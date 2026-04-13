import axios from 'axios';
import crypto from 'crypto';
import { StateType } from '../models/AvatarAnimation';

const GOOGLE_GENAI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const NANO_BANA_API_KEY = process.env.NANO_BANA_API_KEY || process.env.GEMINI_API_KEY || '';
const NANO_BANA_STYLE_PRESET = process.env.NANO_BANA_STYLE_PRESET || 'health_twin_demo_style_v1';
const NANO_BANA_VIDEO_MODEL = process.env.NANO_BANA_VIDEO_MODEL || 'veo-2.0-generate-001';
const NANO_BANA_STYLE_REFERENCE_DATA_URI = process.env.NANO_BANA_STYLE_REFERENCE_DATA_URI || '';
const VIDEO_POLL_INTERVAL_MS = 8000;
const VIDEO_POLL_TIMEOUT_MS = 8 * 60 * 1000;
const VIDEO_DURATION_SECONDS = Number(process.env.NANO_BANA_VIDEO_DURATION_SECONDS || 8);

const DEMO_AVATAR_STYLE_INSTRUCTION = [
    'Use a premium semi-realistic 2D illustrated avatar style.',
    'Crisp facial linework, soft gradient skin shading, expressive natural eyes, and clean contouring.',
    'Preserve the user identity exactly: face shape, eye spacing, nose, lips, hairstyle, hair color, and outfit colors.',
    'Keep chest-up composition, centered framing, simple neutral background, and polished app-ready finish.',
    'Do not produce random/cartoonish replacements; this must look like a stylized version of the real person.',
].join(' ');

interface InlineImageData {
    mimeType: string;
    data: string;
    source: 'data_uri' | 'remote_url';
}

function fallbackAvatarUrlFromImage(imageBuffer: Buffer): string {
    const seed = crypto.createHash('sha1').update(imageBuffer).digest('hex').slice(0, 16);
    return `https://api.dicebear.com/9.x/personas/png?seed=${seed}&size=512&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

function firstString(...values: Array<unknown>): string | null {
    for (const value of values) {
        if (typeof value === 'string' && value.trim().length > 0) {
            return value;
        }
    }
    return null;
}

function normalizeMimeType(value: string | null): string {
    if (!value) return 'image/png';
    const normalized = value.split(';')[0]?.trim();
    return normalized || 'image/png';
}

function parseImageDataUri(dataUri: string): InlineImageData | null {
    const match = dataUri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;
    return {
        mimeType: normalizeMimeType(match[1]),
        data: match[2],
        source: 'data_uri',
    };
}

function resolveStyleReferenceImage(): InlineImageData | null {
    if (!NANO_BANA_STYLE_REFERENCE_DATA_URI) return null;
    return parseImageDataUri(NANO_BANA_STYLE_REFERENCE_DATA_URI);
}

async function resolveAvatarImage(baseAvatarUrl: string): Promise<InlineImageData> {
    const parsed = parseImageDataUri(baseAvatarUrl);
    if (parsed) return parsed;

    const download = await axios.get<ArrayBuffer>(baseAvatarUrl, {
        responseType: 'arraybuffer',
        timeout: 60_000,
    });

    return {
        mimeType: normalizeMimeType(firstString(download.headers['content-type'])),
        data: Buffer.from(download.data).toString('base64'),
        source: 'remote_url',
    };
}

function supportsReferenceImages(model: string): boolean {
    return /^veo-3\.1/i.test(model);
}

function resolveDurationSeconds(model: string, hasReferenceImages: boolean): number {
    if (hasReferenceImages) return 8;

    const requested = Number.isFinite(VIDEO_DURATION_SECONDS) ? Math.trunc(VIDEO_DURATION_SECONDS) : 8;
    const supportedDurations = /^veo-3(\.|-)/i.test(model) ? [4, 6, 8] : [5, 6, 8];

    if (supportedDurations.includes(requested)) return requested;
    return 8;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function stateInstruction(state: StateType): string {
    const map: Record<StateType, string> = {
        happy: 'smiling, uplifting, energetic body language',
        sad: 'subtle sadness, lowered eyebrows, slower movement',
        sleepy: 'yawning, droopy eyelids, slow relaxed motion',
        calm: 'relaxed gentle smile, steady breathing, composed neutral-positive expression',
        tired: 'fatigued expression, heavier eyelids, low-energy movement',
    };
    return map[state];
}

function parseGeneratedVideoUri(payload: unknown): string | null {
    const source = payload as {
        response?: {
            generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: unknown } }> };
            generatedVideos?: Array<{ video?: { uri?: unknown } }>;
        };
        generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: unknown } }> };
        generatedVideos?: Array<{ video?: { uri?: unknown } }>;
    };

    return firstString(
        source.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri,
        source.response?.generatedVideos?.[0]?.video?.uri,
        source.generateVideoResponse?.generatedSamples?.[0]?.video?.uri,
        source.generatedVideos?.[0]?.video?.uri
    );
}

async function createGoogleImageAvatar(imageBuffer: Buffer, mimetype: string): Promise<{ dataUri: string; modelVersion?: string }> {
    const styleReference = resolveStyleReferenceImage();
    const parts: Array<Record<string, unknown>> = [
        {
            text: [
                'Transform this real face photo into a stylized, high-quality avatar.',
                `Use style preset: ${NANO_BANA_STYLE_PRESET}.`,
                DEMO_AVATAR_STYLE_INSTRUCTION,
                'Square composition, centered subject, clean edges, vivid but natural colors.',
                'Result must be suitable for a circular profile frame.',
            ].join(' '),
        },
        {
            inlineData: {
                mimeType: mimetype,
                data: imageBuffer.toString('base64'),
            },
        },
    ];

    if (styleReference) {
        parts.push({
            text: 'Apply the illustration style from the next image as style reference only; keep identity from the selfie.',
        });
        parts.push({
            inlineData: {
                mimeType: styleReference.mimeType,
                data: styleReference.data,
            },
        });
    }

    const response = await axios.post(
        `${GOOGLE_GENAI_API_URL}/models/gemini-2.5-flash-image:generateContent`,
        {
            contents: [
                {
                    parts,
                },
            ],
            generationConfig: {
                responseModalities: ['Image'],
                imageConfig: {
                    aspectRatio: '1:1',
                },
            },
        },
        {
            headers: {
                'x-goog-api-key': NANO_BANA_API_KEY,
                'Content-Type': 'application/json',
            },
            timeout: 180_000,
        }
    );

    const part = response.data?.candidates?.[0]?.content?.parts?.find((candidatePart: unknown) => {
        if (typeof candidatePart !== 'object' || candidatePart === null) return false;
        const maybe = candidatePart as { inlineData?: { data?: unknown } };
        return typeof maybe.inlineData?.data === 'string';
    });
    const mimeType = part?.inlineData?.mimeType || 'image/png';
    const data = part?.inlineData?.data;
    if (!data) {
        throw new Error('Google image generation returned no image bytes');
    }

    return {
        dataUri: `data:${mimeType};base64,${data}`,
        modelVersion: response.data?.modelVersion,
    };
}

const STYLE_REFERENCE_AVAILABLE = !!resolveStyleReferenceImage();

async function startVeoOperation(
    prompt: string,
    avatarImage: InlineImageData,
    hasReferenceImages: boolean
): Promise<string> {
    const durationSeconds = resolveDurationSeconds(NANO_BANA_VIDEO_MODEL, hasReferenceImages);
    const parameters: Record<string, unknown> = {
        aspectRatio: '16:9',
        durationSeconds,
        personGeneration: 'allow_adult',
    };

    if (hasReferenceImages) {
        parameters.referenceImages = [
            {
                referenceType: 'REFERENCE_TYPE_SUBJECT',
                referenceImage: {
                    imageBytes: avatarImage.data,
                    mimeType: avatarImage.mimeType,
                },
            },
        ];
    }

    const response = await axios.post(
        `${GOOGLE_GENAI_API_URL}/models/${NANO_BANA_VIDEO_MODEL}:predictLongRunning`,
        {
            instances: [
                {
                    prompt,
                    image: {
                        mimeType: avatarImage.mimeType,
                        bytesBase64Encoded: avatarImage.data,
                    },
                },
            ],
            parameters,
        },
        {
            headers: {
                'x-goog-api-key': NANO_BANA_API_KEY,
                'Content-Type': 'application/json',
            },
            timeout: 120_000,
        }
    );

    const operationName = firstString(response.data?.name);
    if (!operationName) {
        throw new Error('Veo did not return an operation name');
    }
    return operationName;
}

async function waitForVeoVideoUri(operationName: string): Promise<string> {
    const startedAt = Date.now();
    let lastError: string | null = null;

    while (Date.now() - startedAt < VIDEO_POLL_TIMEOUT_MS) {
        const op = await axios.get(`${GOOGLE_GENAI_API_URL}/${operationName}`, {
            headers: { 'x-goog-api-key': NANO_BANA_API_KEY },
            timeout: 60_000,
        });

        if (op.data?.error?.message) {
            lastError = op.data.error.message;
            break;
        }

        if (op.data?.done) {
            const uri = parseGeneratedVideoUri(op.data);
            if (!uri) {
                throw new Error('Veo operation finished but video URI was missing');
            }
            return uri;
        }

        await sleep(VIDEO_POLL_INTERVAL_MS);
    }

    if (lastError) {
        throw new Error(lastError);
    }
    throw new Error('Timed out waiting for Veo video generation');
}

async function downloadVideoAsDataUri(videoUri: string): Promise<{ dataUri: string; mimeType: string; bytes: number }> {
    const download = await axios.get<ArrayBuffer>(videoUri, {
        headers: { 'x-goog-api-key': NANO_BANA_API_KEY },
        responseType: 'arraybuffer',
        timeout: 180_000,
        maxContentLength: 50 * 1024 * 1024,
    });

    const mimeType = firstString(download.headers['content-type']) || 'video/mp4';
    const buffer = Buffer.from(download.data);
    return {
        dataUri: `data:${mimeType};base64,${buffer.toString('base64')}`,
        mimeType,
        bytes: buffer.length,
    };
}

export interface BaseAvatarResult {
    url: string;
    metadata: Record<string, unknown>;
}

export interface AnimationResult {
    url: string;
    duration: number;
    quality: 'high' | 'standard';
    loopOptimized: boolean;
    circularOptimized: boolean;
    metadata: Record<string, unknown>;
}

/**
 * Generates a stylized avatar from a real uploaded photo using NanoBana.
 * Falls back to deterministic demo output when API credentials are not configured.
 */
export async function generateBaseAvatar(imageBuffer: Buffer, mimetype: string): Promise<BaseAvatarResult> {
    console.log(`[NanoBana] Processing photo (${mimetype}, ${Math.round(imageBuffer.length / 1024)}KB)`);

    if (!NANO_BANA_API_KEY) {
        const fallbackUrl = fallbackAvatarUrlFromImage(imageBuffer);
        return {
            url: fallbackUrl,
            metadata: {
                provider: 'nanobana_fallback',
                reason: 'NANO_BANA_API_KEY missing',
                stylePreset: NANO_BANA_STYLE_PRESET,
                quality: 'high',
                frameTarget: 'circular',
                generatedAt: new Date().toISOString(),
            },
        };
    }

    try {
        const generated = await createGoogleImageAvatar(imageBuffer, mimetype);

        return {
            url: generated.dataUri,
            metadata: {
                provider: 'nanobana_google',
                stylePreset: NANO_BANA_STYLE_PRESET,
                styleGuide: 'demo_reference_v1',
                styleReferenceProvided: STYLE_REFERENCE_AVAILABLE,
                quality: 'high',
                frameTarget: 'circular',
                generatedAt: new Date().toISOString(),
                model: 'gemini-2.5-flash-image',
                modelVersion: generated.modelVersion || null,
            },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.warn('[NanoBana] Google avatar generation failed, using fallback:', message);
        const fallbackUrl = fallbackAvatarUrlFromImage(imageBuffer);
        return {
            url: fallbackUrl,
            metadata: {
                provider: 'nanobana_fallback',
                reason: message,
                stylePreset: NANO_BANA_STYLE_PRESET,
                quality: 'high',
                frameTarget: 'circular',
                generatedAt: new Date().toISOString(),
            },
        };
    }
}

/**
 * Generates a short loopable emotional animation from a saved avatar.
 */
export async function generateStateAnimation(baseAvatarUrl: string, state: StateType): Promise<AnimationResult> {
    if (!NANO_BANA_API_KEY) {
        throw new Error('NANO_BANA_API_KEY missing; cannot generate avatar-based animation');
    }

    const avatarImage = await resolveAvatarImage(baseAvatarUrl);
    const hasReferenceImages = supportsReferenceImages(NANO_BANA_VIDEO_MODEL);
    const durationSeconds = resolveDurationSeconds(NANO_BANA_VIDEO_MODEL, hasReferenceImages);
    const baseReferenceHint =
        avatarImage.source === 'data_uri'
            ? 'Use the provided avatar image as the exact identity reference.'
            : 'Use the provided avatar URL image as the exact identity reference.';

    const prompt = [
        `Create a short ${durationSeconds}-second seamless looping avatar animation.`,
        'The subject must clearly be an adult person (25+ years old), not a child.',
        `Emotion state: ${state}.`,
        `Style preset: ${NANO_BANA_STYLE_PRESET}.`,
        DEMO_AVATAR_STYLE_INSTRUCTION,
        stateInstruction(state),
        baseReferenceHint,
        'Keep face, hairstyle, skin tone, and visual style identical to the reference avatar.',
        'Single centered subject, clean background, smooth motion.',
        'Keep composition optimized for circular crop.',
    ].join(' ');

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            const operationName = await startVeoOperation(prompt, avatarImage, hasReferenceImages);
            const videoUri = await waitForVeoVideoUri(operationName);
            const downloaded = await downloadVideoAsDataUri(videoUri);

            return {
                url: downloaded.dataUri,
                duration: durationSeconds,
                quality: 'high',
                loopOptimized: true,
                circularOptimized: true,
                metadata: {
                    provider: 'nanobana_google',
                    state,
                    stylePreset: NANO_BANA_STYLE_PRESET,
                    styleGuide: 'demo_reference_v1',
                    generatedAt: new Date().toISOString(),
                    model: NANO_BANA_VIDEO_MODEL,
                    operation: operationName,
                    sourceVideoUri: videoUri,
                    downloadedBytes: downloaded.bytes,
                    mimeType: downloaded.mimeType,
                    referenceSource: avatarImage.source,
                    referenceEnabled: hasReferenceImages,
                    attempt,
                },
            };
        } catch (error: unknown) {
            lastError = error;
            const maybeAxiosError = error as { response?: { status?: number } };
            const status = Number(maybeAxiosError?.response?.status || 0);
            if (status === 429 && attempt < 3) {
                await sleep(attempt === 1 ? 12_000 : 20_000);
                continue;
            }
            break;
        }
    }

    const maybeResponseError = lastError as {
        response?: { data?: { error?: { message?: string } } };
        message?: string;
    };
    const reason = maybeResponseError?.response?.data?.error?.message || maybeResponseError?.message || 'Unknown error';
    throw new Error(`Failed to generate "${state}" animation from avatar reference: ${reason}`);
}
