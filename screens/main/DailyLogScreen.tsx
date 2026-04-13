import React, { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, Platform, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import { ScreenLayout } from "../../components/ScreenLayout";
import { Input } from "../../components/ui/Input";
import { Activity, Moon, Smile, ArrowLeft, Calendar, User } from "lucide-react-native";
import { useToast } from "../../components/ui/Toast";
import { saveDailyLog } from "../../lib/api/auth";
import { useAuth } from "../../contexts/AuthContext";
import type { AppScreenProps } from "../../lib/navigation/types";
import { getLocalDateYmd } from "../../lib/date/localDay";

type DailyLogScreenProps = AppScreenProps<'DailyLog'> | AppScreenProps<'DataEntry'>;

type TouchedFields = {
    activeMinutes: boolean;
    sleepHours: boolean;
    mood: boolean;
    energy: boolean;
    stress: boolean;
};

// Tabs
const sections = [
    { title: "Physical", icon: Activity, color: "bg-purple-500", theme: "purple" },
    { title: "Sleep", icon: Moon, color: "bg-indigo-500", theme: "indigo" },
    { title: "Mood", icon: Smile, color: "bg-teal-500", theme: "teal" }
];

const moodOptions = ["happy", "calm", "tired", "stressed"] as const;

export default function DailyLogScreen({ navigation }: DailyLogScreenProps) {
    const { showToast } = useToast();
    const { user } = useAuth(); // ✅ user from MongoDB via AuthContext
    const [currentSection, setCurrentSection] = useState(0);
    const [hoveredTab, setHoveredTab] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    // Form State
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
            setCurrentSection(currentSection + 1);
        } else {
            handleSave();
        }
    };

    const handleSave = async () => {
        if (!user) {
            showToast('Please log in first', 'error');
            return;
        }
        if (!hasFreshDailyLogInput || !mood) {
            goToFirstIncompleteSection();
            showToast('Enter today\'s values in each section before saving.', 'error');
            return;
        }
        setLoading(true);
        try {
            const today = getLocalDateYmd();

            // Save Health to MongoDB Atlas ☁️
            const energyScore = Math.min(100, Math.max(0,
                ((sleepHours / 8) * 0.6 + (parseInt(steps) / 10000) * 0.4) * 100
            ));
            const activeMinutesRounded = Math.round(activeMinutes);

            await saveDailyLog({
                date: today,
                steps: parseInt(steps) || 0,
                activeMinutes: activeMinutesRounded,
                sleepHours,
                energyScore,
                mood,
                energyLevel: energy,
                stressLevel: stress,
                healthNotes: `Active minutes: ${activeMinutesRounded}`,
                moodNotes: `Daily log entry • Active minutes: ${activeMinutesRounded}`,
            });

            showToast('✅ Saved to MongoDB Atlas!', 'success');
            if (navigation.canGoBack()) {
                navigation.goBack();
            } else {
                navigation.navigate('Main');
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to save entry', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Removed: handleLoadExample and handleReset (no more local DB)

    const renderSectionContent = () => {
        switch (currentSection) {
            case 0: // Physical
                return (
                    <View className="space-y-6">
                        <View className="flex-row items-center space-x-4 mb-4">
                            <View className="bg-purple-100 p-3 rounded-full">
                                <Activity size={24} className="text-purple-600" color="#9333ea" />
                            </View>
                            <View>
                                <Text className="text-lg font-bold text-slate-800">Physical Activity</Text>
                                <Text className="text-slate-500 text-sm">Track your movement and exercise</Text>
                            </View>
                        </View>

                        <View>
                            <Text className="text-sm font-medium text-slate-700 mb-2">Steps Taken</Text>
                            <Input
                                placeholder="e.g. 8500"
                                keyboardType="numeric"
                                value={steps}
                                onChangeText={setSteps}
                                className="bg-blue-50/50 border-blue-100 text-blue-600 text-lg font-bold text-center h-14"
                            />
                        </View>

                        <View>
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-sm font-medium text-slate-700">Active Minutes</Text>
                                <Text className="text-sm font-bold text-purple-600">
                                    {touchedFields.activeMinutes ? `${Math.round(activeMinutes)} min` : 'Not set'}
                                </Text>
                            </View>
                            <Slider
                                minimumValue={0}
                                maximumValue={120}
                                step={5}
                                value={activeMinutes}
                                onValueChange={(value) => {
                                    markTouched('activeMinutes');
                                    setActiveMinutes(value);
                                }}
                                minimumTrackTintColor="#8b5cf6"
                                maximumTrackTintColor="#e2e8f0"
                                thumbTintColor="#8b5cf6"
                            />
                            <View className="flex-row justify-between mt-1">
                                <Text className="text-xs text-slate-400">0</Text>
                                <Text className="text-xs text-slate-400">60</Text>
                                <Text className="text-xs text-slate-400">120 min</Text>
                            </View>
                        </View>
                    </View>
                );
            case 1: // Sleep
                return (
                    <View className="space-y-6">
                        <View className="flex-row items-center space-x-4 mb-4">
                            <View className="bg-indigo-100 p-3 rounded-full">
                                <Moon size={24} className="text-indigo-600" color="#4f46e5" />
                            </View>
                            <View>
                                <Text className="text-lg font-bold text-slate-800">Sleep & Rest</Text>
                                <Text className="text-slate-500 text-sm">How well did you sleep?</Text>
                            </View>
                        </View>

                        <View>
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-sm font-medium text-slate-700">Duration</Text>
                                <Text className="text-lg font-bold text-indigo-600">
                                    {touchedFields.sleepHours ? `${sleepHours.toFixed(1)} hrs` : 'Not set'}
                                </Text>
                            </View>
                            <Slider
                                minimumValue={0}
                                maximumValue={12}
                                step={0.5}
                                value={sleepHours}
                                onValueChange={(value) => {
                                    markTouched('sleepHours');
                                    setSleepHours(value);
                                }}
                                minimumTrackTintColor="#6366f1"
                                maximumTrackTintColor="#e2e8f0"
                                thumbTintColor="#6366f1"
                            />
                        </View>
                    </View>
                );
            case 2: // Mood
                return (
                    <View className="space-y-6">
                        <View className="flex-row items-center space-x-4 mb-4">
                            <View className="bg-teal-100 p-3 rounded-full">
                                <Smile size={24} className="text-teal-600" color="#0d9488" />
                            </View>
                            <View>
                                <Text className="text-lg font-bold text-slate-800">Mood & Energy</Text>
                                <Text className="text-slate-500 text-sm">Check in with yourself</Text>
                            </View>
                        </View>

                        <View>
                            <Text className="text-sm font-medium text-slate-700 mb-2">How do you feel?</Text>
                            <View className="flex-row justify-between gap-2">
                                {moodOptions.map((m) => (
                                    <Pressable
                                        key={m}
                                        onPress={() => {
                                            markTouched('mood');
                                            setMood(m);
                                        }}
                                        style={({ pressed }) => [
                                            hoveredTab === (1000 + moodOptions.indexOf(m)) && mood !== m ? styles.softHover : undefined,
                                            pressed ? styles.softPressed : undefined,
                                            Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined,
                                        ]}
                                        onHoverIn={() => setHoveredTab(1000 + moodOptions.indexOf(m))}
                                        onHoverOut={() => setHoveredTab(null)}
                                        className={`flex-1 p-3 rounded-xl border-2 items-center ${mood === m ? 'border-teal-500 bg-teal-50' : 'border-slate-100 bg-white'}`}
                                    >
                                        <Text className={`capitalize ${mood === m ? 'font-bold text-teal-700' : 'text-slate-500'}`}>{m}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <View className="mt-4">
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-sm font-medium text-slate-700">Energy Level</Text>
                                <Text className="text-sm font-bold text-teal-600">
                                    {touchedFields.energy ? `${Math.round(energy)}/10` : 'Not set'}
                                </Text>
                            </View>
                            <Slider
                                minimumValue={1}
                                maximumValue={10}
                                step={1}
                                value={energy}
                                onValueChange={(value) => {
                                    markTouched('energy');
                                    setEnergy(value);
                                }}
                                minimumTrackTintColor="#0d9488"
                                maximumTrackTintColor="#e2e8f0"
                                thumbTintColor="#0d9488"
                            />
                        </View>

                        <View className="mt-4">
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-sm font-medium text-slate-700">Stress Level</Text>
                                <Text className="text-sm font-bold text-red-500">
                                    {touchedFields.stress ? `${Math.round(stress)}/10` : 'Not set'}
                                </Text>
                            </View>
                            <Slider
                                minimumValue={1}
                                maximumValue={10}
                                step={1}
                                value={stress}
                                onValueChange={(value) => {
                                    markTouched('stress');
                                    setStress(value);
                                }}
                                minimumTrackTintColor="#ef4444"
                                maximumTrackTintColor="#e2e8f0"
                                thumbTintColor="#ef4444"
                            />
                        </View>
                    </View>
                );
        }
    };

    return (
        <ScreenLayout gradientBackground>
            <View className="flex-1">
                {/* Header Section */}
                <View className="px-6 pt-4 pb-8">
                    <Pressable
                        onPress={() => navigation.goBack()}
                        style={({ pressed }) => [
                            styles.hoverLift,
                            pressed ? styles.softPressed : undefined,
                            Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined,
                        ]}
                        className="self-start mb-4 flex-row items-center space-x-2 rounded-full border border-white/35 bg-white/20 px-4 py-2"
                    >
                        <ArrowLeft size={16} color="white" />
                        <Text className="text-white font-semibold">Back</Text>
                    </Pressable>
                    <Text className="text-white text-3xl font-bold mb-1">Daily Demo Log</Text>
                    <Text className="text-white/80 text-base mb-4">Enter simulated values for today.</Text>

                    <View className="bg-white/20 self-start px-3 py-1 rounded-full flex-row items-center space-x-2">
                        <Calendar size={14} color="white" />
                        <Text className="text-white font-medium text-sm">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </Text>
                    </View>
                </View>

                {/* Main Content Card */}
                <View className="flex-1 bg-slate-50 rounded-t-[40px] px-6 pt-8 pb-6 shadow-2xl">

                    {/* Section Info */}
                    <View className="bg-purple-50 p-4 rounded-2xl border border-purple-100 flex-row items-center space-x-4 mb-6">
                        <View className="w-12 h-12 bg-purple-100 rounded-full items-center justify-center">
                            <User size={24} color="#a855f7" />
                        </View>
                        <View>
                            <Text className="text-slate-900 font-bold text-base">Daily Health Log</Text>
                            <Text className="text-slate-500 text-sm">Saved to MongoDB Atlas ☁️</Text>
                        </View>
                    </View>

                    {/* Tabs / Section Indicators */}
                    <View className="flex-row justify-between mb-6 bg-white p-1 rounded-xl border border-slate-100">
                        {sections.map((section, index) => {
                            const isActive = index === currentSection;
                            const Icon = section.icon;
                            return (
                                <Pressable
                                    key={index}
                                    onPress={() => setCurrentSection(index)}
                                    onHoverIn={() => setHoveredTab(index)}
                                    onHoverOut={() => setHoveredTab(null)}
                                    style={({ pressed }) => [
                                        hoveredTab === index && !isActive ? styles.tabHover : undefined,
                                        pressed ? styles.tabPressed : undefined,
                                        Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined,
                                    ]}
                                    className={`flex-1 flex-row items-center justify-center py-2 rounded-lg space-x-2 ${isActive ? 'bg-purple-600 shadow-md' : ''}`}
                                >
                                    <Icon size={16} color={isActive ? 'white' : '#94a3b8'} />
                                    <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                                        {section.title}
                                    </Text>
                                </Pressable>
                            )
                        })}
                    </View>

                    {/* Form Content */}
                    <View className="flex-1 bg-blue-50/50 border border-blue-100 rounded-3xl p-6 mb-4">
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {renderSectionContent()}
                        </ScrollView>
                    </View>

                    {/* Footer Navigation */}
                    <View className="flex-row space-x-4 mt-auto">
                        {currentSection > 0 && (
                            <Pressable
                                onPress={() => setCurrentSection(currentSection - 1)}
                                style={({ pressed }) => [
                                    styles.hoverLift,
                                    pressed ? styles.softPressed : undefined,
                                    Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined,
                                ]}
                                className="flex-1 bg-white border border-purple-100 py-4 rounded-full items-center justify-center"
                            >
                                <Text className="text-purple-400 font-bold">Previous</Text>
                            </Pressable>
                        )}
                        <Pressable
                            onPress={handleNext}
                            style={({ pressed }) => [
                                styles.hoverLiftStrong,
                                pressed ? styles.primaryPressed : undefined,
                                Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined,
                            ]}
                            className="flex-1 bg-purple-600 py-4 rounded-full items-center justify-center shadow-lg shadow-purple-200"
                        >
                            <Text className="text-white font-bold text-lg">
                                {currentSection === sections.length - 1 ? "Save & Continue" : "Next Section"}
                            </Text>
                        </Pressable>
                    </View>

                </View>

                {loading && (
                    <View className="absolute inset-0 bg-black/50 items-center justify-center rounded-t-[40px]">
                        <ActivityIndicator size="large" color="white" />
                    </View>
                )}
            </View>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    hoverLift: {
        transform: [{ translateY: -1 }],
        opacity: 0.98,
    },
    hoverLiftStrong: {
        transform: [{ translateY: -2 }],
        shadowOpacity: 0.26,
    },
    softHover: {
        transform: [{ translateY: -1 }],
        borderRadius: 12,
    },
    softPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.985 }],
    },
    primaryPressed: {
        opacity: 0.92,
        transform: [{ scale: 0.988 }],
    },
    tabHover: {
        backgroundColor: '#f5f3ff',
    },
    tabPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.985 }],
    },
});
