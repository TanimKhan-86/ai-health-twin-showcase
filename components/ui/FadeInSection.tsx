import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

interface FadeInSectionProps {
    children: React.ReactNode;
    delay?: number;
    duration?: number;
    fromY?: number;
    style?: StyleProp<ViewStyle>;
}

export function FadeInSection({
    children,
    delay = 0,
    duration = 360,
    fromY = 12,
    style,
}: FadeInSectionProps) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(fromY)).current;

    useEffect(() => {
        opacity.setValue(0);
        translateY.setValue(fromY);

        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration,
                delay,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration,
                delay,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [delay, duration, fromY, opacity, translateY]);

    return (
        <Animated.View
            style={[
                {
                    opacity,
                    transform: [{ translateY }],
                },
                style,
            ]}
        >
            {children}
        </Animated.View>
    );
}
