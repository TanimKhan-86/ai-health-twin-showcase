import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { appTheme } from '../../lib/theme/tokens';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: string;
}

export function EmptyState({ title, description, icon = '🧭' }: EmptyStateProps) {
    return (
        <View style={styles.container}>
            <Text style={styles.icon}>{icon}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: appTheme.colors.surfaceSoft,
        borderRadius: appTheme.radius.md,
        borderWidth: 1,
        borderColor: appTheme.colors.border,
        paddingVertical: appTheme.spacing.lg,
        paddingHorizontal: appTheme.spacing.lg,
        alignItems: 'center',
    },
    icon: {
        fontSize: 24,
        marginBottom: 8,
    },
    title: {
        ...appTheme.typography.h3,
        color: appTheme.colors.textPrimary,
    },
    description: {
        marginTop: 6,
        ...appTheme.typography.caption,
        color: appTheme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
    },
});
