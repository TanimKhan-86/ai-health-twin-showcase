import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../../../lib/api/client";
import {
    normalizeStateVideos,
    SCENARIO_STATES,
    ScenarioAvatarState,
} from "./scenarioUtils";

interface AvatarStateResponse {
    state?: string;
    videoUrl?: string;
    imageUrl?: string | null;
    videoByState?: Record<string, string>;
    availableStates?: string[];
}

interface AvatarStatusResponse {
    avatarUrl?: string | null;
}

interface AvatarLibraryResponse {
    imageUrl?: string | null;
    videoByState?: Record<string, string>;
    availableStates?: string[];
}

function toScenarioState(value?: string | null): ScenarioAvatarState | null {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'happy' || normalized === 'sad' || normalized === 'sleepy' || normalized === 'calm') {
        return normalized;
    }
    return null;
}

function mergeStateVideo(
    current: Partial<Record<ScenarioAvatarState, string>>,
    next?: AvatarStateResponse | null
): Partial<Record<ScenarioAvatarState, string>> {
    const merged = {
        ...current,
        ...normalizeStateVideos(next?.videoByState || {}),
    };
    const explicitState = toScenarioState(next?.state);
    if (explicitState && next?.videoUrl) {
        merged[explicitState] = next.videoUrl;
    }
    return merged;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useScenarioAvatarLibrary() {
    const [avatarLoading, setAvatarLoading] = useState(true);
    const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null);
    const [avatarVideoByState, setAvatarVideoByState] = useState<Partial<Record<ScenarioAvatarState, string>>>({});
    const avatarVideosRef = useRef<Partial<Record<ScenarioAvatarState, string>>>({});
    const fetchingStatesRef = useRef<Set<ScenarioAvatarState>>(new Set());

    const ensureScenarioStateVideo = useCallback(async (state: ScenarioAvatarState): Promise<void> => {
        if (avatarVideosRef.current[state]) return;
        if (fetchingStatesRef.current.has(state)) return;

        fetchingStatesRef.current.add(state);
        try {
            const attempts = [25_000, 35_000];
            for (const timeoutMs of attempts) {
                const response = await apiFetch<AvatarStateResponse>(
                    `/api/avatar/state?state=${encodeURIComponent(state)}&includeMedia=true`,
                    { timeoutMs }
                );
                if (!response.success || !response.data) {
                    await delay(400);
                    continue;
                }

                if (response.data.imageUrl) {
                    setAvatarImageUrl((prev) => prev || response.data?.imageUrl || null);
                }

                const merged = mergeStateVideo(avatarVideosRef.current, response.data);
                avatarVideosRef.current = merged;
                setAvatarVideoByState(merged);
                if (merged[state]) {
                    return;
                }
                await delay(400);
            }
        } catch (e) {
            console.warn(`Avatar state media load failed (${state}):`, e);
        } finally {
            fetchingStatesRef.current.delete(state);
        }
    }, []);

    const reloadAvatarLibrary = useCallback(async () => {
        try {
            setAvatarLoading(true);

            const libraryRes = await apiFetch<AvatarLibraryResponse>('/api/avatar/library', { timeoutMs: 20_000 });
            if (libraryRes.success && libraryRes.data) {
                if (libraryRes.data.imageUrl) {
                    setAvatarImageUrl(libraryRes.data.imageUrl);
                }

                const libraryVideos = {
                    ...avatarVideosRef.current,
                    ...normalizeStateVideos(libraryRes.data.videoByState || {}),
                };
                avatarVideosRef.current = libraryVideos;
                setAvatarVideoByState(libraryVideos);

                let prioritizedState: ScenarioAvatarState | null = null;
                const stateMeta = await apiFetch<AvatarStateResponse>('/api/avatar/state?includeMedia=false', { timeoutMs: 12_000 });
                if (stateMeta.success && stateMeta.data) {
                    const normalizedState = toScenarioState(stateMeta.data.state);
                    if (normalizedState) prioritizedState = normalizedState;
                }

                const knownStates = Array.from(
                    new Set(
                        (libraryRes.data.availableStates || [])
                            .map((state) => toScenarioState(state))
                            .filter((state): state is ScenarioAvatarState => !!state)
                    )
                );
                const availableStates = knownStates.length > 0 ? knownStates : [...SCENARIO_STATES];
                const prioritizedOrder = prioritizedState
                    ? [prioritizedState, ...availableStates.filter((state) => state !== prioritizedState)]
                    : availableStates;

                void (async () => {
                    for (const state of prioritizedOrder) {
                        await ensureScenarioStateVideo(state);
                    }
                })();

                return;
            }

            const stateMeta = await apiFetch<AvatarStateResponse>('/api/avatar/state?includeMedia=false', { timeoutMs: 12_000 });
            let prioritizedState: ScenarioAvatarState | null = null;
            let availableStates: ScenarioAvatarState[] = [...SCENARIO_STATES];

            if (stateMeta.success && stateMeta.data) {
                if (stateMeta.data.imageUrl) {
                    setAvatarImageUrl(stateMeta.data.imageUrl);
                }
                const normalizedState = toScenarioState(stateMeta.data.state);
                if (normalizedState) prioritizedState = normalizedState;
                if (Array.isArray(stateMeta.data.availableStates) && stateMeta.data.availableStates.length > 0) {
                    const filtered = stateMeta.data.availableStates
                        .map((state) => toScenarioState(state))
                        .filter((state): state is ScenarioAvatarState => !!state);
                    if (filtered.length > 0) {
                        availableStates = Array.from(new Set(filtered));
                    }
                }
            } else {
                const status = await apiFetch<AvatarStatusResponse>('/api/avatar/status');
                if (status.success && status.data?.avatarUrl) {
                    setAvatarImageUrl(status.data.avatarUrl);
                }
            }

            const prioritizedOrder = prioritizedState
                ? [prioritizedState, ...availableStates.filter((state) => state !== prioritizedState)]
                : availableStates;

            if (prioritizedOrder[0]) {
                void ensureScenarioStateVideo(prioritizedOrder[0]);
            }

            void (async () => {
                for (const state of prioritizedOrder.slice(1)) {
                    await ensureScenarioStateVideo(state);
                }
            })();
        } catch (e) {
            console.warn('Avatar library load error:', e);
        } finally {
            setAvatarLoading(false);
        }
    }, [ensureScenarioStateVideo]);

    useEffect(() => {
        reloadAvatarLibrary();
    }, [reloadAvatarLibrary]);

    return {
        avatarLoading,
        avatarImageUrl,
        avatarVideoByState,
        ensureScenarioStateVideo,
        reloadAvatarLibrary,
    };
}
