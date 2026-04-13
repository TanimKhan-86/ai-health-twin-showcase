import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, removeToken, setToken } from '../lib/api/client';
import { apiFetch } from '../lib/api/client';
import type { AuthSessionDto, AuthUserDto } from '../lib/api/contracts';

// ─── Types ────────────────────────────────────────────────────────────────────
export type AuthUser = AuthUserDto;

interface AuthContextValue {
    user: AuthUser | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<AuthUser | null>;
    register: (
        name: string,
        email: string,
        password: string,
        profile?: { age?: number; heightCm?: number; weightKg?: number; profileImage?: string }
    ) => Promise<AuthUser | null>;
    logout: () => Promise<void>;
}


// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
    return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
interface AuthProviderProps { children: ReactNode; }

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setTokenState] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // ─── Auto-login on app start ────────────────────────────────────────────────
    useEffect(() => {
        async function restoreSession() {
            try {
                const storedToken = await getToken();
                if (!storedToken) return;

                // Validate token hasn't expired locally first
                const payload = decodeJwt(storedToken);
                if (!payload || isExpired(payload)) {
                    console.log('[Auth] Token expired, clearing session');
                    await removeToken();
                    await AsyncStorage.multiRemove(['USER_ID', 'USER_NAME', 'USER_EMAIL']);
                    return;
                }

                // Always fetch fresh user profile from server (avoids AsyncStorage
                // failing silently on large base64 profileImage strings)
                const res = await apiFetch<{ user: AuthUser }>('/api/auth/me');
                if (res.success && res.data?.user) {
                    const freshUser = res.data.user;
                    setUser(freshUser);
                    setTokenState(storedToken);
                    // Cache lightweight fields only (not the large profileImage)
                    await AsyncStorage.multiSet([
                        ['USER_ID', freshUser.id],
                        ['USER_NAME', freshUser.name],
                        ['USER_EMAIL', freshUser.email],
                    ]);
                    console.log(`[Auth] Session restored via /me: ${freshUser.name}`);
                } else {
                    // Server rejected the token, clear everything
                    await removeToken();
                    await AsyncStorage.multiRemove(['USER_ID', 'USER_NAME', 'USER_EMAIL']);
                }
            } catch (e) {
                console.warn('[Auth] Session restore error:', e);
            } finally {
                setIsLoading(false);
            }
        }
        restoreSession();
    }, []);

    // ─── Register ───────────────────────────────────────────────────────────────
    const register = async (
        name: string,
        email: string,
        password: string,
        profile?: { age?: number; heightCm?: number; weightKg?: number; profileImage?: string }
    ): Promise<AuthUser | null> => {
        const res = await apiFetch<AuthSessionDto>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, ...profile }),
        });

        console.log('[AuthContext] Raw Register Response:', JSON.stringify(res));

        if (res.success && res.data) {
            return completeRegistration(res.data.token, res.data.user, !!profile?.profileImage);
        }

        const registerError = res.success ? 'Unknown register error' : res.error;
        console.error('[AuthContext] Register failed. Success:', res.success, 'Error:', registerError);
        return null;
    };


    // ─── Login ──────────────────────────────────────────────────────────────────
    const login = async (email: string, password: string): Promise<AuthUser | null> => {
        console.log(`[AuthContext] Sending Login... Email: '${email}'`);
        const res = await apiFetch<AuthSessionDto>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        console.log('[AuthContext] Raw Login Response:', JSON.stringify(res));

        if (res.success && res.data) {
            await persistSession(res.data.token, res.data.user);
            return res.data.user;
        }

        const loginError = res.success ? 'Unknown login error' : res.error;
        console.error('[AuthContext] Login failed. Success:', res.success, 'Error:', loginError);
        throw new Error(loginError || 'Login failed');
    };

    // ─── Logout ─────────────────────────────────────────────────────────────────
    const logout = async (): Promise<void> => {
        await removeToken();
        await AsyncStorage.multiRemove(['USER_ID', 'USER_NAME', 'USER_EMAIL', 'USER_PROFILE_IMAGE']);
        setUser(null);
        setTokenState(null);
        console.log('[Auth] Logged out');
    };

    // ─── Helpers ─────────────────────────────────────────────────────────────────
    async function completeRegistration(jwtToken: string, authUser: AuthUser, hasProfileImage: boolean): Promise<AuthUser> {
        await setToken(jwtToken);

        let finalUser = authUser;
        if (hasProfileImage) {
            try {
                const avatarSetup = await apiFetch('/api/avatar/setup', { method: 'POST' });
                if (!avatarSetup.success) {
                    console.warn('[Auth] Avatar setup after registration failed:', avatarSetup.error);
                }
            } catch (error) {
                console.warn('[Auth] Avatar setup after registration crashed:', error);
            }

            const meRes = await apiFetch<{ user: AuthUser }>('/api/auth/me');
            if (meRes.success && meRes.data?.user) {
                finalUser = meRes.data.user;
            }
        }

        await persistSession(jwtToken, finalUser);
        return finalUser;
    }

    async function persistSession(jwtToken: string, authUser: AuthUser) {
        await setToken(jwtToken);
        // Only cache lightweight fields — profileImage (base64) is too large for
        // AsyncStorage and will silently fail. It is fetched fresh via /api/auth/me.
        await AsyncStorage.multiSet([
            ['USER_ID', authUser.id],
            ['USER_NAME', authUser.name],
            ['USER_EMAIL', authUser.email],
        ]);
        // Set the full user object (including profileImage) in React state immediately
        setUser(authUser);
        setTokenState(jwtToken);
    }

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isLoading,
            isAuthenticated: !!user,
            login,
            register,
            logout,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

// ─── JWT Helpers (client-side decode – works in React Native without atob) ──────
function decodeJwt(token: string): { userId: string; exp: number } | null {
    try {
        const base64Url = token.split('.')[1];
        // Pad base64 to a multiple of 4 chars, replace URL-safe chars
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        const padded = pad ? base64 + '='.repeat(4 - pad) : base64;

        // Use Buffer in Node/RN, fall back to atob in browser
        let jsonStr: string;
        if (typeof Buffer !== 'undefined') {
            jsonStr = Buffer.from(padded, 'base64').toString('utf8');
        } else {
            jsonStr = decodeURIComponent(
                atob(padded)
                    .split('')
                    .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
                    .join('')
            );
        }
        return JSON.parse(jsonStr);
    } catch {
        return null;
    }
}

function isExpired(payload: { exp: number }): boolean {
    return payload.exp * 1000 < Date.now();
}
