import React, { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { appTheme, shadows } from '../../lib/theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface AppButtonProps {
    label: string;
    onPress: () => void;
    variant?: ButtonVariant;
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
}

export function AppButton({
    label,
    onPress,
    variant = 'primary',
    disabled = false,
    loading = false,
    icon,
}: AppButtonProps) {
    const tone = stylesByVariant[variant];
    const isDisabled = disabled || loading;
    const scale = useRef(new Animated.Value(1)).current;
    const [hovered, setHovered] = useState(false);

    const animateTo = (value: number) => {
        Animated.spring(scale, {
            toValue: value,
            speed: 18,
            bounciness: 0,
            useNativeDriver: true,
        }).start();
    };

    return (
        <Pressable
            onPress={onPress}
            disabled={isDisabled}
            onHoverIn={() => !isDisabled && setHovered(true)}
            onHoverOut={() => setHovered(false)}
            onPressIn={() => animateTo(0.985)}
            onPressOut={() => animateTo(1)}
            style={({ pressed }) => [
                styles.buttonBase,
                tone.button,
                isDisabled ? styles.disabled : undefined,
                hovered && !isDisabled ? styles.hovered : undefined,
                pressed && !isDisabled ? styles.pressed : undefined,
                Platform.OS === 'web'
                    ? ({ cursor: isDisabled ? 'not-allowed' : 'pointer' } as any)
                    : undefined,
            ]}
        >
            <Animated.View style={[styles.inner, { transform: [{ scale }] }]}>
                {loading ? (
                    <ActivityIndicator size="small" color={tone.text.color} />
                ) : (
                    <View style={styles.content}>
                        {icon}
                        <Text style={[styles.label, tone.text]}>{label}</Text>
                    </View>
                )}
            </Animated.View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    buttonBase: {
        borderRadius: appTheme.radius.md,
        paddingVertical: 12,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        ...shadows.cardSoft,
    },
    inner: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '800',
    },
    disabled: {
        opacity: 0.6,
    },
    hovered: {
        shadowOpacity: 0.2,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        transform: [{ translateY: -1 }],
    },
    pressed: {
        opacity: 0.94,
    },
});

const stylesByVariant = {
    primary: StyleSheet.create({
        button: {
            backgroundColor: appTheme.colors.brand,
            borderColor: appTheme.colors.brandDark,
        },
        text: {
            color: '#fff',
        },
    }),
    secondary: StyleSheet.create({
        button: {
            backgroundColor: appTheme.colors.brandSoft,
            borderColor: appTheme.colors.borderStrong,
        },
        text: {
            color: appTheme.colors.brandDark,
        },
    }),
    danger: StyleSheet.create({
        button: {
            backgroundColor: '#fff1f4',
            borderColor: '#f3b3c0',
        },
        text: {
            color: appTheme.colors.danger,
        },
    }),
} as const;
