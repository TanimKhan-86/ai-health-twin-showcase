import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Animated, Platform } from 'react-native';
import { Check, X, Bell, Info, AlertTriangle } from 'lucide-react-native';
import { cn } from '../../lib/utils';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastConfig {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
    const [toast, setToast] = useState<ToastConfig | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(-100)).current;

    // Function to show toast
    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        setToast({ id: Date.now().toString(), message, type });
    }, []);

    // Function to hide toast
    const hideToast = useCallback(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: -100, duration: 300, useNativeDriver: true }),
        ]).start(() => setToast(null));
    }, [fadeAnim, slideAnim]);

    // Effect to handle animation when toast changes
    useEffect(() => {
        if (toast) {
            // Reset values for entry
            fadeAnim.setValue(0);
            slideAnim.setValue(-100);

            // Animate In: Fade to 1, Slide to nice position
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.spring(slideAnim, {
                    toValue: Platform.OS === 'web' ? 40 : 60, // Top margin
                    friction: 6,
                    useNativeDriver: true
                }),
            ]).start();

            // Auto hide after 3 seconds
            const timer = setTimeout(hideToast, 3000);
            return () => clearTimeout(timer);
        }
    }, [toast, hideToast, fadeAnim, slideAnim]);

    // Helper to get Icon
    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success': return <Check size={20} color="#4ade80" />; // Green
            case 'error': return <X size={20} color="#f87171" />; // Red
            case 'warning': return <AlertTriangle size={20} color="#facc15" />; // Yellow
            default: return <Bell size={20} color="#60a5fa" />; // Blue
        }
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toast && (
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        alignItems: 'center',
                        zIndex: 9999, // High z-index for overlay
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }]
                    }}
                    pointerEvents="none"
                >
                    <View
                        className={cn(
                            "px-6 py-4 rounded-full shadow-2xl flex-row items-center space-x-3 backdrop-blur-md border",
                            "bg-slate-900/90 dark:bg-white/90 border-white/10 dark:border-slate-200/20"
                        )}
                        style={{
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 10
                        }}
                    >
                        {getIcon(toast.type)}
                        <Text className="text-white dark:text-slate-900 font-medium text-base">
                            {toast.message}
                        </Text>
                    </View>
                </Animated.View>
            )}
        </ToastContext.Provider>
    );
};
