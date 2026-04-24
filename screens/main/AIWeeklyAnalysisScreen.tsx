import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { ScreenLayout } from '../../components/ScreenLayout';
import { ArrowLeft, Sparkles, Lightbulb, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react-native';
import { getHealthHistory, getMoodHistory } from '../../lib/api/auth';
import { apiFetch } from '../../lib/api/client';
import { LinearGradient } from 'expo-linear-gradient';
import type { AppScreenProps } from '../../lib/navigation/types';
import type { AiWeeklyAnalysisDto } from '../../lib/api/contracts';

type AIAnalysis = AiWeeklyAnalysisDto;
const INSIGHT_GREEN = '#39b37a';
const INSIGHT_GREEN_DEEP = '#248b5c';
const INSIGHT_GREEN_DARK = '#1e6947';
const INSIGHT_GREEN_SOFT = '#edf9f3';
const INSIGHT_GREEN_BORDER = '#caecd9';
const INSIGHT_GREEN_PANEL = '#def4e7';

function formatGeneratedAt(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString([], {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function AIWeeklyAnalysisScreen({ navigation }: AppScreenProps<'AIWeeklyAnalysis'>) {
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
    const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [healthCount, setHealthCount] = useState(0);

    const fetchAnalysis = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [healthData, moodData] = await Promise.all([getHealthHistory(7), getMoodHistory(7)]);
            setHealthCount(healthData.length);
            if (healthData.length === 0) {
                setError('No health data found for this week. Log at least one day first, or use Settings → Seed Demo Data.');
                setLoading(false); return;
            }
            const response = await apiFetch<AIAnalysis>('/api/ai/weekly-analysis', {
                method: 'POST', body: JSON.stringify({ healthData, moodData }),
            });
            if (!response.success || !response.data) {
                const message = response.success ? 'Failed to get AI analysis' : response.error;
                throw new Error(message);
            }

            const normalized: AIAnalysis = response.data;
            if (!Array.isArray(normalized.tips)) {
                throw new Error('Analysis returned unexpected format');
            }

            setAnalysis({
                ...normalized,
                tips: normalized.tips.filter((tip) => typeof tip === 'string'),
            });
            setLastGeneratedAt(normalized.generatedAt || new Date().toISOString());
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Could not generate your analysis. Please check your connection and try again.');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        void fetchAnalysis();
        const unsubscribe = navigation.addListener('focus', () => {
            void fetchAnalysis();
        });
        return unsubscribe;
    }, [navigation, fetchAnalysis]);

    return (
        <ScreenLayout gradientBackground>
            <View style={{ flex: 1 }}>
                {/* Gradient Header */}
                <LinearGradient colors={[INSIGHT_GREEN, INSIGHT_GREEN_DEEP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGrad}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ArrowLeft color="white" size={18} />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Your Weekly Analysis</Text>
                    <Text style={styles.headerSub}>Powered by Gemini AI ✨</Text>
                </LinearGradient>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                    {/* Loading */}
                    {loading && !analysis && (
                        <View style={styles.stateCard}>
                            <ActivityIndicator size="large" color={INSIGHT_GREEN_DEEP} />
                            <Text style={styles.stateTitle}>Analysing your week...</Text>
                            <Text style={styles.stateSub}>Reviewing {healthCount > 0 ? `${healthCount} days` : 'your'} of health data</Text>
                            <View style={styles.progressBar}><View style={styles.progressFill} /></View>
                        </View>
                    )}

                    {/* Error */}
                    {!analysis && !loading && error && (
                        <View style={styles.stateCard}>
                            <View style={styles.errorIconWrap}><AlertCircle size={32} color="#ef4444" /></View>
                            <Text style={styles.errorTitle}>Analysis Unavailable</Text>
                            <Text style={styles.stateSub}>{error}</Text>
                            <TouchableOpacity onPress={fetchAnalysis} activeOpacity={0.85}>
                                <LinearGradient colors={[INSIGHT_GREEN, INSIGHT_GREEN_DEEP]} style={styles.retryBtn}>
                                    <Text style={styles.retryText}>Try Again</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Results */}
                    {analysis && (
                        <>
                            <View style={styles.metaStack}>
                                <View style={styles.sourceBadge}>
                                    <Text style={styles.sourceBadgeText}>
                                        {analysis.fromCache ? '⚡ Cached result' : analysis.fromFallback ? '🔒 Smart analysis' : '🤖 Gemini AI'}
                                    </Text>
                                </View>
                                <Text style={styles.generatedAtText}>Last generated: {formatGeneratedAt(lastGeneratedAt)}</Text>
                                {loading && (
                                    <View style={styles.refreshingBadge}>
                                        <ActivityIndicator size="small" color={INSIGHT_GREEN_DEEP} />
                                        <Text style={styles.refreshingText}>Refreshing analysis...</Text>
                                    </View>
                                )}
                            </View>

                            {error ? (
                                <View style={styles.inlineError}>
                                    <AlertCircle size={16} color="#ef4444" />
                                    <Text style={styles.inlineErrorText}>{error}</Text>
                                </View>
                            ) : null}

                            {/* Narrative */}
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.cardIconWrap, { backgroundColor: INSIGHT_GREEN_SOFT }]}>
                                        <Sparkles size={18} color={INSIGHT_GREEN_DEEP} />
                                    </View>
                                    <Text style={styles.cardTitle}>Your Week in Review</Text>
                                </View>
                                <View style={styles.narrativeBox}>
                                    <Text style={styles.narrativeText}>"{analysis.narrative}"</Text>
                                </View>
                            </View>

                            {/* Tips */}
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.cardIconWrap, { backgroundColor: '#fffbeb' }]}>
                                        <Lightbulb size={18} color="#f59e0b" />
                                    </View>
                                    <Text style={styles.cardTitle}>3 Tips to Improve</Text>
                                </View>
                                {analysis.tips.length > 0 ? analysis.tips.map((tip, i) => (
                                    <View key={i} style={styles.tipRow}>
                                        <View style={styles.tipBadge}><Text style={styles.tipNum}>{i + 1}</Text></View>
                                        <Text style={styles.tipText}>{tip}</Text>
                                    </View>
                                )) : (
                                    <Text style={styles.tipText}>No tips available yet. Try regenerating analysis.</Text>
                                )}
                            </View>

                            {/* Outcome */}
                            <TouchableOpacity activeOpacity={0.95}>
                                <LinearGradient colors={[INSIGHT_GREEN, INSIGHT_GREEN_DEEP]} style={styles.outcomeCard}>
                                    <View style={styles.cardHeader}>
                                        <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                            <TrendingUp size={18} color="#fff" />
                                        </View>
                                        <Text style={[styles.cardTitle, { color: '#fff' }]}>In 2 Weeks...</Text>
                                    </View>
                                    <Text style={styles.outcomeText}>{analysis.predictedOutcome}</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Disclaimer */}
                            <View style={styles.disclaimerBox}>
                                <Text style={styles.disclaimerText}>{analysis.disclaimer}</Text>
                            </View>

                            {/* Refresh */}
                            <TouchableOpacity onPress={fetchAnalysis} style={styles.refreshBtn} activeOpacity={0.8}>
                                <RefreshCw size={16} color={INSIGHT_GREEN_DEEP} />
                                <Text style={styles.refreshText}>Regenerate Analysis</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </ScrollView>
            </View>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    headerGrad: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 16 },
    backText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

    scroll: { padding: 16, paddingTop: 4, paddingBottom: 60 },

    stateCard: { backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', gap: 12, marginTop: 8, shadowColor: INSIGHT_GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
    stateTitle: { fontSize: 17, fontWeight: '700', color: '#1f2340' },
    stateSub: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
    progressBar: { width: '100%', height: 4, backgroundColor: INSIGHT_GREEN_PANEL, borderRadius: 4, marginTop: 8 },
    progressFill: { width: '60%', height: 4, backgroundColor: INSIGHT_GREEN_DEEP, borderRadius: 4 },
    errorIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
    errorTitle: { fontSize: 17, fontWeight: '700', color: '#ef4444' },
    retryBtn: { borderRadius: 16, paddingHorizontal: 32, paddingVertical: 14, marginTop: 4 },
    retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    metaStack: { alignItems: 'center', marginBottom: 12, gap: 6 },
    sourceBadge: { alignSelf: 'center', backgroundColor: INSIGHT_GREEN_SOFT, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: INSIGHT_GREEN_BORDER },
    sourceBadgeText: { fontSize: 12, color: INSIGHT_GREEN_DEEP, fontWeight: '600' },
    generatedAtText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
    refreshingBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: INSIGHT_GREEN_PANEL, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
    refreshingText: { fontSize: 12, fontWeight: '600', color: INSIGHT_GREEN_DARK },
    inlineError: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
    inlineErrorText: { flex: 1, color: '#b91c1c', fontSize: 12, lineHeight: 18, fontWeight: '500' },

    card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 12, shadowColor: INSIGHT_GREEN, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3, borderWidth: 1, borderColor: INSIGHT_GREEN_PANEL },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    cardIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 15, fontWeight: '700', color: '#1f2340' },
    narrativeBox: { backgroundColor: INSIGHT_GREEN_SOFT, borderRadius: 14, padding: 16, borderLeftWidth: 3, borderLeftColor: INSIGHT_GREEN_DEEP },
    narrativeText: { color: INSIGHT_GREEN_DARK, fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
    tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    tipBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: INSIGHT_GREEN_DEEP, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    tipNum: { color: '#fff', fontWeight: '800', fontSize: 12 },
    tipText: { flex: 1, color: '#374151', fontSize: 14, lineHeight: 21 },

    outcomeCard: { borderRadius: 20, padding: 20, marginBottom: 12, shadowColor: INSIGHT_GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5 },
    outcomeText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 22, fontWeight: '500' },

    disclaimerBox: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: INSIGHT_GREEN_PANEL },
    disclaimerText: { color: '#9ca3af', fontSize: 11, textAlign: 'center', lineHeight: 17 },

    refreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: INSIGHT_GREEN_SOFT, borderRadius: 16, paddingVertical: 14, borderWidth: 1.5, borderColor: INSIGHT_GREEN_BORDER },
    refreshText: { color: INSIGHT_GREEN_DEEP, fontWeight: '700', fontSize: 14 },
});
