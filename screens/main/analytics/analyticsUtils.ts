export type AvatarState = 'happy' | 'sad' | 'sleepy' | 'calm';

export interface HealthEntry {
    date: string;
    steps: number;
    sleepHours: number;
    energyScore: number;
    heartRate?: number;
    waterLitres?: number;
}

export interface MoodEntry {
    date: string;
    stressLevel: number;
    mood?: string;
    energyLevel?: number;
}

export interface DistributionSummary {
    counts: Record<AvatarState, number>;
    percentages: Record<AvatarState, number>;
    trackedDays: number;
}

export type XYPoint = { x: number; y: number };
export type ConfidenceQuality = 'Low' | 'Medium' | 'High';

export interface CoverageSummary {
    totalDays: number;
    healthDays: number;
    moodDays: number;
    completeDays: number;
    healthCoverage: number;
    moodCoverage: number;
    completeCoverage: number;
    quality: ConfidenceQuality;
}

export const AVATAR_STATE_META: Record<AvatarState, { label: string; emoji: string; color: string; bg: string }> = {
    happy: { label: 'Happy', emoji: '😄', color: '#16a34a', bg: '#dcfce7' },
    sad: { label: 'Sad', emoji: '😔', color: '#2563eb', bg: '#dbeafe' },
    sleepy: { label: 'Sleepy', emoji: '😴', color: '#7c3aed', bg: '#ede9fe' },
    calm: { label: 'Calm', emoji: '😌', color: '#0f766e', bg: '#ccfbf1' },
};

export function avg(arr: number[]): number { return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0; }

export function avgFloat(arr: number[], precision = 1): number {
    if (!arr.length) return 0;
    return Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(precision));
}

export function getWeekRange(offset: number) {
    const end = new Date(); end.setDate(end.getDate() - offset * 7);
    const start = new Date(end); start.setDate(start.getDate() - 6);
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    return { startDate: fmt(start), endDate: fmt(end) };
}

export function dayKey(value: string): string {
    return value.slice(0, 10);
}

export function filterByRange<T extends { date: string }>(entries: T[], startDate: string, endDate: string): T[] {
    return entries.filter((e) => {
        const d = dayKey(e.date);
        return d >= startDate && d <= endDate;
    });
}

export function deltaColor(delta: number | null, betterWhenLower = false): string {
    if (delta === null) return '#94a3b8';
    if (delta === 0) return '#6b7280';
    const isGood = betterWhenLower ? delta < 0 : delta > 0;
    return isGood ? '#10b981' : '#ef4444';
}

export function shiftDateString(yyyyMmDd: string, shiftDays: number): string {
    const d = new Date(`${yyyyMmDd}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + shiftDays);
    return d.toISOString().slice(0, 10);
}

export function inferAvatarStateFromDay(health?: HealthEntry, mood?: MoodEntry): AvatarState {
    const sleepHours = Number(health?.sleepHours ?? 0);
    const stressLevel = Number(mood?.stressLevel ?? 0);
    const heartRate = Number(health?.heartRate ?? 0);
    const steps = Number(health?.steps ?? 0);
    const waterLitres = Number(health?.waterLitres ?? 0);
    const energyScore = Number(health?.energyScore ?? 0);
    const moodEnergy = Number(mood?.energyLevel ?? 0);
    const moodName = typeof mood?.mood === 'string' ? mood.mood.toLowerCase() : '';

    if (sleepHours > 0 && sleepHours <= 4) return 'sleepy';

    const fatigueSignal =
        moodName === 'tired' ||
        (energyScore > 0 && energyScore <= 45) ||
        (moodEnergy > 0 && moodEnergy <= 4) ||
        stressLevel >= 7 ||
        heartRate >= 95;

    if (fatigueSignal) return 'sad';

    const lowStress = stressLevel === 0 || stressLevel <= 4;
    const calmMoodPreferred = moodName === 'calm' || moodName === 'neutral';
    const calmSignal =
        moodName === 'calm'
        || (
            moodName === 'neutral'
            && lowStress
            && (sleepHours === 0 || sleepHours >= 6)
        )
        || (
            lowStress
            && sleepHours >= 6
            && sleepHours < 7.5
            && (energyScore === 0 || (energyScore >= 50 && energyScore < 75))
            && (moodEnergy === 0 || (moodEnergy >= 5 && moodEnergy <= 7))
            && (steps === 0 || (steps >= 3500 && steps <= 9000))
        );

    if (calmMoodPreferred && calmSignal) return 'calm';

    let positiveSignals = 0;
    if (steps >= 8000) positiveSignals += 1;
    if (sleepHours >= 7) positiveSignals += 1;
    if (waterLitres >= 2) positiveSignals += 1;
    if (energyScore >= 70) positiveSignals += 1;
    if (moodEnergy >= 7) positiveSignals += 1;

    if (positiveSignals >= 3 && lowStress) return 'happy';
    if (calmSignal) return 'calm';
    return 'sad';
}

export function buildDistribution(
    days: number,
    endDate: string,
    healthEntries: HealthEntry[],
    moodEntries: MoodEntry[]
): DistributionSummary {
    const counts: Record<AvatarState, number> = { happy: 0, sad: 0, sleepy: 0, calm: 0 };
    const startDate = shiftDateString(endDate, -(days - 1));
    const healthInRange = filterByRange(healthEntries, startDate, endDate);
    const moodInRange = filterByRange(moodEntries, startDate, endDate);

    const healthByDay = new Map<string, HealthEntry>();
    const moodByDay = new Map<string, MoodEntry>();
    for (const h of healthInRange) healthByDay.set(dayKey(h.date), h);
    for (const m of moodInRange) moodByDay.set(dayKey(m.date), m);

    let trackedDays = 0;
    for (let i = 0; i < days; i += 1) {
        const key = shiftDateString(startDate, i);
        const health = healthByDay.get(key);
        const mood = moodByDay.get(key);
        if (!health && !mood) continue;
        const state = inferAvatarStateFromDay(health, mood);
        counts[state] += 1;
        trackedDays += 1;
    }

    const percentages: Record<AvatarState, number> = {
        happy: trackedDays ? Math.round((counts.happy / trackedDays) * 100) : 0,
        sad: trackedDays ? Math.round((counts.sad / trackedDays) * 100) : 0,
        sleepy: trackedDays ? Math.round((counts.sleepy / trackedDays) * 100) : 0,
        calm: trackedDays ? Math.round((counts.calm / trackedDays) * 100) : 0,
    };

    return { counts, percentages, trackedDays };
}

export function linearSlope(points: XYPoint[]): number | null {
    if (points.length < 3) return null;
    const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    let num = 0;
    let den = 0;
    for (const point of points) {
        const dx = point.x - meanX;
        const dy = point.y - meanY;
        num += dx * dy;
        den += dx * dx;
    }
    if (den === 0) return null;
    return num / den;
}

export function confidenceLabel(size: number): string {
    if (size >= 12) return 'High';
    if (size >= 6) return 'Medium';
    return 'Low';
}

export function formatSigned(value: number | null, precision = 1): string {
    if (value === null) return 'Not enough data';
    if (Math.abs(value) < 0.05) return `~${(0).toFixed(precision)}`;
    return `${value > 0 ? '+' : ''}${value.toFixed(precision)}`;
}

export function formatEffect(value: number | null, unit: string, precision = 1): string {
    if (value === null) return 'Not enough data';
    return `${formatSigned(value, precision)} ${unit}`;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
    return Math.sqrt(variance);
}

export function averageDelta(values: number[]): number {
    if (values.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < values.length; i += 1) {
        total += Math.abs(values[i] - values[i - 1]);
    }
    return total / (values.length - 1);
}

function qualityFromCoverage(coveragePct: number): ConfidenceQuality {
    if (coveragePct >= 85) return 'High';
    if (coveragePct >= 60) return 'Medium';
    return 'Low';
}

export function qualityColor(quality: ConfidenceQuality): string {
    if (quality === 'High') return '#16a34a';
    if (quality === 'Medium') return '#f59e0b';
    return '#ef4444';
}

export function buildCoverage(
    days: number,
    endDate: string,
    healthEntries: HealthEntry[],
    moodEntries: MoodEntry[]
): CoverageSummary {
    const startDate = shiftDateString(endDate, -(days - 1));
    const healthInRange = filterByRange(healthEntries, startDate, endDate);
    const moodInRange = filterByRange(moodEntries, startDate, endDate);
    const healthByDay = new Set<string>(healthInRange.map((entry) => dayKey(entry.date)));
    const moodByDay = new Set<string>(moodInRange.map((entry) => dayKey(entry.date)));

    let healthDays = 0;
    let moodDays = 0;
    let completeDays = 0;
    for (let i = 0; i < days; i += 1) {
        const key = shiftDateString(startDate, i);
        const hasHealth = healthByDay.has(key);
        const hasMood = moodByDay.has(key);
        if (hasHealth) healthDays += 1;
        if (hasMood) moodDays += 1;
        if (hasHealth && hasMood) completeDays += 1;
    }

    const healthCoverage = Math.round((healthDays / days) * 100);
    const moodCoverage = Math.round((moodDays / days) * 100);
    const completeCoverage = Math.round((completeDays / days) * 100);
    const quality = qualityFromCoverage(completeCoverage);

    return { totalDays: days, healthDays, moodDays, completeDays, healthCoverage, moodCoverage, completeCoverage, quality };
}
