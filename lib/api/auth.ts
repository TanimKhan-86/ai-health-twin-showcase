/**
 * HealthTwin API Client Helpers
 * All data goes through MongoDB Atlas via the Express backend.
 * Works on iOS, Android (Expo Go), and Web.
 */
import { apiFetch } from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
    AuthSessionDto,
    AuthUserDto,
    DailyLogSaveDto,
    FutureInsightDto,
    HealthEntryDto,
    MoodEntryDto,
    MoodType,
    ClearSeedDemoResultDto,
    StreakDataDto,
} from './contracts';
import { getLocalDateYmd } from '../date/localDay';

// Use the same key as client.ts — keeping them in sync prevents session loss
const TOKEN_KEY = 'auth_token';

// ─── Token Helpers (re-exported for AuthContext) ──────────────────────────────
export async function getToken(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
}
export async function setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
}
export async function removeToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
}

// ─── Auth Types ───────────────────────────────────────────────────────────────
export type AuthUser = AuthUserDto;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function register(name: string, email: string, password: string): Promise<AuthUser | null> {
    const res = await apiFetch<AuthSessionDto>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
    });
    if (res.success && res.data) {
        await setToken(res.data.token);
        return res.data.user;
    }
    return null;
}

export async function login(email: string, password: string): Promise<AuthUser | null> {
    const res = await apiFetch<AuthSessionDto>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    if (res.success && res.data) {
        await setToken(res.data.token);
        return res.data.user;
    }
    return null;
}

export async function logout(): Promise<void> {
    await removeToken();
}

export async function deleteMyAccount(): Promise<boolean> {
    const res = await apiFetch('/api/auth/me', { method: 'DELETE' });
    if (res.success) {
        await removeToken();
    }
    return res.success;
}

export async function isAuthenticated(): Promise<boolean> {
    const token = await getToken();
    return !!token;
}

// ─── Health Entries ───────────────────────────────────────────────────────────
export interface HealthEntryData {
    date?: string;        // YYYY-MM-DD, defaults to today
    steps?: number;
    activeMinutes?: number;
    sleepHours?: number;
    energyScore?: number; // 0–100
    heartRate?: number;
    waterLitres?: number; // was hydrationLiters — now matches the DB field
    weight?: number;
    notes?: string;
}

export type HealthEntry = HealthEntryDto;

export async function logHealth(data: HealthEntryData): Promise<HealthEntry | null> {
    const res = await apiFetch<HealthEntry>('/api/health', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return res.success ? res.data! : null;
}

export async function getTodayHealth(): Promise<HealthEntry | null> {
    const date = getLocalDateYmd();
    const res = await apiFetch<HealthEntry>(`/api/health/today?date=${encodeURIComponent(date)}`);
    return res.success ? (res.data ?? null) : null;
}

export async function getHealthHistory(limit = 30): Promise<HealthEntry[]> {
    const res = await apiFetch<HealthEntry[]>(`/api/health/history?limit=${limit}`);
    return res.success ? res.data! : [];
}

export async function seedDemoWeek(): Promise<boolean> {
    const res = await apiFetch('/api/health/seed-demo', { method: 'POST' });
    return res.success;
}

export async function clearSeedDemoWeek(): Promise<ClearSeedDemoResultDto | null> {
    const res = await apiFetch<ClearSeedDemoResultDto>('/api/health/seed-demo', { method: 'DELETE' });
    return res.success ? (res.data ?? null) : null;
}

// ─── Mood Entries ─────────────────────────────────────────────────────────────
export interface MoodEntryData {
    date?: string;
    mood: MoodType;
    energyLevel: number;  // 1-10
    stressLevel: number;  // 1-10
    notes?: string;
}

export type MoodEntry = MoodEntryDto;

export async function logMood(data: MoodEntryData): Promise<MoodEntry | null> {
    const res = await apiFetch<MoodEntry>('/api/mood', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return res.success ? res.data! : null;
}

export async function getTodayMood(): Promise<MoodEntry | null> {
    const date = getLocalDateYmd();
    const res = await apiFetch<MoodEntry>(`/api/mood/today?date=${encodeURIComponent(date)}`);
    return res.success ? (res.data ?? null) : null;
}

export interface DailyLogSaveData {
    date?: string;
    steps?: number;
    activeMinutes?: number;
    sleepHours?: number;
    waterLitres?: number;
    heartRate?: number;
    energyScore?: number;
    weight?: number;
    healthNotes?: string;
    mood: MoodType;
    energyLevel: number;
    stressLevel: number;
    moodNotes?: string;
}

export async function saveDailyLog(data: DailyLogSaveData): Promise<DailyLogSaveDto | null> {
    const res = await apiFetch<DailyLogSaveDto>('/api/daily-log', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return res.success ? (res.data ?? null) : null;
}

export async function getMoodHistory(limit = 30): Promise<MoodEntry[]> {
    const res = await apiFetch<MoodEntry[]>(`/api/mood/history?limit=${limit}`);
    return res.success ? res.data! : [];
}

// ─── Streaks ──────────────────────────────────────────────────────────────────
export type StreakData = StreakDataDto;

export async function getStreak(): Promise<StreakData> {
    const res = await apiFetch<StreakData>('/api/streak');
    return res.success && res.data ? res.data : { currentStreak: 0, longestStreak: 0, lastLogDate: null };
}

// ─── Future You ───────────────────────────────────────────────────────────────
export type FutureInsight = FutureInsightDto;

export async function getFutureInsight(days = 7): Promise<FutureInsight | null> {
    const safeDays = Math.max(1, Math.min(30, Math.trunc(days)));
    const res = await apiFetch<FutureInsight>(`/api/future/insight?days=${safeDays}`);
    return res.success ? (res.data ?? null) : null;
}

// ─── Scores (legacy, keep for prediction feature) ────────────────────────────
export async function postScore(inputs: Record<string, unknown>, score: number): Promise<boolean> {
    const res = await apiFetch('/api/scores', {
        method: 'POST',
        body: JSON.stringify({ inputs, score }),
    });
    return res.success;
}

export async function getLatestScore(): Promise<{ score: number; inputs: Record<string, unknown> } | null> {
    const res = await apiFetch<{ score: number; inputs: Record<string, unknown> }>('/api/scores/latest');
    return res.success ? res.data! : null;
}

export async function getScoreHistory(limit = 50): Promise<Array<{ score: number; createdAt: string }>> {
    const res = await apiFetch<Array<{ score: number; createdAt: string }>>(`/api/scores/history?limit=${limit}`);
    return res.success ? res.data! : [];
}

// ─── Feedback ─────────────────────────────────────────────────────────────────
export async function submitFeedback(rating: number, comment: string): Promise<boolean> {
    const res = await apiFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({ rating, comment }),
    });
    return res.success;
}
