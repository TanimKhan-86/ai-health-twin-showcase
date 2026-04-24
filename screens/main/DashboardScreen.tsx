import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    Platform,
    Image,
    StyleSheet,
    useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Activity, Heart, Moon, Zap } from "lucide-react-native";
import { ScreenLayout } from "../../components/ScreenLayout";
import { DigitalTwinAvatar } from "../../components/DigitalTwinAvatar";
import { useAuth } from "../../contexts/AuthContext";
import { getStreak, getTodayHealth } from "../../lib/api/auth";
import { apiFetch } from "../../lib/api/client";
import type { AppScreenProps, RootStackParamList } from "../../lib/navigation/types";
import type { HealthEntry } from "../../lib/api/auth";
import { getLocalDateYmd } from "../../lib/date/localDay";
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
const DASHBOARD_ACCENT = '#f4b544';
const DASHBOARD_ACCENT_DEEP = '#b77910';
const DASHBOARD_ACCENT_SOFT = '#fff3da';
const DASHBOARD_SURFACE = '#fffdf8';
const DASHBOARD_BORDER = '#efe3d0';
const DASHBOARD_BORDER_SOFT = '#f4eadb';
const DASHBOARD_MUTED = '#9a855f';

type MetricTone = {
    accent: string;
    soft: string;
};

interface MetricCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    status: string;
    insight: string;
    targetLabel: string;
    meterValue: number;
    tone: MetricTone;
}

interface ActionCardProps {
    icon: string;
    eyebrow: string;
    title: string;
    description: string;
    accent: string;
    screen: keyof RootStackParamList;
    featured?: boolean;
    onPress: () => void;
}

function MetricCard({ icon, label, value, status, insight, targetLabel, meterValue, tone }: MetricCardProps) {
    const [hovered, setHovered] = useState(false);
    const clampedMeter = Math.max(0.04, Math.min(1, meterValue));

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
            <View style={[styles.metricAura, { backgroundColor: `${tone.accent}12` }]} />
            <View style={styles.metricCardHeader}>
                <View style={styles.metricTitleRow}>
                    <View style={[styles.metricIcon, { backgroundColor: tone.soft }]}>{icon}</View>
                    <Text style={styles.metricLabel}>{label}</Text>
                </View>
                <View style={[styles.metricStatusPill, { backgroundColor: tone.soft, borderColor: `${tone.accent}30` }]}>
                    <View style={[styles.metricAccentDot, { backgroundColor: tone.accent }]} />
                    <Text style={[styles.metricStatusText, { color: tone.accent }]}>{status}</Text>
                </View>
            </View>
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={styles.metricInsight}>{insight}</Text>
            <View style={styles.metricMeterBlock}>
                <View style={styles.metricMeterMetaRow}>
                    <Text style={styles.metricMetaText}>{label} signal</Text>
                    <Text style={[styles.metricMetaText, { color: tone.accent }]}>{targetLabel}</Text>
                </View>
                <View style={styles.metricMeterTrack}>
                    <View style={[styles.metricMeterFill, { width: `${clampedMeter * 100}%`, backgroundColor: tone.accent }]} />
                </View>
            </View>
        </Pressable>
    );
}

function ActionCard({ icon, eyebrow, title, description, accent, featured = false, onPress }: ActionCardProps) {
    const [hovered, setHovered] = useState(false);

    return (
        <Pressable
            onPress={onPress}
            onHoverIn={() => setHovered(true)}
            onHoverOut={() => setHovered(false)}
            style={({ pressed }) => [
                styles.actionCard,
                featured ? [styles.actionCardFeatured, { borderColor: `${accent}44` }] : undefined,
                hovered ? styles.actionCardHover : undefined,
                pressed ? styles.actionCardPressed : undefined,
                Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined,
            ]}
        >
            <View style={styles.actionCardTopRow}>
                <View style={[styles.actionIconWrap, { backgroundColor: `${accent}18` }]}>
                    <Text style={styles.actionIcon}>{icon}</Text>
                </View>
                <Text style={styles.actionArrow}>↗</Text>
            </View>
            <Text style={[styles.actionEyebrow, { color: accent }]}>{eyebrow}</Text>
            <Text style={styles.actionTitle}>{title}</Text>
            <Text style={styles.actionDescription}>{description}</Text>
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

function getHeroMoodLabel(avatarState: string | null): string {
    const state = avatarState?.trim().toLowerCase();
    if (state === 'happy') return 'happy';
    if (state === 'sad') return 'sad';
    if (state === 'calm') return 'calm';
    if (state === 'sleepy' || state === 'tired') return 'sleepy';
    if (state === 'stressed') return 'stressed';
    return 'balanced';
}

function buildDashboardNarrative(avatarState: string | null): { title: string; body: string } {
    return {
        title: `Your twin feels ${getHeroMoodLabel(avatarState)} today`,
        body: "Your latest signals show solid recovery, healthy movement, and stable energy.",
    };
}

function buildMetricSignals(todayHealth: HealthEntry | null, heartRateValue: string, heartRateSub: string, streak: number) {
    return [
        {
            label: 'Heart rate',
            icon: '♥',
            value: heartRateValue,
            caption: heartRateSub,
            target: 'Target 60-100',
            accent: '#ef4444',
            meterValue: todayHealth?.heartRate ? (todayHealth.heartRate - 50) / 60 : 0.4,
        },
        {
            label: 'Sleep',
            icon: '☾',
            value: todayHealth?.sleepHours != null ? `${todayHealth.sleepHours.toFixed(1)}h` : 'Awaiting log',
            caption: todayHealth?.sleepHours != null ? (todayHealth.sleepHours >= 7 ? 'Recovered' : 'Needs rest') : 'Daily input needed',
            target: 'Goal 8h',
            accent: '#6366f1',
            meterValue: todayHealth?.sleepHours != null ? todayHealth.sleepHours / 8 : 0.2,
        },
        {
            label: 'Energy',
            icon: '⚡',
            value: todayHealth?.energyScore != null ? `${Math.round(todayHealth.energyScore)}/100` : 'Awaiting log',
            caption: todayHealth?.energyScore != null ? (todayHealth.energyScore >= 70 ? 'Strong reserve' : 'Moderate reserve') : 'Predicted after log',
            target: 'Scale 0-100',
            accent: '#f59e0b',
            meterValue: todayHealth?.energyScore != null ? todayHealth.energyScore / 100 : 0.24,
        },
        {
            label: 'Streak',
            icon: '🔥',
            value: `${streak} day${streak === 1 ? '' : 's'}`,
            caption: streak > 0 ? 'Momentum building' : 'Fresh start',
            target: 'Habit 21 days',
            accent: '#10b981',
            meterValue: streak / 21,
        },
    ];
}

export default function DashboardScreen({ navigation }: AppScreenProps<'Main'>) {
    const { user } = useAuth();
    const { width } = useWindowDimensions();
    const [streak, setStreak] = useState(0);
    const [todayHealth, setTodayHealth] = useState<HealthEntry | null>(null);
    const [avatarState, setAvatarState] = useState<string | null>(null);
    const [simulatedHeartRate, setSimulatedHeartRate] = useState<number | null>(null);
    const [avatarKey, setAvatarKey] = useState("init");
    const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(user?.profileImage ?? null);
    const [hoveredHeaderItem, setHoveredHeaderItem] = useState<'streak' | 'avatar' | null>(null);

    const isWide = width >= 840;
    const isDesktop = width >= 1160;
    const contentMaxWidth = isDesktop ? 1180 : 1040;
    const hasTodayLog = !!todayHealth;

    useEffect(() => {
        setProfileAvatarUrl(user?.profileImage ?? null);
        setAvatarKey(`user-${user?.id ?? 'anon'}-${Date.now()}`);
    }, [user?.id, user?.profileImage]);

    const loadDashboard = useCallback(async () => {
        try {
            const dayKey = getLocalDateYmd();
            const [streakData, health, avatarStatus, avatarStateResponse] = await Promise.all([
                getStreak(),
                getTodayHealth(),
                apiFetch<{ hasAvatar: boolean; avatarUrl?: string }>('/api/avatar/status'),
                apiFetch<{ state?: string }>(`/api/avatar/state?date=${encodeURIComponent(dayKey)}&includeMedia=false`),
            ]);
            setStreak(streakData?.currentStreak ?? 0);
            setTodayHealth(health);
            setProfileAvatarUrl((avatarStatus.success ? avatarStatus.data?.avatarUrl ?? null : null) ?? user?.profileImage ?? null);
            setAvatarState(
                avatarStateResponse.success
                    ? avatarStateResponse.data?.state?.trim().toLowerCase() ?? null
                    : null
            );
            setAvatarKey(Date.now().toString());
        } catch (e) {
            console.warn('Dashboard load error:', e);
        }
    }, [user?.profileImage]);

    useEffect(() => {
        void loadDashboard();
        const unsubscribe = navigation.addListener('focus', () => {
            void loadDashboard();
        });
        return unsubscribe;
    }, [navigation, loadDashboard]);

    useEffect(() => {
        const hasRealHeartRate = typeof todayHealth?.heartRate === 'number' && todayHealth.heartRate > 0;

        if (!todayHealth || hasRealHeartRate) {
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
        ? user.name.split(' ').map((name: string) => name[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    const displayedHeartRate = typeof todayHealth?.heartRate === 'number' && todayHealth.heartRate > 0
        ? Math.round(todayHealth.heartRate)
        : simulatedHeartRate;
    const heartRateValue = typeof displayedHeartRate === 'number' ? `${displayedHeartRate} BPM` : '—';
    const heartRateSub = typeof displayedHeartRate === 'number'
        ? (displayedHeartRate >= 100 ? 'Elevated' : displayedHeartRate < 60 ? 'Low' : 'Normal')
        : 'Daily input needed';

    const snapshotNarrative = useMemo(
        () => buildDashboardNarrative(avatarState),
        [avatarState]
    );
    const heroSignals = useMemo(
        () => buildMetricSignals(todayHealth, heartRateValue, heartRateSub, streak),
        [todayHealth, heartRateValue, heartRateSub, streak]
    );

    const actionItems: ActionCardProps[] = [
        {
            icon: '🌀',
            eyebrow: 'Interactive simulation',
            title: 'Scenario Explorer',
            description: 'See how sleep and movement changes reshape energy, mood, and avatar state.',
            accent: '#5c48f0',
            screen: 'WhatIf',
            featured: true,
            onPress: () => navigation.navigate('WhatIf'),
        },
        {
            icon: '📈',
            eyebrow: 'Seven-day narrative',
            title: 'Weekly Report',
            description: 'Turn recent logs into a richer summary that feels more like a product than a spreadsheet.',
            accent: '#0f9f71',
            screen: 'WeeklySummary',
            onPress: () => navigation.navigate('WeeklySummary'),
        },
        {
            icon: '✨',
            eyebrow: 'AI insight',
            title: 'Weekly Analysis',
            description: 'Generate a clean narrative briefing with practical recommendations and a forward-looking outcome.',
            accent: '#7c3aed',
            screen: 'AIWeeklyAnalysis',
            onPress: () => navigation.navigate('AIWeeklyAnalysis'),
        },
        {
            icon: '📝',
            eyebrow: 'Daily input',
            title: 'Log Daily Vitals',
            description: 'Capture the signals that keep the dashboard, avatar, and weekly insights grounded in the same data.',
            accent: '#f59e0b',
            screen: 'DailyLog',
            onPress: () => navigation.navigate('DailyLog'),
        },
    ];

    return (
        <ScreenLayout gradientBackground>
            <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <PageHeader
                    title={`${greeting}, ${firstName} 👋`}
                    subtitle="Your health snapshot"
                    gradientColors={[appTheme.colors.brand, appTheme.colors.brandDark]}
                    compact
                    containerStyle={styles.dashboardHeader}
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
                                    Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined,
                                ]}
                            >
                                <Text style={styles.streakEmoji}>🔥</Text>
                                <Text style={styles.streakNum}>{streak}</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => navigation.navigate('Settings')}
                                onHoverIn={() => setHoveredHeaderItem('avatar')}
                                onHoverOut={() => setHoveredHeaderItem(null)}
                                style={({ pressed }) => [
                                    styles.avatarWrap,
                                    hoveredHeaderItem === 'avatar' ? styles.headerChipHover : undefined,
                                    pressed ? styles.headerChipPressed : undefined,
                                    Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined,
                                ]}
                            >
                                {profileAvatarUrl
                                    ? <Image source={{ uri: profileAvatarUrl }} style={styles.avatarImg} />
                                    : <Text style={styles.avatarInitials}>{initials}</Text>}
                            </Pressable>
                        </View>
                    )}
                />

                <View style={[styles.pageShell, { maxWidth: contentMaxWidth }]}> 
                    <FadeInSection delay={40}>
                        <View style={[styles.heroGrid, isDesktop ? styles.heroGridDesktop : undefined]}>
                            <LinearGradient
                                colors={['rgba(255,251,244,0.98)', 'rgba(255,255,255,0.96)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[styles.heroCard, isDesktop ? styles.heroCardDesktop : undefined]}
                            >
                                <View style={styles.heroCardInner}>
                                    <View style={styles.heroLeadContent}>
                                        <View style={styles.heroPillRow}>
                                            <View style={styles.heroPill}>
                                                <Text style={styles.heroPillText}>Health twin live</Text>
                                            </View>
                                            <View style={styles.heroPillMuted}>
                                                <Text style={styles.heroPillMutedText}>Synced today</Text>
                                            </View>
                                        </View>

                                        <Text style={styles.heroTitle}>{snapshotNarrative.title}</Text>
                                        <Text style={styles.heroBody}>{snapshotNarrative.body}</Text>

                                        <View style={[styles.signalGrid, isWide ? styles.signalGridWide : undefined]}>
                                            {heroSignals.map((signal) => (
                                                <View key={signal.label} style={styles.signalChip}>
                                                    <View style={styles.signalTopRow}>
                                                        <Text style={styles.signalLabel}>{signal.label}</Text>
                                                        <View style={[styles.signalIconBubble, { backgroundColor: `${signal.accent}14` }]}>
                                                            <Text style={styles.signalIconText}>{signal.icon}</Text>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.signalValue}>{signal.value}</Text>
                                                    <Text style={styles.signalCaption}>{signal.caption}</Text>
                                                    <View style={styles.signalMeterWrap}>
                                                        <View style={styles.signalMeterTrack}>
                                                            <View
                                                                style={[
                                                                    styles.signalMeterFill,
                                                                    {
                                                                        width: `${Math.max(6, Math.min(100, signal.meterValue * 100))}%`,
                                                                        backgroundColor: signal.accent,
                                                                    },
                                                                ]}
                                                            />
                                                        </View>
                                                        <Text style={[styles.signalTarget, { color: signal.accent }]}>{signal.target}</Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    </View>

                                    <View style={[styles.heroActionRow, isWide ? styles.heroActionRowWide : undefined]}>
                                        <View style={styles.heroActionButton}>
                                            <AppButton
                                                label="Explore Scenarios"
                                                onPress={() => navigation.navigate('WhatIf')}
                                                icon={<Text style={styles.heroButtonIcon}>🌀</Text>}
                                            />
                                        </View>
                                        <View style={styles.heroActionButton}>
                                            <AppButton
                                                label="Weekly Report"
                                                onPress={() => navigation.navigate('WeeklySummary')}
                                                variant="secondary"
                                                icon={<Text style={styles.heroButtonIcon}>📈</Text>}
                                            />
                                        </View>
                                    </View>
                                </View>
                            </LinearGradient>

                            <View style={styles.avatarFeatureCard}>
                                <View style={styles.avatarFeatureGlowOne} />
                                <View style={styles.avatarFeatureGlowTwo} />
                                <View style={styles.avatarFeatureTopRow}>
                                    <View style={styles.avatarFeatureHeadingBlock}>
                                        <View style={styles.avatarFeatureBadgeRow}>
                                            <View style={styles.avatarFeatureBadgeIcon}>
                                                <Text style={styles.avatarFeatureBadgeIconText}>✦</Text>
                                            </View>
                                            <Text style={styles.avatarFeatureEyebrow}>Digital twin</Text>
                                        </View>
                                        <Text style={styles.avatarFeatureTitle}>Live portrait state</Text>
                                        <Text style={styles.avatarFeatureSubtitle}>A visual reflection of today’s logged health pattern.</Text>
                                    </View>
                                    <View style={styles.avatarFeatureStatusPill}>
                                        <View style={styles.avatarFeatureStatusDot} />
                                        <Text style={styles.avatarFeatureStatusText}>{hasTodayLog ? 'Synced' : 'Waiting'}</Text>
                                    </View>
                                </View>
                                <View style={styles.avatarHalo} />
                                <View style={styles.avatarStage}>
                                    <DigitalTwinAvatar key={avatarKey} showStateLabel presentation="bare" />
                                </View>
                            </View>
                        </View>
                    </FadeInSection>

                    <View style={styles.lowerGrid}>
                        <FadeInSection delay={90}>
                            <View style={styles.sectionCard}>
                                <View style={styles.sectionHeaderRow}>
                                    <View>
                                        <Text style={styles.sectionEyebrow}>Today at a glance</Text>
                                        <Text style={styles.sectionTitle}>Live health metrics</Text>
                                    </View>
                                    <Text style={styles.sectionMeta}>{hasTodayLog ? 'Data in sync' : 'Waiting for daily input'}</Text>
                                </View>

                                <View style={styles.metricsGrid}>
                                        <MetricCard
                                            icon={<Heart color="#ef4444" size={18} />}
                                            label="Heart Rate"
                                            value={heartRateValue}
                                            status={heartRateSub}
                                            insight={displayedHeartRate ? 'Resting rhythm looks stable' : 'Waiting for a live read'}
                                            targetLabel="Target 60-100"
                                            meterValue={displayedHeartRate ? (displayedHeartRate - 50) / 60 : 0.28}
                                            tone={{ accent: '#ef4444', soft: '#fef2f2' }}
                                        />
                                        <MetricCard
                                            icon={<Activity color="#5c48f0" size={18} />}
                                            label="Steps"
                                            value={todayHealth?.steps != null ? todayHealth.steps.toLocaleString() : '—'}
                                            status={todayHealth?.steps != null ? (todayHealth.steps >= 8000 ? 'On track' : 'Building') : 'Awaiting log'}
                                            insight={todayHealth?.steps != null ? 'Daily movement against your 10k goal' : 'Waiting for today’s activity'}
                                            targetLabel="Goal 10,000"
                                            meterValue={todayHealth?.steps != null ? todayHealth.steps / 10000 : 0.18}
                                            tone={{ accent: '#5c48f0', soft: '#f3f1ff' }}
                                        />
                                        <MetricCard
                                            icon={<Moon color="#6366f1" size={18} />}
                                            label="Sleep"
                                            value={todayHealth?.sleepHours != null ? `${todayHealth.sleepHours.toFixed(1)}h` : '—'}
                                            status={todayHealth?.sleepHours != null ? (todayHealth.sleepHours >= 7 ? 'Recovered' : 'Below target') : 'Awaiting log'}
                                            insight={todayHealth?.sleepHours != null ? 'Recovery depth compared with a full night' : 'Sleep data unlocks recovery insight'}
                                            targetLabel="Goal 8 hours"
                                            meterValue={todayHealth?.sleepHours != null ? todayHealth.sleepHours / 8 : 0.2}
                                            tone={{ accent: '#6366f1', soft: '#eef2ff' }}
                                        />
                                        <MetricCard
                                            icon={<Zap color="#f59e0b" size={18} />}
                                            label="Energy"
                                            value={todayHealth?.energyScore != null ? `${Math.round(todayHealth.energyScore)}` : '—'}
                                            status={todayHealth?.energyScore != null ? (todayHealth.energyScore >= 70 ? 'High reserve' : 'Moderate reserve') : 'Predicted'}
                                            insight={todayHealth?.energyScore != null ? 'Composite readiness from rest and movement' : 'Estimated once today is logged'}
                                            targetLabel="Scale 0-100"
                                            meterValue={todayHealth?.energyScore != null ? todayHealth.energyScore / 100 : 0.24}
                                            tone={{ accent: '#f59e0b', soft: '#fffbeb' }}
                                        />
                                    </View>
                                </View>
                            </FadeInSection>

                        <FadeInSection delay={130}>
                            <View style={styles.sectionCard}>
                                <View style={styles.sectionHeaderRow}>
                                    <View>
                                        <Text style={styles.sectionEyebrow}>Key journeys</Text>
                                        <Text style={styles.sectionTitle}>Explore the product story</Text>
                                    </View>
                                    <Text style={styles.sectionMeta}>Four strongest paths</Text>
                                </View>

                                <View style={[styles.actionGrid, isWide ? styles.actionGridWide : undefined]}>
                                    {actionItems.map((item) => (
                                        <View key={item.screen} style={isWide ? styles.actionGridItemWide : undefined}>
                                            <ActionCard {...item} />
                                        </View>
                                    ))}
                                </View>

                                <View style={styles.sideRailFooter}>
                                    <View style={styles.sideRailFooterCard}>
                                        <Text style={styles.sideRailFooterTitle}>Momentum</Text>
                                        <Text style={styles.sideRailFooterValue}>🔥 {streak} day streak</Text>
                                        <Text style={styles.sideRailFooterCopy}>Achievements make progress visible without competing with the core health story.</Text>
                                    </View>
                                    <View style={styles.sideRailButtonRow}>
                                        <View style={styles.sideRailButtonWrap}>
                                            <AppButton
                                                label="Achievements"
                                                onPress={() => navigation.navigate('Achievements')}
                                                variant="secondary"
                                            />
                                        </View>
                                        <View style={styles.sideRailButtonWrap}>
                                            <AppButton
                                                label="Analytics"
                                                onPress={() => navigation.navigate('Analytics')}
                                                variant="secondary"
                                            />
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </FadeInSection>
                    </View>
                </View>
            </ScrollView>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    scroll: {
        paddingBottom: 88,
    },
    pageShell: {
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        gap: 20,
    },
    dashboardHeader: {
        paddingBottom: 14,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    streakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.74)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 4,
        borderWidth: 1,
        borderColor: DASHBOARD_BORDER_SOFT,
    },
    headerChipHover: {
        transform: [{ translateY: -1 }],
        shadowOpacity: 0.16,
        shadowRadius: 10,
    },
    headerChipPressed: {
        opacity: 0.92,
        transform: [{ scale: 0.98 }],
    },
    streakEmoji: {
        fontSize: 16,
    },
    streakNum: {
        fontWeight: '800',
        color: '#7c3aed',
        fontSize: 15,
    },
    avatarWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#7c3aed',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#fff',
    },
    avatarImg: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    avatarInitials: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 14,
    },
    heroGrid: {
        gap: 18,
    },
    heroGridDesktop: {
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    heroCard: {
        flex: 1.15,
        borderRadius: 32,
        padding: 24,
        borderWidth: 1,
        borderColor: DASHBOARD_BORDER,
        shadowColor: '#5c48f0',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.08,
        shadowRadius: 32,
        elevation: 8,
    },
    heroCardDesktop: {
        minHeight: 360,
    },
    heroCardInner: {
        flex: 1,
        justifyContent: 'space-between',
    },
    heroLeadContent: {
        flexShrink: 1,
    },
    heroPillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 18,
    },
    heroPill: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
        backgroundColor: DASHBOARD_ACCENT_SOFT,
        borderWidth: 1,
        borderColor: '#f0d49a',
    },
    heroPillText: {
        color: DASHBOARD_ACCENT_DEEP,
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    heroPillMuted: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
        backgroundColor: DASHBOARD_SURFACE,
        borderWidth: 1,
        borderColor: DASHBOARD_BORDER_SOFT,
    },
    heroPillMutedText: {
        color: appTheme.colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
    },
    heroTitle: {
        ...appTheme.typography.h1,
        color: appTheme.colors.textPrimary,
        fontSize: 30,
        lineHeight: 34,
    },
    heroBody: {
        marginTop: 12,
        color: appTheme.colors.textSecondary,
        fontSize: 15,
        lineHeight: 24,
        maxWidth: 620,
        fontWeight: '600',
    },
    signalGrid: {
        marginTop: 22,
        gap: 10,
    },
    signalGridWide: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    signalChip: {
        flex: 1,
        minWidth: 130,
        backgroundColor: 'rgba(255,255,255,0.84)',
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: DASHBOARD_BORDER_SOFT,
        overflow: 'hidden',
    },
    signalTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    signalLabel: {
        color: DASHBOARD_MUTED,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.45,
    },
    signalIconBubble: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    signalIconText: {
        fontSize: 13,
    },
    signalValue: {
        marginTop: 8,
        color: appTheme.colors.textPrimary,
        fontSize: 18,
        fontWeight: '800',
    },
    signalCaption: {
        marginTop: 4,
        color: appTheme.colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    signalMeterWrap: {
        marginTop: 12,
    },
    signalMeterTrack: {
        height: 6,
        borderRadius: 999,
        backgroundColor: '#f1ebe1',
        overflow: 'hidden',
    },
    signalMeterFill: {
        height: '100%',
        borderRadius: 999,
    },
    signalTarget: {
        marginTop: 6,
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    heroActionRow: {
        marginTop: 18,
        gap: 10,
    },
    heroActionRowWide: {
        flexDirection: 'row',
    },
    heroActionButton: {
        flex: 1,
    },
    heroButtonIcon: {
        fontSize: 15,
    },
    avatarFeatureCard: {
        flex: 0.92,
        minHeight: 350,
        borderRadius: 32,
        backgroundColor: 'rgba(255,253,249,0.94)',
        borderWidth: 1,
        borderColor: DASHBOARD_BORDER_SOFT,
        padding: 22,
        overflow: 'hidden',
        shadowColor: '#5c48f0',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.09,
        shadowRadius: 28,
        elevation: 8,
    },
    avatarFeatureGlowOne: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(244,181,68,0.10)',
        top: -60,
        right: -40,
    },
    avatarFeatureGlowTwo: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: 'rgba(92,72,240,0.08)',
        bottom: -70,
        left: -50,
    },
    avatarFeatureTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 14,
    },
    avatarFeatureHeadingBlock: {
        flex: 1,
        paddingRight: 8,
    },
    avatarFeatureBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    avatarFeatureBadgeIcon: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#eef4ff',
        borderWidth: 1,
        borderColor: '#d8e7ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarFeatureBadgeIconText: {
        color: '#3b82f6',
        fontSize: 11,
        fontWeight: '800',
    },
    avatarFeatureEyebrow: {
        color: '#6f8fb8',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.55,
    },
    avatarFeatureTitle: {
        color: appTheme.colors.textPrimary,
        fontSize: 20,
        fontWeight: '800',
    },
    avatarFeatureSubtitle: {
        marginTop: 6,
        color: appTheme.colors.textSecondary,
        fontSize: 12,
        lineHeight: 18,
        fontWeight: '600',
        maxWidth: 250,
    },
    avatarFeatureStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: '#ffffffcc',
        borderWidth: 1,
        borderColor: '#d7e6ff',
    },
    avatarFeatureStatusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10b981',
    },
    avatarFeatureStatusText: {
        color: '#5f7ea7',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    avatarHalo: {
        position: 'absolute',
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(244,181,68,0.12)',
        top: 76,
        alignSelf: 'center',
    },
    avatarStage: {
        marginTop: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lowerGrid: {
        gap: 18,
    },
    sectionCard: {
        backgroundColor: 'rgba(255,252,248,0.94)',
        borderRadius: 30,
        borderWidth: 1,
        borderColor: DASHBOARD_BORDER,
        padding: 22,
        shadowColor: '#d8c5a1',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.07,
        shadowRadius: 22,
        elevation: 6,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 12,
        marginBottom: 18,
    },
    sectionEyebrow: {
        color: DASHBOARD_ACCENT_DEEP,
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.55,
        marginBottom: 6,
    },
    sectionTitle: {
        ...appTheme.typography.h2,
        color: appTheme.colors.textPrimary,
    },
    sectionMeta: {
        color: appTheme.colors.textMuted,
        fontSize: 12,
        fontWeight: '700',
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    metricCard: {
        flex: 1,
        minWidth: 220,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: DASHBOARD_BORDER_SOFT,
        shadowColor: '#5c48f0',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 4,
        overflow: 'hidden',
    },
    metricCardHover: {
        transform: [{ translateY: -2 }],
        shadowOpacity: 0.09,
        shadowRadius: 20,
    },
    metricCardPressed: {
        opacity: 0.96,
        transform: [{ scale: 0.995 }],
    },
    metricCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    metricAura: {
        position: 'absolute',
        top: -24,
        right: -18,
        width: 96,
        height: 96,
        borderRadius: 48,
    },
    metricTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    metricIcon: {
        width: 42,
        height: 42,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    metricStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    metricAccentDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    metricStatusText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    metricValue: {
        ...appTheme.typography.metric,
        color: appTheme.colors.textPrimary,
        fontSize: 28,
    },
    metricLabel: {
        ...appTheme.typography.caption,
        color: appTheme.colors.textPrimary,
        fontSize: 13,
    },
    metricInsight: {
        marginTop: 8,
        color: appTheme.colors.textSecondary,
        fontSize: 12,
        lineHeight: 18,
        fontWeight: '600',
        minHeight: 36,
    },
    metricMeterBlock: {
        marginTop: 14,
    },
    metricMeterMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    metricMetaText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.35,
        color: DASHBOARD_MUTED,
    },
    metricMeterTrack: {
        height: 7,
        borderRadius: 999,
        backgroundColor: '#f2ede4',
        overflow: 'hidden',
    },
    metricMeterFill: {
        height: '100%',
        borderRadius: 999,
    },
    actionGrid: {
        gap: 12,
    },
    actionGridWide: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    actionGridItemWide: {
        width: '49%',
    },
    actionCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: DASHBOARD_BORDER_SOFT,
        shadowColor: '#5c48f0',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
        elevation: 4,
    },
    actionCardFeatured: {
        backgroundColor: '#fff7ec',
    },
    actionCardHover: {
        transform: [{ translateY: -2 }],
        shadowOpacity: 0.1,
        shadowRadius: 18,
    },
    actionCardPressed: {
        opacity: 0.96,
        transform: [{ scale: 0.995 }],
    },
    actionCardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    actionIconWrap: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionIcon: {
        fontSize: 22,
    },
    actionArrow: {
        color: '#d3b378',
        fontSize: 18,
        fontWeight: '700',
    },
    actionEyebrow: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.55,
        marginBottom: 8,
    },
    actionTitle: {
        color: appTheme.colors.textPrimary,
        fontSize: 18,
        lineHeight: 22,
        fontWeight: '800',
    },
    actionDescription: {
        marginTop: 8,
        color: appTheme.colors.textSecondary,
        fontSize: 13,
        lineHeight: 21,
        fontWeight: '600',
    },
    sideRailFooter: {
        marginTop: 16,
        gap: 12,
    },
    sideRailFooterCard: {
        borderRadius: 22,
        backgroundColor: '#fff6e8',
        borderWidth: 1,
        borderColor: '#ecd9b6',
        padding: 16,
    },
    sideRailFooterTitle: {
        color: DASHBOARD_MUTED,
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.55,
    },
    sideRailFooterValue: {
        marginTop: 8,
        color: appTheme.colors.textPrimary,
        fontSize: 22,
        fontWeight: '800',
    },
    sideRailFooterCopy: {
        marginTop: 8,
        color: appTheme.colors.textSecondary,
        fontSize: 13,
        lineHeight: 20,
        fontWeight: '600',
    },
    sideRailButtonRow: {
        flexDirection: 'row',
        gap: 10,
    },
    sideRailButtonWrap: {
        flex: 1,
    },
});
