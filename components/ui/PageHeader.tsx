import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { appTheme, gradients } from '../../lib/theme/tokens';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    backLabel?: string;
    rightSlot?: React.ReactNode;
    gradientColors?: [string, string] | [string, string, string];
    containerStyle?: ViewStyle;
    compact?: boolean;
    titleStyle?: TextStyle;
    subtitleStyle?: TextStyle;
}

export function PageHeader({
    title,
    subtitle,
    onBack,
    backLabel = 'Back',
    rightSlot,
    gradientColors = gradients.primaryHeader,
    containerStyle,
    compact = false,
    titleStyle,
    subtitleStyle,
}: PageHeaderProps) {
    return (
        <LinearGradient colors={gradientColors} style={[styles.header, compact ? styles.headerCompact : undefined, containerStyle]}>
            <View style={[styles.topRow, compact ? styles.topRowCompact : undefined]}>
                {onBack ? (
                    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                        <ArrowLeft color="#fff" size={18} />
                        <Text style={styles.backText}>{backLabel}</Text>
                    </TouchableOpacity>
                ) : <View />}
                {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
            </View>
            <Text style={[styles.title, compact ? styles.titleCompact : undefined, titleStyle]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, compact ? styles.subtitleCompact : undefined, subtitleStyle]}>{subtitle}</Text> : null}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: appTheme.spacing.xl,
        paddingTop: appTheme.spacing.md,
        paddingBottom: appTheme.spacing.xxl,
        borderBottomLeftRadius: appTheme.radius.xl,
        borderBottomRightRadius: appTheme.radius.xl,
    },
    headerCompact: {
        paddingTop: 10,
        paddingBottom: 16,
    },
    topRow: {
        minHeight: 36,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: appTheme.spacing.md,
    },
    topRowCompact: {
        minHeight: 24,
        marginBottom: 8,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderRadius: appTheme.radius.pill,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
    },
    backText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    title: {
        ...appTheme.typography.h1,
        color: '#fff',
    },
    titleCompact: {
        fontSize: 23,
        letterSpacing: -0.2,
    },
    subtitle: {
        marginTop: appTheme.spacing.xs,
        ...appTheme.typography.caption,
        color: 'rgba(255,255,255,0.85)',
    },
    subtitleCompact: {
        marginTop: 2,
    },
    rightSlot: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
