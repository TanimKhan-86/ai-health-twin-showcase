import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Image } from 'react-native';
import { ScreenLayout } from '../../components/ScreenLayout';
import { RefreshCw, Sparkles, CalendarDays, TrendingUp } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { FutureInsight, getFutureInsight } from '../../lib/api/auth';
import { apiFetch } from '../../lib/api/client';
import { useToast } from '../../components/ui/Toast';
import type { AppScreenProps } from '../../lib/navigation/types';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionCard } from '../../components/ui/SectionCard';
import { AppButton } from '../../components/ui/AppButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { appTheme } from '../../lib/theme/tokens';
import { FadeInSection } from '../../components/ui/FadeInSection';

const STATE_THEME = {
    happy: { label: 'Happy', color: '#10b981', bg: '#ecfdf5', emoji: '😄' },
    sad: { label: 'Sad', color: '#7c3aed', bg: '#f5f3ff', emoji: '😔' },
    sleepy: { label: 'Sleepy', color: '#f59e0b', bg: '#fffbeb', emoji: '😴' },
    calm: { label: 'Calm', color: '#0f766e', bg: '#ccfbf1', emoji: '😌' },
} as const;

type FutureState = keyof typeof STATE_THEME;
const FUTURE_STATES = Object.keys(STATE_THEME) as FutureState[];
const WEB_VIDEO_STYLE: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    position: 'absolute',
    top: 0,
    left: 0,
};

export default function FutureYouScreen({ navigation }: AppScreenProps<'FutureYou'>) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [insight, setInsight] = useState<FutureInsight | null>(null);
    const [videoFailed, setVideoFailed] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadInsight = useCallback(async (silent = false) => {
        if (silent) setRefreshing(true);
        else setLoading(true);

        try {
            setError(null);
            const data = await getFutureInsight(7);
            if (!data) {
                setError('Could not load future prediction');
                return;
            }
            setInsight(data);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Could not load future prediction');
        } finally {
            if (silent) setRefreshing(false);
            else setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadInsight(false);
        const unsubscribe = navigation.addListener('focus', () => {
            void loadInsight(false);
        });
        return unsubscribe;
    }, [navigation, loadInsight]);

    const projectedState = (insight?.projectedState || 'sad') as FutureState;
    const dominantState = (insight?.dominantState || 'sad') as FutureState;
    const currentState = (insight?.currentState || 'sad') as FutureState;

    const projectedTheme = STATE_THEME[projectedState];
    const dominantTheme = STATE_THEME[dominantState];
    const currentTheme = STATE_THEME[currentState];
    const futureMediaHint = useMemo(() => {
        if (!insight) return null;

        const hasVideo = !!insight.media?.projectedVideoUrl && !videoFailed;
        if (hasVideo) return null;

        if (!insight.media?.imageUrl) {
            if (!insight.hasSevenDayData) {
                return {
                    title: 'No logs yet for projection media',
                    body: 'Seed 7 days demo or log daily vitals first, then Future You can generate state-specific media.',
                };
            }
            return {
                title: 'Avatar setup required',
                body: 'Open Settings > Digital Twin Setup to generate avatar image and emotion loops.',
            };
        }

        if (!insight.media?.projectedVideoUrl) {
            return {
                title: 'Projection video unavailable',
                body: 'Showing avatar image fallback. Generate or refresh avatar loops in Digital Twin Setup.',
            };
        }

        if (videoFailed) {
            return {
                title: 'Projection video failed to load',
                body: 'Showing avatar image fallback. Try refresh; if this persists, regenerate avatar media.',
            };
        }

        return null;
    }, [insight, videoFailed]);

    const totalTracked = useMemo(() => {
        if (!insight) return 0;
        return FUTURE_STATES.reduce((sum, state) => sum + (insight.stateBreakdown[state] ?? 0), 0);
    }, [insight]);

    const handleSeedDemo = async () => {
        setRefreshing(true);
        try {
            let seeded = false;
            const primary = await apiFetch('/api/seed/demo', { method: 'POST' });
            seeded = primary.success;
            if (!seeded) {
                const fallback = await apiFetch('/api/health/seed-demo', { method: 'POST' });
                seeded = fallback.success;
            }

            if (seeded) {
                showToast('7 days demo data seeded. Re-analyzing Future You...', 'success');
                await loadInsight(true);
                return;
            }
            showToast('Could not seed demo data', 'error');
        } catch (e: unknown) {
            showToast(e instanceof Error ? e.message : 'Could not seed demo data', 'error');
        } finally {
            setRefreshing(false);
        }
    };

    if (loading) {
        return (
            <ScreenLayout gradientBackground>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#7c3aed" />
                    <Text style={{ marginTop: 12, color: '#4c1d95', fontWeight: '700' }}>
                        Analyzing your last 7 days...
                    </Text>
                </View>
            </ScreenLayout>
        );
    }

    return (
        <ScreenLayout gradientBackground>
            <View style={{ flex: 1 }}>
                <PageHeader
                    title="Future You"
                    subtitle="7-day behavior trend prediction"
                    onBack={() => navigation.goBack()}
                />

                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    <FadeInSection delay={40}>
                        <SectionCard style={styles.card}>
                        <View style={{ alignItems: 'center' }}>
                            <View style={styles.avatarFrame}>
                                {insight?.media?.projectedVideoUrl && !videoFailed ? (
                                    Platform.OS === 'web' ? (
                                        <video
                                            src={insight.media.projectedVideoUrl}
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                            onError={() => setVideoFailed(true)}
                                            style={WEB_VIDEO_STYLE}
                                        />
                                    ) : (
                                        <Video
                                            key={insight.media.projectedVideoUrl}
                                            source={{ uri: insight.media.projectedVideoUrl }}
                                            style={styles.nativeVideo}
                                            resizeMode={ResizeMode.COVER}
                                            isLooping
                                            shouldPlay
                                            isMuted
                                            onError={() => setVideoFailed(true)}
                                        />
                                    )
                                ) : insight?.media?.imageUrl ? (
                                    <Image source={{ uri: insight.media.imageUrl }} style={styles.nativeVideo} resizeMode="cover" />
                                ) : (
                                    <Text style={styles.emptyAvatarText}>Avatar media unavailable</Text>
                                )}
                            </View>
                            {futureMediaHint && (
                                <View style={styles.mediaHintBox}>
                                    <Text style={styles.mediaHintTitle}>{futureMediaHint.title}</Text>
                                    <Text style={styles.mediaHintBody}>{futureMediaHint.body}</Text>
                                </View>
                            )}

                            <View style={[styles.pill, { backgroundColor: projectedTheme.bg, borderColor: projectedTheme.color }]}>
                                <Sparkles size={14} color={projectedTheme.color} />
                                <Text style={[styles.pillText, { color: projectedTheme.color }]}>
                                    Next week onward: {projectedTheme.label} {projectedTheme.emoji}
                                </Text>
                            </View>

                            <Text style={styles.insightText}>
                                {insight?.insight || 'Could not generate future insight.'}
                            </Text>
                        </View>
                        </SectionCard>
                    </FadeInSection>

                    <FadeInSection delay={80}>
                        <SectionCard style={styles.card}>
                        <View style={styles.titleRow}>
                            <View style={styles.titleIconWrap}>
                                <CalendarDays size={16} color={appTheme.colors.brandDark} />
                            </View>
                            <Text style={styles.cardTitle}>State Summary (Last 7 Days)</Text>
                        </View>

                        <View style={styles.summaryGrid}>
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Dominant</Text>
                                <Text style={[styles.summaryValue, { color: dominantTheme.color }]}>
                                    {dominantTheme.label} {dominantTheme.emoji}
                                </Text>
                            </View>
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Current</Text>
                                <Text style={[styles.summaryValue, { color: currentTheme.color }]}>
                                    {currentTheme.label} {currentTheme.emoji}
                                </Text>
                            </View>
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Projection</Text>
                                <Text style={[styles.summaryValue, { color: projectedTheme.color }]}>
                                    {projectedTheme.label} {projectedTheme.emoji}
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.reasonLine}>• {insight?.reasoning?.dominant}</Text>
                        <Text style={styles.reasonLine}>• {insight?.reasoning?.current}</Text>
                        <Text style={styles.reasonLine}>• {insight?.reasoning?.projection}</Text>
                        </SectionCard>
                    </FadeInSection>

                    <FadeInSection delay={120}>
                        <SectionCard style={styles.card}>
                        <View style={styles.titleRow}>
                            <View style={styles.titleIconWrap}>
                                <TrendingUp size={16} color={appTheme.colors.brandDark} />
                            </View>
                            <Text style={styles.cardTitle}>Trait Distribution</Text>
                        </View>

                        {FUTURE_STATES.map((state) => {
                            const theme = STATE_THEME[state];
                            const count = insight?.stateBreakdown?.[state] ?? 0;
                            const percent = totalTracked > 0 ? Math.round((count / totalTracked) * 100) : 0;
                            return (
                                <View key={state} style={styles.barRow}>
                                    <Text style={styles.barLabel}>{theme.emoji} {theme.label}</Text>
                                    <View style={styles.barTrack}>
                                        <View style={[styles.barFill, { width: `${percent}%`, backgroundColor: theme.color }]} />
                                    </View>
                                    <Text style={styles.barCount}>{count}d</Text>
                                </View>
                            );
                        })}
                        </SectionCard>
                    </FadeInSection>

                    {!insight?.hasSevenDayData && (
                        <FadeInSection delay={150}>
                            <SectionCard style={styles.card}>
                            <EmptyState
                                icon="📉"
                                title="No 7-day data yet"
                                description="Seed demo data first, then Future You can predict whether your next weeks trend happy, calm, sad, or sleepy."
                            />
                            <View style={{ marginTop: 12 }}>
                                <AppButton
                                    label={refreshing ? 'Seeding...' : 'Seed 7-Day Demo'}
                                    onPress={handleSeedDemo}
                                    loading={refreshing}
                                    icon={!refreshing ? <RefreshCw size={16} color="#fff" /> : undefined}
                                />
                            </View>
                            </SectionCard>
                        </FadeInSection>
                    )}

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <FadeInSection delay={180}>
                        <AppButton
                            label={refreshing ? 'Refreshing...' : 'Re-analyze Future You'}
                            onPress={() => loadInsight(true)}
                            disabled={refreshing}
                            loading={refreshing}
                            variant="secondary"
                            icon={!refreshing ? <RefreshCw size={16} color={appTheme.colors.brandDark} /> : undefined}
                        />
                    </FadeInSection>

                    <FadeInSection delay={220}>
                        <TouchableOpacity style={styles.whatIfCta} activeOpacity={0.85} onPress={() => navigation.navigate('WhatIf')}>
                            <LinearGradient
                                colors={['#7c3aed', '#6d28d9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.whatIfCtaInner}
                            >
                                <Text style={styles.whatIfCtaTitle}>Want to improve? What-if I did...</Text>
                                <Text style={styles.whatIfCtaSub}>Open Scenario Explorer</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </FadeInSection>
                </ScrollView>
            </View>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    scroll: { padding: 16, paddingBottom: 64, gap: 2 },
    card: {
        marginBottom: 16,
    },
    avatarFrame: {
        width: 164,
        height: 164,
        borderRadius: 82,
        overflow: 'hidden',
        borderWidth: 4,
        borderColor: '#ffffff',
        backgroundColor: '#ede9fe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    nativeVideo: { width: '100%', height: '100%' },
    emptyAvatarText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    pill: {
        marginTop: 16,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pillText: { fontWeight: '800', fontSize: 13 },
    insightText: {
        marginTop: 14,
        textAlign: 'center',
        color: appTheme.colors.textSecondary,
        fontSize: appTheme.typography.body.fontSize,
        lineHeight: 21,
        fontWeight: appTheme.typography.body.fontWeight,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    titleIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 11,
        backgroundColor: appTheme.colors.brandSoft,
        borderWidth: 1,
        borderColor: appTheme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: { ...appTheme.typography.h3, color: appTheme.colors.textPrimary, fontWeight: '800' },
    summaryGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    summaryItem: {
        flex: 1,
        backgroundColor: '#faf5ff',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#ede9fe',
    },
    summaryLabel: { ...appTheme.typography.overline, color: appTheme.colors.textSecondary, textTransform: 'uppercase' },
    summaryValue: { marginTop: 3, ...appTheme.typography.bodyStrong },
    reasonLine: { marginTop: 8, color: appTheme.colors.textSecondary, fontSize: 13, lineHeight: 20, fontWeight: '500' },
    barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
    barLabel: { width: 84, ...appTheme.typography.caption, color: appTheme.colors.textPrimary, fontWeight: '700' },
    barTrack: { flex: 1, height: 8, borderRadius: 6, backgroundColor: '#e9d5ff', overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 6 },
    barCount: { width: 30, textAlign: 'right', color: appTheme.colors.textSecondary, fontWeight: '700', fontSize: 12 },
    mediaHintBox: {
        marginTop: 12,
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        width: '100%',
    },
    mediaHintTitle: { color: appTheme.colors.textPrimary, fontSize: 12, fontWeight: '800', textAlign: 'left' },
    mediaHintBody: { color: appTheme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: 'left' },
    errorText: { color: '#ef4444', fontSize: 12, textAlign: 'center', marginBottom: 8 },
    whatIfCta: {
        marginTop: 12,
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 4,
    },
    whatIfCtaInner: {
        paddingVertical: 15,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
    },
    whatIfCtaTitle: { color: '#fff', ...appTheme.typography.bodyStrong, fontSize: 15 },
    whatIfCtaSub: { color: 'rgba(255,255,255,0.85)', ...appTheme.typography.caption, marginTop: 2 },
});
