import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ScreenLayout } from '../../components/ScreenLayout';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { GamificationService } from '../../lib/gamification';
import { useAuth } from '../../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import type { AppScreenProps } from '../../lib/navigation/types';
import { EmptyState } from '../../components/ui/EmptyState';

interface BadgeProgress {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    isUnlocked: boolean;
}

export default function AchievementsScreen({ navigation }: AppScreenProps<'Achievements'>) {
    const { user } = useAuth();
    const [badges, setBadges] = useState<BadgeProgress[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadBadges(); }, [user]);

    const loadBadges = async () => {
        setLoading(true);
        try {
            const userId = user?.id ?? 'demo-user';
            await GamificationService.checkAchievements(userId);
            const data = await GamificationService.getBadgeProgress(userId);
            setBadges(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const unlockedCount = badges.filter(b => b.isUnlocked).length;
    const totalCount = badges.length;

    return (
        <ScreenLayout gradientBackground>
            <View style={{ flex: 1 }}>
                <LinearGradient colors={["#f59e0b", "#d97706"]} style={styles.headerGrad}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ArrowLeft color="white" size={18} />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Achievements</Text>
                    <Text style={styles.headerSub}>Your health milestones</Text>
                </LinearGradient>

                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    {loading ? (
                        <View style={styles.stateCard}>
                            <ActivityIndicator size="large" color="#d97706" />
                            <Text style={styles.stateTitle}>Loading achievements...</Text>
                            <Text style={styles.stateSub}>Checking your latest progress</Text>
                        </View>
                    ) : badges.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <EmptyState
                                icon="🏅"
                                title="No achievements yet"
                                description="Log daily vitals and complete weekly activities to unlock your first badge."
                            />
                        </View>
                    ) : (
                        <>
                            {/* Stats Summary */}
                            <View style={styles.statsCard}>
                                <View style={styles.statCol}>
                                    <Text style={styles.statValue}>{unlockedCount}</Text>
                                    <Text style={styles.statLabel}>Unlocked</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statCol}>
                                    <Text style={styles.statValue}>{totalCount}</Text>
                                    <Text style={styles.statLabel}>Total Available</Text>
                                </View>
                            </View>

                            {/* Badges Grid */}
                            <View style={styles.grid}>
                                {badges.map((badge) => (
                                    <View key={badge.id} style={styles.gridItem}>
                                        <View style={[styles.badgeCard, !badge.isUnlocked && styles.badgeLocked]}>
                                            <View style={[styles.iconWrap, badge.isUnlocked ? { backgroundColor: '#fffbeb' } : { backgroundColor: '#f1f5f9' }]}>
                                                {badge.isUnlocked ? (
                                                    <Text style={styles.badgeEmoji}>{badge.icon}</Text>
                                                ) : (
                                                    <Lock size={20} color="#94a3b8" />
                                                )}
                                            </View>
                                            <Text style={[styles.badgeName, !badge.isUnlocked && { color: '#64748b' }]}>
                                                {badge.name}
                                            </Text>
                                            <Text style={styles.badgeDesc} numberOfLines={2}>
                                                {badge.description}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
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
    backText: { color: '#fff', fontWeight: '700' },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
    scroll: { padding: 16, paddingBottom: 40 },
    stateCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#f59e0b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
    },
    stateTitle: { fontSize: 16, fontWeight: '700', color: '#1e1b4b', marginTop: 12 },
    stateSub: { fontSize: 13, color: '#6b7280', marginTop: 6 },
    emptyCard: { marginTop: 8 },
    statsCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
    statCol: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 32, fontWeight: '800', color: '#d97706' },
    statLabel: { fontSize: 13, color: '#9ca3af', marginTop: 4, fontWeight: '600' },
    statDivider: { width: 1, backgroundColor: '#f3f4f6' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    gridItem: { width: '48%', marginBottom: 16 },
    badgeCard: { height: 150, backgroundColor: '#fff', borderRadius: 20, padding: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: '#fef3c7' },
    badgeLocked: { backgroundColor: '#f8fafc', shadowOpacity: 0, elevation: 0, borderColor: '#f1f5f9' },
    iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    badgeEmoji: { fontSize: 28 },
    badgeName: { fontSize: 14, fontWeight: '700', color: '#1e1b4b', textAlign: 'center', marginBottom: 4 },
    badgeDesc: { fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 16 },
});
