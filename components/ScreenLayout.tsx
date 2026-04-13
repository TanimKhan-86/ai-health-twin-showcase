import type { ReactNode } from "react";
import { View, StyleProp, ViewStyle, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { appTheme, gradients } from "../lib/theme/tokens";

interface ScreenLayoutProps {
    children: ReactNode;
    gradientBackground?: boolean;
    outerStyle?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
}

export function ScreenLayout({
    children,
    outerStyle,
    contentStyle,
    gradientBackground = true,
}: ScreenLayoutProps) {
    if (gradientBackground) {
        return (
            <LinearGradient
                colors={gradients.screen}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[styles.flex, outerStyle]}
            >
                <StatusBar style="dark" />
                <SafeAreaView style={[styles.flex, contentStyle]}>
                    {children}
                </SafeAreaView>
            </LinearGradient>
        );
    }

    return (
        <View style={[styles.flex, { backgroundColor: appTheme.colors.backgroundBottom }, outerStyle]}>
            <StatusBar style="dark" />
            <SafeAreaView style={[styles.flex, contentStyle]}>
                {children}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
});
