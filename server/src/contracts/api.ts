export interface ApiErrorDetail {
    field: string;
    message: string;
}

export interface ApiSuccess<T> {
    success: true;
    data: T;
}

export interface ApiFailure {
    success: false;
    error: string;
    details?: ApiErrorDetail[];
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export type MoodType =
    | 'happy'
    | 'sad'
    | 'stressed'
    | 'tired'
    | 'energetic'
    | 'neutral'
    | 'calm'
    | 'anxious'
    | 'excited';

export type AvatarStateType = 'happy' | 'sad' | 'sleepy' | 'calm' | 'tired';
export type AvatarMode = 'prebuilt' | 'nanobana';

export interface AuthUserDto {
    id: string;
    name: string;
    email: string;
    age?: number;
    heightCm?: number;
    weightKg?: number;
    profileImage?: string | null;
}

export interface AuthSessionDto {
    token: string;
    user: AuthUserDto;
}

export interface HealthEntryDto {
    _id: string;
    userId: string;
    date: string;
    steps: number;
    activeMinutes?: number;
    sleepHours: number;
    waterLitres: number;
    heartRate: number;
    energyScore?: number | null;
    weight?: number;
    notes?: string;
    source?: 'daily_log' | 'health_api' | 'seed_demo' | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface MoodEntryDto {
    _id: string;
    userId: string;
    date: string;
    mood: MoodType;
    energyLevel: number;
    stressLevel: number;
    notes?: string;
    source?: 'daily_log' | 'mood_api' | 'seed_demo' | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface DailyLogSaveDto {
    date: string;
    health: HealthEntryDto;
    mood: MoodEntryDto;
}

export interface StreakDataDto {
    currentStreak: number;
    longestStreak: number;
    lastLogDate: string | null;
}

export interface SeedDemoResultDto {
    message: string;
    healthEntries: number;
    moodEntries: number;
}

export interface ClearSeedDemoResultDto {
    message: string;
    healthEntriesDeleted: number;
    moodEntriesDeleted: number;
}

export interface AvatarStatusDto {
    hasAvatar: boolean;
    avatarUrl?: string | null;
    avatarFingerprint?: string | null;
    stylePreset?: string;
    mode: AvatarMode;
    requiredStates: AvatarStateType[];
    generatedStates?: AvatarStateType[];
    pendingStates?: AvatarStateType[];
    ready: boolean;
}

export interface AvatarStateDto {
    state: AvatarStateType;
    videoUrl: string | null;
    videoByState: Partial<Record<AvatarStateType, string>>;
    imageUrl: string | null;
    avatarFingerprint: string | null;
    reasoning: string;
    mode: AvatarMode;
    requiredStates: AvatarStateType[];
    availableStates: AvatarStateType[];
}

export interface AvatarLibraryDto {
    mode: AvatarMode;
    requiredStates: AvatarStateType[];
    imageUrl: string | null;
    videoByState: Partial<Record<AvatarStateType, string>>;
    availableStates: AvatarStateType[];
}

export type FutureState = 'happy' | 'sad' | 'sleepy' | 'calm';

export interface FutureInsightDto {
    period: {
        days: number;
        from: string;
        to: string;
    };
    hasSevenDayData: boolean;
    analyzedDays: number;
    dominantState: FutureState;
    currentState: FutureState;
    projectedState: FutureState;
    stateBreakdown: Record<FutureState, number>;
    dailyStates: Array<{ date: string; state: FutureState | null; reason: string | null }>;
    reasoning: {
        dominant: string;
        current: string;
        projection: string;
    };
    insight: string;
    media: {
        imageUrl: string | null;
        projectedVideoUrl: string | null;
        availableStates: string[];
    };
}

export interface AiWeeklyAnalysisDto {
    narrative: string;
    tips: string[];
    predictedOutcome: string;
    disclaimer: string;
    fromCache?: boolean;
    fromFallback?: boolean;
    cacheWeek?: string;
    generatedAt?: string;
}
