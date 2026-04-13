import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Image, StyleSheet, Platform } from "react-native";
import { ScreenLayout } from "../../components/ScreenLayout";
import { ArrowLeft, CheckCircle, UploadCloud, Camera } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from 'expo-image-picker';
import { apiFetch, getToken } from "../../lib/api/client";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import type { AppScreenProps } from "../../lib/navigation/types";
import type { ApiEnvelope } from "../../lib/api/contracts";

export default function AvatarSetupScreen({ navigation }: AppScreenProps<'AvatarSetup'>) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [statusHint, setStatusHint] = useState<string | null>(null);
    const [avatarMode, setAvatarMode] = useState<'prebuilt' | 'nanobana'>('prebuilt');
    const [requiredStates, setRequiredStates] = useState<string[]>(['happy', 'sad', 'sleepy']);

    // Check if user already has an avatar
    useEffect(() => {
        apiFetch<{
            hasAvatar: boolean;
            avatarUrl?: string;
            ready?: boolean;
            generatedStates?: string[];
            mode?: 'prebuilt' | 'nanobana';
            requiredStates?: string[];
        }>('/api/avatar/status').then((res) => {
            if (res.success && res.data?.hasAvatar) {
                setAvatarMode(res.data.mode || 'prebuilt');
                setRequiredStates(res.data.requiredStates || ['happy', 'sad', 'sleepy']);
                setPhotoUri(res.data.avatarUrl ?? null);
                setSuccess(!!res.data.ready);
                if (res.data.ready) {
                    setStatusHint(`Avatar is fully ready with loops: ${(res.data.requiredStates || ['happy', 'sad', 'sleepy']).join(', ')}.`);
                } else {
                    setStatusHint(`Avatar found. Generated states: ${(res.data.generatedStates || []).join(', ') || 'none'}`);
                }
            } else if (res.success && res.data) {
                setAvatarMode(res.data.mode || 'prebuilt');
                setRequiredStates(res.data.requiredStates || ['happy', 'sad', 'sleepy']);
            }
        });
    }, []);

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setPhotoUri(result.assets[0].uri);
            setSuccess(false);
        }
    };

    // Safe multipart fetch
    const uploadAvatar = async () => {
        setLoading(true);

        try {
            const token = await getToken();
            const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
            const usingProfileImageFallback = !photoUri;
            let res: Response;

            if (photoUri) {
                const formData = new FormData();

                // Expo Web workaround for FormData with ImagePicker
                if (photoUri.startsWith('data:') || photoUri.startsWith('blob:')) {
                    const response = await fetch(photoUri);
                    const blob = await response.blob();
                    formData.append('photo', blob, 'avatar.jpg');
                } else {
                    formData.append('photo', {
                        uri: photoUri,
                        name: 'avatar.jpg',
                        type: 'image/jpeg',
                    } as unknown as Blob);
                }

                res = await fetch(`${API_URL}/api/avatar/setup`, {
                    method: 'POST',
                    headers: {
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: formData,
                });
            } else {
                // No upload provided: backend will use the user's saved profileImage.
                res = await fetch(`${API_URL}/api/avatar/setup`, {
                    method: 'POST',
                    headers: {
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });
            }

            let data: ApiEnvelope<{
                message?: string;
                mode?: 'prebuilt' | 'nanobana';
                ready?: boolean;
                requiredStates?: string[];
            }> | null = null;
            try {
                data = (await res.json()) as ApiEnvelope<{
                    message?: string;
                    mode?: 'prebuilt' | 'nanobana';
                    ready?: boolean;
                    requiredStates?: string[];
                }>;
            } catch {
                throw new Error(`Avatar setup failed (${res.status})`);
            }
            if (!res.ok || !data || !data.success) {
                const errorMessage = data && !data.success ? data.error : `Avatar setup failed (${res.status})`;
                throw new Error(errorMessage);
            }
            const payload = data.data;

            const backendMessage = payload?.message || '';
            showToast(
                backendMessage || (
                    usingProfileImageFallback
                        ? 'Avatar setup completed.'
                        : 'Avatar setup completed.'
                ),
                'success'
            );
            setSuccess(true);
            const nextStates: string[] = payload?.requiredStates || requiredStates;
            setRequiredStates(nextStates);
            if (payload?.mode) {
                setAvatarMode(payload.mode);
            }
            setStatusHint(
                payload?.ready
                    ? `${nextStates.join(', ')} loops are ready.`
                    : backendMessage || 'Avatar setup completed.'
            );

        } catch (e: unknown) {
            showToast(e instanceof Error ? e.message : 'Error generating avatar', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenLayout gradientBackground>
            <View style={{ flex: 1 }}>
                <LinearGradient colors={["#3b82f6", "#2563eb"]} style={styles.headerGrad}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ArrowLeft color="white" size={18} />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Digital Twin Setup</Text>
                    <Text style={styles.headerSub}>
                        {avatarMode === 'prebuilt' ? 'Prebuilt Avatar Mode' : 'Powered by NanoBana AI'}
                    </Text>
                </LinearGradient>

                <View style={styles.content}>
                    <View style={styles.card}>
                        <Text style={styles.instructions}>
                            {avatarMode === 'prebuilt'
                                ? `Generation API is disabled. Uploading here only updates your profile photo. Avatar media should be seeded with pre-generated files (${requiredStates.join(', ')}).`
                                : `Upload a clear photo of your face. NanoBana will create a stylized avatar plus loop-ready emotional animations (${requiredStates.join(', ')}).`}
                        </Text>
                        {statusHint ? <Text style={styles.statusHint}>{statusHint}</Text> : null}
                        {!photoUri && user?.profileImage ? (
                            <Text style={styles.statusHint}>
                                No new upload selected. Tap Generate to use your current profile picture.
                            </Text>
                        ) : null}

                        <TouchableOpacity onPress={handlePickImage} style={{ width: 200, height: 200, borderRadius: 100, backgroundColor: '#eff6ff', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#bfdbfe', borderStyle: 'dashed', marginBottom: 24 }}>
                            {photoUri ? (
                                Platform.OS === 'web' ? (
                                    // @ts-ignore
                                    <img src={photoUri} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
                                ) : (
                                    <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} />
                                )
                            ) : (
                                <View style={styles.placeholder}>
                                    <Camera size={40} color="#93c5fd" />
                                    <Text style={styles.placeholderText}>Tap to select photo</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {!loading && !success && (photoUri || user?.profileImage) && (
                            <TouchableOpacity onPress={uploadAvatar} style={styles.btnPrimary}>
                                <UploadCloud size={20} color="white" />
                                <Text style={styles.btnText}>
                                    {avatarMode === 'prebuilt'
                                        ? (photoUri ? 'Upload Profile Picture' : 'Refresh Avatar Status')
                                        : (photoUri ? 'Generate Avatar' : 'Generate From Profile Picture')}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {loading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#3b82f6" />
                                <Text style={styles.loadingText}>
                                    {avatarMode === 'prebuilt' ? 'Checking prebuilt avatar media...' : 'Building your NanoBana avatar system...'}
                                </Text>
                                <Text style={styles.loadingSub}>
                                    {avatarMode === 'prebuilt'
                                        ? `Expected states: ${requiredStates.join(', ')}`
                                        : 'Generating high-quality loop animations'}
                                </Text>
                            </View>
                        )}

                        {success && (
                            <View style={styles.successContainer}>
                                <CheckCircle size={48} color="#10b981" />
                                <Text style={styles.successText}>Twin Activated!</Text>
                                <Text style={styles.successSub}>Your dashboard can now auto-switch between {requiredStates.join(', ')} loops.</Text>
                                <TouchableOpacity onPress={() => navigation.navigate('Main')} style={styles.successCtaBtn}>
                                    <Text style={styles.successCtaText}>Go to Dashboard</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
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
    content: { padding: 16, flex: 1, marginTop: 10 },
    card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
    instructions: { fontSize: 15, color: '#4b5563', lineHeight: 22, textAlign: 'center', marginBottom: 24 },
    statusHint: { fontSize: 12, color: '#1d4ed8', textAlign: 'center', marginBottom: 16, lineHeight: 18 },
    imagePicker: { width: 200, height: 200, borderRadius: 100, backgroundColor: '#eff6ff', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#bfdbfe', borderStyle: 'dashed', marginBottom: 24 },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { alignItems: 'center' },
    placeholderText: { color: '#60a5fa', fontWeight: '600', marginTop: 8 },
    btnPrimary: { flexDirection: 'row', backgroundColor: '#3b82f6', borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
    btnText: { color: 'white', fontWeight: '700', fontSize: 16 },
    loadingContainer: { alignItems: 'center', paddingVertical: 20 },
    loadingText: { marginTop: 16, fontSize: 16, fontWeight: '700', color: '#1e3a8a' },
    loadingSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
    successContainer: { alignItems: 'center', paddingVertical: 10 },
    successText: { marginTop: 12, fontSize: 20, fontWeight: '800', color: '#10b981' },
    successSub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 4 },
    successCtaBtn: { marginTop: 16, backgroundColor: '#2563eb', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 },
    successCtaText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
