import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import type { ApiEnvelope, ApiErrorDetail } from './contracts';

// ─── Base URL ─────────────────────────────────────────────────────────────────
// Set EXPO_PUBLIC_API_URL in your .env file:
//   LAN (Expo Go on phone):  http://192.168.x.x:4000
//   Android emulator:        http://10.0.2.2:4000
//   ngrok:                   https://xxxx.ngrok.io
//   Web (localhost):         http://localhost:4000
const ENV_API_BASE = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
const DEFAULT_API_BASE = 'http://localhost:4000';
const REQUEST_TIMEOUT_MS = 10000;

const TOKEN_KEY = 'auth_token';

// ─── Token Helpers ────────────────────────────────────────────────────────────
export async function getToken(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
}

// ─── Core Fetch Wrapper ────────────────────────────────────────────────────────
interface ApiOptions extends RequestInit {
    auth?: boolean; // Set to true to include Authorization header
    timeoutMs?: number;
}

type ApiResponse<T = unknown> = ApiEnvelope<T>;

function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeBaseUrl(base: string): string {
    return base.replace(/\/+$/, '');
}

function pushUnique(list: string[], value: string | null | undefined): void {
    if (!value) return;
    const normalized = normalizeBaseUrl(value.trim());
    if (!normalized) return;
    if (!list.includes(normalized)) list.push(normalized);
}

function getWebHostnameSafe(): string | null {
    const globalLike = globalThis as {
        location?: { hostname?: unknown };
        window?: { location?: { hostname?: unknown } };
    };

    if (typeof globalLike.location?.hostname === 'string' && globalLike.location.hostname.length > 0) {
        return globalLike.location.hostname;
    }

    if (typeof globalLike.window?.location?.hostname === 'string' && globalLike.window.location.hostname.length > 0) {
        return globalLike.window.location.hostname;
    }

    return null;
}

function getExpoHostSafe(): string | null {
    const nativeModulesAny = NativeModules as unknown as {
        SourceCode?: { scriptURL?: unknown };
    };

    const scriptUrl = nativeModulesAny.SourceCode?.scriptURL;
    if (typeof scriptUrl !== 'string' || scriptUrl.trim().length === 0) {
        return null;
    }

    try {
        const parsed = new URL(scriptUrl);
        if (!parsed.hostname) return null;
        return parsed.hostname;
    } catch {
        return null;
    }
}

function getApiBaseCandidates(): string[] {
    const candidates: string[] = [];
    pushUnique(candidates, ENV_API_BASE);

    if (Platform.OS !== 'web') {
        const expoHost = getExpoHostSafe();
        if (expoHost && expoHost !== 'localhost' && expoHost !== '127.0.0.1') {
            pushUnique(candidates, `http://${expoHost}:4000`);
        }

        // Keep emulator/simulator-friendly fallbacks.
        if (Platform.OS === 'android') {
            pushUnique(candidates, 'http://10.0.2.2:4000');
            pushUnique(candidates, 'http://10.0.3.2:4000');
        } else if (Platform.OS === 'ios') {
            pushUnique(candidates, DEFAULT_API_BASE);
            pushUnique(candidates, 'http://127.0.0.1:4000');
        }
    }

    const host = getWebHostnameSafe();
    if (Platform.OS === 'web') {
        if (host === 'localhost' || host === '127.0.0.1') {
            pushUnique(candidates, 'http://localhost:4000');
            pushUnique(candidates, 'http://127.0.0.1:4000');
        } else if (host && /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
            pushUnique(candidates, `http://${host}:4000`);
            pushUnique(candidates, DEFAULT_API_BASE);
        }
    }

    if (candidates.length === 0) {
        pushUnique(candidates, DEFAULT_API_BASE);
    }

    return candidates;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    if (typeof AbortController === 'undefined') {
        return fetch(url, init);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

export async function apiFetch<T = unknown>(
    path: string,
    options: ApiOptions = {}
): Promise<ApiResponse<T>> {
    const { auth = false, timeoutMs = REQUEST_TIMEOUT_MS, ...fetchOptions } = options;
    const incomingHeaders = (fetchOptions.headers as Record<string, string> | undefined) ?? {};
    const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
    const hasContentType = Object.keys(incomingHeaders).some(k => k.toLowerCase() === 'content-type');
    const headers: Record<string, string> = { ...incomingHeaders };
    if (!isFormData && !hasContentType) {
        headers['Content-Type'] = 'application/json';
    }

    // Always attach JWT if one is stored (protected routes need it, public routes ignore it)
    const token = await getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const bases = getApiBaseCandidates();
    let lastNetworkError = 'Network error – check your API URL and connection';

    for (const base of bases) {
        try {
            const response = await fetchWithTimeout(`${base}${path}`, {
                ...fetchOptions,
                headers,
            }, timeoutMs);

            let json: unknown;
            try {
                json = await response.json();
            } catch {
                return {
                    success: false,
                    error: `Server returned ${response.status}: ${response.statusText}`,
                };
            }

            if (!response.ok) {
                let errorMessage = `Error ${response.status}: ${response.statusText}`;
                let details: ApiErrorDetail[] | undefined;
                if (isObject(json)) {
                    if (typeof json.error === 'string') {
                        errorMessage = json.error;
                    }
                    if (Array.isArray(json.details)) {
                        details = json.details as ApiErrorDetail[];
                    }
                }
                return {
                    success: false,
                    error: errorMessage,
                    details,
                };
            }

            // Normalize wrapped payloads: { success, data, error }
            if (isObject(json) && hasOwn(json, 'success') && typeof json.success === 'boolean') {
                if (!json.success) {
                    return {
                        success: false,
                        error: typeof json.error === 'string' ? json.error : 'Request failed',
                        details: Array.isArray(json.details) ? (json.details as ApiErrorDetail[]) : undefined,
                    };
                }
                if (hasOwn(json, 'data')) {
                    return { success: true, data: json.data as T };
                }
                return { success: true, data: undefined as T };
            }

            // Raw payloads (for routes that return objects directly)
            return { success: true, data: json as T };
        } catch (error: unknown) {
            const networkError = error as { name?: string; message?: string };
            const isAbort = networkError?.name === 'AbortError';
            lastNetworkError = isAbort
                ? `Request timed out after ${Math.round(timeoutMs / 1000)}s`
                : (networkError?.message || 'Network error – check your API URL and connection');
            continue;
        }
    }

    // In Expo dev, console.error triggers a full red overlay even for handled failures.
    console.warn(`[API] ${path} failed on bases [${bases.join(', ')}]: ${lastNetworkError}`);
    return {
        success: false,
        error: lastNetworkError,
    };
}
