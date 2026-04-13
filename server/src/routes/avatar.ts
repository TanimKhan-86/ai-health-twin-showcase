import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate as requireAuth } from '../middleware/auth';
import { Avatar } from '../models/Avatar';
import { AvatarAnimation, StateType } from '../models/AvatarAnimation';
import { generateBaseAvatar, generateStateAnimation } from '../lib/nanobanaService';
import HealthEntry from '../models/HealthEntry';
import MoodEntry from '../models/MoodEntry';
import User from '../models/User';
import { getUtcDayRange } from '../lib/dateUtils';
import { getErrorMessage, sendError, sendSuccess } from '../lib/apiResponse';
import { parseQuery } from '../lib/validation';
import {
    AvatarVideoCandidate,
    chooseAvatarState,
    computeAvatarFingerprint,
    isAvatarBasedAnimation,
    resolveSourceImage,
    resolveAvatarFingerprint,
    safeMetadata,
    SourceImage,
} from '../services/avatarMediaService';
import {
    ensureMediaRefFromValue,
    resolveMediaUrlForClient,
    storeBufferAsMediaRef,
} from '../services/mediaStoreService';

interface AuthRequest extends express.Request {
    userId?: string;
    file?: Express.Multer.File;
}

const router = express.Router();
type AvatarMode = 'prebuilt' | 'nanobana';
const NANO_BANA_STATES: StateType[] = ['happy', 'sad', 'sleepy', 'calm', 'tired'];
const PREBUILT_REQUIRED_STATES: StateType[] = ['happy', 'sad', 'sleepy'];
const PREBUILT_OPTIONAL_STATES: StateType[] = ['calm'];
const PREBUILT_STATES: StateType[] = [...PREBUILT_REQUIRED_STATES, ...PREBUILT_OPTIONAL_STATES];
const AVATAR_MODE: AvatarMode = (() => {
    const raw = (process.env.AVATAR_MODE || 'prebuilt').trim().toLowerCase();
    if (raw === 'nanobana' || raw === 'live') return 'nanobana';
    return 'prebuilt';
})();
const ACTIVE_AVATAR_STATES: StateType[] = AVATAR_MODE === 'nanobana' ? NANO_BANA_STATES : PREBUILT_STATES;
const REQUIRED_READY_STATES: StateType[] = AVATAR_MODE === 'nanobana'
    ? NANO_BANA_STATES
    : PREBUILT_REQUIRED_STATES;
const DAILY_LOG_SOURCE = 'daily_log';
const LEGACY_DAILY_LOG_HEALTH_NOTE_PATTERN = /^Active minutes:/i;
const LEGACY_DAILY_LOG_MOOD_NOTE_PATTERN = /Daily log entry/i;
const avatarStateQuerySchema = z.object({
    state: z.enum(['happy', 'sad', 'sleepy', 'calm', 'tired']).optional(),
    date: z.string().trim().optional(),
    includeMedia: z.union([z.string(), z.boolean()]).optional(),
});

interface AnimationStatusSignal {
    stateType: StateType;
    generationMetadata?: Record<string, unknown>;
}

interface AvatarVideoCacheEntry {
    videoUrl: string;
    cachedAt: number;
}

const AVATAR_VIDEO_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const avatarVideoCache = new Map<string, AvatarVideoCacheEntry>();

function parseIncludeMedia(value: string | boolean | undefined): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return true;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    return true;
}

function buildAvatarCacheKey(userId: string, state: StateType, avatarFingerprint?: string | null): string {
    return `${userId}::${avatarFingerprint || 'no-fingerprint'}::${state}`;
}

function readCachedAvatarVideo(userId: string, state: StateType, avatarFingerprint?: string | null): string | null {
    const key = buildAvatarCacheKey(userId, state, avatarFingerprint);
    const cached = avatarVideoCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.cachedAt > AVATAR_VIDEO_CACHE_TTL_MS) {
        avatarVideoCache.delete(key);
        return null;
    }
    return cached.videoUrl;
}

function writeCachedAvatarVideo(userId: string, state: StateType, videoUrl: string, avatarFingerprint?: string | null): void {
    const key = buildAvatarCacheKey(userId, state, avatarFingerprint);
    avatarVideoCache.set(key, {
        videoUrl,
        cachedAt: Date.now(),
    });
}

async function ensureAvatarImageStored(
    userId: string,
    avatar: { _id?: unknown; avatarImageUrl?: string | null } | null
): Promise<string | null> {
    if (!avatar?.avatarImageUrl) return null;
    const normalized = await ensureMediaRefFromValue(
        avatar.avatarImageUrl,
        { userId, kind: 'avatar-image' },
        'avatar-image'
    );
    if (normalized && normalized !== avatar.avatarImageUrl && avatar._id) {
        await Avatar.updateOne({ _id: avatar._id }, { $set: { avatarImageUrl: normalized } });
        avatar.avatarImageUrl = normalized;
    }
    return normalized ?? null;
}

async function ensureUserProfileImageStored(
    userId: string,
    user: { _id?: unknown; profileImage?: string | null } | null
): Promise<string | null> {
    if (!user?.profileImage) return null;
    const normalized = await ensureMediaRefFromValue(
        user.profileImage,
        { userId, kind: 'profile-image' },
        'profile-image'
    );
    if (normalized && normalized !== user.profileImage && user._id) {
        await User.updateOne({ _id: user._id }, { $set: { profileImage: normalized } });
        user.profileImage = normalized;
    }
    return normalized ?? null;
}

async function ensureAnimationVideoStored(
    userId: string,
    stateType: StateType,
    animation: { _id?: unknown; videoUrl?: string | null } | null
): Promise<string | null> {
    if (!animation?.videoUrl) return null;
    const normalized = await ensureMediaRefFromValue(
        animation.videoUrl,
        { userId, kind: 'avatar-video', stateType },
        `avatar-video-${stateType}`
    );
    if (normalized && normalized !== animation.videoUrl && animation._id) {
        await AvatarAnimation.updateOne({ _id: animation._id }, { $set: { videoUrl: normalized } });
        animation.videoUrl = normalized;
    }
    return normalized ?? null;
}

function isGeneratedForAvatar(
    generationMetadata: unknown,
    avatarFingerprint?: string | null
): boolean {
    const metadata = safeMetadata(generationMetadata);
    const provider = typeof metadata.provider === 'string' ? metadata.provider : '';
    const animationFingerprint = typeof metadata.avatarFingerprint === 'string'
        ? metadata.avatarFingerprint
        : null;

    if (avatarFingerprint) {
        if (animationFingerprint) {
            return animationFingerprint === avatarFingerprint;
        }
        // Prebuilt media can be fingerprintless on older seeded records.
        return AVATAR_MODE === 'prebuilt' && provider.startsWith('prebuilt_');
    }

    return provider === 'nanobana_google'
        || provider === 'nanobana_reused'
        || provider === 'nanobana_surrogate'
        || provider.startsWith('prebuilt_');
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

/**
 * POST /api/avatar/setup
 * 1) user uploads real photo
 * 2) NanoBana stylizes avatar image (when AVATAR_MODE=nanobana)
 * 3) avatar image is saved in DB
 * 4) saved avatar is retrieved from DB
 * 5) NanoBana generates emotional animations
 * 6) each animation is saved in DB
 */
router.post('/setup', requireAuth, upload.single('photo'), async (req: AuthRequest, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendError(res, 401, 'Unauthorized');
            return;
        }
        const user = await User.findById(userId).select('profileImage');
        if (!user) {
            sendError(res, 404, 'User not found');
            return;
        }

        if (AVATAR_MODE === 'prebuilt') {
            if (req.file) {
                user.profileImage = await storeBufferAsMediaRef(
                    req.file.buffer,
                    req.file.mimetype || 'image/jpeg',
                    { userId, kind: 'profile-image' },
                    'profile-image'
                );
                await user.save();
            }

            const [avatar, animations] = await Promise.all([
                Avatar.findOne({ userId }).sort({ updatedAt: -1, createdAt: -1 }),
                AvatarAnimation.find({ userId, stateType: { $in: ACTIVE_AVATAR_STATES } }),
            ]);

            await ensureUserProfileImageStored(userId, user);
            await ensureAvatarImageStored(userId, avatar);
            const avatarFingerprint = resolveAvatarFingerprint(avatar);
            const generatedStates = Array.from(
                new Set(
                    animations
                        .filter(anim => isAvatarBasedAnimation(
                            { videoUrl: anim.videoUrl, generationMetadata: safeMetadata(anim.generationMetadata) },
                            avatarFingerprint
                        ))
                        .map((anim) => anim.stateType)
                )
            );
            const hasAllStates = REQUIRED_READY_STATES.every((state) => generatedStates.includes(state));

            sendSuccess(res, {
                mode: AVATAR_MODE,
                avatarId: avatar?._id ?? null,
                imageUrl: resolveMediaUrlForClient(req, avatar?.avatarImageUrl ?? null),
                profileImage: resolveMediaUrlForClient(req, user.profileImage ?? null),
                generatedStates,
                requiredStates: REQUIRED_READY_STATES,
                pendingStates: REQUIRED_READY_STATES.filter((state) => !generatedStates.includes(state)),
                ready: !!avatar && hasAllStates,
                message: hasAllStates
                    ? 'Prebuilt avatar media is ready. Generation API is disabled in prebuilt mode.'
                    : 'Prebuilt mode is active. Avatar generation API is disabled; seed pre-generated assets for this user.',
            });
            return;
        }

        let sourceImage: SourceImage;
        try {
            sourceImage = await resolveSourceImage(req, user.profileImage);
        } catch {
            sendError(res, 400, 'No photo provided. Upload a photo or set a profile image first.');
            return;
        }

        const { url: avatarUrl, metadata } = await generateBaseAvatar(sourceImage.buffer, sourceImage.mimetype);
        const avatarFingerprint = computeAvatarFingerprint(avatarUrl);
        const normalizedAvatarStorage = await ensureMediaRefFromValue(
            avatarUrl,
            { userId, kind: 'avatar-image' },
            'avatar-image'
        ) || avatarUrl;

        await Avatar.findOneAndUpdate(
            { userId },
            {
                userId,
                avatarImageUrl: normalizedAvatarStorage,
                generationMetadata: {
                    ...metadata,
                    avatarFingerprint,
                    source: sourceImage.source === 'upload' ? 'photo_upload' : 'user_profile_image',
                    statesRequested: ACTIVE_AVATAR_STATES,
                },
            },
            { upsert: true, new: true }
        );

        // Keep visible profile image aligned with generated avatar identity.
        if (user.profileImage !== normalizedAvatarStorage) {
            user.profileImage = normalizedAvatarStorage;
            await user.save();
        }

        // Explicitly read avatar back from DB before animation generation (required flow).
        const savedAvatar = await Avatar.findOne({ userId }).sort({ updatedAt: -1, createdAt: -1 });
        if (!savedAvatar?.avatarImageUrl) {
            sendError(res, 500, 'Avatar saved but could not be reloaded from DB');
            return;
        }

        // Generate state videos sequentially to reduce provider rate-limit failures.
        const generatedAnimations: Array<{
            state: StateType;
            videoUrl: string;
            duration: number;
            loopOptimized: boolean;
            circularOptimized: boolean;
        }> = [];

        // Seed fallback pool from prior avatar-based animations (never stock sample videos).
        const existingAnimations = await AvatarAnimation.find({ userId, stateType: { $in: ACTIVE_AVATAR_STATES } });
        const avatarVideoPool: AvatarVideoCandidate[] = existingAnimations
            .filter(anim => isAvatarBasedAnimation(
                { videoUrl: anim.videoUrl, generationMetadata: safeMetadata(anim.generationMetadata) },
                avatarFingerprint
            ))
            .map(anim => ({
                state: anim.stateType,
                videoUrl: anim.videoUrl,
                duration: anim.duration ?? 8,
                quality: anim.quality === 'standard' ? 'standard' : 'high',
                loopOptimized: anim.loopOptimized ?? true,
                circularOptimized: anim.circularOptimized ?? true,
                metadata: safeMetadata(anim.generationMetadata),
            }));

        for (const state of ACTIVE_AVATAR_STATES) {
            let candidate: AvatarVideoCandidate;
            try {
                const animation = await generateStateAnimation(avatarUrl, state);
                const normalizedVideoStorage = await ensureMediaRefFromValue(
                    animation.url,
                    { userId, kind: 'avatar-video', stateType: state },
                    `avatar-video-${state}`
                ) || animation.url;
                candidate = {
                    state,
                    videoUrl: normalizedVideoStorage,
                    duration: animation.duration,
                    quality: animation.quality,
                    loopOptimized: animation.loopOptimized,
                    circularOptimized: animation.circularOptimized,
                    metadata: {
                        ...animation.metadata,
                        avatarFingerprint,
                    },
                };
            } catch (error: unknown) {
                const reason = getErrorMessage(error, `Failed generating ${state}`);
                console.warn(`[Avatar setup] ${state} generation failed, reusing avatar-based animation: ${reason}`);

                const sameState = avatarVideoPool.find(item => item.state === state);
                const surrogate = sameState || avatarVideoPool[0];

                if (!surrogate) {
                    throw new Error(`Could not generate avatar animation for "${state}" and no avatar-based video is available`);
                }

                candidate = {
                    state,
                    videoUrl: surrogate.videoUrl,
                    duration: surrogate.duration,
                    quality: surrogate.quality,
                    loopOptimized: surrogate.loopOptimized,
                    circularOptimized: surrogate.circularOptimized,
                    metadata: {
                        ...surrogate.metadata,
                        provider: sameState ? 'nanobana_reused' : 'nanobana_surrogate',
                        sourceState: surrogate.state,
                        failedState: state,
                        avatarFingerprint,
                        reason,
                        generatedAt: new Date().toISOString(),
                    },
                };
            }

            await AvatarAnimation.findOneAndUpdate(
                { userId, stateType: state },
                {
                    userId,
                    stateType: state,
                    videoUrl: candidate.videoUrl,
                    duration: candidate.duration,
                    quality: candidate.quality,
                    loopOptimized: candidate.loopOptimized,
                    circularOptimized: candidate.circularOptimized,
                    generationMetadata: candidate.metadata,
                },
                { upsert: true, new: true, runValidators: true }
            );

            generatedAnimations.push({
                state,
                videoUrl: candidate.videoUrl,
                duration: candidate.duration,
                loopOptimized: candidate.loopOptimized,
                circularOptimized: candidate.circularOptimized,
            });

            if (isAvatarBasedAnimation({ videoUrl: candidate.videoUrl, generationMetadata: candidate.metadata }, avatarFingerprint)) {
                avatarVideoPool.push(candidate);
            }
        }

        // Clean up old non-supported states from previous versions (e.g. neutral).
        await AvatarAnimation.deleteMany({
            userId,
            stateType: { $nin: ACTIVE_AVATAR_STATES },
        });

        await Promise.all([
            ensureAvatarImageStored(userId, savedAvatar),
            ensureUserProfileImageStored(userId, user),
        ]);

        const responseAnimations = generatedAnimations.map((animation) => ({
            ...animation,
            videoUrl: resolveMediaUrlForClient(req, animation.videoUrl),
        }));

        sendSuccess(res, {
            avatarId: savedAvatar._id,
            imageUrl: resolveMediaUrlForClient(req, savedAvatar.avatarImageUrl),
            profileImage: resolveMediaUrlForClient(req, user.profileImage ?? null),
            stylePreset: savedAvatar.generationMetadata?.stylePreset || 'health_twin_demo_style_v1',
            mode: AVATAR_MODE,
            requiredStates: ACTIVE_AVATAR_STATES,
            animations: responseAnimations,
            message: 'Avatar and all emotional loop animations were generated and stored.',
        });
        return;
    } catch (error) {
        console.error('Avatar setup error:', error);
        sendError(res, 500, `Failed to process avatar generation: ${getErrorMessage(error)}`);
        return;
    }
});

/**
 * GET /api/avatar/state
 * Returns exactly one loopable animation URL selected dynamically from daily metrics.
 */
router.get('/state', requireAuth, async (req: AuthRequest, res) => {
    const query = parseQuery(res, avatarStateQuerySchema, req.query);
    if (!query) return;

    try {
        const userId = req.userId;
        if (!userId) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

        const { start: todayStartUtc, end: tomorrowStartUtc } = getUtcDayRange(query.date);

        const requestedStateRaw = query.state ?? null;
        const includeMedia = parseIncludeMedia(query.includeMedia);
        const requestedState = requestedStateRaw && ACTIVE_AVATAR_STATES.includes(requestedStateRaw as StateType)
            ? (requestedStateRaw as StateType)
            : null;

        const [avatar, animationSignals, health, mood] = await Promise.all([
            Avatar.findOne({ userId })
                .sort({ updatedAt: -1, createdAt: -1 })
                .select('avatarImageUrl generationMetadata')
                .lean<{ avatarImageUrl?: string; generationMetadata?: Record<string, unknown> } | null>(),
            AvatarAnimation.find({ userId, stateType: { $in: ACTIVE_AVATAR_STATES } })
                .select('stateType generationMetadata')
                .lean<AnimationStatusSignal[]>(),
            HealthEntry.findOne({
                userId,
                date: { $gte: todayStartUtc, $lt: tomorrowStartUtc },
                $or: [
                    { source: DAILY_LOG_SOURCE },
                    { source: { $exists: false }, notes: LEGACY_DAILY_LOG_HEALTH_NOTE_PATTERN },
                    { source: null, notes: LEGACY_DAILY_LOG_HEALTH_NOTE_PATTERN },
                ],
            })
                .sort({ updatedAt: -1, createdAt: -1 })
                .lean(),
            MoodEntry.findOne({
                userId,
                date: { $gte: todayStartUtc, $lt: tomorrowStartUtc },
                $or: [
                    { source: DAILY_LOG_SOURCE },
                    { source: { $exists: false }, notes: LEGACY_DAILY_LOG_MOOD_NOTE_PATTERN },
                    { source: null, notes: LEGACY_DAILY_LOG_MOOD_NOTE_PATTERN },
                ],
            })
                .sort({ updatedAt: -1, createdAt: -1 })
                .lean(),
        ]);

        if (!avatar && animationSignals.length === 0) {
            sendError(res, 404, 'No avatar setup found. Please complete setup.');
            return;
        }

        await ensureAvatarImageStored(userId, avatar);
        const avatarFingerprint = resolveAvatarFingerprint(avatar);
        const generatedStates = Array.from(
            new Set(
                animationSignals
                    .filter(anim => isGeneratedForAvatar(anim.generationMetadata, avatarFingerprint))
                    .map((anim) => anim.stateType)
            )
        );
        const generatedStateSet = new Set(generatedStates);

        if (!requestedState && !health && !mood) {
            sendError(res, 404, 'No Daily Log vitals found for this date. Log Daily Vitals first.');
            return;
        }

        const { state: inferredState, reasoning } = chooseAvatarState(health, mood, ACTIVE_AVATAR_STATES);
        const preferredCandidates: Array<StateType | null> = [
            requestedState,
            inferredState,
            'happy',
            'calm',
            'sad',
            'sleepy',
            'tired',
        ];
        const preferredStates = Array.from(
            new Set<StateType>(
                preferredCandidates.filter(
                    (value): value is StateType => !!value && ACTIVE_AVATAR_STATES.includes(value)
                )
            )
        );

        let resolvedState = preferredStates.find((state) => generatedStateSet.has(state))
            || generatedStates[0]
            || inferredState;

        let fallbackVideo: string | null = null;
        if (includeMedia && resolvedState && generatedStateSet.has(resolvedState)) {
            fallbackVideo = readCachedAvatarVideo(userId, resolvedState, avatarFingerprint);
            if (!fallbackVideo) {
                const selected = await AvatarAnimation.findOne({ userId, stateType: resolvedState })
                    .select('videoUrl')
                    .lean<{ _id?: unknown; videoUrl?: string } | null>();
                fallbackVideo = await ensureAnimationVideoStored(userId, resolvedState, selected) || null;
                if (fallbackVideo) {
                    writeCachedAvatarVideo(userId, resolvedState, fallbackVideo, avatarFingerprint);
                }
            }
        }

        if (includeMedia && !fallbackVideo && generatedStates.length > 0) {
            for (const state of generatedStates) {
                const cached = readCachedAvatarVideo(userId, state, avatarFingerprint);
                if (cached) {
                    fallbackVideo = cached;
                    resolvedState = state;
                    break;
                }
            }
            if (!fallbackVideo) {
                const fallbackAnim = await AvatarAnimation.findOne({ userId, stateType: { $in: generatedStates } })
                    .sort({ stateType: 1 })
                    .select('stateType videoUrl')
                    .lean<{ _id?: unknown; stateType?: StateType; videoUrl?: string } | null>();
                if (fallbackAnim?.videoUrl && fallbackAnim.stateType) {
                    const normalized = await ensureAnimationVideoStored(userId, fallbackAnim.stateType, fallbackAnim);
                    fallbackVideo = normalized;
                    if (fallbackAnim.stateType) {
                        resolvedState = fallbackAnim.stateType;
                        if (normalized) {
                            writeCachedAvatarVideo(userId, fallbackAnim.stateType, normalized, avatarFingerprint);
                        }
                    }
                }
            }
        }
        const resolvedReasoning = requestedState
            ? `Client preview requested "${requestedState}" state`
            : reasoning;

        if (includeMedia) {
            if (!fallbackVideo && !avatar?.avatarImageUrl) {
                sendError(res, 404, 'No avatar media available yet');
                return;
            }
        } else if (generatedStates.length === 0 && !avatar?.avatarImageUrl) {
            sendError(res, 404, 'No avatar media available yet');
            return;
        }

        const compactVideoByState = includeMedia && fallbackVideo
            ? { [resolvedState]: resolveMediaUrlForClient(req, fallbackVideo) || fallbackVideo } as Record<string, string>
            : {};

        sendSuccess(res, {
            state: resolvedState,
            videoUrl: includeMedia ? (resolveMediaUrlForClient(req, fallbackVideo) || fallbackVideo) : null,
            videoByState: compactVideoByState,
            imageUrl: resolveMediaUrlForClient(req, avatar?.avatarImageUrl ?? null),
            avatarFingerprint,
            reasoning: resolvedReasoning,
            mode: AVATAR_MODE,
            requiredStates: ACTIVE_AVATAR_STATES,
            availableStates: generatedStates,
        });
        return;
    } catch (error) {
        console.error('Avatar state fetch error:', error);
        sendError(res, 500, `Failed to fetch avatar state: ${getErrorMessage(error)}`);
        return;
    }
});

/**
 * GET /api/avatar/status
 * Returns setup status + generation progress for the required emotional states.
 */
router.get('/status', requireAuth, async (req: AuthRequest, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

        const [avatar, animationSignals] = await Promise.all([
            Avatar.findOne({ userId })
                .sort({ updatedAt: -1, createdAt: -1 })
                .select('avatarImageUrl generationMetadata')
                .lean<{ _id?: unknown; avatarImageUrl?: string; generationMetadata?: Record<string, unknown> } | null>(),
            AvatarAnimation.find({ userId, stateType: { $in: ACTIVE_AVATAR_STATES } })
                .select('stateType generationMetadata')
                .lean<AnimationStatusSignal[]>(),
        ]);

        await ensureAvatarImageStored(userId, avatar);
        const avatarFingerprint = resolveAvatarFingerprint(avatar);
        const generatedStates = Array.from(
            new Set(
                animationSignals
                    .filter(anim => isGeneratedForAvatar(anim.generationMetadata, avatarFingerprint))
                    .map((a) => a.stateType)
            )
        );
        const hasAllStates = REQUIRED_READY_STATES.every((state) => generatedStates.includes(state));

        sendSuccess(res, {
            hasAvatar: !!avatar,
            avatarUrl: resolveMediaUrlForClient(req, avatar?.avatarImageUrl),
            avatarFingerprint,
            stylePreset: avatar?.generationMetadata?.stylePreset || 'health_twin_demo_style_v1',
            mode: AVATAR_MODE,
            requiredStates: REQUIRED_READY_STATES,
            generatedStates,
            pendingStates: REQUIRED_READY_STATES.filter((state) => !generatedStates.includes(state)),
            ready: !!avatar && hasAllStates,
        });
        return;
    } catch (error) {
        sendError(res, 500, `Failed to fetch status: ${getErrorMessage(error)}`);
        return;
    }
});

/**
 * GET /api/avatar/library
 * Returns avatar image + per-state animation URLs for client-driven previews
 * (e.g., Scenario Explorer simulation state preview).
 */
router.get('/library', requireAuth, async (req: AuthRequest, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

        const [avatar, animations] = await Promise.all([
            Avatar.findOne({ userId })
                .sort({ updatedAt: -1, createdAt: -1 })
                .select('avatarImageUrl generationMetadata')
                .lean<{ _id?: unknown; avatarImageUrl?: string; generationMetadata?: Record<string, unknown> } | null>(),
            AvatarAnimation.find({ userId, stateType: { $in: ACTIVE_AVATAR_STATES } })
                .select('stateType videoUrl generationMetadata')
                .lean<Array<{ _id?: unknown; stateType: StateType; videoUrl?: string; generationMetadata?: unknown }>>(),
        ]);

        if (!avatar && animations.length === 0) {
            sendError(res, 404, 'No avatar media found. Please complete setup.');
            return;
        }

        await ensureAvatarImageStored(userId, avatar);
        const avatarFingerprint = resolveAvatarFingerprint(avatar);

        const usableAnimations: Array<{ stateType: StateType; videoUrl: string }> = [];
        for (const anim of animations) {
            const normalizedVideo = await ensureAnimationVideoStored(userId, anim.stateType, anim);
            if (!normalizedVideo) continue;
            if (!isAvatarBasedAnimation(
                { videoUrl: normalizedVideo, generationMetadata: safeMetadata(anim.generationMetadata) },
                avatarFingerprint
            )) {
                continue;
            }
            writeCachedAvatarVideo(userId, anim.stateType, normalizedVideo, avatarFingerprint);
            usableAnimations.push({ stateType: anim.stateType, videoUrl: normalizedVideo });
        }

        const videoByState = usableAnimations.reduce((acc, anim) => {
            const resolved = resolveMediaUrlForClient(req, anim.videoUrl) || anim.videoUrl;
            acc[anim.stateType] = resolved;
            return acc;
        }, {} as Record<StateType, string>);

        sendSuccess(res, {
            mode: AVATAR_MODE,
            requiredStates: ACTIVE_AVATAR_STATES,
            imageUrl: resolveMediaUrlForClient(req, avatar?.avatarImageUrl ?? null),
            videoByState,
            availableStates: Object.keys(videoByState) as StateType[],
        });
        return;
    } catch (error) {
        console.error('Avatar library fetch error:', error);
        sendError(res, 500, `Failed to fetch avatar library: ${getErrorMessage(error)}`);
        return;
    }
});

export default router;
