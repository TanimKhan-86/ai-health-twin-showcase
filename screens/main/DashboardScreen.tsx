import React, { useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Platform, Image, StyleSheet } from "react-native";
import { ScreenLayout } from "../../components/ScreenLayout";
import { DigitalTwinAvatar } from "../../components/DigitalTwinAvatar";
import { Activity, Heart, Moon, Zap } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { getStreak, getTodayHealth } from "../../lib/api/auth";
import { apiFetch } from "../../lib/api/client";
import { LinearGradient } from "expo-linear-gradient";
import { useToast } from "../../components/ui/Toast";
import type { AppScreenProps } from "../../lib/navigation/types";
import type { HealthEntry } from "../../lib/api/auth";
import type { RootStackParamList } from "../../lib/navigation/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { AppButton } from "../../components/ui/AppButton";
import { appTheme } from "../../lib/theme/tokens";
import { FadeInSection } from "../../components/ui/FadeInSection";

const SIMULATED_HEART_RATE_MIN = 64;
const SIMULATED_HEART_RATE_MAX = 86;
const SIMULATED_HEART_RATE_BASE = 74;
const SIMULATED_HEART_RATE_VARIANCE = 4;
const SIMULATED_HEART_RATE_DELAY_MIN_MS = 2000;
const SIMULATED_HEART_RATE_DELAY_MAX_MS = 5000;

interface MetricCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    subValue: string;
    iconBg: string;
}

function MetricCard({ icon, label, value, subValue, iconBg }: MetricCardProps) {
    const [hovered, setHovered] = useState(false);
    return (
        <Pressable
            onHoverIn={() => setHovered(true)}
            onHoverOut={() => setHovered(false)}
            style={({ pressed }) => [
                styles.metricCard,
                hovered ? styles.metricCardHover : undefined,
                pressed ? styles.metricCardPressed : undefined,
            ]}
        >
            <View style={[styles.metricIcon, { backgroundColor: iconBg }]}>{icon}</View>
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={styles.metricSub}>{subValue}</Text>
        </Pressable>
    );
}

function clampHeartRate(value: number): number {
    return Math.min(SIMULATED_HEART_RATE_MAX, Math.max(SIMULATED_HEART_RATE_MIN, value));
}

function getInitialSimulatedHeartRate(health: HealthEntry): number {
    const energyBias = typeof health.energyScore === 'number'
        ? Math.round((health.energyScore - 50) / 12)
        : 0;
    const sleepBias = typeof health.sleepHours === 'number'
        ? Math.round((health.sleepHours - 7) * 1.5)
        : 0;
    const stepsBias = typeof health.steps === 'number'
        ? Math.round(Math.min(4, health.steps / 4000))
        : 0;
    const randomOffset = Math.floor(Math.random() * ((SIMULATED_HEART_RATE_VARIANCE * 2) + 1)) - SIMULATED_HEART_RATE_VARIANCE;
    return clampHeartRate(SIMULATED_HEART_RATE_BASE + energyBias - sleepBias + stepsBias + randomOffset);
}

function getNextSimulatedHeartRate(previous: number): number {
    const delta = Math.floor(Math.random() * 5) - 2;
    return clampHeartRate(previous + delta);
}

export default function DashboardScreen({ navigation }: AppScreenProps<'Main'>) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [streak, setStreak] = useState(0);
    const [todayHealth, setTodayHealth] = useState<HealthEntry | null>(null);
    const [simulatedHeartRate, setSimulatedHeartRate] = useState<number | null>(null);
    const [avatarKey, setAvatarKey] = useState("init");
    const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(user?.profileImage ?? null);
    const [hoveredHeaderItem, setHoveredHeaderItem] = useState<'streak' | 'avatar' | null>(null);
    const [hoveredActionRow, setHoveredActionRow] = useState<string | null>(null);
    const webPointerStyle = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined;

    useEffect(() => {
        setProfileAvatarUrl(user?.profileImage ?? null);
        setAvatarKey(`user-${user?.id ?? 'anon'}-${Date.now()}`);
    }, [user?.id, user?.profileImage]);

    const loadDashboard = useCallback(async () => {
        try {
            const [streakData, health, avatarStatus] = await Promise.all([
                getStreak(),
                getTodayHealth(),
                apiFetch<{ hasAvatar: boolean; avatarUrl?: string }>('/api/avatar/status'),
            ]);
            setStreak(streakData?.currentStreak ?? 0);
            setTodayHealth(health);
            setProfileAvatarUrl((avatarStatus.success ? avatarStatus.data?.avatarUrl ?? null : null) ?? user?.profileImage ?? null);
            setAvatarKey(Date.now().toString()); // Force avatar refresh
        } catch (e) { console.warn('Dashboard load error:', e); }
    }, [user?.id, user?.profileImage]);

    useEffect(() => {
        void loadDashboard();
        const unsubscribe = navigation.addListener('focus', () => {
            void loadDashboard();
        });
        return unsubscribe;
    }, [navigation, loadDashboard]);

    useEffect(() => {
        const hasSavedDailyLog = !!todayHealth;
        const hasRealHeartRate = typeof todayHealth?.heartRate === 'number' && todayHealth.heartRate > 0;

        if (!hasSavedDailyLog || hasRealHeartRate) {
            setSimulatedHeartRate(null);
            return;
        }

        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let cancelled = false;

        setSimulatedHeartRate((previous) => previous ?? getInitialSimulatedHeartRate(todayHealth));

        const scheduleNextBeat = () => {
            const delay = SIMULATED_HEART_RATE_DELAY_MIN_MS
                + Math.floor(Math.random() * ((SIMULATED_HEART_RATE_DELAY_MAX_MS - SIMULATED_HEART_RATE_DELAY_MIN_MS) + 1));

            timeoutId = setTimeout(() => {
                if (cancelled) return;
                setSimulatedHeartRate((previous) => getNextSimulatedHeartRate(previous ?? getInitialSimulatedHeartRate(todayHealth)));
                scheduleNextBeat();
            }, delay);
        };

        scheduleNextBeat();

        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [todayHealth]);

    const firstName = user?.name?.split(' ')[0] || 'there';
    const greeting = (() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    })();
    const initials = user?.name
        ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';
    const displayedHeartRate = typeof todayHealth?.heartRate === 'number' && todayHealth.heartRate > 0
        ? Math.round(todayHealth.heartRate)
        : simulatedHeartRate;
    const heartRateValue = typeof displayedHeartRate === 'number'
        ? `${displayedHeartRate} BPM`
        : '—';
    const heartRateSub = typeof displayedHeartRate === 'number'
        ? (displayedHeartRate >= 100 ? 'High' : displayedHeartRate < 60 ? 'Low' : 'Normal')
        : 'Log today';
    const actionItems: Array<{
        icon: string;
        label: string;
        sub: string;
        screen: keyof RootStackParamList;
        color: string;
    }> = [
        { icon: '📋', label: 'Log Daily Vitals', sub: 'Saved to MongoDB ☁️', screen: 'DailyLog', color: '#7c3aed' },
        { icon: '🌀', label: 'What-If Scenarios', sub: 'AI Predictions', screen: 'WhatIf', color: '#6366f1' },
        { icon: '🏆', label: 'Achievements', sub: `🔥 ${streak} day streak`, screen: 'Achievements', color: '#f59e0b' },
        { icon: '📈', label: 'Weekly Summary', sub: "Your Twin's Report", screen: 'WeeklySummary', color: '#10b981' },
    ];

    return (
        <ScreenLayout gradientBackground>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                {/* Header */}
                <PageHeader
                    title={`${greeting}, ${firstName} 👋`}
                    subtitle="Your health snapshot"
                    gradientColors={[appTheme.colors.brand, appTheme.colors.brandDark]}
                    rightSlot={(
                        <View style={styles.headerRight}>
                            <Pressable
                                onPress={() => navigation.navigate('Achievements')}
                                onHoverIn={() => setHoveredHeaderItem('streak')}
                                onHoverOut={() => setHoveredHeaderItem(null)}
                                style={({ pressed }) => [
                                    styles.streakBadge,
                                    hoveredHeaderItem === 'streak' ? styles.headerChipHover : undefined,
                                    pressed ? styles.headerChipPressed : undefined,
                                    webPointerStyle,
                                ]}
                            >
                                <Text style={styles.streakEmoji}>🔥</Text>
                                <Text style={styles.streakNum}>{streak}</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => navigation.navigate("Settings")}
                                onHoverIn={() => setHoveredHeaderItem('avatar')}
                                onHoverOut={() => setHoveredHeaderItem(null)}
                                style={({ pressed }) => [
                                    styles.avatarWrap,
                                    hoveredHeaderItem === 'avatar' ? styles.headerChipHover : undefined,
                                    pressed ? styles.headerChipPressed : undefined,
                                    webPointerStyle,
                                ]}
                            >
                                {profileAvatarUrl
                                    ? <Image source={{ uri: profileAvatarUrl }} style={styles.avatarImg} />
                                    : <Text style={styles.avatarInitials}>{initials}</Text>}
                            </Pressable>
                        </View>
                    )}
                />

                {/* Avatar Section */}
                <FadeInSection delay={40}>
                    <View style={styles.avatarSection}>
                        <DigitalTwinAvatar key={avatarKey} showStateLabel />
                    </View>
                </FadeInSection>

                {/* Metric Cards */}
                <FadeInSection delay={80}>
                    <View style={styles.metricsContainer}>
                        <Text style={styles.sectionTitle}>Live Health Metrics</Text>
                        <View style={styles.metricsGrid}>
                            <MetricCard
                                icon={<Heart color="#ef4444" size={18} />} iconBg="#fef2f2"
                                label="Heart Rate" value={heartRateValue} subValue={heartRateSub}
                            />
                            <MetricCard
                                icon={<Activity color="#7c3aed" size={18} />} iconBg="#f5f3ff"
                                label="Steps"
                                value={todayHealth?.steps != null ? todayHealth.steps.toLocaleString() : '—'}
                                subValue={todayHealth?.steps != null ? (todayHealth.steps >= 8000 ? '🏃 Great!' : 'Keep going!') : 'Log today'}
                            />
                            <MetricCard
                                icon={<Moon color="#6366f1" size={18} />} iconBg="#eef2ff"
                                label="Sleep"
                                value={todayHealth?.sleepHours != null ? `${todayHealth.sleepHours}h` : '—'}
                                subValue={todayHealth?.sleepHours != null ? (todayHealth.sleepHours >= 7 ? '😴 Rested' : 'Need rest') : 'Log today'}
                            />
                            <MetricCard
                                icon={<Zap color="#f59e0b" size={18} />} iconBg="#fffbeb"
                                label="Energy"
                                value={todayHealth?.energyScore != null ? `${Math.round(todayHealth.energyScore)}` : '—'}
                                subValue={todayHealth?.energyScore != null ? (todayHealth.energyScore >= 70 ? '⚡ High' : 'Low') : 'Log today'}
                            />
                        </View>
                    </View>
                </FadeInSection>

                {/* Quick Actions */}
                <FadeInSection delay={120}>
                    <View style={styles.quickActions}>
                        <View style={{ flex: 1 }}>
                            <AppButton
                                label="Future You"
                                onPress={() => navigation.navigate('FutureYou')}
                                variant="secondary"
                                icon={<Text style={{ fontSize: 14 }}>🔮</Text>}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <AppButton
                                label="Analytics"
                                onPress={() => navigation.navigate('Analytics')}
                                variant="secondary"
                                icon={<Text style={{ fontSize: 14 }}>📊</Text>}
                            />
                        </View>
                    </View>
                </FadeInSection>

                {/* Action List */}
                <FadeInSection delay={160}>
                    <View style={styles.actionList}>
                    {actionItems.map((item) => (
                        <Pressable
                            key={item.screen}
                            style={({ pressed }) => [
                                styles.actionRow,
                                hoveredActionRow === item.screen ? styles.actionRowHover : undefined,
                                pressed ? styles.actionRowPressed : undefined,
                                webPointerStyle,
                            ]}
                            onHoverIn={() => setHoveredActionRow(item.screen)}
                            onHoverOut={() => setHoveredActionRow(null)}
                            onPress={() => navigation.navigate(item.screen)}
                        >
                            <View style={[styles.actionIconWrap, { backgroundColor: item.color + '18' }]}>
                                <Text style={styles.actionIconEmoji}>{item.icon}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.actionLabel}>{item.label}</Text>
                                <Text style={styles.actionSub}>{item.sub}</Text>
                            </View>
                            <Text style={styles.actionChevron}>›</Text>
                        </Pressable>
                    ))}

                    <Pressable
                        style={({ pressed }) => [
                            styles.actionRow,
                            hoveredActionRow === 'watch' ? styles.actionRowHover : undefined,
                            pressed ? styles.actionRowPressed : undefined,
                            webPointerStyle,
                        ]}
                        onHoverIn={() => setHoveredActionRow('watch')}
                        onHoverOut={() => setHoveredActionRow(null)}
                        onPress={() => showToast('⌚ Digital watch connection coming soon', 'info')}
                    >
                        <View style={[styles.actionIconWrap, { backgroundColor: '#0ea5e918' }]}>
                            <Text style={styles.actionIconEmoji}>⌚</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.actionLabel}>Connect Digital Watch</Text>
                            <Text style={styles.actionSub}>Coming soon</Text>
                        </View>
                        <Text style={styles.actionChevron}>›</Text>
                    </Pressable>

                    {/* AI Weekly Analysis — featured */}
                    <Pressable
                        onPress={() => navigation.navigate("AIWeeklyAnalysis")}
                        onHoverIn={() => setHoveredActionRow('ai-analysis')}
                        onHoverOut={() => setHoveredActionRow(null)}
                        style={({ pressed }) => [
                            hoveredActionRow === 'ai-analysis' ? styles.aiActionHoverWrap : undefined,
                            pressed ? styles.aiActionPressedWrap : undefined,
                            webPointerStyle,
                        ]}
                    >
                        <LinearGradient
                            colors={["#7c3aed", "#6d28d9"]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={[
                                styles.aiActionRow,
                                hoveredActionRow === 'ai-analysis' ? styles.aiActionRowHover : undefined,
                            ]}
                        >
                            <View style={styles.aiIconWrap}>
                                <Text style={{ fontSize: 22 }}>🤖</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.aiActionLabel}>Your Weekly Analysis</Text>
                                <Text style={styles.aiActionSub}>Powered by Gemini AI ✨</Text>
                            </View>
                            <Text style={styles.aiChevron}>›</Text>
                        </LinearGradient>
                    </Pressable>
                    </View>
                </FadeInSection>
            </ScrollView>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    scroll: { paddingBottom: 100 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 4, borderWidth: 1, borderColor: '#e9d5ff' },
    headerChipHover: { transform: [{ translateY: -1 }], shadowOpacity: 0.16, shadowRadius: 10 },
    headerChipPressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
    streakEmoji: { fontSize: 16 },
    streakNum: { fontWeight: '800', color: '#7c3aed', fontSize: 15 },
    avatarWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#fff' },
    avatarImg: { width: 40, height: 40, borderRadius: 20 },
    avatarInitials: { color: '#fff', fontWeight: '800', fontSize: 14 },

    avatarSection: { height: 280, justifyContent: 'center' },

    metricsContainer: { paddingHorizontal: 20, marginBottom: 16 },
    sectionTitle: { ...appTheme.typography.h3, color: appTheme.colors.textPrimary, marginBottom: 12 },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    metricCard: {
        flex: 1, minWidth: '45%', backgroundColor: '#ffffff',
        borderRadius: 20, padding: 16, alignItems: 'center',
        shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
        borderWidth: 1, borderColor: '#f3f0ff',
    },
    metricCardHover: {
        transform: [{ translateY: -2 }],
        shadowOpacity: 0.14,
        shadowRadius: 16,
    },
    metricCardPressed: {
        opacity: 0.96,
        transform: [{ scale: 0.99 }],
    },
    metricIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    metricValue: { ...appTheme.typography.metric, color: appTheme.colors.textPrimary },
    metricLabel: { ...appTheme.typography.caption, color: appTheme.colors.textSecondary, marginTop: 2 },
    metricSub: { ...appTheme.typography.overline, color: appTheme.colors.brandDark, marginTop: 2 },

    quickActions: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, gap: 10 },

    actionList: { paddingHorizontal: 20, gap: 10 },
    actionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 14, shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#f3f0ff' },
    actionIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    actionIconEmoji: { fontSize: 20 },
    actionLabel: { ...appTheme.typography.bodyStrong, color: appTheme.colors.textPrimary },
    actionSub: { ...appTheme.typography.caption, color: appTheme.colors.textMuted, marginTop: 2 },
    actionChevron: { fontSize: 22, color: '#c4b5fd', fontWeight: '300' },
    actionRowHover: {
        transform: [{ translateY: -1 }],
        shadowOpacity: 0.12,
        shadowRadius: 12,
    },
    actionRowPressed: {
        opacity: 0.94,
        transform: [{ scale: 0.995 }],
    },

    aiActionRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 16, gap: 14, shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
    aiActionRowHover: { shadowOpacity: 0.36, shadowRadius: 14 },
    aiActionHoverWrap: { transform: [{ translateY: -1 }] },
    aiActionPressedWrap: { opacity: 0.95, transform: [{ scale: 0.995 }] },
    aiIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    aiActionLabel: { ...appTheme.typography.bodyStrong, color: '#ffffff' },
    aiActionSub: { ...appTheme.typography.caption, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
    aiChevron: { fontSize: 22, color: 'rgba(255,255,255,0.6)', fontWeight: '300' },
});
