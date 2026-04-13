import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import { ScreenLayout } from "../../components/ScreenLayout";
import { Activity, Moon, Smile, ArrowLeft, Save, Calendar } from "lucide-react-native";
import { logHealth, logMood } from "../../lib/api/auth";
import { useToast } from "../../components/ui/Toast";
import { LinearGradient } from "expo-linear-gradient";
import type { AppScreenProps } from "../../lib/navigation/types";
import type { MoodType } from "../../lib/api/contracts";
import { getLocalDateYmd } from "../../lib/date/localDay";

const SECTIONS = [
    { title: "Physical Activity", icon: Activity, gradientColors: ["#7c3aed", "#6d28d9"] as [string, string], emoji: "🏃" },
    { title: "Sleep & Recovery", icon: Moon, gradientColors: ["#6366f1", "#4f46e5"] as [string, string], emoji: "😴" },
    { title: "Mood & Wellness", icon: Smile, gradientColors: ["#f59e0b", "#d97706"] as [string, string], emoji: "😊" },
];

const MOODS: Array<{ val: MoodType; emoji: string; label: string; color: string }> = [
    { val: 'happy', emoji: '😄', label: 'Happy', color: '#10b981' },
    { val: 'calm', emoji: '😌', label: 'Calm', color: '#6366f1' },
    { val: 'tired', emoji: '😴', label: 'Tired', color: '#94a3b8' },
    { val: 'anxious', emoji: '😰', label: 'Anxious', color: '#f59e0b' },
    { val: 'sad', emoji: '😢', label: 'Sad', color: '#ef4444' },
    { val: 'excited', emoji: '🤩', label: 'Excited', color: '#a855f7' },
];

export default function DataEntryScreen({ navigation }: AppScreenProps<'DataEntry'>) {
    const { showToast } = useToast();
    const [currentSection, setCurrentSection] = useState(0);
    const [saving, setSaving] = useState(false);

    const [steps, setSteps] = useState("");
    const [activeMinutes, setActiveMinutes] = useState(30);
    const [sleepHours, setSleepHours] = useState(7);
    const [sleepQuality, setSleepQuality] = useState("");
    const [mood, setMood] = useState<MoodType | ''>('');
    const [energy, setEnergy] = useState(5);
    const [stress, setStress] = useState(3);

    const handleNext = async () => {
        if (currentSection < SECTIONS.length - 1) {
            setCurrentSection(currentSection + 1);
        } else {
            setSaving(true);
            try {
                const today = getLocalDateYmd();
                const result = await logHealth({ date: today, steps: parseInt(steps) || 0, sleepHours, energyScore: energy * 10 });
                if (mood) {
                    await logMood({ date: today, mood, energyLevel: energy, stressLevel: stress });
                }
                if (result) {
                    showToast('✅ Vitals saved!', 'success');
                    setTimeout(() => navigation.goBack(), 800);
                } else {
                    showToast('❌ Save failed', 'error');
                }
            } catch (e) {
                showToast('❌ Error saving data', 'error');
            } finally {
                setSaving(false);
            }
        }
    };

    const section = SECTIONS[currentSection];
    const SectionIcon = section.icon;

    const renderContent = () => {
        switch (currentSection) {
            case 0:
                return (
                    <View style={styles.formGroup}>
                        <Text style={styles.fieldLabel}>Steps Taken</Text>
                        <TextInput
                            style={styles.input} placeholder="e.g. 8500"
                            placeholderTextColor="#a78bfa" keyboardType="numeric"
                            value={steps} onChangeText={setSteps}
                        />
                        <View style={styles.sliderRow}>
                            <Text style={styles.fieldLabel}>Active Minutes</Text>
                            <View style={[styles.badge, { backgroundColor: '#f5f3ff' }]}>
                                <Text style={styles.badgeText}>{Math.round(activeMinutes)} min</Text>
                            </View>
                        </View>
                        <Slider minimumValue={0} maximumValue={120} step={5} value={activeMinutes}
                            onValueChange={setActiveMinutes} minimumTrackTintColor="#7c3aed"
                            maximumTrackTintColor="#e9d5ff" thumbTintColor="#7c3aed" />
                    </View>
                );
            case 1:
                return (
                    <View style={styles.formGroup}>
                        <View style={styles.sliderRow}>
                            <Text style={styles.fieldLabel}>Sleep Duration</Text>
                            <View style={[styles.badge, { backgroundColor: '#eef2ff' }]}>
                                <Text style={[styles.badgeText, { color: '#6366f1' }]}>{sleepHours.toFixed(1)} hrs</Text>
                            </View>
                        </View>
                        <Slider minimumValue={0} maximumValue={12} step={0.5} value={sleepHours}
                            onValueChange={setSleepHours} minimumTrackTintColor="#6366f1"
                            maximumTrackTintColor="#e0e7ff" thumbTintColor="#6366f1" />
                        <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Sleep Quality</Text>
                        <View style={styles.chipRow}>
                            {["Excellent", "Good", "Fair", "Poor"].map((q) => (
                                <TouchableOpacity
                                    key={q} onPress={() => setSleepQuality(q)}
                                    style={[styles.chip, sleepQuality === q && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, sleepQuality === q && styles.chipTextActive]}>{q}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            case 2:
                return (
                    <View style={styles.formGroup}>
                        <Text style={styles.fieldLabel}>How are you feeling?</Text>
                        <View style={styles.moodGrid}>
                            {MOODS.map((m) => (
                                <TouchableOpacity
                                    key={m.val} onPress={() => setMood(m.val)}
                                    style={[styles.moodBtn, mood === m.val && { borderColor: m.color, backgroundColor: m.color + '15' }]}
                                >
                                    <Text style={styles.moodEmoji}>{m.emoji}</Text>
                                    <Text style={[styles.moodLabel, mood === m.val && { color: m.color, fontWeight: '700' }]}>{m.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.sliderRow}>
                            <Text style={styles.fieldLabel}>Energy Level</Text>
                            <View style={[styles.badge, { backgroundColor: '#fffbeb' }]}>
                                <Text style={[styles.badgeText, { color: '#d97706' }]}>{Math.round(energy)}/10</Text>
                            </View>
                        </View>
                        <Slider minimumValue={1} maximumValue={10} step={1} value={energy}
                            onValueChange={setEnergy} minimumTrackTintColor="#f59e0b"
                            maximumTrackTintColor="#fef3c7" thumbTintColor="#f59e0b" />
                        <View style={styles.sliderRow}>
                            <Text style={styles.fieldLabel}>Stress Level</Text>
                            <View style={[styles.badge, { backgroundColor: '#fef2f2' }]}>
                                <Text style={[styles.badgeText, { color: '#ef4444' }]}>{Math.round(stress)}/10</Text>
                            </View>
                        </View>
                        <Slider minimumValue={1} maximumValue={10} step={1} value={stress}
                            onValueChange={setStress} minimumTrackTintColor="#ef4444"
                            maximumTrackTintColor="#fee2e2" thumbTintColor="#ef4444" />
                    </View>
                );
        }
    };

    return (
        <ScreenLayout gradientBackground>
            <View style={{ flex: 1 }}>
                {/* Gradient Header */}
                <LinearGradient colors={section.gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGrad}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ArrowLeft color="white" size={20} />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Daily Log</Text>
                    <View style={styles.headerDateRow}>
                        <Calendar size={13} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.headerDate}>{new Date().toDateString()}</Text>
                    </View>
                    {/* Progress pills */}
                    <View style={styles.progressRow}>
                        {SECTIONS.map((_, i) => (
                            <View key={i} style={[styles.progressPill, i <= currentSection ? styles.progressActive : styles.progressInactive]} />
                        ))}
                    </View>
                </LinearGradient>

                {/* White Card */}
                <View style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionIconWrap}>
                            <SectionIcon color="white" size={22} />
                        </View>
                        <View>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                            <Text style={styles.sectionStep}>Step {currentSection + 1} of {SECTIONS.length}</Text>
                        </View>
                    </View>

                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
                        {renderContent()}
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity onPress={handleNext} disabled={saving} activeOpacity={0.85}>
                            <LinearGradient colors={section.gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextBtn}>
                                {saving
                                    ? <ActivityIndicator color="#fff" />
                                    : <>
                                        {currentSection === SECTIONS.length - 1 && <Save color="white" size={18} />}
                                        <Text style={styles.nextBtnText}>{currentSection === SECTIONS.length - 1 ? 'Save Entry' : 'Next Section'}</Text>
                                    </>
                                }
                            </LinearGradient>
                        </TouchableOpacity>
                        {currentSection > 0 && (
                            <TouchableOpacity onPress={() => setCurrentSection(currentSection - 1)} style={styles.prevBtn}>
                                <Text style={styles.prevBtnText}>Previous Step</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    headerGrad: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 16 },
    backText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 },
    headerDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 16 },
    headerDate: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
    progressRow: { flexDirection: 'row', gap: 8 },
    progressPill: { flex: 1, height: 4, borderRadius: 4 },
    progressActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
    progressInactive: { backgroundColor: 'rgba(255,255,255,0.25)' },

    card: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -16, paddingHorizontal: 22, paddingTop: 28 },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
    sectionIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { fontSize: 20, fontWeight: '800', color: '#1e1b4b' },
    sectionStep: { fontSize: 13, color: '#9ca3af', marginTop: 2 },

    formGroup: { gap: 4 },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 4 },
    input: { backgroundColor: '#f5f3ff', borderRadius: 14, borderWidth: 1.5, borderColor: '#e9d5ff', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#1e1b4b', marginBottom: 16 },
    sliderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
    badgeText: { fontWeight: '700', fontSize: 13, color: '#7c3aed' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 8 },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e9d5ff', backgroundColor: '#fff' },
    chipActive: { backgroundColor: '#f5f3ff', borderColor: '#7c3aed' },
    chipText: { color: '#6b7280', fontWeight: '500', fontSize: 13 },
    chipTextActive: { color: '#7c3aed', fontWeight: '700' },
    moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    moodBtn: { flex: 1, minWidth: '28%', alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#e9d5ff', backgroundColor: '#fafafa', gap: 4 },
    moodEmoji: { fontSize: 22 },
    moodLabel: { fontSize: 11, color: '#6b7280', fontWeight: '500' },

    footer: { paddingTop: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
    nextBtn: { borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
    nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    prevBtn: { alignItems: 'center', paddingVertical: 12 },
    prevBtnText: { color: '#9ca3af', fontWeight: '600', fontSize: 14 },
});
