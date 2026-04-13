import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, Platform } from "react-native";
import { ScreenLayout } from "../../components/ScreenLayout";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Heart, ArrowLeft, Check, Camera, Upload } from "lucide-react-native";
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from "../../contexts/AuthContext";
import { getToken } from "../../lib/api/client";
import type { AppScreenProps } from "../../lib/navigation/types";

export default function SignUpScreen({ navigation }: AppScreenProps<'SignUp'>) {
    const { register } = useAuth();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        age: "",
        height: "",
        weight: "",
        profileImage: null as string | null,
        profileImageMime: null as string | null,
    });

    const handleNext = () => {
        setErrorMsg(null);
        if (step === 1) {
            if (!formData.firstName || !formData.email || !formData.password) {
                setErrorMsg("Please fill in all required fields.");
                return;
            }
            if (formData.password.length < 8) {
                setErrorMsg("Password must be at least 8 characters long.");
                return;
            }
            if (formData.password !== formData.confirmPassword) {
                setErrorMsg("Passwords do not match.");
                return;
            }
        }

        if (step === 3 && !formData.profileImage) {
            setErrorMsg("Please upload a selfie to continue.");
            return;
        }

        if (step < 3) setStep(step + 1);
        else handleSignup();
    };


    const handleBack = () => {
        if (step > 1) setStep(step - 1);
        else navigation.goBack();
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.65,
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            setFormData({ ...formData, profileImage: asset.uri, profileImageMime: asset.mimeType ?? 'image/jpeg' });
        }
    };

    const uploadProfileImage = async (photoUri: string, mimeType?: string | null) => {
        const token = await getToken();
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";
        const formData = new FormData();

        if (photoUri.startsWith("data:") || photoUri.startsWith("blob:")) {
            const response = await fetch(photoUri);
            const blob = await response.blob();
            formData.append("photo", blob, "profile.jpg");
        } else {
            formData.append("photo", {
                uri: photoUri,
                name: "profile.jpg",
                type: mimeType || "image/jpeg",
            } as unknown as Blob);
        }

        const response = await fetch(`${apiUrl}/api/avatar/setup`, {
            method: "POST",
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
        });

        let payload: { success?: boolean; error?: string } | null = null;
        try {
            payload = (await response.json()) as { success?: boolean; error?: string };
        } catch {
            // keep null payload; status fallback below
        }

        if (!response.ok || payload?.success === false) {
            throw new Error(payload?.error || `Photo upload failed (${response.status})`);
        }
    };

    const handleSignup = async () => {
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const fullName = `${formData.firstName} ${formData.lastName}`.trim();

            // Build optional profile fields
            const profile = {
                age: formData.age ? parseInt(formData.age) : undefined,
                heightCm: formData.height ? parseFloat(formData.height) : undefined,
                weightKg: formData.weight ? parseFloat(formData.weight) : undefined,
            };

            // Call AuthContext → backend → MongoDB (saves ALL fields)
            const user = await register(fullName, formData.email, formData.password, profile);

            if (!user) {
                setErrorMsg("Failed to create account. Email might already be in use.");
                return;
            }

            if (formData.profileImage) {
                try {
                    await uploadProfileImage(formData.profileImage, formData.profileImageMime);
                } catch (uploadError: unknown) {
                    const message = uploadError instanceof Error ? uploadError.message : "Could not upload profile picture";
                    console.warn("[SignUp] Profile image upload failed:", message);
                    Alert.alert(
                        "Profile created",
                        "Your account was created, but profile photo upload failed. You can upload it later in Settings."
                    );
                }
            }

            console.log(`✅ Registered in MongoDB: ${user.id} with full profile`);
            // Auth gate in App.tsx auto-navigates to Main
        } catch (error) {
            console.error(error);
            setErrorMsg("Something went wrong. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };


    // Helper to render the circular steps
    const renderStep = (num: number) => {
        const isActive = step === num;
        const isCompleted = step > num;

        return (
            <View className="items-center justify-center">
                <View
                    className={`h-8 w-8 rounded-full items-center justify-center border ${isActive ? "border-brand-primary bg-purple-50" :
                        isCompleted ? "bg-brand-primary border-brand-primary" : "border-slate-300 bg-white"
                        }`}
                >
                    {isCompleted ? (
                        <Check size={16} color="white" />
                    ) : (
                        <Text className={`font-medium ${isActive ? "text-brand-primary" : "text-slate-400"}`}>
                            {num}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <ScreenLayout gradientBackground>
            <View className="flex-1 px-6 pt-12">

            {/* Header Area */}
            <View className="items-center mb-6">
                <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/10 mb-4">
                    <Heart size={32} color="#8b5cf6" fill="#8b5cf6" />
                </View>
                <Text className="text-xl font-bold text-brand-primary mb-1">HealthTwin AI</Text>
                <Text className="text-sm text-brand-secondary mb-6">Your Digital Health Companion</Text>

                <Text className="text-3xl font-bold text-slate-900 text-center">Create a Profile</Text>
                <Text className="text-slate-500 text-center mt-2 px-8">
                    Create a demo profile to store your avatar and health data.
                </Text>
            </View>

            {/* Stepper */}
            <View className="flex-row items-center justify-center mb-8 px-4">
                {renderStep(1)}
                <View className={`flex-1 h-px mx-2 ${step > 1 ? "bg-brand-primary" : "bg-slate-200"}`} />
                {renderStep(2)}
                <View className={`flex-1 h-px mx-2 ${step > 2 ? "bg-brand-primary" : "bg-slate-200"}`} />
                {renderStep(3)}
            </View>

            {/* Form Content */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
                {errorMsg ? (
                    <View className="bg-red-100 p-3 rounded-xl mb-4 border border-red-300 mx-4">
                        <Text className="text-red-700 text-center font-medium">{errorMsg}</Text>
                    </View>
                ) : null}

                {step === 1 && (
                    <View className="space-y-4">
                        <View className="flex-row space-x-4">
                            <Input
                                containerClassName="flex-1"
                                placeholder="First Name"
                                value={formData.firstName}
                                onChangeText={(t) => setFormData({ ...formData, firstName: t })}
                                className="bg-purple-50/50 border-purple-100/80 rounded-2xl h-14"
                                placeholderTextColor="#94a3b8"
                            />
                            <Input
                                containerClassName="flex-1"
                                placeholder="Last Name"
                                value={formData.lastName}
                                onChangeText={(t) => setFormData({ ...formData, lastName: t })}
                                className="bg-purple-50/50 border-purple-100/80 rounded-2xl h-14"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>

                        <Input
                            placeholder="Email Address"
                            value={formData.email}
                            onChangeText={(t) => setFormData({ ...formData, email: t })}
                            keyboardType="email-address"
                            className="bg-purple-50/50 border-purple-100/80 rounded-2xl h-14"
                            placeholderTextColor="#94a3b8"
                        />

                        <Input
                            placeholder="Password"
                            value={formData.password}
                            onChangeText={(t) => setFormData({ ...formData, password: t })}
                            secureTextEntry
                            className="bg-purple-50/50 border-purple-100/80 rounded-2xl h-14"
                            placeholderTextColor="#94a3b8"
                        />

                        <Input
                            placeholder="Confirm Password"
                            value={formData.confirmPassword}
                            onChangeText={(t) => setFormData({ ...formData, confirmPassword: t })}
                            secureTextEntry
                            className="bg-purple-50/50 border-purple-100/80 rounded-2xl h-14"
                            placeholderTextColor="#94a3b8"
                        />
                    </View>
                )}

                {step === 2 && (
                    <View className="space-y-4">
                        <Text className="text-center text-slate-600 mb-2">Tell us about yourself for the simulation</Text>
                        <Input
                            placeholder="Age"
                            value={formData.age}
                            onChangeText={(t) => setFormData({ ...formData, age: t })}
                            keyboardType="numeric"
                            className="bg-purple-50/50 border-purple-100/80 rounded-2xl h-14"
                            placeholderTextColor="#94a3b8"
                        />
                        <View className="flex-row space-x-4">
                            <Input
                                containerClassName="flex-1"
                                placeholder="Height (cm)"
                                value={formData.height}
                                onChangeText={(t) => setFormData({ ...formData, height: t })}
                                keyboardType="numeric"
                                className="bg-purple-50/50 border-purple-100/80 rounded-2xl h-14"
                                placeholderTextColor="#94a3b8"
                            />
                            <Input
                                containerClassName="flex-1"
                                placeholder="Weight (kg)"
                                value={formData.weight}
                                onChangeText={(t) => setFormData({ ...formData, weight: t })}
                                keyboardType="numeric"
                                className="bg-purple-50/50 border-purple-100/80 rounded-2xl h-14"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>
                    </View>
                )}

                {step === 3 && (
                    <View className="space-y-6 items-center py-4">
                        <Text className="text-xl font-bold text-slate-800">Profile Picture</Text>
                        <Text className="text-center text-slate-500 px-4">
                            Upload a real selfie. This is required to generate your NanoBana avatar and emotion videos.
                        </Text>

                        <TouchableOpacity
                            onPress={pickImage}
                            className="h-40 w-40 rounded-full bg-purple-50 border-2 border-dashed border-purple-200 items-center justify-center overflow-hidden"
                        >
                            {formData.profileImage ? (
                                <Image
                                    source={{ uri: formData.profileImage }}
                                    className="h-full w-full"
                                    resizeMode="cover"
                                />
                            ) : (
                                <View className="items-center space-y-2">
                                    <Camera size={32} color="#a855f7" />
                                    <Text className="text-xs text-brand-primary font-medium">Tap to Upload</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {formData.profileImage && (
                            <TouchableOpacity onPress={() => setFormData({ ...formData, profileImage: null })}>
                                <Text className="text-red-500 text-sm">Remove Photo</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Bottom Actions */}
            <View className="pb-10 pt-4">
                <Button
                    label={isLoading ? "Creating Profile..." : (step === 3 ? "Complete Sign Up" : "Continue")}
                    onPress={handleNext}
                    disabled={isLoading}
                    className="w-full bg-brand-primary h-14 rounded-full shadow-lg shadow-brand-primary/30"
                    labelClasses="text-lg font-semibold"
                />

                {step === 1 && (
                    <View className="mt-6 flex-row justify-center space-x-1">
                        <Text className="text-slate-500">Already have a profile?</Text>
                        <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
                            <Text className="font-bold text-brand-secondary">Sign In</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {step > 1 && (
                    <TouchableOpacity onPress={handleBack} className="mt-4 items-center" disabled={isLoading}>
                        <Text className="text-slate-400 font-medium">Back</Text>
                    </TouchableOpacity>
                )}
            </View>
            </View>
        </ScreenLayout>
    );
}
