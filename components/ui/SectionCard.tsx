import React from 'react';
import { View, StyleProp, ViewStyle, StyleSheet } from 'react-native';
import { appTheme, shadows } from '../../lib/theme/tokens';

interface SectionCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

export function SectionCard({ children, style }: SectionCardProps) {
    return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: appTheme.colors.surface,
        borderRadius: appTheme.radius.lg,
        padding: appTheme.spacing.lg,
        borderWidth: 1,
        borderColor: appTheme.colors.border,
        ...shadows.cardSoft,
    },
});
