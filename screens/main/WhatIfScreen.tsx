import { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Dimensions, StyleSheet, Platform, Image, ActivityIndicator } from "react-native";
import Slider from "@react-native-community/slider";
import { LineChart } from "react-native-gifted-charts";
import { ScreenLayout } from "../../components/ScreenLayout";
import { Activity, Moon, RefreshCw, TrendingUp, AlertTriangle } from "lucide-react-native";
import { Video, ResizeMode } from "expo-av";
import { calculatePredictedEnergy, predictMoodState, generatePredictionInsight, generateHabitSimulation } from "../../lib/prediction/model";
import { getHealthHistory } from "../../lib/api/auth";
import type { AppScreenProps } from "../../lib/navigation/types";
import {
    assessDataConfidence,
    assessScenarioFeasibility,
    AVATAR_STATE_META,
    CONFIDENCE_META,
    ConfidenceLevel,
    lowerConfidence,
    ScenarioAvatarState,
    ScenarioSlot,
    SavedScenario,
    inferSimulationAvatarDecision,
    SCENARIO_STATES,
} from "./whatif/scenarioUtils";
import { useScenarioAvatarLibrary } from "./whatif/useScenarioAvatarLibrary";
import { PageHeader } from "../../components/ui/PageHeader";
import { SectionCard } from "../../components/ui/SectionCard";
import { AppButton } from "../../components/ui/AppButton";
import { FadeInSection } from "../../components/ui/FadeInSection";
import { chartTheme } from "../../lib/theme/charts";
import { appTheme } from "../../lib/theme/tokens";

const screenWidth = Dimensions.get("window").width;
const WEB_VIDEO_STYLE: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    position: 'absolute',
    top: 0,
    left: 0,
};

export default function WhatIfScreen({ navigation }: AppScreenProps<'WhatIf'>) {
    const [loading, setLoading] = useState(true);

    const [baselinesteps, setBaselineSteps] = useState(5000);
    const [baselineSleep, setBaselineSleep] = useState(6.5);
    const [baselineEnergy, setBaselineEnergy] = useState(60);

    const [simSteps, setSimSteps] = useState(5000);
    const [simSleep, setSimSleep] = useState(6.5);
    const {
        avatarLoading,
        avatarImageUrl,
        avatarVideoByState,
        ensureScenarioStateVideo,
    } = useScenarioAvatarLibrary();
    const [avatarVideoFailed, setAvatarVideoFailed] = useState(false);
    const [videoRetryKey, setVideoRetryKey] = useState(0);
    const [videoFailureCount, setVideoFailureCount] = useState(0);
    const [scenarioA, setScenarioA] = useState<SavedScenario | null>(null);
    const [scenarioB, setScenarioB] = useState<SavedScenario | null>(null);
    const [availableLogDays, setAvailableLogDays] = useState(0);

    const predictedEnergy = useMemo(() => calculatePredictedEnergy(simSleep, simSteps), [simSleep, simSteps]);
    const predictedMood = useMemo(() => predictMoodState(simSleep, predictedEnergy), [simSleep, predictedEnergy]);
    const baselineMood = useMemo(() => predictMoodState(baselineSleep, baselineEnergy), [baselineSleep, baselineEnergy]);
    const baselineDecision = useMemo(() => inferSimulationAvatarDecision(baselineSleep, baselineEnergy), [baselineSleep, baselineEnergy]);
    const baselineFeasibility = useMemo(
        () => assessScenarioFeasibility(baselineSleep, baselinesteps, baselineSleep, baselinesteps),
        [baselineSleep, baselinesteps]
    );
    const simulationDecision = useMemo(
        () => inferSimulationAvatarDecision(simSleep, predictedEnergy),
        [simSleep, predictedEnergy]
    );
    const feasibility = useMemo(
        () => assessScenarioFeasibility(simSleep, simSteps, baselineSleep, baselinesteps),
        [simSleep, simSteps, baselineSleep, baselinesteps]
    );
    const dataConfidence = useMemo(
        () => assessDataConfidence(availableLogDays, 7),
        [availableLogDays]
    );
    const baselineCombinedConfidence = useMemo(
        () => lowerConfidence(baselineFeasibility.confidence, dataConfidence.confidence),
        [baselineFeasibility.confidence, dataConfidence.confidence]
    );
    const combinedConfidence = useMemo(
        () => lowerConfidence(feasibility.confidence, dataConfidence.confidence),
        [feasibility.confidence, dataConfidence.confidence]
    );
    const simulatedAvatarState = simulationDecision.state;
    const selectedStateVideoUrl = useMemo(
        () => avatarVideoByState[simulatedAvatarState] || null,
        [avatarVideoByState, simulatedAvatarState]
    );
    const fallbackPreviewState = useMemo(
        () => SCENARIO_STATES.find((state) => Boolean(avatarVideoByState[state])) || null,
        [avatarVideoByState]
    );
    const resolvedPreviewState = selectedStateVideoUrl ? simulatedAvatarState : fallbackPreviewState;
    const previewVideoUrl = resolvedPreviewState ? (avatarVideoByState[resolvedPreviewState] || null) : null;
    const previewIsFallbackState = !!resolvedPreviewState && resolvedPreviewState !== simulatedAvatarState;
    const hasAnyScenarioVideo = useMemo(
        () => Boolean(fallbackPreviewState),
        [fallbackPreviewState]
    );
    const scenarioMediaHint = useMemo(() => {
        if (previewVideoUrl && !avatarVideoFailed) {
            if (previewIsFallbackState && resolvedPreviewState) {
                return `Predicted ${AVATAR_STATE_META[simulatedAvatarState].label.toLowerCase()} video is not ready. Playing ${AVATAR_STATE_META[resolvedPreviewState].label.toLowerCase()} preview.`;
            }
            return null;
        }
        if (avatarLoading && !previewVideoUrl && !avatarImageUrl) return null;
        const stateLabel = AVATAR_STATE_META[simulatedAvatarState].label;
        if (avatarVideoFailed && previewVideoUrl) {
            return `${stateLabel} video failed to play. Showing avatar image fallback.`;
        }
        if (!previewVideoUrl && hasAnyScenarioVideo && avatarImageUrl) {
            return `${stateLabel} video is still loading. Showing avatar image fallback.`;
        }
        if (avatarImageUrl) {
            return `No playable scenario video available right now. Showing avatar image fallback.`;
        }
        if (availableLogDays === 0) {
            return 'No logs found yet. Seed 7 days demo or log daily vitals, then generate avatar media.';
        }
        return 'Avatar setup required. Open Settings > Digital Twin Setup.';
    }, [previewVideoUrl, avatarVideoFailed, avatarLoading, hasAnyScenarioVideo, avatarImageUrl, simulatedAvatarState, previewIsFallbackState, resolvedPreviewState, availableLogDays]);
    const forecastData = useMemo(() => generateHabitSimulation(baselineSleep, baselinesteps, simSleep, simSteps, 30), [baselineSleep, baselinesteps, simSleep, simSteps]);

    const chartData = useMemo(() => forecastData.map((point) => ({
        value: point.predictedEnergy, label: point.day % 5 === 0 ? `D${point.day}` : '',
        dataPointText: point.day === 30 ? point.predictedEnergy.toString() : '',
    })), [forecastData]);
    const forecastChartWidth = Math.max(240, screenWidth - 90);
    const forecastChartProps = useMemo(() => ({
        height: 160,
        width: forecastChartWidth,
        spacing: forecastChartWidth / 30,
        thickness: 3,
        hideDataPoints: true,
        hideRules: false,
        rulesType: 'solid' as const,
        rulesColor: chartTheme.rulesColor,
        yAxisColor: chartTheme.axisColor,
        xAxisColor: chartTheme.axisColor,
        yAxisTextStyle: chartTheme.axisText,
        xAxisLabelTextStyle: { ...chartTheme.axisText, textAlign: 'center' as const },
        maxValue: 100,
        noOfSections: chartTheme.sections,
        areaChart: true,
        startFillColor: "#7c3aed",
        endFillColor: "#f5f3ff",
        startOpacity: 0.18,
        endOpacity: 0.04,
        animationDuration: 850,
        isAnimated: true,
    }), [forecastChartWidth]);

    const finalEnergyDiff = forecastData[forecastData.length - 1].predictedEnergy - baselineEnergy;

    const narrative = useMemo(() => generatePredictionInsight(
        baselineEnergy, predictedEnergy, simSleep - baselineSleep, simSteps - baselinesteps
    ), [baselineEnergy, predictedEnergy, simSleep, simSteps]);
    const finalNarrative = useMemo(() => {
        if (dataConfidence.confidence === 'low') {
            return `Limited data (${dataConfidence.loggedDays}/${dataConfidence.totalDays} logs). ${narrative}`;
        }
        if (dataConfidence.confidence === 'medium') {
            return `Partial data (${dataConfidence.loggedDays}/${dataConfidence.totalDays} logs). ${narrative}`;
        }
        return narrative;
    }, [dataConfidence.confidence, dataConfidence.loggedDays, dataConfidence.totalDays, narrative]);
    const dataConfidenceMeta = CONFIDENCE_META[dataConfidence.confidence];
    const combinedConfidenceMeta = CONFIDENCE_META[combinedConfidence];
    const comparisonCards = useMemo(() => [
        {
            key: 'baseline',
            title: 'Baseline',
            subtitle: '7-day average',
            scenario: {
                sleep: baselineSleep,
                steps: baselinesteps,
                energy: baselineEnergy,
                mood: baselineMood,
                avatarState: baselineDecision.state,
                confidence: baselineCombinedConfidence,
                savedAtLabel: 'Auto',
            },
            isBaseline: true,
        },
        {
            key: 'scenario-a',
            title: 'Scenario A',
            subtitle: scenarioA ? `Saved ${scenarioA.savedAtLabel}` : 'Not saved yet',
            scenario: scenarioA,
            isBaseline: false,
        },
        {
            key: 'scenario-b',
            title: 'Scenario B',
            subtitle: scenarioB ? `Saved ${scenarioB.savedAtLabel}` : 'Not saved yet',
            scenario: scenarioB,
            isBaseline: false,
        },
    ], [baselineSleep, baselinesteps, baselineEnergy, baselineMood, baselineDecision.state, baselineCombinedConfidence, scenarioA, scenarioB]);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        setAvatarVideoFailed(false);
        setVideoFailureCount(0);
        setVideoRetryKey((value) => value + 1);
    }, [previewVideoUrl, simulationDecision.state]);

    useEffect(() => {
        if (selectedStateVideoUrl) return;
        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let attempts = 0;

        const tryLoad = async () => {
            if (cancelled) return;
            attempts += 1;
            await ensureScenarioStateVideo(simulatedAvatarState);
            if (cancelled) return;
            if (!selectedStateVideoUrl && attempts < 3) {
                timeoutId = setTimeout(() => {
                    void tryLoad();
                }, 900);
            }
        };

        void tryLoad();

        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [selectedStateVideoUrl, ensureScenarioStateVideo, simulatedAvatarState]);

    const handlePreviewVideoError = useCallback(() => {
        setVideoFailureCount((count) => {
            if (count < 2) {
                setVideoRetryKey((value) => value + 1);
                return count + 1;
            }
            setAvatarVideoFailed(true);
            return count;
        });
    }, []);

    useEffect(() => {
        void ensureScenarioStateVideo(simulatedAvatarState);
    }, [ensureScenarioStateVideo, simulatedAvatarState]);

    const loadData = async () => {
        try {
            const history = await getHealthHistory(7);
            const logCount = Array.isArray(history) ? history.length : 0;
            setAvailableLogDays(logCount);
            if (history.length > 0) {
                const avgSteps = Math.round(history.reduce((s, e) => s + e.steps, 0) / history.length);
                const avgSleep = history.reduce((s, e) => s + e.sleepHours, 0) / history.length;
                setBaselineSteps(avgSteps); setBaselineSleep(Number(avgSleep.toFixed(1)));
                setBaselineEnergy(calculatePredictedEnergy(avgSleep, avgSteps));
                setSimSteps(avgSteps); setSimSleep(Number(avgSleep.toFixed(1)));
            } else {
                setBaselineSteps(6500); setBaselineSleep(7.0);
                setBaselineEnergy(calculatePredictedEnergy(7.0, 6500));
                setSimSteps(6500); setSimSleep(7.0);
            }
        } catch (e) {
            setAvailableLogDays(0);
            console.error(e);
        }
        finally { setLoading(false); }
    };

    const saveScenario = (slot: ScenarioSlot) => {
        const saved: SavedScenario = {
            sleep: simSleep,
            steps: simSteps,
            energy: predictedEnergy,
            mood: predictedMood,
            avatarState: simulationDecision.state,
            confidence: combinedConfidence,
            savedAtLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        if (slot === 'A') {
            setScenarioA(saved);
            return;
        }
        setScenarioB(saved);
    };

    const resetSimulation = () => { setSimSteps(baselinesteps); setSimSleep(baselineSleep); };

    return (
        <ScreenLayout gradientBackground>
            <View style={{ flex: 1 }}>
                <PageHeader
                    title="Scenario Explorer"
                    subtitle="See how lifestyle changes affect you"
                    onBack={() => navigation.goBack()}
                />

                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    {/* Avatar Preview */}
                    <FadeInSection delay={40}>
                        <SectionCard style={styles.card}>
                        <View style={{ alignItems: 'center', marginVertical: 10 }}>
                            <View style={styles.avatarPreviewShell}>
                                {avatarLoading && !previewVideoUrl && !avatarImageUrl ? (
                                    <ActivityIndicator size="small" color="#7c3aed" />
                                ) : previewVideoUrl && !avatarVideoFailed ? (
                                    Platform.OS === 'web' ? (
                                        <video
                                            key={`${previewVideoUrl}-${videoRetryKey}`}
                                            src={previewVideoUrl}
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                            onLoadedData={() => setAvatarVideoFailed(false)}
                                            onError={handlePreviewVideoError}
                                            style={WEB_VIDEO_STYLE}
                                        />
                                    ) : (
                                        <Video
                                            key={`${previewVideoUrl}-${videoRetryKey}`}
                                            source={{ uri: previewVideoUrl }}
                                            style={styles.nativeVideo}
                                            resizeMode={ResizeMode.COVER}
                                            isMuted
                                            shouldPlay
                                            isLooping
                                            onLoad={() => setAvatarVideoFailed(false)}
                                            onError={handlePreviewVideoError}
                                        />
                                    )
                                ) : avatarImageUrl ? (
                                    <Image source={{ uri: avatarImageUrl }} style={styles.nativeVideo} resizeMode="cover" />
                                ) : (
                                    <Text style={styles.avatarFallbackText}>Setup avatar in Settings</Text>
                                )}
                            </View>
                            <View style={styles.moodBadge}>
                                <Text style={styles.moodText}>
                                    {AVATAR_STATE_META[simulatedAvatarState].label} {AVATAR_STATE_META[simulatedAvatarState].emoji}
                                </Text>
                            </View>
                            {previewIsFallbackState && resolvedPreviewState && (
                                <Text style={styles.playbackStateText}>
                                    Playing preview: {AVATAR_STATE_META[resolvedPreviewState].label} {AVATAR_STATE_META[resolvedPreviewState].emoji}
                                </Text>
                            )}
                            <Text style={styles.moodSubText}>Scenario model: {predictedMood}</Text>
                            {scenarioMediaHint && <Text style={styles.scenarioMediaHint}>{scenarioMediaHint}</Text>}
                            <Text style={[styles.dataConfidenceInline, { color: dataConfidenceMeta.color }]}>
                                Data confidence: {dataConfidenceMeta.label} ({dataConfidence.loggedDays}/{dataConfidence.totalDays} logs)
                            </Text>
                            <View style={styles.whyPanel}>
                                <Text style={styles.whyTitle}>Why this state?</Text>
                                <Text style={styles.whyRule}>{simulationDecision.ruleName}: {simulationDecision.ruleExpression}</Text>
                                <Text style={styles.whyMatch}>Matched because: {simulationDecision.matchedBecause}</Text>
                                <Text style={styles.whyValues}>
                                    Current values: sleep={simSleep.toFixed(1)}h, steps={simSteps.toLocaleString()}, predictedEnergy={predictedEnergy}
                                </Text>
                            </View>
                            <Text style={styles.narrativeText}>{finalNarrative}</Text>
                        </View>
                        </SectionCard>
                    </FadeInSection>

                    {/* Controls */}
                    <FadeInSection delay={80}>
                        <SectionCard style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>Adjust Habits</Text>
                            <TouchableOpacity onPress={resetSimulation} style={styles.resetBtn}>
                                <RefreshCw size={14} color="#7c3aed" />
                                <Text style={styles.resetText}>Reset</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.controlGroup}>
                            <View style={styles.controlRow}>
                                <View style={styles.controlLabelRow}>
                                    <View style={[styles.iconWrap, { backgroundColor: '#eff6ff' }]}><Activity size={16} color="#3b82f6" /></View>
                                    <Text style={styles.controlLabel}>Daily Steps</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.controlVal, { color: '#3b82f6' }]}>{simSteps.toLocaleString()}</Text>
                                    <Text style={styles.controlSub}>{simSteps - baselinesteps > 0 ? '+' : ''}{simSteps - baselinesteps} from avg</Text>
                                </View>
                            </View>
                            <Slider
                                minimumValue={0} maximumValue={20000} step={500}
                                value={simSteps} onValueChange={setSimSteps}
                                minimumTrackTintColor="#3b82f6" thumbTintColor="#3b82f6"
                            />
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.controlGroup}>
                            <View style={styles.controlRow}>
                                <View style={styles.controlLabelRow}>
                                    <View style={[styles.iconWrap, { backgroundColor: '#eef2ff' }]}><Moon size={16} color="#6366f1" /></View>
                                    <Text style={styles.controlLabel}>Nightly Sleep</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.controlVal, { color: '#6366f1' }]}>{simSleep.toFixed(1)}h</Text>
                                    <Text style={styles.controlSub}>{simSleep - baselineSleep > 0 ? '+' : ''}{(simSleep - baselineSleep).toFixed(1)}h from avg</Text>
                                </View>
                            </View>
                            <Slider
                                minimumValue={0} maximumValue={12} step={0.5}
                                value={simSleep} onValueChange={setSimSleep}
                                minimumTrackTintColor="#6366f1" thumbTintColor="#6366f1"
                            />
                        </View>

                        <View
                            style={[
                                styles.guardrailPanel,
                                combinedConfidence === 'low'
                                    ? styles.guardrailPanelLow
                                    : combinedConfidence === 'medium'
                                        ? styles.guardrailPanelMedium
                                        : styles.guardrailPanelHigh,
                            ]}
                        >
                            <View style={styles.guardrailHeader}>
                                <View style={styles.guardrailTitleRow}>
                                    <AlertTriangle size={14} color={combinedConfidenceMeta.color} />
                                    <Text style={styles.guardrailTitle}>Feasibility Guardrails</Text>
                                </View>
                                <View style={[styles.confidenceBadge, { backgroundColor: combinedConfidenceMeta.bg, borderColor: combinedConfidenceMeta.border }]}>
                                    <Text style={[styles.confidenceBadgeText, { color: combinedConfidenceMeta.color }]}>
                                        Confidence: {combinedConfidenceMeta.label}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.dataConfidenceRow}>
                                <Text style={styles.dataConfidenceLabel}>Data coverage</Text>
                                <Text style={[styles.dataConfidenceValue, { color: dataConfidenceMeta.color }]}>
                                    {dataConfidenceMeta.label} ({dataConfidence.loggedDays}/{dataConfidence.totalDays})
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.dataConfidenceNote,
                                    dataConfidence.confidence === 'low' ? styles.dataConfidenceNoteLow : undefined,
                                ]}
                            >
                                {dataConfidence.note}
                            </Text>

                            {feasibility.warnings.length > 0 ? (
                                <View style={styles.guardrailWarnings}>
                                    {feasibility.warnings.map((warning, idx) => (
                                        <Text key={`warning-${idx}`} style={styles.guardrailWarningText}>• {warning}</Text>
                                    ))}
                                </View>
                            ) : (
                                <Text style={styles.guardrailSafeText}>Inputs look realistic for daily planning.</Text>
                            )}

                            {(feasibility.isUnrealistic || dataConfidence.confidence === 'low') && (
                                <Text style={styles.guardrailLowText}>
                                    Low confidence: results are less certain due to unrealistic inputs and/or limited recent logs.
                                </Text>
                            )}
                        </View>

                        <View style={styles.saveScenarioRow}>
                            <View style={{ flex: 1 }}>
                                <AppButton label="Save as Scenario A" onPress={() => saveScenario('A')} variant="secondary" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <AppButton label="Save as Scenario B" onPress={() => saveScenario('B')} variant="secondary" />
                            </View>
                        </View>
                        </SectionCard>
                    </FadeInSection>

                    {/* Scenario Comparison */}
                    <FadeInSection delay={120}>
                        <SectionCard style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>Baseline vs Scenario A/B</Text>
                        </View>
                        <Text style={styles.compareHint}>
                            Save up to 2 scenarios and compare energy, mood, and avatar outcome side-by-side.
                        </Text>

                        <View style={styles.compareTable}>
                            <View style={[styles.compareTableRow, styles.compareTableHeaderRow]}>
                                <View style={[styles.compareMetricCell, styles.compareMetricHeaderCell]}>
                                    <Text style={styles.compareHeaderText}>Metric</Text>
                                </View>
                                {comparisonCards.map((card) => (
                                    <View
                                        key={`${card.key}-header`}
                                        style={[
                                            styles.compareValueCell,
                                            styles.compareHeaderCell,
                                            card.isBaseline ? styles.compareBaselineValueCell : undefined,
                                        ]}
                                    >
                                        <Text style={styles.compareHeaderText}>{card.title}</Text>
                                        <Text style={styles.compareHeaderSubText}>
                                            {card.isBaseline ? 'Auto' : card.scenario ? card.scenario.savedAtLabel : 'Not saved'}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.compareTableRow}>
                                <View style={styles.compareMetricCell}>
                                    <Text style={styles.compareMetricLabel}>Energy</Text>
                                </View>
                                {comparisonCards.map((card) => {
                                    const scenario = card.scenario;
                                    const delta = scenario ? scenario.energy - baselineEnergy : null;
                                    return (
                                        <View key={`${card.key}-energy`} style={[styles.compareValueCell, card.isBaseline ? styles.compareBaselineValueCell : undefined]}>
                                            <Text style={styles.compareCellPrimary}>{scenario ? scenario.energy : '—'}</Text>
                                            <Text
                                                style={[
                                                    styles.compareCellSecondary,
                                                    !card.isBaseline && delta !== null
                                                        ? { color: delta >= 0 ? '#059669' : '#dc2626' }
                                                        : undefined,
                                                ]}
                                            >
                                                {card.isBaseline
                                                    ? 'baseline'
                                                    : delta === null
                                                        ? 'not set'
                                                        : `${delta >= 0 ? '+' : ''}${delta} vs`}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>

                            <View style={styles.compareTableRow}>
                                <View style={styles.compareMetricCell}>
                                    <Text style={styles.compareMetricLabel}>Mood</Text>
                                </View>
                                {comparisonCards.map((card) => (
                                    <View key={`${card.key}-mood`} style={[styles.compareValueCell, card.isBaseline ? styles.compareBaselineValueCell : undefined]}>
                                        <Text style={styles.compareCellText}>{card.scenario ? card.scenario.mood : '—'}</Text>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.compareTableRow}>
                                <View style={styles.compareMetricCell}>
                                    <Text style={styles.compareMetricLabel}>Confidence</Text>
                                </View>
                                {comparisonCards.map((card) => {
                                    const scenario = card.scenario;
                                    const confidence: ConfidenceLevel | null = scenario ? scenario.confidence : null;
                                    const meta = confidence ? CONFIDENCE_META[confidence] : null;
                                    return (
                                        <View key={`${card.key}-confidence`} style={[styles.compareValueCell, card.isBaseline ? styles.compareBaselineValueCell : undefined]}>
                                            <Text style={[styles.compareCellText, meta ? { color: meta.color } : undefined]}>
                                                {meta ? meta.label : '—'}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>

                            <View style={styles.compareTableRow}>
                                <View style={styles.compareMetricCell}>
                                    <Text style={styles.compareMetricLabel}>Avatar</Text>
                                </View>
                                {comparisonCards.map((card) => {
                                    const avatarMeta = card.scenario ? AVATAR_STATE_META[card.scenario.avatarState] : null;
                                    return (
                                        <View key={`${card.key}-avatar`} style={[styles.compareValueCell, card.isBaseline ? styles.compareBaselineValueCell : undefined]}>
                                            <Text style={styles.compareCellText}>
                                                {avatarMeta ? `${avatarMeta.label} ${avatarMeta.emoji}` : '—'}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>

                            <View style={styles.compareTableRow}>
                                <View style={styles.compareMetricCell}>
                                    <Text style={styles.compareMetricLabel}>Sleep</Text>
                                </View>
                                {comparisonCards.map((card) => (
                                    <View key={`${card.key}-sleep`} style={[styles.compareValueCell, card.isBaseline ? styles.compareBaselineValueCell : undefined]}>
                                        <Text style={styles.compareCellText}>{card.scenario ? `${card.scenario.sleep.toFixed(1)}h` : '—'}</Text>
                                    </View>
                                ))}
                            </View>

                            <View style={[styles.compareTableRow, styles.compareTableRowLast]}>
                                <View style={styles.compareMetricCell}>
                                    <Text style={styles.compareMetricLabel}>Steps</Text>
                                </View>
                                {comparisonCards.map((card) => (
                                    <View key={`${card.key}-steps`} style={[styles.compareValueCell, card.isBaseline ? styles.compareBaselineValueCell : undefined]}>
                                        <Text style={styles.compareCellText}>{card.scenario ? card.scenario.steps.toLocaleString() : '—'}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                        </SectionCard>
                    </FadeInSection>

                    {/* Forecast Chart */}
                    <FadeInSection delay={160}>
                        <SectionCard style={styles.card}>
                        <View style={styles.forecastHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={[styles.iconWrap, { backgroundColor: '#f5f3ff' }]}><TrendingUp size={16} color="#7c3aed" /></View>
                                <Text style={styles.cardTitle}>30-Day Energy Forecast</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.forecastDiff, { color: finalEnergyDiff >= 0 ? '#10b981' : '#ef4444' }]}>
                                    {finalEnergyDiff >= 0 ? '+' : ''}{finalEnergyDiff} pts
                                </Text>
                                <Text style={styles.forecastSub}>by Day 30</Text>
                            </View>
                        </View>

                        <View style={{ marginLeft: -10, marginTop: 10, height: 200 }}>
                            <LineChart
                                data={chartData}
                                color="#7c3aed"
                                {...forecastChartProps}
                            />
                        </View>
                        </SectionCard>
                    </FadeInSection>
                </ScrollView>
            </View>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    scroll: { padding: 16, paddingBottom: 80, gap: 2 },
    card: {
        marginBottom: 16,
    },
    avatarPreviewShell: {
        width: 154,
        height: 154,
        borderRadius: 77,
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: '#fff',
        backgroundColor: '#ede9fe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    nativeVideo: { width: '100%', height: '100%' },
    avatarFallbackText: {
        color: '#6d28d9',
        fontSize: 11,
        fontWeight: '700',
        textAlign: 'center',
        paddingHorizontal: 14,
    },
    moodBadge: {
        backgroundColor: '#f5f3ff',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#ddd6fe',
        marginTop: 14,
        marginBottom: 12,
    },
    moodText: { color: '#6d28d9', fontWeight: '800', fontSize: 15 },
    playbackStateText: {
        color: '#5b21b6',
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 6,
    },
    moodSubText: { ...appTheme.typography.caption, color: appTheme.colors.textSecondary, marginBottom: 8 },
    scenarioMediaHint: {
        color: '#64748b',
        fontSize: 11,
        textAlign: 'center',
        marginBottom: 8,
        lineHeight: 17,
        paddingHorizontal: 8,
        fontWeight: '600',
    },
    dataConfidenceInline: { fontSize: 11, fontWeight: '700', marginBottom: 8 },
    whyPanel: {
        width: '100%',
        backgroundColor: '#f8f7ff',
        borderColor: '#ddd6fe',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
    },
    whyTitle: { color: '#5b21b6', fontSize: 12, fontWeight: '800', marginBottom: 5 },
    whyRule: { color: '#6d28d9', fontSize: 11, fontWeight: '700' },
    whyMatch: { color: '#4b5563', fontSize: 11, marginTop: 4, fontWeight: '600' },
    whyValues: { color: '#6b7280', fontSize: 11, marginTop: 4, fontWeight: '600' },
    narrativeText: {
        color: appTheme.colors.textSecondary,
        textAlign: 'center',
        fontSize: 13,
        lineHeight: 20,
        fontWeight: '500',
        paddingHorizontal: 6,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#ede9fe',
    },
    cardTitle: { ...appTheme.typography.h3, fontWeight: '800', color: appTheme.colors.textPrimary },
    resetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f5f3ff',
        borderWidth: 1,
        borderColor: '#ddd6fe',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    resetText: { ...appTheme.typography.caption, color: appTheme.colors.brandDark, fontWeight: '700' },
    controlGroup: { paddingVertical: 8 },
    controlRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    controlLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: appTheme.colors.border,
    },
    controlLabel: { ...appTheme.typography.bodyStrong, color: appTheme.colors.textPrimary },
    controlVal: { ...appTheme.typography.metric },
    controlSub: { ...appTheme.typography.overline, color: appTheme.colors.textMuted, marginTop: 2 },
    guardrailPanel: {
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 10,
    },
    guardrailPanelHigh: { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' },
    guardrailPanelMedium: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
    guardrailPanelLow: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
    guardrailHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    guardrailTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    guardrailTitle: { ...appTheme.typography.caption, color: appTheme.colors.textPrimary, fontWeight: '800' },
    confidenceBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    confidenceBadgeText: { fontSize: 10, fontWeight: '800' },
    dataConfidenceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    dataConfidenceLabel: { fontSize: 11, color: '#4b5563', fontWeight: '700' },
    dataConfidenceValue: { fontSize: 11, fontWeight: '800' },
    dataConfidenceNote: { fontSize: 11, color: '#6b7280', fontWeight: '600', marginBottom: 8 },
    dataConfidenceNoteLow: { color: '#b91c1c' },
    guardrailWarnings: { gap: 4 },
    guardrailWarningText: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
    guardrailSafeText: { fontSize: 11, color: '#065f46', fontWeight: '700' },
    guardrailLowText: { marginTop: 8, fontSize: 11, color: '#b91c1c', fontWeight: '800' },
    saveScenarioRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    compareHint: { color: appTheme.colors.textSecondary, fontSize: 12, marginTop: -2, marginBottom: 14, lineHeight: 18, fontWeight: '500' },
    compareTable: {
        borderWidth: 1,
        borderColor: '#e9e5ff',
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: '#fff',
    },
    compareTableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#ede9fe', minHeight: 46 },
    compareTableHeaderRow: { borderTopWidth: 0, backgroundColor: '#f5f3ff' },
    compareTableRowLast: {},
    compareMetricCell: {
        flex: 1,
        paddingHorizontal: 10,
        paddingVertical: 9,
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: '#ede9fe',
    },
    compareMetricHeaderCell: { backgroundColor: '#f5f3ff' },
    compareValueCell: {
        flex: 1,
        paddingHorizontal: 8,
        paddingVertical: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: '#ede9fe',
    },
    compareBaselineValueCell: { backgroundColor: '#f5f3ff' },
    compareHeaderCell: {},
    compareHeaderText: { color: appTheme.colors.brandDark, fontWeight: '800', fontSize: 11, textAlign: 'center' },
    compareHeaderSubText: { color: appTheme.colors.brand, fontWeight: '700', fontSize: 10, textAlign: 'center', marginTop: 2 },
    compareMetricLabel: { color: appTheme.colors.textSecondary, fontWeight: '700', fontSize: 12 },
    compareCellPrimary: { color: '#1f2937', fontWeight: '800', fontSize: 15, lineHeight: 18 },
    compareCellSecondary: { color: appTheme.colors.textSecondary, fontWeight: '600', fontSize: 10, marginTop: 2, textAlign: 'center' },
    compareCellText: { color: appTheme.colors.textPrimary, fontWeight: '700', fontSize: 11, textAlign: 'center' },
    divider: { height: 1, backgroundColor: '#ede9fe', marginVertical: 8 },
    forecastHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    forecastDiff: { fontSize: 17, fontWeight: '800' },
    forecastSub: { ...appTheme.typography.overline, color: appTheme.colors.textMuted, marginTop: 2 },
});
