import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert, Switch, Share, Platform, Image, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenLayout } from "../../components/ScreenLayout";
import { useToast } from "../../components/ui/Toast";
import { User, Bell, Download, Trash2, LogOut, ChevronRight, Shield, Database } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { deleteMyAccount, seedDemoWeek } from "../../lib/api/auth";
import { apiFetch } from "../../lib/api/client";
import type { AppScreenProps } from "../../lib/navigation/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { SectionCard } from "../../components/ui/SectionCard";
import { AppButton } from "../../components/ui/AppButton";

function SettingRow({ icon, iconBg, label, sub, onPress, isDestructive, rightEl }: {
    icon: React.ReactNode; iconBg: string; label: string; sub?: string;
    onPress?: () => void; isDestructive?: boolean; rightEl?: React.ReactNode;
}) {
    return (
        <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
            <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>{icon}</View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, isDestructive && { color: '#ef4444' }]}>{label}</Text>
                {sub && <Text style={styles.rowSub}>{sub}</Text>}
            </View>
            {rightEl || (!isDestructive && <ChevronRight size={18} color="#d1d5db" />)}
        </TouchableOpacity>
    );
}

export default function SettingsScreen({ navigation }: AppScreenProps<'Settings'>) {
    const { user, logout } = useAuth();
    const { showToast } = useToast();
    const [isSeeding, setIsSeeding] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(user?.profileImage ?? null);

    const initials = user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '?';
    const notificationsStorageKey = user?.id ? `healthtwin_notifications_enabled:${user.id}` : null;

    React.useEffect(() => {
        setProfileAvatarUrl(user?.profileImage ?? null);
    }, [user?.id, user?.profileImage]);

    React.useEffect(() => {
        let isMounted = true;
        apiFetch<{ hasAvatar: boolean; avatarUrl?: string }>('/api/avatar/status').then((res) => {
            if (!isMounted) return;
            setProfileAvatarUrl((res.success ? res.data?.avatarUrl ?? null : null) ?? user?.profileImage ?? null);
        });
        return () => { isMounted = false; };
    }, [user?.id, user?.profileImage]);

    React.useEffect(() => {
        if (!notificationsStorageKey) return;
        let cancelled = false;
        AsyncStorage.getItem(notificationsStorageKey).then((storedValue) => {
            if (cancelled || storedValue === null) return;
            setNotifications(storedValue === '1');
        }).catch((error) => {
            console.warn('Failed to load notification preference:', error);
        });
        return () => { cancelled = true; };
    }, [notificationsStorageKey]);

    const handleNotificationsToggle = async (nextValue: boolean) => {
        setNotifications(nextValue);
        if (notificationsStorageKey) {
            try {
                await AsyncStorage.setItem(notificationsStorageKey, nextValue ? '1' : '0');
            } catch (error) {
                console.warn('Failed to persist notification preference:', error);
            }
        }
        showToast(nextValue ? 'Notifications on' : 'Notifications off', nextValue ? 'success' : 'info');
    };

    const handleLogout = () => {
        if (Platform.OS === 'web') {
            // Bypass window.confirm on Chrome which flashes and disappears
            logout();
        } else {
            Alert.alert('Sign Out', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: () => logout() }
            ]);
        }
    };

    const handleSeedDemo = async () => {
        setIsSeeding(true);
        try {
            const ok = await seedDemoWeek();
            if (ok) showToast('🌱 7 days seeded! Check Weekly Summary & Achievements.', 'success');
            else showToast('❌ Seed failed — is the server running?', 'error');
        } catch { showToast('❌ Network error', 'error'); }
        finally { setIsSeeding(false); }
    };

    const handleExport = async () => {
        await Share.share({ message: JSON.stringify({ user: { name: user?.name, email: user?.email }, exportedAt: new Date().toISOString() }, null, 2), title: 'HealthTwin Export' });
    };

    const handleDeleteAccount = () => {
        Alert.alert("Delete Account", "Permanently delete your profile and all synced data?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    if (isDeletingAccount) return;
                    setIsDeletingAccount(true);
                    try {
                        const ok = await deleteMyAccount();
                        if (!ok) {
                            showToast('Failed to delete account', 'error');
                            return;
                        }
                        await logout();
                        showToast('Account deleted permanently', 'success');
                    } catch {
                        showToast('Failed to delete account', 'error');
                    } finally {
                        setIsDeletingAccount(false);
                    }
                }
            }
        ]);
    };

    return (
        <ScreenLayout gradientBackground>
            <PageHeader
                title="Settings"
                subtitle="Manage your preferences"
                onBack={() => navigation.goBack()}
            />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                {/* Profile Card */}
                <SectionCard style={styles.profileCard}>
                    <View style={styles.profileAvatar}>
                        {profileAvatarUrl
                            ? <Image source={{ uri: profileAvatarUrl }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                            : <Text style={styles.avatarInitials}>{initials}</Text>}
                    </View>
                    <View>
                        <Text style={styles.profileName}>{user?.name ?? '—'}</Text>
                        <Text style={styles.profileEmail}>{user?.email ?? '—'}</Text>
                        {user?.age && <Text style={styles.profileMeta}>{user.age}y · {user.heightCm}cm · {user.weightKg}kg</Text>}
                    </View>
                </SectionCard>

                <Text style={styles.sectionLabel}>ACCOUNT</Text>
                <SectionCard style={styles.section}>
                    <SettingRow icon={<User size={18} color="#7c3aed" />} iconBg="#f5f3ff" label="Account ID" sub={user?.id ? `${user.id.substring(0, 16)}...` : '—'} />
                    <View style={styles.divider} />
                    <SettingRow icon={<Shield size={18} color="#6366f1" />} iconBg="#eef2ff" label="Email" sub={user?.email ?? '—'} />
                </SectionCard>

                <Text style={styles.sectionLabel}>PREFERENCES</Text>
                <SectionCard style={styles.section}>
                    <SettingRow
                        icon={<Bell size={18} color="#f59e0b" />} iconBg="#fffbeb" label="Push Notifications"
                        rightEl={<Switch value={notifications} onValueChange={handleNotificationsToggle} trackColor={{ false: '#e5e7eb', true: '#7c3aed' }} thumbColor="#fff" />}
                    />
                </SectionCard>

                <Text style={styles.sectionLabel}>DATA & DEMO</Text>
                <SectionCard style={styles.section}>
                    <SettingRow icon={<User size={18} color="#0ea5e9" />} iconBg="#e0f2fe"
                        label="Digital Twin Setup" sub="Create your NanoBana avatar"
                        onPress={() => navigation.navigate("AvatarSetup")} />
                    <View style={styles.divider} />
                    <SettingRow icon={<Database size={18} color="#10b981" />} iconBg="#ecfdf5"
                        label={isSeeding ? "Seeding..." : "Seed 7 Days Demo"} sub="Populate with sample health data"
                        onPress={isSeeding ? undefined : handleSeedDemo} />
                    <View style={styles.divider} />
                    <SettingRow icon={<Download size={18} color="#3b82f6" />} iconBg="#eff6ff"
                        label="Export Data (JSON)" sub="Share your health records" onPress={handleExport} />
                    <View style={styles.divider} />
                    <SettingRow icon={<Database size={18} color="#8b5cf6" />} iconBg="#f5f3ff"
                        label="Database Info (Read-only)" sub="Storage overview for prototype" onPress={() => navigation.navigate("DatabaseViewer")} />
                </SectionCard>

                <Text style={styles.sectionLabel}>DANGER ZONE</Text>
                <SectionCard style={styles.section}>
                    <SettingRow icon={<Trash2 size={18} color="#ef4444" />} iconBg="#fef2f2"
                        label={isDeletingAccount ? "Deleting Account..." : "Delete Account"}
                        isDestructive
                        sub="This cannot be undone"
                        onPress={isDeletingAccount ? undefined : handleDeleteAccount}
                    />
                </SectionCard>

                {/* Sign Out */}
                <AppButton
                    label="Sign Out"
                    onPress={handleLogout}
                    variant="danger"
                    icon={<LogOut size={16} color="#e14b61" />}
                />

                <Text style={styles.footer}>HealthTwin AI v1.0.0 · MongoDB Atlas</Text>
            </ScrollView>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    scroll: { padding: 16, paddingTop: 8, paddingBottom: 60 },

    profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
    profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#e9d5ff' },
    avatarInitials: { color: '#fff', fontWeight: '800', fontSize: 22 },
    profileName: { fontSize: 17, fontWeight: '800', color: '#1e1b4b' },
    profileEmail: { fontSize: 13, color: '#7c3aed', marginTop: 2 },
    profileMeta: { fontSize: 11, color: '#9ca3af', marginTop: 4 },

    sectionLabel: { fontSize: 11, fontWeight: '700', color: '#7c3aed', marginLeft: 4, marginBottom: 8, marginTop: 8, letterSpacing: 0.8 },
    section: { marginBottom: 12, overflow: 'hidden', padding: 0 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
    rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { fontSize: 15, fontWeight: '600', color: '#1e1b4b' },
    rowSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
    divider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 70 },
    footer: { textAlign: 'center', color: '#9ca3af', fontSize: 11, marginTop: 24 },
});
