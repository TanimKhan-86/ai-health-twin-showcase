import React, { useState } from "react";
import {
    View, Text, TouchableOpacity,
    Keyboard, TouchableWithoutFeedback, Platform,
    StyleSheet, ActivityIndicator
} from "react-native";
import { ScreenLayout } from "../../components/ScreenLayout";
import { CircuitBoard } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { LinearGradient } from "expo-linear-gradient";
import { TextInput } from "react-native";
import { apiFetch } from "../../lib/api/client";
import type { AppScreenProps } from "../../lib/navigation/types";

export default function SignInScreen({ navigation }: AppScreenProps<'SignIn'>) {
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [touched, setTouched] = useState({ email: false, password: false });
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showResetPanel, setShowResetPanel] = useState(false);
    const [resetEmail, setResetEmail] = useState("");
    const [resetPassword, setResetPassword] = useState("");
    const [resetConfirmPassword, setResetConfirmPassword] = useState("");
    const [resetLoading, setResetLoading] = useState(false);
    const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);
    const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
    const normalizedEmail = email.trim().toLowerCase();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    const passwordValid = password.length >= 6;
    const canSubmit = emailValid && passwordValid && !isLoading;
    const normalizedResetEmail = resetEmail.trim().toLowerCase();
    const resetEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedResetEmail);
    const resetPasswordValid = resetPassword.length >= 8;
    const resetPasswordsMatch = resetPassword === resetConfirmPassword;
    const canSubmitReset = resetEmailValid && resetPasswordValid && resetPasswordsMatch && !resetLoading;

    const handleLogin = async () => {
        setErrorMsg(null);
        setTouched({ email: true, password: true });
        if (!emailValid || !passwordValid) {
            setErrorMsg("Please enter a valid email and a password with at least 6 characters.");
            return;
        }
        setIsLoading(true);
        try {
            const cleanEmail = normalizedEmail;
            const cleanPassword = password;
            const user = await login(cleanEmail, cleanPassword);
            if (!user) {
                setErrorMsg("Invalid email or password.");
            }
        } catch (error: unknown) {
            setErrorMsg(error instanceof Error ? error.message : "Something went wrong. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPasswordPress = () => {
        if (!showResetPanel && !resetEmail && normalizedEmail) {
            setResetEmail(normalizedEmail);
        }
        setResetErrorMsg(null);
        setResetSuccessMsg(null);
        setShowResetPanel((prev) => !prev);
    };

    const handleResetPassword = async () => {
        setResetErrorMsg(null);
        setResetSuccessMsg(null);

        if (!resetEmailValid) {
            setResetErrorMsg("Enter a valid email address.");
            return;
        }
        if (!resetPasswordValid) {
            setResetErrorMsg("New password must be at least 8 characters.");
            return;
        }
        if (!resetPasswordsMatch) {
            setResetErrorMsg("New passwords do not match.");
            return;
        }

        setResetLoading(true);
        try {
            const res = await apiFetch<{ message?: string }>('/api/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({
                    email: normalizedResetEmail,
                    newPassword: resetPassword,
                }),
            });

            if (!res.success) {
                setResetErrorMsg(res.error || 'Could not reset password.');
                return;
            }

            setShowResetPanel(false);
            setResetSuccessMsg(res.data?.message || 'Password reset successful. Sign in with your new password.');
            setEmail(normalizedResetEmail);
            setPassword("");
            setResetPassword("");
            setResetConfirmPassword("");
            setTouched((prev) => ({ ...prev, password: false }));
            setErrorMsg(null);
        } catch (error: unknown) {
            setResetErrorMsg(error instanceof Error ? error.message : 'Could not reset password.');
        } finally {
            setResetLoading(false);
        }
    };

    const content = (
        <View style={styles.container}>
            {/* Logo */}
            <View style={styles.logoSection}>
                <View style={styles.logoWrap}>
                    <CircuitBoard size={36} color="#ffffff" />
                </View>
                <Text style={styles.appName}>HealthTwin AI</Text>
                <Text style={styles.tagline}>Your Digital Health Companion</Text>
            </View>

            {/* Card */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Welcome Back</Text>
                <Text style={styles.cardSubtitle}>Sign in to your account</Text>
                <Text style={styles.authModeNote}>Prototype mode: email/password sign-in only.</Text>

                {errorMsg ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                ) : null}
                {resetSuccessMsg ? (
                    <View style={styles.successBox}>
                        <Text style={styles.successText}>{resetSuccessMsg}</Text>
                    </View>
                ) : null}

                <TextInput
                    style={[
                        styles.input,
                        touched.email ? (emailValid ? styles.inputValid : styles.inputInvalid) : null,
                    ]}
                    placeholder="Email"
                    placeholderTextColor="#a78bfa"
                    value={email}
                    onChangeText={(value) => {
                        setEmail(value);
                        if (errorMsg) setErrorMsg(null);
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />
                {touched.email && (
                    <Text style={emailValid ? styles.validHint : styles.invalidHint}>
                        {emailValid ? "Looks good." : "Enter a valid email address."}
                    </Text>
                )}

                <View style={styles.passwordWrap}>
                    <TextInput
                        style={[
                            styles.input,
                            styles.passwordInput,
                            touched.password ? (passwordValid ? styles.inputValid : styles.inputInvalid) : null,
                        ]}
                        placeholder="Password"
                        placeholderTextColor="#a78bfa"
                        value={password}
                        onChangeText={(value) => {
                            setPassword(value);
                            if (errorMsg) setErrorMsg(null);
                        }}
                        onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((prev) => !prev)}>
                        <Text style={styles.eyeBtnText}>{showPassword ? "Hide" : "Show"}</Text>
                    </TouchableOpacity>
                </View>
                {touched.password && (
                    <Text style={passwordValid ? styles.validHint : styles.invalidHint}>
                        {passwordValid ? "Password length is valid." : "Password must be at least 6 characters."}
                    </Text>
                )}
                <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPasswordPress}>
                    <Text style={styles.forgotText}>{showResetPanel ? "Close reset" : "Forgot Password?"}</Text>
                </TouchableOpacity>

                {showResetPanel ? (
                    <View style={styles.resetPanel}>
                        <Text style={styles.resetTitle}>Reset Password</Text>
                        <Text style={styles.resetSub}>Prototype mode: reset using email + new password.</Text>
                        {resetErrorMsg ? <Text style={styles.resetErrorText}>{resetErrorMsg}</Text> : null}
                        <TextInput
                            style={styles.input}
                            placeholder="Account Email"
                            placeholderTextColor="#a78bfa"
                            value={resetEmail}
                            onChangeText={setResetEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="New Password"
                            placeholderTextColor="#a78bfa"
                            value={resetPassword}
                            onChangeText={setResetPassword}
                            secureTextEntry
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm New Password"
                            placeholderTextColor="#a78bfa"
                            value={resetConfirmPassword}
                            onChangeText={setResetConfirmPassword}
                            secureTextEntry
                        />
                        <TouchableOpacity onPress={handleResetPassword} disabled={!canSubmitReset} activeOpacity={0.85}>
                            <LinearGradient
                                colors={canSubmitReset ? ["#2563eb", "#1d4ed8"] : ["#93c5fd", "#60a5fa"]}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={styles.resetBtn}
                            >
                                {resetLoading
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={styles.resetBtnText}>Reset Password</Text>}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                ) : null}

                <TouchableOpacity onPress={handleLogin} disabled={!canSubmit} activeOpacity={0.85}>
                    <LinearGradient
                        colors={canSubmit ? ["#7c3aed", "#6d28d9"] : ["#c4b5fd", "#a78bfa"]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
                    >
                        {isLoading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.primaryBtnText}>Sign In</Text>
                        }
                    </LinearGradient>
                </TouchableOpacity>

            </View>

            <View style={styles.bottomRow}>
                <Text style={styles.bottomText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
                    <Text style={styles.bottomLink}>Sign Up</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <ScreenLayout gradientBackground>
            {Platform.OS === 'web' ? content : (
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{content}</TouchableWithoutFeedback>
            )}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
    logoSection: { alignItems: 'center', marginBottom: 32 },
    logoWrap: {
        width: 80, height: 80, borderRadius: 24,
        backgroundColor: '#7c3aed',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45, shadowRadius: 16, elevation: 12,
        marginBottom: 16,
    },
    appName: { fontSize: 26, fontWeight: '800', color: '#3b0764', letterSpacing: 0.3 },
    tagline: { fontSize: 14, color: '#7c3aed', fontWeight: '500', marginTop: 4 },

    card: {
        backgroundColor: '#ffffff',
        borderRadius: 28,
        padding: 28,
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 8,
    },
    cardTitle: { fontSize: 22, fontWeight: '800', color: '#1e1b4b', textAlign: 'center' },
    cardSubtitle: { fontSize: 13, color: '#7c3aed', textAlign: 'center', marginTop: 4, marginBottom: 24 },
    authModeNote: { marginTop: -12, marginBottom: 16, fontSize: 12, color: '#6b7280', textAlign: 'center' },

    errorBox: { backgroundColor: '#fee2e2', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fca5a5' },
    errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center', fontWeight: '500' },
    successBox: { backgroundColor: '#dcfce7', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#86efac' },
    successText: { color: '#166534', fontSize: 13, textAlign: 'center', fontWeight: '600' },

    input: {
        backgroundColor: '#f5f3ff',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#e9d5ff',
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: '#1e1b4b',
        marginBottom: 12,
    },
    inputValid: {
        borderColor: '#34d399',
    },
    inputInvalid: {
        borderColor: '#f87171',
    },
    validHint: {
        marginTop: -8,
        marginBottom: 10,
        fontSize: 12,
        color: '#059669',
        fontWeight: '600',
    },
    invalidHint: {
        marginTop: -8,
        marginBottom: 10,
        fontSize: 12,
        color: '#dc2626',
        fontWeight: '600',
    },
    passwordWrap: {
        position: 'relative',
    },
    passwordInput: {
        paddingRight: 74,
        marginBottom: 12,
    },
    eyeBtn: {
        position: 'absolute',
        right: 12,
        top: 13,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: '#ede9fe',
    },
    eyeBtnText: {
        color: '#6d28d9',
        fontSize: 12,
        fontWeight: '700',
    },
    forgotBtn: {
        alignSelf: 'flex-end',
        marginTop: -2,
        marginBottom: 12,
    },
    forgotText: {
        color: '#6d28d9',
        fontSize: 12,
        fontWeight: '700',
    },
    resetPanel: {
        borderWidth: 1,
        borderColor: '#dbeafe',
        backgroundColor: '#eff6ff',
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
    },
    resetTitle: {
        color: '#1e3a8a',
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 2,
    },
    resetSub: {
        color: '#475569',
        fontSize: 12,
        marginBottom: 10,
    },
    resetErrorText: {
        color: '#b91c1c',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
    },
    resetBtn: {
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    resetBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },

    primaryBtn: {
        borderRadius: 16, paddingVertical: 16,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#6d28d9', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
    },
    primaryBtnDisabled: {
        shadowOpacity: 0.08,
    },
    primaryBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

    bottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
    bottomText: { color: '#5b21b6', fontSize: 14 },
    bottomLink: { color: '#7c3aed', fontWeight: '800', fontSize: 14 },
});
