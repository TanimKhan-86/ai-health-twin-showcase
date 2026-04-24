import React, { useMemo, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    Platform,
    StyleSheet,
    useWindowDimensions,
    TextInput,
} from "react-native";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { Activity, ArrowLeft, Calendar, Moon, Smile } from "lucide-react-native";
import { ScreenLayout } from "../../components/ScreenLayout";
import { useToast } from "../../components/ui/Toast";
import { saveDailyLog } from "../../lib/api/auth";
import { useAuth } from "../../contexts/AuthContext";
import type { AppScreenProps } from "../../lib/navigation/types";
import { getLocalDateYmd } from "../../lib/date/localDay";
import { PageHeader } from "../../components/ui/PageHeader";
import { AppButton } from "../../components/ui/AppButton";
import { appTheme } from "../../lib/theme/tokens";

type DailyLogScreenProps = AppScreenProps<"DailyLog"> | AppScreenProps<"DataEntry">;

type TouchedFields = {
    activeMinutes: boolean;
    sleepHours: boolean;
    mood: boolean;
    energy: boolean;
    stress: boolean;
};

type SectionConfig = {
    key: "physical" | "sleep" | "mood";
    title: string;
    subtitle: string;
    accent: string;
    soft: string;
    Icon: typeof Activity;
};

const LOG_BLUE = "#3b82f6";
const LOG_BLUE_DEEP = "#1d4ed8";
const LOG_BLUE_SOFT = "#eaf3ff";
const LOG_INDIGO = "#5c48f0";
const LOG_INDIGO_SOFT = "#f2efff";
const LOG_MINT = "#0f9f71";
const LOG_MINT_SOFT = "#eafaf3";
const LOG_GOLD = "#f4b544";
const LOG_GOLD_SOFT = "#fff6df";
const LOG_ROSE = "#ef476f";
const LOG_ROSE_SOFT = "#fff1f5";
const LOG_BORDER = "#e6ddff";
const LOG_SURFACE = "rgba(255,255,255,0.92)";
const LOG_SURFACE_SOFT = "rgba(255,255,255,0.72)";

const sections: SectionConfig[] = [
    {
        key: "physical",
        title: "Physical",
        subtitle: "Movement and activity",
        accent: LOG_INDIGO,
        soft: LOG_INDIGO_SOFT,
        Icon: Activity,
    },
    {
        key: "sleep",
        title: "Sleep",
        subtitle: "Recovery and rest",
        accent: LOG_BLUE,
        soft: LOG_BLUE_SOFT,
        Icon: Moon,
    },
    {
        key: "mood",
        title: "Mood",
        subtitle: "Energy and stress",
        accent: LOG_MINT,
        soft: LOG_MINT_SOFT,
        Icon: Smile,
    },
];

const moodOptions = ["happy", "calm", "tired", "stressed"] as const;

const moodMeta: Record<(typeof moodOptions)[number], { emoji: string; title: string; note: string; accent: string; soft: string }> = {
    happy: {
        emoji: "🙂",
        title: "Happy",
        note: "Positive and upbeat",
        accent: LOG_GOLD,
        soft: LOG_GOLD_SOFT,
    },
    calm: {
        emoji: "😌",
        title: "Calm",
        note: "Steady and settled",
        accent: LOG_BLUE,
        soft: LOG_BLUE_SOFT,
    },
    tired: {
        emoji: "😴",
        title: "Tired",
        note: "Low energy today",
        accent: LOG_INDIGO,
        soft: LOG_INDIGO_SOFT,
    },
    stressed: {
        emoji: "😣",
        title: "Stressed",
        note: "High pressure or strain",
        accent: LOG_ROSE,
        soft: LOG_ROSE_SOFT,
    },
};

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function buildCompletionState(
    steps: string,
    touchedFields: TouchedFields,
    mood: (typeof moodOptions)[number] | null
): boolean[] {
    return [
        steps.trim().length > 0 && touchedFields.activeMinutes,
        touchedFields.sleepHours,
        !!mood && touchedFields.energy && touchedFields.stress,
    ];
}

export default function DailyLogScreen({ navigation }: DailyLogScreenProps) {
    const { showToast } = useToast();
    const { user } = useAuth();
    const { width } = useWindowDimensions();
    const [currentSection, setCurrentSection] = useState(0);
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [steps, setSteps] = useState("");
    const [activeMinutes, setActiveMinutes] = useState(0);
    const [sleepHours, setSleepHours] = useState(0);
    const [mood, setMood] = useState<(typeof moodOptions)[number] | null>(null);
    const [energy, setEnergy] = useState(1);
    const [stress, setStress] = useState(1);
    const [touchedFields, setTouchedFields] = useState<TouchedFields>({
        activeMinutes: false,
        sleepHours: false,
        mood: false,
        energy: false,
        stress: false,
    });

    const isWide = width >= 1120;
    const dateLabel = useMemo(
        () => new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        }),
        []
    );

    const markTouched = (field: keyof TouchedFields) => {
        setTouchedFields((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
    };

    const hasFreshDailyLogInput = (
        steps.trim().length > 0
        && touchedFields.activeMinutes
        && touchedFields.sleepHours
        && !!mood
        && touchedFields.energy
        && touchedFields.stress
    );

    const completionBySection = useMemo(
        () => buildCompletionState(steps, touchedFields, mood),
        [steps, touchedFields, mood]
    );
    const completionCount = completionBySection.filter(Boolean).length;
    const progressRatio = completionCount / sections.length;
    const remainingSections = sections.length - completionCount;

    const parsedSteps = Number.parseInt(steps, 10) || 0;
    const energyScore = Math.min(100, Math.max(0,
        ((sleepHours / 8) * 0.6 + (parsedSteps / 10000) * 0.4) * 100
    ));

    const goToFirstIncompleteSection = () => {
        if (steps.trim().length === 0 || !touchedFields.activeMinutes) {
            setCurrentSection(0);
            return;
        }
        if (!touchedFields.sleepHours) {
            setCurrentSection(1);
            return;
        }
        setCurrentSection(2);
    };

    const handleNext = () => {
        if (currentSection < sections.length - 1) {
            setCurrentSection((prev) => prev + 1);
            return;
        }
        void handleSave();
    };

    const handleSave = async () => {
        if (!user) {
            showToast("Please log in first", "error");
            return;
        }
        if (!hasFreshDailyLogInput || !mood) {
            goToFirstIncompleteSection();
            showToast("Enter today’s values in each section before saving.", "error");
            return;
        }

        setLoading(true);
        try {
            const today = getLocalDateYmd();
            const activeMinutesRounded = Math.round(activeMinutes);

            await saveDailyLog({
                date: today,
                steps: parsedSteps,
                activeMinutes: activeMinutesRounded,
                sleepHours,
                energyScore,
                mood,
                energyLevel: energy,
                stressLevel: stress,
                healthNotes: `Active minutes: ${activeMinutesRounded}`,
                moodNotes: `Daily log entry • Active minutes: ${activeMinutesRounded}`,
            });

            showToast("Saved to MongoDB Atlas.", "success");
            if (navigation.canGoBack()) {
                navigation.goBack();
            } else {
                navigation.navigate("Main");
            }
        } catch (error) {
            console.error(error);
            showToast("Failed to save entry", "error");
        } finally {
            setLoading(false);
        }
    };

    const currentSectionConfig = sections[currentSection];

    const renderSectionContent = () => {
        switch (currentSection) {
            case 0:
                return (
                    <View style={styles.sectionStack}>
                        <View style={[styles.sectionHero, { backgroundColor: currentSectionConfig.soft }]}> 
                            <View style={[styles.sectionIconShell, { backgroundColor: "#ffffff" }]}> 
                                <Activity size={22} color={currentSectionConfig.accent} />
                            </View>
                            <View style={styles.sectionHeroCopy}>
                                <Text style={styles.sectionTitle}>Movement snapshot</Text>
                                <Text style={styles.sectionText}>Enter today’s step count and active minutes to anchor the twin in real activity data.</Text>
                            </View>
                        </View>

                        <View style={styles.fieldGrid}>
                            <View style={[styles.inputCard, styles.inputCardPrimary]}>
                                <Text style={styles.fieldEyebrow}>Steps taken</Text>
                                <TextInput
                                    placeholder="8500"
                                    placeholderTextColor="#99a3c0"
                                    keyboardType="numeric"
                                    value={steps}
                                    onChangeText={setSteps}
                                    style={styles.numericInput}
                                />
                                <Text style={styles.fieldSupport}>A full day target usually sits around 8,000 to 10,000 steps.</Text>
                            </View>

                            <View style={styles.sliderCard}>
                                <View style={styles.sliderHeader}>
                                    <View>
                                        <Text style={styles.fieldEyebrow}>Active minutes</Text>
                                        <Text style={styles.sliderTitle}>Intentional movement</Text>
                                    </View>
                                    <View style={[styles.valueBadge, { backgroundColor: LOG_INDIGO_SOFT }]}> 
                                        <Text style={[styles.valueBadgeText, { color: LOG_INDIGO }]}>
                                            {touchedFields.activeMinutes ? `${Math.round(activeMinutes)} min` : "Set"}
                                        </Text>
                                    </View>
                                </View>
                                <Slider
                                    minimumValue={0}
                                    maximumValue={120}
                                    step={5}
                                    value={activeMinutes}
                                    onValueChange={(value) => {
                                        markTouched("activeMinutes");
                                        setActiveMinutes(value);
                                    }}
                                    minimumTrackTintColor={LOG_INDIGO}
                                    maximumTrackTintColor="#e6e8f2"
                                    thumbTintColor={LOG_INDIGO}
                                />
                                <View style={styles.scaleMetaRow}>
                                    <Text style={styles.scaleMetaText}>0 min</Text>
                                    <Text style={styles.scaleMetaText}>60 min</Text>
                                    <Text style={styles.scaleMetaText}>120 min</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                );
            case 1:
                return (
                    <View style={styles.sectionStack}>
                        <View style={[styles.sectionHero, { backgroundColor: currentSectionConfig.soft }]}> 
                            <View style={[styles.sectionIconShell, { backgroundColor: "#ffffff" }]}> 
                                <Moon size={22} color={currentSectionConfig.accent} />
                            </View>
                            <View style={styles.sectionHeroCopy}>
                                <Text style={styles.sectionTitle}>Recovery snapshot</Text>
                                <Text style={styles.sectionText}>Capture last night’s sleep so the dashboard can estimate recovery and energy quality properly.</Text>
                            </View>
                        </View>

                        <View style={styles.sliderCardLarge}>
                            <View style={styles.sliderHeader}>
                                <View>
                                    <Text style={styles.fieldEyebrow}>Sleep duration</Text>
                                    <Text style={styles.sliderTitle}>Hours slept</Text>
                                </View>
                                <View style={[styles.valueBadge, { backgroundColor: LOG_BLUE_SOFT }]}> 
                                    <Text style={[styles.valueBadgeText, { color: LOG_BLUE }]}>
                                        {touchedFields.sleepHours ? `${sleepHours.toFixed(1)} hrs` : "Set"}
                                    </Text>
                                </View>
                            </View>
                            <Slider
                                minimumValue={0}
                                maximumValue={12}
                                step={0.5}
                                value={sleepHours}
                                onValueChange={(value) => {
                                    markTouched("sleepHours");
                                    setSleepHours(value);
                                }}
                                minimumTrackTintColor={LOG_BLUE}
                                maximumTrackTintColor="#e6e8f2"
                                thumbTintColor={LOG_BLUE}
                            />
                            <View style={styles.scaleMetaRow}>
                                <Text style={styles.scaleMetaText}>0 hrs</Text>
                                <Text style={styles.scaleMetaText}>8 hrs</Text>
                                <Text style={styles.scaleMetaText}>12 hrs</Text>
                            </View>
                        </View>

                        <View style={styles.insightBand}>
                            <Text style={styles.insightBandLabel}>Why this matters</Text>
                            <Text style={styles.insightBandText}>Sleep has the biggest impact on recovery quality and heavily shapes the projected energy score.</Text>
                        </View>
                    </View>
                );
            case 2:
                return (
                    <View style={styles.sectionStack}>
                        <View style={[styles.sectionHero, { backgroundColor: currentSectionConfig.soft }]}> 
                            <View style={[styles.sectionIconShell, { backgroundColor: "#ffffff" }]}> 
                                <Smile size={22} color={currentSectionConfig.accent} />
                            </View>
                            <View style={styles.sectionHeroCopy}>
                                <Text style={styles.sectionTitle}>Mood snapshot</Text>
                                <Text style={styles.sectionText}>Choose the feeling that best matches today, then tune your energy and stress levels.</Text>
                            </View>
                        </View>

                        <View style={styles.moodGrid}>
                            {moodOptions.map((option) => {
                                const meta = moodMeta[option];
                                const selected = mood === option;
                                const hoverKey = `mood-${option}`;
                                return (
                                    <Pressable
                                        key={option}
                                        onPress={() => {
                                            markTouched("mood");
                                            setMood(option);
                                        }}
                                        onHoverIn={() => setHoveredKey(hoverKey)}
                                        onHoverOut={() => setHoveredKey(null)}
                                        style={({ pressed }) => [
                                            styles.moodCard,
                                            { borderColor: selected ? meta.accent : LOG_BORDER, backgroundColor: selected ? meta.soft : "rgba(255,255,255,0.78)" },
                                            hoveredKey === hoverKey && !selected ? styles.cardHover : undefined,
                                            pressed ? styles.cardPressed : undefined,
                                            Platform.OS === "web" ? ({ cursor: "pointer" } as any) : undefined,
                                        ]}
                                    >
                                        <Text style={styles.moodEmoji}>{meta.emoji}</Text>
                                        <Text style={[styles.moodTitle, selected ? { color: meta.accent } : undefined]}>{meta.title}</Text>
                                        <Text style={styles.moodNote}>{meta.note}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <View style={styles.fieldGrid}>
                            <View style={styles.sliderCard}>
                                <View style={styles.sliderHeader}>
                                    <View>
                                        <Text style={styles.fieldEyebrow}>Energy level</Text>
                                        <Text style={styles.sliderTitle}>How energised do you feel?</Text>
                                    </View>
                                    <View style={[styles.valueBadge, { backgroundColor: LOG_MINT_SOFT }]}> 
                                        <Text style={[styles.valueBadgeText, { color: LOG_MINT }]}>
                                            {touchedFields.energy ? `${Math.round(energy)}/10` : "Set"}
                                        </Text>
                                    </View>
                                </View>
                                <Slider
                                    minimumValue={1}
                                    maximumValue={10}
                                    step={1}
                                    value={energy}
                                    onValueChange={(value) => {
                                        markTouched("energy");
                                        setEnergy(value);
                                    }}
                                    minimumTrackTintColor={LOG_MINT}
                                    maximumTrackTintColor="#e6e8f2"
                                    thumbTintColor={LOG_MINT}
                                />
                                <View style={styles.scaleMetaRow}>
                                    <Text style={styles.scaleMetaText}>Low</Text>
                                    <Text style={styles.scaleMetaText}>5</Text>
                                    <Text style={styles.scaleMetaText}>High</Text>
                                </View>
                            </View>

                            <View style={styles.sliderCard}>
                                <View style={styles.sliderHeader}>
                                    <View>
                                        <Text style={styles.fieldEyebrow}>Stress level</Text>
                                        <Text style={styles.sliderTitle}>How pressured do you feel?</Text>
                                    </View>
                                    <View style={[styles.valueBadge, { backgroundColor: LOG_ROSE_SOFT }]}> 
                                        <Text style={[styles.valueBadgeText, { color: LOG_ROSE }]}>
                                            {touchedFields.stress ? `${Math.round(stress)}/10` : "Set"}
                                        </Text>
                                    </View>
                                </View>
                                <Slider
                                    minimumValue={1}
                                    maximumValue={10}
                                    step={1}
                                    value={stress}
                                    onValueChange={(value) => {
                                        markTouched("stress");
                                        setStress(value);
                                    }}
                                    minimumTrackTintColor={LOG_ROSE}
                                    maximumTrackTintColor="#e6e8f2"
                                    thumbTintColor={LOG_ROSE}
                                />
                                <View style={styles.scaleMetaRow}>
                                    <Text style={styles.scaleMetaText}>Low</Text>
                                    <Text style={styles.scaleMetaText}>5</Text>
                                    <Text style={styles.scaleMetaText}>High</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <ScreenLayout gradientBackground>
            <PageHeader
                onBack={() => navigation.goBack()}
                title="Log daily vitals"
                subtitle="Capture today’s signals so the dashboard, twin state, and weekly story stay in sync."
                gradientColors={[LOG_INDIGO, LOG_BLUE_DEEP]}
                compact
                containerStyle={styles.header}
            />

            <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={[styles.pageShell, isWide ? styles.pageShellWide : undefined]}>
                    <View style={styles.mainColumn}>
                        <LinearGradient
                            colors={["rgba(255,255,255,0.98)", "rgba(248,251,255,0.96)"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.heroCard}
                        >
                            <View style={styles.heroPillRow}>
                                <View style={styles.heroPill}>
                                    <Text style={styles.heroPillText}>Daily capture</Text>
                                </View>
                                <View style={styles.heroPillMuted}>
                                    <Calendar size={14} color={LOG_BLUE_DEEP} />
                                    <Text style={styles.heroPillMutedText}>{dateLabel}</Text>
                                </View>
                            </View>

                            <Text style={styles.heroTitle}>Build today’s health story</Text>
                            <Text style={styles.heroBody}>
                                Enter a clean daily check-in to refresh the avatar, live metrics, and weekly reporting flow with consistent data.
                            </Text>

                            <View style={styles.progressBlock}>
                                <View style={styles.progressTopRow}>
                                    <Text style={styles.progressLabel}>Completion</Text>
                                    <Text style={styles.progressValue}>{completionCount}/{sections.length} sections</Text>
                                </View>
                                <View style={styles.progressTrack}>
                                    <View style={[styles.progressFill, { width: `${Math.max(8, clamp01(progressRatio) * 100)}%` }]} />
                                </View>
                                <Text style={styles.progressNote}>
                                    {remainingSections === 0
                                        ? "Everything is ready to save."
                                        : `${remainingSections} section${remainingSections === 1 ? "" : "s"} left before the entry is complete.`}
                                </Text>
                            </View>
                        </LinearGradient>

                        <View style={styles.segmentRail}>
                            {sections.map((section, index) => {
                                const active = index === currentSection;
                                const completed = completionBySection[index];
                                const Icon = section.Icon;
                                const hoverKey = `section-${section.key}`;
                                return (
                                    <Pressable
                                        key={section.key}
                                        onPress={() => setCurrentSection(index)}
                                        onHoverIn={() => setHoveredKey(hoverKey)}
                                        onHoverOut={() => setHoveredKey(null)}
                                        style={({ pressed }) => [
                                            styles.segmentTab,
                                            active ? { backgroundColor: section.soft, borderColor: `${section.accent}55` } : undefined,
                                            hoveredKey === hoverKey && !active ? styles.cardHover : undefined,
                                            pressed ? styles.cardPressed : undefined,
                                            Platform.OS === "web" ? ({ cursor: "pointer" } as any) : undefined,
                                        ]}
                                    >
                                        <View style={[styles.segmentIconWrap, { backgroundColor: active ? section.accent : "#eef2ff" }]}> 
                                            <Icon size={16} color={active ? "#ffffff" : section.accent} />
                                        </View>
                                        <View style={styles.segmentCopy}>
                                            <Text style={[styles.segmentTitle, active ? { color: section.accent } : undefined]}>{section.title}</Text>
                                            <Text style={styles.segmentSubtitle}>{section.subtitle}</Text>
                                        </View>
                                        <View style={[styles.segmentStatusDot, completed ? styles.segmentStatusDone : undefined]} />
                                    </Pressable>
                                );
                            })}
                        </View>

                        <View style={styles.sectionCard}>
                            {renderSectionContent()}
                        </View>

                        <View style={[styles.footerRow, currentSection === 0 ? styles.footerRowSingle : undefined]}>
                            {currentSection > 0 ? (
                                <View style={styles.footerButton}>
                                    <AppButton
                                        label="Previous"
                                        onPress={() => setCurrentSection((prev) => Math.max(0, prev - 1))}
                                        variant="secondary"
                                        icon={<ArrowLeft size={16} color={LOG_INDIGO} />}
                                    />
                                </View>
                            ) : null}
                            <View style={styles.footerButtonPrimary}>
                                <AppButton
                                    label={currentSection === sections.length - 1 ? "Save daily log" : "Next section"}
                                    onPress={handleNext}
                                    loading={loading}
                                />
                            </View>
                        </View>
                    </View>

                    <View style={styles.sideColumn}>
                        <LinearGradient
                            colors={["rgba(255,255,255,0.98)", "rgba(255,249,239,0.96)"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.sideCard}
                        >
                            <Text style={styles.sideEyebrow}>Today’s sync preview</Text>
                            <Text style={styles.sideTitle}>What this log will update</Text>
                            <Text style={styles.sideBody}>
                                The values below feed the dashboard, avatar state, and weekly summary experience.
                            </Text>

                            <View style={styles.metricStack}>
                                <View style={styles.previewMetricCard}>
                                    <Text style={styles.previewMetricLabel}>Steps</Text>
                                    <Text style={styles.previewMetricValue}>{steps.trim().length > 0 ? `${parsedSteps.toLocaleString()}` : "—"}</Text>
                                    <Text style={styles.previewMetricCaption}>Movement baseline</Text>
                                </View>
                                <View style={styles.previewMetricCard}>
                                    <Text style={styles.previewMetricLabel}>Sleep</Text>
                                    <Text style={styles.previewMetricValue}>{touchedFields.sleepHours ? `${sleepHours.toFixed(1)}h` : "—"}</Text>
                                    <Text style={styles.previewMetricCaption}>Recovery input</Text>
                                </View>
                                <View style={styles.previewMetricCard}>
                                    <Text style={styles.previewMetricLabel}>Mood</Text>
                                    <Text style={styles.previewMetricValue}>{mood ? moodMeta[mood].title : "—"}</Text>
                                    <Text style={styles.previewMetricCaption}>Emotional state</Text>
                                </View>
                                <View style={styles.previewMetricCard}>
                                    <Text style={styles.previewMetricLabel}>Projected score</Text>
                                    <Text style={styles.previewMetricValue}>{Math.round(energyScore)}/100</Text>
                                    <Text style={styles.previewMetricCaption}>Derived from sleep and steps</Text>
                                </View>
                            </View>

                            <View style={styles.statusBand}>
                                <Text style={styles.statusBandTitle}>{hasFreshDailyLogInput ? "Ready to save" : "Still collecting"}</Text>
                                <Text style={styles.statusBandText}>
                                    {hasFreshDailyLogInput
                                        ? "All required fields are complete. Saving will write today’s entry to MongoDB Atlas."
                                        : "Fill each section once so the entry can be saved as a full daily log."}
                                </Text>
                            </View>
                        </LinearGradient>
                    </View>
                </View>
            </ScrollView>

            {loading ? (
                <View style={styles.loadingScrim}>
                    <View style={styles.loadingCard}>
                        <Text style={styles.loadingTitle}>Saving today’s entry</Text>
                        <Text style={styles.loadingText}>Syncing the dashboard and twin state.</Text>
                    </View>
                </View>
            ) : null}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    header: {
        paddingBottom: 18,
    },
    scroll: {
        paddingBottom: 88,
    },
    pageShell: {
        width: "100%",
        maxWidth: 1220,
        alignSelf: "center",
        paddingHorizontal: 20,
        paddingTop: 18,
        gap: 18,
    },
    pageShellWide: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    mainColumn: {
        flex: 1.15,
        gap: 18,
    },
    sideColumn: {
        width: "100%",
        maxWidth: 340,
    },
    heroCard: {
        borderRadius: 30,
        borderWidth: 1,
        borderColor: "#dde8ff",
        padding: 24,
        shadowColor: LOG_BLUE_DEEP,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 26,
        elevation: 7,
    },
    heroPillRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
    },
    heroPill: {
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: LOG_GOLD_SOFT,
        borderWidth: 1,
        borderColor: "#f1d18f",
    },
    heroPillText: {
        color: "#b77910",
        fontSize: 12,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.4,
    },
    heroPillMuted: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: "rgba(255,255,255,0.78)",
        borderWidth: 1,
        borderColor: "#dde8ff",
    },
    heroPillMutedText: {
        color: LOG_BLUE_DEEP,
        fontSize: 12,
        fontWeight: "700",
    },
    heroTitle: {
        ...appTheme.typography.h1,
        color: appTheme.colors.textPrimary,
        fontSize: 34,
        lineHeight: 38,
        marginBottom: 10,
    },
    heroBody: {
        color: appTheme.colors.textSecondary,
        fontSize: 18,
        lineHeight: 28,
        fontWeight: "600",
        maxWidth: 760,
    },
    progressBlock: {
        marginTop: 20,
        backgroundColor: "rgba(255,255,255,0.84)",
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: "#e4ebff",
    },
    progressTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
    },
    progressLabel: {
        color: appTheme.colors.textSecondary,
        fontSize: 13,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.3,
    },
    progressValue: {
        color: appTheme.colors.textPrimary,
        fontSize: 14,
        fontWeight: "800",
    },
    progressTrack: {
        marginTop: 12,
        height: 10,
        borderRadius: 999,
        backgroundColor: "#e4eaff",
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        borderRadius: 999,
        backgroundColor: LOG_BLUE,
    },
    progressNote: {
        marginTop: 12,
        color: appTheme.colors.textSecondary,
        fontSize: 13,
        lineHeight: 20,
        fontWeight: "600",
    },
    segmentRail: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    segmentTab: {
        flex: 1,
        minWidth: 220,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: LOG_BORDER,
        backgroundColor: LOG_SURFACE_SOFT,
        paddingHorizontal: 16,
        paddingVertical: 14,
        shadowColor: LOG_BLUE_DEEP,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 3,
    },
    segmentIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    segmentCopy: {
        flex: 1,
    },
    segmentTitle: {
        color: appTheme.colors.textPrimary,
        fontSize: 15,
        fontWeight: "800",
    },
    segmentSubtitle: {
        marginTop: 2,
        color: appTheme.colors.textMuted,
        fontSize: 12,
        fontWeight: "600",
    },
    segmentStatusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#d7dced",
    },
    segmentStatusDone: {
        backgroundColor: LOG_MINT,
    },
    sectionCard: {
        backgroundColor: LOG_SURFACE,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: LOG_BORDER,
        padding: 24,
        shadowColor: LOG_BLUE_DEEP,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.07,
        shadowRadius: 24,
        elevation: 6,
    },
    sectionStack: {
        gap: 18,
    },
    sectionHero: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.7)",
    },
    sectionIconShell: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: LOG_BLUE_DEEP,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 2,
    },
    sectionHeroCopy: {
        flex: 1,
    },
    sectionTitle: {
        color: appTheme.colors.textPrimary,
        fontSize: 22,
        fontWeight: "800",
    },
    sectionText: {
        marginTop: 6,
        color: appTheme.colors.textSecondary,
        fontSize: 14,
        lineHeight: 22,
        fontWeight: "600",
    },
    fieldGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 16,
    },
    inputCard: {
        flex: 1,
        minWidth: 260,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: LOG_BORDER,
        backgroundColor: "rgba(255,255,255,0.84)",
        padding: 20,
    },
    inputCardPrimary: {
        backgroundColor: "rgba(255,255,255,0.96)",
    },
    fieldEyebrow: {
        color: appTheme.colors.textMuted,
        fontSize: 11,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.45,
    },
    numericInput: {
        marginTop: 12,
        color: appTheme.colors.textPrimary,
        fontSize: 42,
        lineHeight: 48,
        fontWeight: "800",
        paddingVertical: 0,
    },
    fieldSupport: {
        marginTop: 12,
        color: appTheme.colors.textSecondary,
        fontSize: 13,
        lineHeight: 20,
        fontWeight: "600",
    },
    sliderCard: {
        flex: 1,
        minWidth: 260,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: LOG_BORDER,
        backgroundColor: "rgba(255,255,255,0.84)",
        padding: 20,
    },
    sliderCardLarge: {
        borderRadius: 24,
        borderWidth: 1,
        borderColor: LOG_BORDER,
        backgroundColor: "rgba(255,255,255,0.86)",
        padding: 20,
    },
    sliderHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        marginBottom: 16,
    },
    sliderTitle: {
        marginTop: 4,
        color: appTheme.colors.textPrimary,
        fontSize: 18,
        fontWeight: "800",
    },
    valueBadge: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.04)",
    },
    valueBadgeText: {
        fontSize: 13,
        fontWeight: "800",
    },
    scaleMetaRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 4,
    },
    scaleMetaText: {
        color: appTheme.colors.textMuted,
        fontSize: 12,
        fontWeight: "600",
    },
    insightBand: {
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "#d8e7ff",
        backgroundColor: "#f4f9ff",
        padding: 18,
    },
    insightBandLabel: {
        color: LOG_BLUE_DEEP,
        fontSize: 11,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.45,
    },
    insightBandText: {
        marginTop: 8,
        color: appTheme.colors.textSecondary,
        fontSize: 14,
        lineHeight: 22,
        fontWeight: "600",
    },
    moodGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    moodCard: {
        flex: 1,
        minWidth: 160,
        borderRadius: 22,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 18,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    moodEmoji: {
        fontSize: 24,
    },
    moodTitle: {
        color: appTheme.colors.textPrimary,
        fontSize: 16,
        fontWeight: "800",
    },
    moodNote: {
        color: appTheme.colors.textMuted,
        fontSize: 12,
        fontWeight: "600",
        textAlign: "center",
    },
    footerRow: {
        flexDirection: "row",
        gap: 14,
    },
    footerRowSingle: {
        justifyContent: "flex-end",
    },
    footerButton: {
        flex: 0.92,
    },
    footerButtonPrimary: {
        flex: 1.08,
    },
    sideCard: {
        borderRadius: 30,
        borderWidth: 1,
        borderColor: LOG_BORDER,
        padding: 22,
        shadowColor: LOG_BLUE_DEEP,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.07,
        shadowRadius: 24,
        elevation: 6,
        gap: 16,
    },
    sideEyebrow: {
        color: "#b77910",
        fontSize: 11,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.45,
    },
    sideTitle: {
        color: appTheme.colors.textPrimary,
        fontSize: 24,
        fontWeight: "800",
    },
    sideBody: {
        color: appTheme.colors.textSecondary,
        fontSize: 14,
        lineHeight: 22,
        fontWeight: "600",
    },
    metricStack: {
        gap: 12,
    },
    previewMetricCard: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: LOG_BORDER,
        backgroundColor: "rgba(255,255,255,0.82)",
        padding: 16,
    },
    previewMetricLabel: {
        color: appTheme.colors.textMuted,
        fontSize: 11,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.45,
    },
    previewMetricValue: {
        marginTop: 8,
        color: appTheme.colors.textPrimary,
        fontSize: 24,
        fontWeight: "800",
    },
    previewMetricCaption: {
        marginTop: 4,
        color: appTheme.colors.textSecondary,
        fontSize: 13,
        fontWeight: "600",
    },
    statusBand: {
        borderRadius: 22,
        backgroundColor: "rgba(255,255,255,0.88)",
        borderWidth: 1,
        borderColor: "#e8dcc4",
        padding: 18,
    },
    statusBandTitle: {
        color: appTheme.colors.textPrimary,
        fontSize: 18,
        fontWeight: "800",
    },
    statusBandText: {
        marginTop: 8,
        color: appTheme.colors.textSecondary,
        fontSize: 13,
        lineHeight: 20,
        fontWeight: "600",
    },
    loadingScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(20, 24, 46, 0.18)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    loadingCard: {
        minWidth: 260,
        maxWidth: 360,
        borderRadius: 24,
        padding: 22,
        backgroundColor: "rgba(255,255,255,0.96)",
        borderWidth: 1,
        borderColor: LOG_BORDER,
        shadowColor: LOG_BLUE_DEEP,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 22,
        elevation: 6,
    },
    loadingTitle: {
        color: appTheme.colors.textPrimary,
        fontSize: 18,
        fontWeight: "800",
    },
    loadingText: {
        marginTop: 8,
        color: appTheme.colors.textSecondary,
        fontSize: 14,
        lineHeight: 22,
        fontWeight: "600",
    },
    cardHover: {
        transform: [{ translateY: -1 }],
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
    },
    cardPressed: {
        opacity: 0.92,
        transform: [{ scale: 0.988 }],
    },
});
