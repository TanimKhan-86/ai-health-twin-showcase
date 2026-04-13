import React, { useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Platform } from "react-native";
import { ScreenLayout } from "../../components/ScreenLayout";
import { ArrowLeft, Moon, Zap, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react-native";
import { DigitalTwinAvatar } from "../../components/DigitalTwinAvatar";
import { clearSeedDemoWeek, getHealthHistory, getMoodHistory, HealthEntry as HealthLogEntry, MoodEntry as MoodLogEntry } from "../../lib/api/auth";
import { LinearGradient } from "expo-linear-gradient";
import type { AppScreenProps } from "../../lib/navigation/types";
import { useToast } from "../../components/ui/Toast";
import { getLocalDateYmd } from "../../lib/date/localDay";

function avg(arr: number[]) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function toTitleCase(value: string): string {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function formatLogDay(value?: string): string {
    if (!value) return '—';
    if (value.includes('T')) return value.slice(0, 10);
    return value;
}

function getWeeklyWindow(baseDate: Date = new Date()): {
    startDate: Date;
    endDate: Date;
    startYmd: string;
    endYmd: string;
} {
    const endDate = new Date(baseDate);
    endDate.setDate(endDate.getDate() - 1); // yesterday
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6); // 7-day window ending yesterday
    return {
        startDate,
        endDate,
        startYmd: getLocalDateYmd(startDate),
        endYmd: getLocalDateYmd(endDate),
    };
}

function isDayWithinWindow(dayYmd: string, startYmd: string, endYmd: string): boolean {
    return dayYmd >= startYmd && dayYmd <= endYmd;
}

function generateNarrative(health: HealthLogEntry[]): string {
    if (!health.length) return "Start logging your health data and I'll generate your personal weekly story here! 📊";
    const avgEnergy = avg(health.map(e => e.energyScore ?? 0));
    const avgSleep = avg(health.map(e => e.sleepHours));
    const avgSteps = avg(health.map(e => e.steps));
    const energyLabel = avgEnergy >= 75 ? 'excellent' : avgEnergy >= 50 ? 'moderate' : 'low';
    const sleepLabel = avgSleep >= 7.5 ? 'well-rested' : avgSleep >= 6 ? 'somewhat rested' : 'sleep-deprived';
    const stepsLabel = avgSteps >= 8000 ? 'very active' : avgSteps >= 5000 ? 'moderately active' : 'lightly active';
    return `This week, your digital twin observed ${energyLabel} energy levels averaging ${Math.round(avgEnergy)}/100. You were ${sleepLabel} with ${avgSleep.toFixed(1)} hours of sleep per night, and ${stepsLabel} with an average of ${Math.round(avgSteps).toLocaleString()} steps per day. ${avgEnergy >= 65 ? 'Keep up the great work! 💪' : 'Try logging 30 more minutes of sleep each night — it has the biggest impact on your energy score.'}`;
}

function isSeededHealthEntry(entry: HealthLogEntry): boolean {
    if (entry.source === 'seed_demo') return true;
    return typeof entry.notes === 'string' && /^Demo entry day/i.test(entry.notes);
}

function isSeededMoodEntry(entry: MoodLogEntry): boolean {
    if (entry.source === 'seed_demo') return true;
    return typeof entry.notes === 'string' && /^Demo mood day/i.test(entry.notes);
}

export default function WeeklySummaryScreen({ navigation }: AppScreenProps<'WeeklySummary'>) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [health, setHealth] = useState<HealthLogEntry[]>([]);
    const [moods, setMoods] = useState<MoodLogEntry[]>([]);
    const [requiresSeed, setRequiresSeed] = useState(false);
    const [clearingSeed, setClearingSeed] = useState(false);
    const loadSummary = useCallback(async () => {
        setLoading(true);
        try {
            // Pull a wider range, then strictly compute summary from last 7 days before today.
            const [h, m] = await Promise.all([getHealthHistory(30), getMoodHistory(30)]);
            const { startYmd, endYmd } = getWeeklyWindow();

            const seededHealthWindow = h.filter((entry) => {
                const day = formatLogDay(entry.date);
                return isDayWithinWindow(day, startYmd, endYmd) && isSeededHealthEntry(entry);
            });
            const seededMoodWindow = m.filter((entry) => {
                const day = formatLogDay(entry.date);
                return isDayWithinWindow(day, startYmd, endYmd) && isSeededMoodEntry(entry);
            });

            const seededHealthDays = new Set(seededHealthWindow.map((entry) => formatLogDay(entry.date))).size;
            const seededMoodDays = new Set(seededMoodWindow.map((entry) => formatLogDay(entry.date))).size;
            const hasCompleteSeededWeek = seededHealthDays >= 7 && seededMoodDays >= 7;

            setRequiresSeed(!hasCompleteSeededWeek);
            if (hasCompleteSeededWeek) {
                setHealth(seededHealthWindow);
                setMoods(seededMoodWindow);
            } else {
                setHealth([]);
                setMoods([]);
            }
        } catch (e) { console.error("Weekly summary load error", e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        void loadSummary();
        const unsubscribe = navigation.addListener('focus', () => {
            void loadSummary();
        });
        return unsubscribe;
    }, [navigation, loadSummary]);

    const avgEnergy = Math.round(avg(health.map(e => e.energyScore ?? 0)));
    const avgSleep = avg(health.map(e => e.sleepHours)).toFixed(1);
    const avgSteps = Math.round(avg(health.map(e => e.steps)));
    const bestDay = health.reduce<HealthLogEntry | null>((best, entry) => {
        if (!best) return entry;
        return (entry.energyScore ?? 0) > (best.energyScore ?? 0) ? entry : best;
    }, null);

    const trend: 'improving' | 'declining' | 'stable' = (() => {
        if (health.length < 4) return 'stable';
        const sorted = [...health].sort((a, b) => a.date.localeCompare(b.date));
        const first = avg(sorted.slice(0, 3).map(e => e.energyScore ?? 0));
        const last = avg(sorted.slice(-3).map(e => e.energyScore ?? 0));
        return last > first + 5 ? 'improving' : last < first - 5 ? 'declining' : 'stable';
    })();

    const TrendIcon = trend === 'improving' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus;
    const trendColor = trend === 'improving' ? '#10b981' : trend === 'declining' ? '#ef4444' : '#6b7280';
    const trendBg = trend === 'improving' ? '#ecfdf5' : trend === 'declining' ? '#fef2f2' : '#f3f4f6';
    const moodCounts = moods.reduce<Record<string, number>>((acc, entry) => {
        const key = entry.mood || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    const moodBreakdown = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);
    const dominantMood = moodBreakdown[0]?.[0] ?? null;
    const dominantMoodPercent = moods.length > 0 && moodBreakdown[0]
        ? Math.round((moodBreakdown[0][1] / moods.length) * 100)
        : 0;
    const avgMoodEnergy = moods.length ? Math.round(avg(moods.map((entry) => entry.energyLevel))) : null;
    const avgMoodStress = moods.length ? Math.round(avg(moods.map((entry) => entry.stressLevel))) : null;
    const moodTrend: 'improving' | 'declining' | 'stable' = (() => {
        if (moods.length < 4) return 'stable';
        const sorted = [...moods].sort((a, b) => a.date.localeCompare(b.date));
        const sampleSize = Math.min(3, sorted.length);
        const firstStress = avg(sorted.slice(0, sampleSize).map((entry) => entry.stressLevel));
        const lastStress = avg(sorted.slice(-sampleSize).map((entry) => entry.stressLevel));
        if (lastStress < firstStress - 0.8) return 'improving';
        if (lastStress > firstStress + 0.8) return 'declining';
        return 'stable';
    })();
    const moodTrendColor = moodTrend === 'improving' ? '#10b981' : moodTrend === 'declining' ? '#ef4444' : '#6b7280';
    const moodTrendLabel = moodTrend === 'improving'
        ? 'Stress trend improving'
        : moodTrend === 'declining'
            ? 'Stress trend rising'
            : 'Stress trend stable';

    const weeklyWindow = getWeeklyWindow();
    const startDate = weeklyWindow.startYmd.slice(5, 10);
    const endDate = weeklyWindow.endYmd.slice(5, 10);

    const performClearSeededData = useCallback(async () => {
        if (clearingSeed) return;
        setClearingSeed(true);
        try {
            const result = await clearSeedDemoWeek();
            if (!result) {
                showToast('Failed to clear seeded data', 'error');
                return;
            }
            showToast(
                `Cleared ${result.healthEntriesDeleted} health + ${result.moodEntriesDeleted} mood demo rows`,
                'success'
            );
            await loadSummary();
        } catch (error) {
            console.error('Failed to clear seeded data:', error);
            showToast('Failed to clear seeded data', 'error');
        } finally {
            setClearingSeed(false);
        }
    }, [clearingSeed, loadSummary, showToast]);

    const handleClearSeededData = useCallback(() => {
        const message = 'This will remove all seeded weekly demo rows from your account. Continue?';
        if (Platform.OS === 'web') {
            const shouldContinue = typeof window === 'undefined' ? true : window.confirm(message);
            if (!shouldContinue) return;
            void performClearSeededData();
            return;
        }
        Alert.alert(
            'Clear Seeded Data',
            message,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => { void performClearSeededData(); },
                },
            ]
        );
    }, [performClearSeededData]);

    return (
        <ScreenLayout gradientBackground>
            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#7c3aed" />
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <LinearGradient colors={["#10b981", "#059669"]} style={styles.headerGrad}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <ArrowLeft color="white" size={18} />
                            <Text style={styles.backText}>Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Weekly Report</Text>
                        <Text style={styles.headerSub}>{startDate} – {endDate} · MongoDB ☁️</Text>
                    </LinearGradient>

                    {requiresSeed ? (
                        <View style={styles.seedGateWrap}>
                            <View style={styles.seedGateCard}>
                                <Text style={styles.seedGateTitle}>Weekly data not ready yet</Text>
                                <Text style={styles.seedGateText}>
                                    Seed 7 Days Demo data from Settings first, then come back to Weekly Report.
                                </Text>
                                <TouchableOpacity
                                    style={styles.seedGatePrimaryButton}
                                    onPress={() => navigation.navigate('Settings')}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.seedGatePrimaryButtonText}>Go to Settings</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.seedGateSecondaryButton}
                                    onPress={() => { void loadSummary(); }}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.seedGateSecondaryButtonText}>I seeded data, refresh</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                    <ScrollView contentContainerStyle={styles.scroll}>
                        <View style={styles.clearSeedWrap}>
                            <TouchableOpacity
                                style={[styles.clearSeedButton, clearingSeed ? styles.clearSeedButtonDisabled : undefined]}
                                onPress={handleClearSeededData}
                                activeOpacity={0.85}
                                disabled={clearingSeed}
                            >
                                <Text style={styles.clearSeedButtonText}>
                                    {clearingSeed ? 'Clearing seeded data...' : 'Clear Seeded Data'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Narrative */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={[styles.iconWrap, { backgroundColor: '#ecfdf5' }]}><Activity size={18} color="#10b981" /></View>
                                <Text style={styles.cardTitle}>Your Twin's Analysis</Text>
                            </View>
                            <View style={styles.avatarBlock}><DigitalTwinAvatar /></View>
                            <View style={styles.narrativeBox}>
                                <Text style={styles.narrativeText}>"{generateNarrative(health)}"</Text>
                            </View>
                        </View>

                        <Text style={styles.sectionLabel}>KEY HIGHLIGHTS</Text>
                        {health.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Text style={styles.emptyText}>No logs this week. Use the Daily Log screen to start tracking! 📝</Text>
                            </View>
                        ) : (
                            <View style={{ gap: 10 }}>
                                <View style={styles.card}>
                                    <View style={styles.row}>
                                        <View style={[styles.iconWrap, { backgroundColor: trendBg }]}><TrendIcon size={18} color={trendColor} /></View>
                                        <View style={styles.rowBody}>
                                            <Text style={styles.rowTitle}>Energy Trend</Text>
                                            <Text style={styles.rowSub}>Avg Score: {avgEnergy}/100 · {trend}</Text>
                                        </View>
                                        <Text numberOfLines={1} style={[styles.bigStat, { color: trendColor }]}>{avgEnergy}</Text>
                                    </View>
                                </View>
                                <View style={styles.card}>
                                    <View style={styles.row}>
                                        <View style={[styles.iconWrap, { backgroundColor: '#eef2ff' }]}><Moon size={18} color="#6366f1" /></View>
                                        <View style={styles.rowBody}>
                                            <Text style={styles.rowTitle}>Sleep & Activity</Text>
                                            <Text style={styles.rowSub}>{avgSteps.toLocaleString()} steps · {avgSleep}h sleep</Text>
                                        </View>
                                        <Text numberOfLines={1} style={[styles.bigStat, { color: '#6366f1' }]}>{avgSleep}h</Text>
                                    </View>
                                </View>
                                {bestDay && (
                                    <View style={styles.card}>
                                        <View style={styles.row}>
                                            <View style={[styles.iconWrap, { backgroundColor: '#fffbeb' }]}><Zap size={18} color="#f59e0b" /></View>
                                            <View style={styles.rowBody}>
                                                <Text style={styles.rowTitle}>Peak Performance</Text>
                                                <Text style={styles.rowSub}>Best day: {formatLogDay(bestDay.date)}</Text>
                                            </View>
                                            <Text numberOfLines={1} style={[styles.bigStat, { color: '#f59e0b' }]}>{Math.round(bestDay.energyScore ?? 0)}</Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        <Text style={styles.sectionLabel}>MOOD SUMMARY</Text>
                        {moods.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Text style={styles.emptyText}>No mood logs this week. Add your daily mood to unlock mood trends.</Text>
                            </View>
                        ) : (
                            <View style={{ gap: 10 }}>
                                <View style={styles.card}>
                                    <View style={styles.row}>
                                        <View style={[styles.iconWrap, { backgroundColor: '#ede9fe' }]}><Activity size={18} color="#7c3aed" /></View>
                                        <View style={styles.rowBody}>
                                            <Text style={styles.rowTitle}>Mood Trend</Text>
                                            <Text style={styles.rowSub}>
                                                {dominantMood ? `${toTitleCase(dominantMood)} dominated (${dominantMoodPercent}%)` : 'No dominant mood yet'}
                                            </Text>
                                        </View>
                                        <View style={[styles.trendBadge, { backgroundColor: trendBg }]}>
                                            <Text style={[styles.trendBadgeText, { color: moodTrendColor }]}>{moodTrendLabel}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.card}>
                                    <View style={styles.row}>
                                        <View style={[styles.iconWrap, { backgroundColor: '#fffbeb' }]}><Zap size={18} color="#f59e0b" /></View>
                                        <View style={styles.rowBody}>
                                            <Text style={styles.rowTitle}>Mood Energy vs Stress</Text>
                                            <Text style={styles.rowSub}>
                                                Avg mood energy {avgMoodEnergy ?? '—'}/10 · stress {avgMoodStress ?? '—'}/10
                                            </Text>
                                        </View>
                                        <Text numberOfLines={1} style={[styles.bigStat, { color: '#7c3aed', fontSize: 18 }]}>{moods.length}d</Text>
                                    </View>
                                </View>

                                <View style={styles.card}>
                                    <Text style={styles.rowTitle}>Mood Distribution</Text>
                                    <View style={styles.moodChipRow}>
                                        {moodBreakdown.map(([moodName, count]) => (
                                            <View key={moodName} style={styles.moodChip}>
                                                <Text style={styles.moodChipText}>
                                                    {toTitleCase(moodName)} · {Math.round((count / moods.length) * 100)}%
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                    )}
                </View>
            )}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    headerGrad: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 16 },
    backText: { color: '#fff', fontWeight: '700' },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4, flexShrink: 1, lineHeight: 18 },
    scroll: { padding: 16, paddingBottom: 60 },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: '#7c3aed', marginBottom: 8, marginTop: 4, letterSpacing: 0.8 },
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 10, shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, minWidth: 0 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: '#1e1b4b', flexShrink: 1 },
    iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    avatarBlock: { width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 2, marginBottom: 4 },
    narrativeBox: { backgroundColor: '#f5f3ff', borderRadius: 14, padding: 16, borderLeftWidth: 3, borderLeftColor: '#10b981', marginTop: 8 },
    narrativeText: { color: '#374151', fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 15, fontWeight: '700', color: '#1e1b4b' },
    rowSub: { fontSize: 12, color: '#9ca3af', marginTop: 2, lineHeight: 17 },
    bigStat: { fontSize: 22, fontWeight: '800', minWidth: 56, textAlign: 'right', marginLeft: 6 },
    trendBadge: { maxWidth: 122, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: '#e5e7eb' },
    trendBadgeText: { fontSize: 11, fontWeight: '700', textAlign: 'right' },
    emptyCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center' },
    emptyText: { color: '#6b7280', textAlign: 'center', lineHeight: 22 },
    moodChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    moodChip: { backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#e9d5ff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
    moodChipText: { fontSize: 12, fontWeight: '600', color: '#5b21b6' },
    seedGateWrap: { flex: 1, padding: 16, justifyContent: 'center' },
    seedGateCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 5,
    },
    seedGateTitle: { fontSize: 22, fontWeight: '800', color: '#1f2937', marginBottom: 10, textAlign: 'center' },
    seedGateText: { fontSize: 15, color: '#6b7280', lineHeight: 24, textAlign: 'center', marginBottom: 20 },
    seedGatePrimaryButton: {
        backgroundColor: '#10b981',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 18,
        alignItems: 'center',
    },
    seedGatePrimaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    seedGateSecondaryButton: {
        marginTop: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#d1fae5',
        backgroundColor: '#ecfdf5',
        paddingVertical: 12,
        paddingHorizontal: 18,
        alignItems: 'center',
    },
    seedGateSecondaryButtonText: { color: '#047857', fontSize: 14, fontWeight: '700' },
    clearSeedWrap: { marginBottom: 8, alignItems: 'flex-end' },
    clearSeedButton: {
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    clearSeedButtonDisabled: {
        opacity: 0.6,
    },
    clearSeedButtonText: {
        color: '#b91c1c',
        fontSize: 13,
        fontWeight: '700',
    },
});
