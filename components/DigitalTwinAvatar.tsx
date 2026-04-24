import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, ActivityIndicator, Platform, Image, StyleSheet } from "react-native";
import { Video, ResizeMode, InterruptionModeAndroid, InterruptionModeIOS, Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { apiFetch } from "../lib/api/client";
import { HealthEntry, MoodEntry } from "../lib/api/auth";
import { getLocalDateYmd } from "../lib/date/localDay";
import { useAuth } from "../contexts/AuthContext";

interface AvatarStatePayload {
    state: string;
    videoUrl?: string;
    videoByState?: Record<string, string>;
    availableStates?: string[];
    imageUrl?: string | null;
    reasoning?: string;
}

interface AvatarStatusPayload {
    hasAvatar?: boolean;
    ready?: boolean;
    pendingStates?: string[];
    avatarUrl?: string | null;
}

type UnavailableReason = 'setup_required' | 'seed_required' | 'no_logs' | 'media_unavailable';

type AuraPreset = {
    ringColors: [string, string];
    glowColor: string;
    frameBg: string;
};

const AURA_PRESETS: Record<string, AuraPreset> = {
    happy: {
        ringColors: ['#fbbf24', '#f97316'], // warm
        glowColor: 'rgba(251, 191, 36, 0.30)',
        frameBg: '#fff7ed',
    },
    sad: {
        ringColors: ['#67e8f9', '#2563eb'], // cool
        glowColor: 'rgba(59, 130, 246, 0.28)',
        frameBg: '#eff6ff',
    },
    sleepy: {
        ringColors: ['#8b5cf6', '#4f46e5'], // indigo
        glowColor: 'rgba(99, 102, 241, 0.30)',
        frameBg: '#eef2ff',
    },
    calm: {
        ringColors: ['#34d399', '#0ea5a4'], // mint/teal
        glowColor: 'rgba(16, 185, 129, 0.26)',
        frameBg: '#ecfeff',
    },
    stressed: {
        ringColors: ['#f59e0b', '#ef4444'], // amber/red
        glowColor: 'rgba(239, 68, 68, 0.24)',
        frameBg: '#fff7ed',
    },
    default: {
        ringColors: ['#a78bfa', '#7c3aed'],
        glowColor: 'rgba(124, 58, 237, 0.22)',
        frameBg: '#ede9fe',
    },
};

function getAuraPresetForState(rawState: string | null): AuraPreset {
    const state = (rawState || '').toLowerCase();
    if (state === 'happy') return AURA_PRESETS.happy;
    if (state === 'sad') return AURA_PRESETS.sad;
    if (state === 'sleepy') return AURA_PRESETS.sleepy;
    if (state === 'calm') return AURA_PRESETS.calm;
    if (state === 'stressed' || state === 'tired') return AURA_PRESETS.stressed;
    return AURA_PRESETS.default;
}

interface DigitalTwinAvatarProps {
    showStateLabel?: boolean;
    presentation?: 'card' | 'bare';
}

function getStateLabel(rawState: string | null): string | null {
    const state = (rawState || '').toLowerCase();
    if (!state) return null;
    if (state === 'happy') return 'Happy';
    if (state === 'sad') return 'Sad';
    if (state === 'sleepy') return 'Sleepy';
    if (state === 'calm') return 'Calm';
    if (state === 'tired') return 'Sleepy';
    if (state === 'stressed') return 'Stressed';
    return state.charAt(0).toUpperCase() + state.slice(1);
}

export function DigitalTwinAvatar({ showStateLabel = false, presentation = 'card' }: DigitalTwinAvatarProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [avatarState, setAvatarState] = useState<string | null>(null);
    const [videoFailed, setVideoFailed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [unavailableReason, setUnavailableReason] = useState<UnavailableReason | null>(null);
    const [unavailableDetail, setUnavailableDetail] = useState<string | null>(null);
    const hasLoadedRef = useRef(false);
    const videoCacheRef = useRef<Record<string, string>>({});
    const prefetchingStatesRef = useRef<Set<string>>(new Set());
    const activeUserIdRef = useRef<string | null>(null);
    const webVideoRef = useRef<any>(null);

    useEffect(() => {
        // Audio API is native-only — skip on web to prevent crash
        if (Platform.OS !== 'web') {
            Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                staysActiveInBackground: false,
                interruptionModeIOS: InterruptionModeIOS.DoNotMix,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
                playThroughEarpieceAndroid: false,
            });
        }
    }, []);

    useEffect(() => {
        const nextUserId = user?.id ?? null;
        if (activeUserIdRef.current === nextUserId) return;
        activeUserIdRef.current = nextUserId;

        // Prevent avatar/media bleed when account changes in the same app session.
        hasLoadedRef.current = false;
        videoCacheRef.current = {};
        prefetchingStatesRef.current.clear();
        setLoading(true);
        setVideoUrl(null);
        setImageUrl(null);
        setAvatarState(null);
        setVideoFailed(false);
        setError(null);
        setUnavailableReason(null);
        setUnavailableDetail(null);
    }, [user?.id]);

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const status = await apiFetch<AvatarStatusPayload>('/api/avatar/status');
                if (!isMounted || !status.success) return;
                const statusImage = status.data?.avatarUrl ?? null;
                if (statusImage) {
                    setImageUrl(prev => prev || statusImage);
                }
            } catch {
                // Best-effort prefetch only.
            }
        })();
        return () => {
            isMounted = false;
        };
    }, []);

    const normalizeState = useCallback((state: string | null | undefined): string | null => {
        if (!state) return null;
        const normalized = state.trim().toLowerCase();
        return normalized.length ? normalized : null;
    }, []);

    const cacheMediaFromPayload = useCallback((payload?: AvatarStatePayload | null): void => {
        if (!payload) return;
        const stateFromPayload = normalizeState(payload.state);
        if (stateFromPayload && payload.videoUrl) {
            videoCacheRef.current[stateFromPayload] = payload.videoUrl;
        }
        if (payload.videoByState) {
            Object.entries(payload.videoByState).forEach(([rawState, url]) => {
                const state = normalizeState(rawState);
                if (!state || typeof url !== 'string' || !url) return;
                videoCacheRef.current[state] = url;
            });
        }
    }, [normalizeState]);

    const warmStateVideo = useCallback(async (dayKey: string, state: string): Promise<void> => {
        const normalized = normalizeState(state);
        if (!normalized) return;
        if (videoCacheRef.current[normalized]) return;
        if (prefetchingStatesRef.current.has(normalized)) return;

        prefetchingStatesRef.current.add(normalized);
        try {
            const response = await apiFetch<AvatarStatePayload>(
                `/api/avatar/state?date=${encodeURIComponent(dayKey)}&state=${encodeURIComponent(normalized)}&includeMedia=true`,
                { timeoutMs: 45_000 }
            );
            if (!response.success) return;
            cacheMediaFromPayload(response.data);
        } catch {
            // Best-effort prefetch only.
        } finally {
            prefetchingStatesRef.current.delete(normalized);
        }
    }, [cacheMediaFromPayload, normalizeState]);

    const prefetchMissingStateVideos = useCallback((dayKey: string, rawStates?: string[], currentState?: string | null): void => {
        if (!Array.isArray(rawStates) || rawStates.length === 0) return;
        const normalizedCurrent = normalizeState(currentState);
        const queue = rawStates
            .map((state) => normalizeState(state))
            .filter((state): state is string => !!state)
            .filter((state) => state !== normalizedCurrent)
            .filter((state) => !videoCacheRef.current[state])
            .filter((state) => !prefetchingStatesRef.current.has(state));
        if (queue.length === 0) return;

        void (async () => {
            for (const state of queue) {
                await warmStateVideo(dayKey, state);
            }
        })();
    }, [normalizeState, warmStateVideo]);

    const resolveUnavailableReason = useCallback(async (sourceMessage?: string): Promise<{ reason: UnavailableReason; detail: string }> => {
        const lowered = (sourceMessage || '').toLowerCase();
        if (lowered.includes('no avatar setup')) {
            return {
                reason: 'setup_required',
                detail: 'Open Settings > Digital Twin Setup to generate avatar media.',
            };
        }
        if (lowered.includes('no daily log vitals')) {
            return {
                reason: 'no_logs',
                detail: 'No Daily Log Vitals found for today. Log Daily Vitals first.',
            };
        }

        try {
            const dayKey = getLocalDateYmd();
            const [statusRes, todayHealthRes, todayMoodRes] = await Promise.all([
                apiFetch<AvatarStatusPayload>('/api/avatar/status'),
                apiFetch<HealthEntry | null>(`/api/health/today?date=${encodeURIComponent(dayKey)}`),
                apiFetch<MoodEntry | null>(`/api/mood/today?date=${encodeURIComponent(dayKey)}`),
            ]);

            const hasAvatar = !!(statusRes.success && statusRes.data?.hasAvatar);
            const ready = !!(statusRes.success && statusRes.data?.ready);
            const pendingStates = statusRes.success && Array.isArray(statusRes.data?.pendingStates)
                ? statusRes.data.pendingStates
                : [];
            const hasTodayLogs = !!(todayHealthRes.success && todayHealthRes.data)
                || !!(todayMoodRes.success && todayMoodRes.data);

            if (!hasAvatar) {
                return {
                    reason: 'setup_required',
                    detail: 'Open Settings > Digital Twin Setup to generate avatar media.',
                };
            }

            if (!hasTodayLogs) {
                return {
                    reason: 'no_logs',
                    detail: 'No logs for today yet. Log Daily Vitals first.',
                };
            }

            if (!ready) {
                const missingStates = pendingStates.length ? ` Missing states: ${pendingStates.join(', ')}.` : '';
                return {
                    reason: 'seed_required',
                    detail: `Avatar setup is incomplete.${missingStates} Re-run Digital Twin Setup.`,
                };
            }
        } catch {
            // Fall through to generic message.
        }

        return {
            reason: 'media_unavailable',
            detail: 'Avatar media is temporarily unavailable. Refresh or re-run setup.',
        };
    }, []);

    const fetchState = useCallback(async () => {
        try {
            if (!hasLoadedRef.current) setLoading(true);
            setError(null);
            setUnavailableReason(null);
            setUnavailableDetail(null);
            const dayKey = getLocalDateYmd();

            const stateOnly = await apiFetch<AvatarStatePayload>(
                `/api/avatar/state?date=${encodeURIComponent(dayKey)}&includeMedia=false`,
                { timeoutMs: 12_000 }
            );

            if (!stateOnly.success) {
                const unavailable = await resolveUnavailableReason(stateOnly.error);
                setUnavailableReason(unavailable.reason);
                setUnavailableDetail(unavailable.detail);
                throw new Error(stateOnly.error);
            }
            const nextState = normalizeState(stateOnly.data?.state);
            const nextImage = stateOnly.data?.imageUrl ?? null;
            setAvatarState(nextState);
            if (nextImage) {
                setImageUrl(nextImage);
            }
            prefetchMissingStateVideos(dayKey, stateOnly.data?.availableStates, nextState);

            const cachedVideo = nextState ? videoCacheRef.current[nextState] ?? null : null;
            if (cachedVideo) {
                setVideoUrl(prev => (prev === cachedVideo ? prev : cachedVideo));
                setVideoFailed(false);
                return;
            }

            const requestedStateSegment = nextState ? `&state=${encodeURIComponent(nextState)}` : '';
            const mediaRes = await apiFetch<AvatarStatePayload>(
                `/api/avatar/state?date=${encodeURIComponent(dayKey)}${requestedStateSegment}&includeMedia=true`,
                { timeoutMs: 45_000 }
            );

            if (!mediaRes.success) {
                const unavailable = await resolveUnavailableReason(mediaRes.error);
                setUnavailableReason(unavailable.reason);
                setUnavailableDetail(unavailable.detail);
                throw new Error(mediaRes.error);
            }

            cacheMediaFromPayload(mediaRes.data);
            prefetchMissingStateVideos(dayKey, mediaRes.data?.availableStates, nextState);
            const resolvedState = normalizeState(mediaRes.data?.state) ?? nextState;
            const resolvedVideo = resolvedState ? videoCacheRef.current[resolvedState] ?? null : null;
            if (resolvedState) {
                setAvatarState(resolvedState);
            }
            if (resolvedVideo) {
                setVideoUrl(prev => (prev === resolvedVideo ? prev : resolvedVideo));
                setVideoFailed(false);
                return;
            }

            setVideoUrl(null);
            const unavailable = await resolveUnavailableReason('No avatar video available');
            setUnavailableReason(unavailable.reason);
            setUnavailableDetail(unavailable.detail);
            if (!nextImage && !mediaRes.data?.imageUrl) {
                throw new Error('No avatar media available yet');
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to load avatar';
            setError(message);
        } finally {
            if (!hasLoadedRef.current) {
                setLoading(false);
                hasLoadedRef.current = true;
            }
        }
    }, [cacheMediaFromPayload, normalizeState, resolveUnavailableReason, user?.id]);

    useEffect(() => {
        fetchState();
        // Poll frequently so post-log state changes appear quickly.
        const interval = setInterval(fetchState, 15000);
        return () => clearInterval(interval);
    }, [fetchState]);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!videoUrl || videoFailed) return;
        const node = webVideoRef.current;
        if (!node || typeof node.play !== 'function') return;

        node.muted = true;
        node.defaultMuted = true;
        node.playsInline = true;

        const tryPlay = () => {
            try {
                const maybePromise = node.play();
                if (maybePromise && typeof maybePromise.catch === 'function') {
                    maybePromise.catch(() => {
                        // Keep the element mounted; some browsers need another readiness event.
                    });
                }
            } catch {
                // Ignore autoplay timing issues and let later readiness events retry.
            }
        };

        if (typeof node.readyState === 'number' && node.readyState >= 2) {
            tryPlay();
            return;
        }

        const handleCanPlay = () => {
            tryPlay();
        };

        node.addEventListener('canplay', handleCanPlay);
        return () => {
            node.removeEventListener('canplay', handleCanPlay);
        };
    }, [videoUrl, videoFailed]);

    const isBare = presentation === 'bare';
    const renderGlassCard = (children: React.ReactNode) => (
        <View style={[styles.root, isBare && styles.rootBare]}>
            {isBare ? (
                <View style={[styles.glassCard, styles.glassCardBare]}>
                    {children}
                </View>
            ) : (
                <LinearGradient
                    colors={['rgba(255,255,255,0.78)', 'rgba(255,255,255,0.56)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.glassCard}
                >
                    <View style={styles.glassSheen} />
                    {children}
                </LinearGradient>
            )}
        </View>
    );

    if (loading && !videoUrl && !imageUrl) {
        return renderGlassCard(
            <View className="items-center justify-center p-8">
                <ActivityIndicator size="small" color="#7c3aed" />
            </View>
        );
    }

    const unavailableTitle = unavailableReason === 'setup_required'
        ? 'Avatar setup required'
        : unavailableReason === 'seed_required'
            ? 'Avatar media incomplete'
            : unavailableReason === 'no_logs'
                ? 'No daily logs yet'
                : unavailableReason === 'media_unavailable'
                    ? 'Avatar unavailable'
                    : null;
    const auraPreset = getAuraPresetForState(avatarState);
    const stateLabel = getStateLabel(avatarState);

    if (unavailableReason && !videoUrl && !imageUrl) {
        return renderGlassCard(
            <View className="items-center justify-center p-8">
                <View style={styles.auraLayer}>
                    <View className="h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
                </View>
                <View className="h-40 w-40 items-center justify-center rounded-full bg-gradient-to-tr from-purple-100 to-indigo-50 shadow-lg border-4 border-white/40 border-dashed">
                    <Text className="text-center font-bold text-indigo-500 text-sm px-4">{unavailableTitle}</Text>
                </View>
                <Text className="mt-3 text-center text-xs font-semibold text-slate-500 px-8">
                    {unavailableDetail || 'Avatar media is not ready yet.'}
                </Text>
            </View>
        );
    }

    return renderGlassCard(
        <View className="items-center justify-center p-8">
            {/* Aura Effect */}
            <View style={styles.auraLayer}>
                <View style={[styles.auraGlow, { backgroundColor: auraPreset.glowColor }]} />
            </View>

            <View className="items-center justify-center">
                <LinearGradient
                    colors={auraPreset.ringColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.auraRing}
                >
                    {/* The dynamic video frame */}
                    <View style={[styles.videoFrame, { backgroundColor: auraPreset.frameBg }]}>
                        {videoUrl && !videoFailed ? (Platform.OS === 'web' ? (
                            <video
                                key={videoUrl}
                                ref={(node) => {
                                    webVideoRef.current = node;
                                }}
                                src={videoUrl}
                                autoPlay
                                loop
                                muted
                                playsInline
                                preload="auto"
                                crossOrigin="anonymous"
                                onError={() => setVideoFailed(true)}
                                onLoadedData={() => {
                                    setVideoFailed(false);
                                    const node = webVideoRef.current;
                                    if (node && typeof node.play === 'function') {
                                        const maybePromise = node.play();
                                        if (maybePromise && typeof maybePromise.catch === 'function') {
                                            maybePromise.catch(() => undefined);
                                        }
                                    }
                                }}
                                onCanPlay={() => {
                                    const node = webVideoRef.current;
                                    if (node && typeof node.play === 'function') {
                                        const maybePromise = node.play();
                                        if (maybePromise && typeof maybePromise.catch === 'function') {
                                            maybePromise.catch(() => undefined);
                                        }
                                    }
                                }}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
                            />
                        ) : (
                            <Video
                                key={videoUrl}
                                source={{ uri: videoUrl }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode={ResizeMode.COVER}
                                isMuted={true}
                                shouldPlay={true}
                                isLooping={true}
                                onLoad={() => setVideoFailed(false)}
                                onError={() => setVideoFailed(true)}
                            />
                        )) : imageUrl ? (
                            <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                            <Text className="text-indigo-400 text-xs font-semibold px-4 text-center">Avatar loading...</Text>
                        )}
                    </View>
                </LinearGradient>
                {showStateLabel && stateLabel && (
                    <Text style={styles.stateLabelText}>
                        {stateLabel}
                    </Text>
                )}
                {error && !unavailableReason && (
                    <Text className="mt-3 text-center text-xs font-semibold text-rose-500 px-6">
                        {error}
                    </Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    rootBare: {
        paddingHorizontal: 0,
        paddingVertical: 0,
        width: '100%',
    },
    glassCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.58)',
        overflow: 'hidden',
        shadowColor: '#1f2937',
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 7,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    glassCardBare: {
        maxWidth: 380,
        borderRadius: 0,
        borderWidth: 0,
        backgroundColor: 'transparent',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
        overflow: 'visible',
    },
    glassSheen: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '45%',
        backgroundColor: 'rgba(255,255,255,0.22)',
    },
    auraLayer: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    auraGlow: {
        height: 256,
        width: 256,
        borderRadius: 128,
    },
    auraRing: {
        height: 170,
        width: 170,
        borderRadius: 85,
        padding: 4,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#111827',
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    videoFrame: {
        height: 162,
        width: 162,
        borderRadius: 81,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#ffffff',
    },
    stateLabelText: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: '700',
        color: '#4338ca',
        textAlign: 'center',
    },
});
