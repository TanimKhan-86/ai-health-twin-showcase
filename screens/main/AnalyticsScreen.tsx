import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, useWindowDimensions } from "react-native";
import { ScreenLayout } from "../../components/ScreenLayout";
import { BarChart2, TrendingUp, ChevronLeft, ChevronRight, Activity } from "lucide-react-native";
import { LineChart } from "react-native-gifted-charts";
import {
    averageDelta,
    avg,
    avgFloat,
    AVATAR_STATE_META,
    AvatarState,
    buildCoverage,
    buildDistribution,
    clamp,
    confidenceLabel,
    dayKey,
    deltaColor,
    filterByRange,
    formatEffect,
    formatSigned,
    getWeekRange,
    HealthEntry,
    linearSlope,
    MoodEntry,
    qualityColor,
    shiftDateString,
    stdDev,
    XYPoint,
} from "./analytics/analyticsUtils";
import { useAnalyticsHistoryData } from "./analytics/useAnalyticsHistoryData";
import type { AppScreenProps } from "../../lib/navigation/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { appTheme } from "../../lib/theme/tokens";
import { chartTheme } from "../../lib/theme/charts";
import { FadeInSection } from "../../components/ui/FadeInSection";

export default function AnalyticsScreen({ navigation }: AppScreenProps<'Analytics'>) {
    const { width: screenWidth } = useWindowDimensions();
    const { loading, allHealth, allMood } = useAnalyticsHistoryData(60);
    const [weekOffset, setWeekOffset] = useState(0);
    const [trendWindow, setTrendWindow] = useState<7 | 30>(7);

    const { startDate, endDate } = getWeekRange(weekOffset);
    const { startDate: prevStartDate, endDate: prevEndDate } = getWeekRange(weekOffset + 1);
    const weekEntries = filterByRange(allHealth, startDate, endDate).sort((a, b) => a.date.localeCompare(b.date));
    const prevWeekEntries = filterByRange(allHealth, prevStartDate, prevEndDate);
    const weekMoodEntries = filterByRange(allMood, startDate, endDate).sort((a, b) => a.date.localeCompare(b.date));
    const prevWeekMoodEntries = filterByRange(allMood, prevStartDate, prevEndDate);

    const avgEnergy = avg(weekEntries.map(e => e.energyScore));
    const prevAvgEnergy = avg(prevWeekEntries.map(e => e.energyScore));
    const avgSteps = avg(weekEntries.map(e => e.steps));
    const prevAvgSteps = avg(prevWeekEntries.map(e => e.steps));
    const avgSleep = avgFloat(weekEntries.map(e => e.sleepHours), 1);
    const prevAvgSleep = avgFloat(prevWeekEntries.map(e => e.sleepHours), 1);
    const weekStressLevels = weekMoodEntries.map(e => Number(e.stressLevel)).filter(v => Number.isFinite(v));
    const prevWeekStressLevels = prevWeekMoodEntries.map(e => Number(e.stressLevel)).filter(v => Number.isFinite(v));
    const avgStress = avgFloat(weekStressLevels, 1);
    const prevAvgStress = avgFloat(prevWeekStressLevels, 1);
    const bestDay = weekEntries.reduce<HealthEntry | null>((b, e) => !b || e.energyScore > b.energyScore ? e : b, null);

    const sleepDelta = prevWeekEntries.length ? Number((avgSleep - prevAvgSleep).toFixed(1)) : null;
    const stepsDelta = prevWeekEntries.length ? (avgSteps - prevAvgSteps) : null;
    const energyDelta = prevWeekEntries.length ? (avgEnergy - prevAvgEnergy) : null;
    const stressDelta = prevWeekStressLevels.length ? Number((avgStress - prevAvgStress).toFixed(1)) : null;
    const dist7 = buildDistribution(7, endDate, allHealth, allMood);
    const dist30 = buildDistribution(30, endDate, allHealth, allMood);
    const coverage7 = buildCoverage(7, endDate, allHealth, allMood);
    const coverage30 = buildCoverage(30, endDate, allHealth, allMood);

    const trendStartDate = shiftDateString(endDate, -(trendWindow - 1));
    const trendHealthEntries = filterByRange(allHealth, trendStartDate, endDate).sort((a, b) => a.date.localeCompare(b.date));
    const trendMoodEntries = filterByRange(allMood, trendStartDate, endDate).sort((a, b) => a.date.localeCompare(b.date));

    const trendHealthByDay = new Map<string, HealthEntry>();
    const trendMoodByDay = new Map<string, MoodEntry>();
    for (const entry of trendHealthEntries) trendHealthByDay.set(dayKey(entry.date), entry);
    for (const entry of trendMoodEntries) trendMoodByDay.set(dayKey(entry.date), entry);

    const trendDayKeys: string[] = [];
    for (let i = 0; i < trendWindow; i += 1) {
        trendDayKeys.push(shiftDateString(trendStartDate, i));
    }
    const trendLabel = (key: string, index: number): string => {
        if (trendWindow === 30) {
            return index % 5 === 0 || index === trendDayKeys.length - 1 ? key.slice(8, 10) : "";
        }
        return key.slice(8, 10);
    };
    const trendChartWidth = Math.max(220, screenWidth - 86);
    const trendChartProps = useMemo(() => ({
        height: chartTheme.lineHeight,
        width: trendChartWidth,
        thickness: chartTheme.lineThickness,
        noOfSections: chartTheme.sections,
        yAxisThickness: 0,
        xAxisThickness: 1,
        xAxisColor: chartTheme.axisColor,
        hideRules: false,
        rulesColor: chartTheme.rulesColor,
        yAxisTextStyle: chartTheme.axisText,
        xAxisLabelTextStyle: chartTheme.axisText,
        initialSpacing: chartTheme.spacingInset,
        endSpacing: chartTheme.spacingInset,
        isAnimated: true,
        animationDuration: 620,
    }), [trendChartWidth]);

    const sleepTrendData = trendDayKeys.flatMap((key, index) => {
        const entry = trendHealthByDay.get(key);
        if (!entry) return [];
        const value = Number(entry.sleepHours);
        if (!Number.isFinite(value)) return [];
        return [{ value: Number(value.toFixed(1)), label: trendLabel(key, index) }];
    });
    const stepsTrendData = trendDayKeys.flatMap((key, index) => {
        const entry = trendHealthByDay.get(key);
        if (!entry) return [];
        const value = Number(entry.steps);
        if (!Number.isFinite(value)) return [];
        return [{ value, label: trendLabel(key, index) }];
    });
    const energyTrendData = trendDayKeys.flatMap((key, index) => {
        const entry = trendHealthByDay.get(key);
        if (!entry) return [];
        const value = Number(entry.energyScore);
        if (!Number.isFinite(value)) return [];
        return [{ value: Math.round(value), label: trendLabel(key, index) }];
    });
    const stressTrendData = trendDayKeys.flatMap((key, index) => {
        const entry = trendMoodByDay.get(key);
        if (!entry) return [];
        const value = Number(entry.stressLevel);
        if (!Number.isFinite(value)) return [];
        return [{ value: Number(value.toFixed(1)), label: trendLabel(key, index) }];
    });
    const sleepEnergyPairs: XYPoint[] = trendDayKeys.flatMap((key) => {
        const entry = trendHealthByDay.get(key);
        if (!entry) return [];
        const x = Number(entry.sleepHours);
        const y = Number(entry.energyScore);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
        return [{ x, y }];
    });
    const stepsEnergyPairs: XYPoint[] = trendDayKeys.flatMap((key) => {
        const entry = trendHealthByDay.get(key);
        if (!entry) return [];
        const x = Number(entry.steps);
        const y = Number(entry.energyScore);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
        return [{ x, y }];
    });
    const stressEnergyPairs: XYPoint[] = trendDayKeys.flatMap((key) => {
        const health = trendHealthByDay.get(key);
        const mood = trendMoodByDay.get(key);
        if (!health || !mood) return [];
        const x = Number(mood.stressLevel);
        const y = Number(health.energyScore);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
        return [{ x, y }];
    });

    const sleepEnergyPerHour = linearSlope(sleepEnergyPairs);
    const stepsEnergyPerStep = linearSlope(stepsEnergyPairs);
    const stressEnergyPerPoint = linearSlope(stressEnergyPairs);
    const stepsEnergyPerThousand = stepsEnergyPerStep === null ? null : stepsEnergyPerStep * 1000;
    const consistencySleepValues = trendDayKeys.flatMap((key) => {
        const entry = trendHealthByDay.get(key);
        if (!entry) return [];
        const value = Number(entry.sleepHours);
        return Number.isFinite(value) ? [value] : [];
    });
    const consistencyStepsValues = trendDayKeys.flatMap((key) => {
        const entry = trendHealthByDay.get(key);
        if (!entry) return [];
        const value = Number(entry.steps);
        return Number.isFinite(value) ? [value] : [];
    });
    const hasConsistencyData = consistencySleepValues.length >= 3 && consistencyStepsValues.length >= 3;
    const sleepStd = hasConsistencyData ? stdDev(consistencySleepValues) : 0;
    const sleepSwing = hasConsistencyData ? averageDelta(consistencySleepValues) : 0;
    const sleepRegularityScore = hasConsistencyData
        ? Math.round((clamp(100 - (sleepStd * 30), 0, 100) * 0.6) + (clamp(100 - (sleepSwing * 20), 0, 100) * 0.4))
        : null;
    const stepsMean = consistencyStepsValues.length
        ? (consistencyStepsValues.reduce((sum, value) => sum + value, 0) / consistencyStepsValues.length)
        : 0;
    const stepsStd = hasConsistencyData ? stdDev(consistencyStepsValues) : 0;
    const stepsCv = stepsMean > 0 ? stepsStd / stepsMean : 0;
    const stepsStabilityScore = hasConsistencyData ? Math.round(clamp(100 - (stepsCv * 120), 0, 100)) : null;
    const consistencyScore = sleepRegularityScore !== null && stepsStabilityScore !== null
        ? Math.round((sleepRegularityScore * 0.55) + (stepsStabilityScore * 0.45))
        : null;
    const consistencyLabel = consistencyScore === null
        ? 'Not enough data'
        : consistencyScore >= 80
            ? 'Very Consistent'
            : consistencyScore >= 65
                ? 'Moderately Consistent'
                : 'Inconsistent';
    const consistencyColor = consistencyScore === null
        ? '#64748b'
        : consistencyScore >= 80
            ? '#16a34a'
            : consistencyScore >= 65
                ? '#f59e0b'
                : '#ef4444';
    const sleepEffectPhrase = sleepEnergyPerHour === null
        ? 'signal still building (log a few more days)'
        : `${formatSigned(sleepEnergyPerHour, 1)} energy per +1h`;
    const stepsEffectPhrase = stepsEnergyPerThousand === null
        ? 'signal still building (log a few more days)'
        : `${formatSigned(stepsEnergyPerThousand, 1)} energy per +1k steps`;
    const stressEffectPhrase = stressEnergyPerPoint === null
        ? 'signal still building (log a few more days)'
        : `${formatSigned(stressEnergyPerPoint, 1)} energy per +1 stress`;

    const correlationCards = [
        {
            id: 'sleep-energy',
            title: 'Sleep vs Energy',
            statement: 'Higher sleep (+1h) correlates with',
            valueText: formatEffect(sleepEnergyPerHour, 'energy', 1),
            confidence: confidenceLabel(sleepEnergyPairs.length),
            samples: sleepEnergyPairs.length,
            color: '#6366f1',
        },
        {
            id: 'steps-energy',
            title: 'Steps vs Energy',
            statement: 'Higher activity (+1,000 steps) correlates with',
            valueText: formatEffect(stepsEnergyPerThousand, 'energy', 1),
            confidence: confidenceLabel(stepsEnergyPairs.length),
            samples: stepsEnergyPairs.length,
            color: '#14b8a6',
        },
        {
            id: 'stress-energy',
            title: 'Stress vs Energy',
            statement: 'Higher stress (+1 point) correlates with',
            valueText: formatEffect(stressEnergyPerPoint, 'energy', 1),
            confidence: confidenceLabel(stressEnergyPairs.length),
            samples: stressEnergyPairs.length,
            color: '#ef4444',
        },
    ] as const;
    const recommendations: Array<{ id: string; title: string; detail: string }> = [];
    if (coverage7.completeDays < 5) {
        recommendations.push({
            id: 'rec-log-coverage',
            title: 'Improve daily logging coverage',
            detail: `You logged complete data on ${coverage7.completeDays}/7 days. Target at least 5/7 days this week to increase analytics confidence.`,
        });
    }
    if (avgSleep < 6.8) {
        recommendations.push({
            id: 'rec-sleep',
            title: 'Increase sleep by +0.5 to +1.0 hour',
            detail: `Your 7-day average sleep is ${avgSleep.toFixed(1)}h. Raise it toward 7.0-7.5h; current sleep-energy signal: ${sleepEffectPhrase}.`,
        });
    }
    if (avgSteps < 7000) {
        recommendations.push({
            id: 'rec-steps',
            title: 'Add at least +1,500 daily steps',
            detail: `Current 7-day average is ${avgSteps.toLocaleString()} steps. Pushing toward 8,000 can lift energy; current steps-energy signal: ${stepsEffectPhrase}.`,
        });
    }
    if (avgStress > 6) {
        recommendations.push({
            id: 'rec-stress',
            title: 'Reduce stress to below 6/10',
            detail: `Current stress average is ${avgStress.toFixed(1)}/10. Add a 10-minute daily cooldown block; stress-energy signal: ${stressEffectPhrase}.`,
        });
    }
    if (consistencyScore !== null && consistencyScore < 70) {
        recommendations.push({
            id: 'rec-consistency',
            title: 'Stabilize routine day to day',
            detail: `Consistency score is ${consistencyScore}/100. Keep sleep variance under about 1h and avoid large step swings between consecutive days.`,
        });
    }
    if (recommendations.length < 2) {
        recommendations.push({
            id: 'rec-maintain',
            title: 'Maintain your strongest habit',
            detail: `Your current strongest signal is ${avgSleep >= 7 ? 'sleep duration' : avgSteps >= 8000 ? 'daily movement' : 'energy stability'}. Keep it stable for 7 more days to improve prediction reliability.`,
        });
    }
    const topRecommendations = recommendations.slice(0, 3);

    return (
        <ScreenLayout gradientBackground>
            <View style={{ flex: 1 }}>
                <PageHeader
                    title="Analytics"
                    subtitle="From MongoDB Atlas"
                    onBack={() => navigation.goBack()}
                    gradientColors={["#6366f1", "#4f46e5"]}
                    rightSlot={(
                        <View style={styles.navRow}>
                            <TouchableOpacity onPress={() => setWeekOffset(o => o + 1)} style={styles.navBtn}>
                                <ChevronLeft color="white" size={18} />
                            </TouchableOpacity>
                            <Text style={styles.navText}>{startDate.slice(5)} – {endDate.slice(5)}</Text>
                            <TouchableOpacity onPress={() => setWeekOffset(o => Math.max(0, o - 1))} style={[styles.navBtn, weekOffset === 0 && { opacity: 0.3 }]} disabled={weekOffset === 0}>
                                <ChevronRight color="white" size={18} />
                            </TouchableOpacity>
                        </View>
                    )}
                />

                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    {loading ? (
                        <ActivityIndicator size="large" color={appTheme.colors.brand} style={{ marginTop: 40 }} />
                    ) : weekEntries.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <EmptyState
                                icon="📊"
                                title="No data this week"
                                description="Log your health in the Daily Log to see analytics here."
                            />
                        </View>
                    ) : (
                        <>
                            {/* Weekly Snapshot */}
                            <FadeInSection delay={40}>
                                <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.iconWrapSm, { backgroundColor: '#eef2ff' }]}><Activity size={16} color="#4f46e5" /></View>
                                    <Text style={styles.cardTitle}>Weekly Snapshot</Text>
                                </View>

                                <View style={styles.snapshotGrid}>
                                    <View style={styles.snapshotCard}>
                                        <Text style={styles.snapshotLabel}>Sleep Avg</Text>
                                        <Text style={styles.snapshotValue}>{avgSleep.toFixed(1)}h</Text>
                                        <Text style={[styles.snapshotDelta, { color: deltaColor(sleepDelta) }]}>
                                            {sleepDelta === null ? 'No previous week' : `${sleepDelta > 0 ? '+' : ''}${sleepDelta.toFixed(1)}h vs last 7d`}
                                        </Text>
                                    </View>

                                    <View style={styles.snapshotCard}>
                                        <Text style={styles.snapshotLabel}>Steps Avg</Text>
                                        <Text style={styles.snapshotValue}>{avgSteps.toLocaleString()}</Text>
                                        <Text style={[styles.snapshotDelta, { color: deltaColor(stepsDelta) }]}>
                                            {stepsDelta === null ? 'No previous week' : `${stepsDelta > 0 ? '+' : ''}${stepsDelta.toLocaleString()} vs last 7d`}
                                        </Text>
                                    </View>

                                    <View style={styles.snapshotCard}>
                                        <Text style={styles.snapshotLabel}>Energy Avg</Text>
                                        <Text style={styles.snapshotValue}>{avgEnergy}/100</Text>
                                        <Text style={[styles.snapshotDelta, { color: deltaColor(energyDelta) }]}>
                                            {energyDelta === null ? 'No previous week' : `${energyDelta > 0 ? '+' : ''}${energyDelta} pts vs last 7d`}
                                        </Text>
                                    </View>

                                    <View style={styles.snapshotCard}>
                                        <Text style={styles.snapshotLabel}>Stress Avg</Text>
                                        <Text style={styles.snapshotValue}>{avgStress.toFixed(1)}/10</Text>
                                        <Text style={[styles.snapshotDelta, { color: deltaColor(stressDelta, true) }]}>
                                            {stressDelta === null ? 'No previous week' : `${stressDelta > 0 ? '+' : ''}${stressDelta.toFixed(1)} vs last 7d`}
                                        </Text>
                                    </View>
                                </View>
                                </View>
                            </FadeInSection>

                            {/* Mood / Avatar State Distribution */}
                            <FadeInSection delay={80}>
                                <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.iconWrapSm, { backgroundColor: '#f5f3ff' }]}><Text style={{ fontSize: 16 }}>🎭</Text></View>
                                    <Text style={styles.cardTitle}>Mood/Avatar State Distribution</Text>
                                </View>

                                <View style={styles.distributionMetaRow}>
                                    <Text style={styles.distributionMetaText}>Last 7d tracked days: {dist7.trackedDays}</Text>
                                    <Text style={styles.distributionMetaText}>Last 30d tracked days: {dist30.trackedDays}</Text>
                                </View>

                                {(Object.keys(AVATAR_STATE_META) as AvatarState[]).map((state) => {
                                    const meta = AVATAR_STATE_META[state];
                                    const pct7 = dist7.percentages[state];
                                    const pct30 = dist30.percentages[state];
                                    return (
                                        <View key={state} style={styles.distributionRow}>
                                            <View style={styles.distributionStateCol}>
                                                <View style={[styles.distributionStatePill, { backgroundColor: meta.bg }]}>
                                                    <Text style={[styles.distributionStateText, { color: meta.color }]}>{meta.label} {meta.emoji}</Text>
                                                </View>
                                            </View>

                                            <View style={styles.distributionBarsCol}>
                                                <View style={styles.distributionBarRow}>
                                                    <Text style={styles.distributionBarLabel}>7d</Text>
                                                    <View style={styles.distributionTrack}>
                                                        <View style={[styles.distributionFill, { width: `${pct7}%`, backgroundColor: meta.color }]} />
                                                    </View>
                                                    <Text style={styles.distributionPct}>{pct7}%</Text>
                                                </View>
                                                <View style={styles.distributionBarRow}>
                                                    <Text style={styles.distributionBarLabel}>30d</Text>
                                                    <View style={styles.distributionTrack}>
                                                        <View style={[styles.distributionFill, { width: `${pct30}%`, backgroundColor: meta.color }]} />
                                                    </View>
                                                    <Text style={styles.distributionPct}>{pct30}%</Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                                </View>
                            </FadeInSection>

                            {/* Trend Charts */}
                            <FadeInSection delay={120}>
                                <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.iconWrapSm, { backgroundColor: '#f1f5f9' }]}><BarChart2 size={16} color="#0f172a" /></View>
                                    <Text style={styles.cardTitle}>Trend Charts</Text>
                                </View>

                                <View style={styles.trendToggleRow}>
                                    {[7, 30].map((windowDays) => (
                                        <TouchableOpacity
                                            key={windowDays}
                                            onPress={() => setTrendWindow(windowDays as 7 | 30)}
                                            style={[
                                                styles.trendToggleBtn,
                                                trendWindow === windowDays && styles.trendToggleBtnActive,
                                            ]}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[
                                                styles.trendToggleText,
                                                trendWindow === windowDays && styles.trendToggleTextActive,
                                            ]}>
                                                {windowDays} Days
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.trendRangeText}>
                                    {trendStartDate} to {endDate}
                                </Text>

                                <View style={styles.trendMetricCard}>
                                    <View style={styles.trendMetricHeader}>
                                        <Text style={styles.trendMetricTitle}>Sleep (hours)</Text>
                                        <Text style={styles.trendMetricSub}>{sleepTrendData.length} logged days</Text>
                                    </View>
                                    {sleepTrendData.length > 0 ? (
                                        <View style={styles.trendChartWrap}>
                                            <LineChart
                                                data={sleepTrendData}
                                                color="#6366f1"
                                                dataPointsColor="#6366f1"
                                                maxValue={12}
                                                {...trendChartProps}
                                            />
                                        </View>
                                    ) : <Text style={styles.noDataCompact}>No sleep logs in selected range</Text>}
                                </View>

                                <View style={styles.trendMetricCard}>
                                    <View style={styles.trendMetricHeader}>
                                        <Text style={styles.trendMetricTitle}>Steps</Text>
                                        <Text style={styles.trendMetricSub}>{stepsTrendData.length} logged days</Text>
                                    </View>
                                    {stepsTrendData.length > 0 ? (
                                        <View style={styles.trendChartWrap}>
                                            <LineChart
                                                data={stepsTrendData}
                                                color="#14b8a6"
                                                dataPointsColor="#14b8a6"
                                                {...trendChartProps}
                                            />
                                        </View>
                                    ) : <Text style={styles.noDataCompact}>No step logs in selected range</Text>}
                                </View>

                                <View style={styles.trendMetricCard}>
                                    <View style={styles.trendMetricHeader}>
                                        <Text style={styles.trendMetricTitle}>Energy (0-100)</Text>
                                        <Text style={styles.trendMetricSub}>{energyTrendData.length} logged days</Text>
                                    </View>
                                    {energyTrendData.length > 0 ? (
                                        <View style={styles.trendChartWrap}>
                                            <LineChart
                                                data={energyTrendData}
                                                color="#7c3aed"
                                                dataPointsColor="#7c3aed"
                                                maxValue={100}
                                                {...trendChartProps}
                                            />
                                        </View>
                                    ) : <Text style={styles.noDataCompact}>No energy logs in selected range</Text>}
                                </View>

                                <View style={[styles.trendMetricCard, styles.trendMetricCardLast]}>
                                    <View style={styles.trendMetricHeader}>
                                        <Text style={styles.trendMetricTitle}>Stress (0-10)</Text>
                                        <Text style={styles.trendMetricSub}>{stressTrendData.length} logged days</Text>
                                    </View>
                                    {stressTrendData.length > 0 ? (
                                        <View style={styles.trendChartWrap}>
                                            <LineChart
                                                data={stressTrendData}
                                                color="#ef4444"
                                                dataPointsColor="#ef4444"
                                                {...trendChartProps}
                                                maxValue={10}
                                                noOfSections={5}
                                            />
                                        </View>
                                    ) : <Text style={styles.noDataCompact}>No stress logs in selected range</Text>}
                                </View>
                                </View>
                            </FadeInSection>

                            {/* Correlation Insights */}
                            <FadeInSection delay={160}>
                                <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.iconWrapSm, { backgroundColor: '#ede9fe' }]}><TrendingUp size={16} color="#7c3aed" /></View>
                                    <Text style={styles.cardTitle}>Correlation Insights</Text>
                                </View>
                                <Text style={styles.correlationIntro}>
                                    Based on the last {trendWindow} days. Correlation shows direction, not guaranteed causation.
                                </Text>

                                {correlationCards.map((card, index) => (
                                    <View
                                        key={card.id}
                                        style={[styles.correlationCard, index === correlationCards.length - 1 && styles.correlationCardLast]}
                                    >
                                        <Text style={styles.correlationTitle}>{card.title}</Text>
                                        <Text style={styles.correlationStatement}>{card.statement}</Text>
                                        <Text style={[styles.correlationValue, { color: card.color }]}>{card.valueText}</Text>
                                        <Text style={styles.correlationMeta}>Confidence: {card.confidence} ({card.samples} matched days)</Text>
                                    </View>
                                ))}
                                </View>
                            </FadeInSection>

                            {/* Consistency Score */}
                            <FadeInSection delay={200}>
                                <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.iconWrapSm, { backgroundColor: '#ecfeff' }]}><Activity size={16} color="#0891b2" /></View>
                                    <Text style={styles.cardTitle}>Consistency Score</Text>
                                </View>
                                <View style={styles.consistencyTopRow}>
                                    <Text style={styles.consistencyMainValue}>
                                        {consistencyScore === null ? '—' : `${consistencyScore}/100`}
                                    </Text>
                                    <Text style={[styles.consistencyMainLabel, { color: consistencyColor }]}>
                                        {consistencyLabel}
                                    </Text>
                                </View>
                                <Text style={styles.consistencyHint}>
                                    Combines sleep regularity (timing proxy from day-to-day sleep pattern) and steps stability.
                                </Text>
                                <View style={styles.consistencyBreakdownRow}>
                                    <View style={styles.consistencyPill}>
                                        <Text style={styles.consistencyPillLabel}>Sleep Regularity</Text>
                                        <Text style={styles.consistencyPillValue}>
                                            {sleepRegularityScore === null ? '—' : `${sleepRegularityScore}/100`}
                                        </Text>
                                    </View>
                                    <View style={styles.consistencyPill}>
                                        <Text style={styles.consistencyPillLabel}>Steps Stability</Text>
                                        <Text style={styles.consistencyPillValue}>
                                            {stepsStabilityScore === null ? '—' : `${stepsStabilityScore}/100`}
                                        </Text>
                                    </View>
                                </View>
                                </View>
                            </FadeInSection>

                            {/* Data Confidence */}
                            <FadeInSection delay={240}>
                                <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.iconWrapSm, { backgroundColor: '#f0f9ff' }]}><Text style={{ fontSize: 15 }}>🛡️</Text></View>
                                    <Text style={styles.cardTitle}>Data Confidence</Text>
                                </View>

                                <View style={styles.coverageRow}>
                                    <View style={styles.coverageRangeCell}>
                                        <Text style={styles.coverageRangeTitle}>Last 7 Days</Text>
                                        <Text style={styles.coverageRangeValue}>{coverage7.completeDays}/{coverage7.totalDays} complete</Text>
                                        <Text style={styles.coverageRangeSub}>Health {coverage7.healthDays}/{coverage7.totalDays} • Mood {coverage7.moodDays}/{coverage7.totalDays}</Text>
                                    </View>
                                    <View style={styles.coverageQualityCell}>
                                        <Text style={styles.coverageQualityLabel}>Quality</Text>
                                        <Text style={[styles.coverageQualityValue, { color: qualityColor(coverage7.quality) }]}>{coverage7.quality}</Text>
                                    </View>
                                </View>

                                <View style={styles.coverageRow}>
                                    <View style={styles.coverageRangeCell}>
                                        <Text style={styles.coverageRangeTitle}>Last 30 Days</Text>
                                        <Text style={styles.coverageRangeValue}>{coverage30.completeDays}/{coverage30.totalDays} complete</Text>
                                        <Text style={styles.coverageRangeSub}>Health {coverage30.healthDays}/{coverage30.totalDays} • Mood {coverage30.moodDays}/{coverage30.totalDays}</Text>
                                    </View>
                                    <View style={styles.coverageQualityCell}>
                                        <Text style={styles.coverageQualityLabel}>Quality</Text>
                                        <Text style={[styles.coverageQualityValue, { color: qualityColor(coverage30.quality) }]}>{coverage30.quality}</Text>
                                    </View>
                                </View>
                                </View>
                            </FadeInSection>

                            {/* Actionable Recommendations */}
                            <FadeInSection delay={280}>
                                <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.iconWrapSm, { backgroundColor: '#fffbeb' }]}><Text style={{ fontSize: 15 }}>✅</Text></View>
                                    <Text style={styles.cardTitle}>Actionable Recommendations</Text>
                                </View>
                                {topRecommendations.map((recommendation, index) => (
                                    <View
                                        key={recommendation.id}
                                        style={[styles.recommendationCard, index === topRecommendations.length - 1 && styles.recommendationCardLast]}
                                    >
                                        <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
                                        <Text style={styles.recommendationText}>{recommendation.detail}</Text>
                                    </View>
                                ))}

                                <TouchableOpacity
                                    style={styles.futureLinkButton}
                                    activeOpacity={0.85}
                                    onPress={() => navigation.navigate('FutureYou')}
                                >
                                    <Text style={styles.futureLinkButtonText}>Use This In Future You</Text>
                                    <Text style={styles.futureLinkButtonSub}>Connect analytics with prediction workflow</Text>
                                </TouchableOpacity>
                                </View>
                            </FadeInSection>

                            {/* Insights */}
                            <FadeInSection delay={320}>
                                <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.iconWrapSm, { backgroundColor: '#fffbeb' }]}><Text style={{ fontSize: 16 }}>💡</Text></View>
                                    <Text style={styles.cardTitle}>Key Insights</Text>
                                </View>
                                <View style={styles.insightRow}><Text style={styles.inLabel}>Avg Energy</Text><Text style={[styles.inVal, { color: '#7c3aed' }]}>{avgEnergy}/100</Text></View>
                                <View style={styles.divider} />
                                <View style={styles.insightRow}><Text style={styles.inLabel}>Avg Steps</Text><Text style={[styles.inVal, { color: '#14b8a6' }]}>{avgSteps.toLocaleString()}</Text></View>
                                <View style={styles.divider} />
                                <View style={styles.insightRow}><Text style={styles.inLabel}>Avg Sleep</Text><Text style={[styles.inVal, { color: '#6366f1' }]}>{avgSleep.toFixed(1)}h</Text></View>
                                <View style={styles.divider} />
                                <View style={styles.insightRow}><Text style={styles.inLabel}>Best Day</Text><Text style={[styles.inVal, { color: '#1e1b4b' }]}>{bestDay ? `${bestDay.date.slice(5)} (${Math.round(bestDay.energyScore)})` : '—'}</Text></View>
                                <View style={styles.insightAlert}>
                                    <Text style={styles.insightAlertText}>{weekEntries.length < 3 ? "🔍 Log more days to see deeper patterns." : avgEnergy >= 70 ? "✨ You're performing above average!" : "💤 Try getting more sleep — it boosts energy scores."}</Text>
                                </View>
                                </View>
                            </FadeInSection>
                        </>
                    )}
                </ScrollView>
            </View>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    navRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
    navBtn: { padding: 4 },
    navText: { color: '#fff', fontWeight: '700', fontSize: 12, marginHorizontal: 4 },
    scroll: { padding: appTheme.spacing.lg, paddingBottom: 64, gap: 4 },
    card: {
        backgroundColor: appTheme.colors.surface,
        borderRadius: appTheme.radius.lg,
        padding: appTheme.spacing.xl,
        marginBottom: appTheme.spacing.lg,
        shadowColor: appTheme.colors.brand,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
        borderColor: appTheme.colors.border,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: appTheme.spacing.lg },
    iconWrapSm: {
        width: 34,
        height: 34,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: appTheme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: { ...appTheme.typography.h3, fontWeight: '800', color: appTheme.colors.textPrimary },
    snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    snapshotCard: { width: '48%', backgroundColor: '#f8f9ff', borderWidth: 1, borderColor: appTheme.colors.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12 },
    snapshotLabel: { fontSize: 12, fontWeight: '700', color: appTheme.colors.textMuted },
    snapshotValue: { fontSize: 20, fontWeight: '900', color: appTheme.colors.textPrimary, marginTop: 2 },
    snapshotDelta: { fontSize: 11, fontWeight: '700', marginTop: 4 },
    distributionMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
    distributionMetaText: { color: appTheme.colors.textSecondary, fontSize: 11, fontWeight: '600' },
    distributionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
    distributionStateCol: { width: 92 },
    distributionStatePill: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start' },
    distributionStateText: { fontSize: 11, fontWeight: '800' },
    distributionBarsCol: { flex: 1, gap: 6 },
    distributionBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    distributionBarLabel: { width: 26, color: appTheme.colors.textSecondary, fontSize: 11, fontWeight: '700' },
    distributionTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: '#e4e9fb', overflow: 'hidden' },
    distributionFill: { height: '100%', borderRadius: 999 },
    distributionPct: { width: 34, textAlign: 'right', color: '#334155', fontSize: 11, fontWeight: '800' },
    trendToggleRow: { flexDirection: 'row', backgroundColor: '#f8f9ff', borderRadius: 12, borderWidth: 1, borderColor: appTheme.colors.border, padding: 4, gap: 6, marginBottom: 12 },
    trendToggleBtn: { flex: 1, borderRadius: 9, alignItems: 'center', paddingVertical: 8 },
    trendToggleBtnActive: { backgroundColor: '#1e1b4b' },
    trendToggleText: { fontSize: 12, fontWeight: '700', color: appTheme.colors.textSecondary },
    trendToggleTextActive: { color: '#ffffff' },
    trendRangeText: { fontSize: 11, color: appTheme.colors.textSecondary, fontWeight: '600', marginBottom: 12 },
    trendMetricCard: { borderWidth: 1, borderColor: appTheme.colors.border, borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: '#fcfdff' },
    trendMetricCardLast: { marginBottom: 0 },
    trendMetricHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    trendMetricTitle: { ...appTheme.typography.caption, fontWeight: '800', fontSize: 13, color: appTheme.colors.textPrimary },
    trendMetricSub: { fontSize: 11, color: appTheme.colors.textSecondary, fontWeight: '600' },
    trendChartWrap: { marginLeft: -10, height: 148 },
    chartAxisText: chartTheme.axisText,
    noDataCompact: { color: appTheme.colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 14, fontWeight: '600' },
    correlationIntro: { color: appTheme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 12 },
    correlationCard: { backgroundColor: '#fcfdff', borderWidth: 1, borderColor: appTheme.colors.border, borderRadius: 14, padding: 12, marginBottom: 10 },
    correlationCardLast: { marginBottom: 0 },
    correlationTitle: { ...appTheme.typography.caption, fontWeight: '800', fontSize: 13, color: appTheme.colors.textPrimary, marginBottom: 3 },
    correlationStatement: { ...appTheme.typography.caption, color: appTheme.colors.textSecondary, marginBottom: 4 },
    correlationValue: { fontSize: 18, fontWeight: '900' },
    correlationMeta: { marginTop: 4, fontSize: 11, color: appTheme.colors.textSecondary, fontWeight: '600' },
    consistencyTopRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 6 },
    consistencyMainValue: { fontSize: 30, fontWeight: '900', color: '#0f172a' },
    consistencyMainLabel: { ...appTheme.typography.caption, fontSize: 13, fontWeight: '800' },
    consistencyHint: { color: appTheme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 12 },
    consistencyBreakdownRow: { flexDirection: 'row', gap: 10 },
    consistencyPill: { flex: 1, backgroundColor: '#f8f9ff', borderWidth: 1, borderColor: appTheme.colors.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10 },
    consistencyPillLabel: { fontSize: 11, fontWeight: '700', color: appTheme.colors.textSecondary, marginBottom: 3 },
    consistencyPillValue: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    coverageRow: { flexDirection: 'row', backgroundColor: '#fcfdff', borderWidth: 1, borderColor: appTheme.colors.border, borderRadius: 14, padding: 12, marginBottom: 12, alignItems: 'center' },
    coverageRangeCell: { flex: 1, paddingRight: 8 },
    coverageRangeTitle: { ...appTheme.typography.caption, fontSize: 13, fontWeight: '800', color: appTheme.colors.textPrimary },
    coverageRangeValue: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 3 },
    coverageRangeSub: { fontSize: 11, color: appTheme.colors.textSecondary, marginTop: 3 },
    coverageQualityCell: { width: 86, alignItems: 'flex-end' },
    coverageQualityLabel: { fontSize: 11, color: appTheme.colors.textSecondary, fontWeight: '700' },
    coverageQualityValue: { fontSize: 18, fontWeight: '900', marginTop: 2 },
    recommendationCard: { backgroundColor: '#fcfdff', borderWidth: 1, borderColor: appTheme.colors.border, borderRadius: 14, padding: 12, marginBottom: 10 },
    recommendationCardLast: { marginBottom: 12 },
    recommendationTitle: { ...appTheme.typography.caption, fontSize: 13, fontWeight: '800', color: appTheme.colors.textPrimary, marginBottom: 4 },
    recommendationText: { fontSize: 12, color: appTheme.colors.textSecondary, lineHeight: 18 },
    futureLinkButton: { backgroundColor: '#1e1b4b', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
    futureLinkButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    futureLinkButtonSub: { color: '#c4b5fd', fontSize: 11, marginTop: 2, fontWeight: '600' },
    insightRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
    inLabel: { ...appTheme.typography.body, color: appTheme.colors.textSecondary },
    inVal: { ...appTheme.typography.bodyStrong, fontSize: 15 },
    divider: { height: 1, backgroundColor: '#f3f4f6' },
    insightAlert: { backgroundColor: '#f5f3ff', padding: 16, borderRadius: 14, marginTop: 16, borderLeftWidth: 3, borderLeftColor: '#7c3aed' },
    insightAlertText: { color: '#4c1d95', fontSize: 13, lineHeight: 20, fontWeight: '500' },
    emptyCard: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', marginTop: 20 },
    iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1e1b4b', marginBottom: 8 },
    emptyText: { color: '#6b7280', textAlign: 'center', lineHeight: 22, fontSize: 14 },
    noData: { color: '#9ca3af', textAlign: 'center', marginVertical: 40 },
});
