import { Platform, TextStyle, ViewStyle } from 'react-native';

const fontFamilies = {
    display: Platform.select({
        web: '"Sora", "Manrope", "Avenir Next", "Segoe UI", sans-serif',
        ios: 'Avenir Next',
        android: 'sans-serif-medium',
        default: 'System',
    }) || 'System',
    body: Platform.select({
        web: '"Manrope", "Avenir Next", "Segoe UI", sans-serif',
        ios: 'Avenir Next',
        android: 'sans-serif',
        default: 'System',
    }) || 'System',
    mono: Platform.select({
        web: '"JetBrains Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
        ios: 'Menlo',
        android: 'monospace',
        default: 'monospace',
    }) || 'monospace',
};

export const appTheme = {
    fonts: fontFamilies,
    colors: {
        backgroundTop: '#d2cbff',
        backgroundMid: '#e7e2ff',
        backgroundBottom: '#f8f7ff',
        surface: '#ffffff',
        surfaceSoft: '#f8f7ff',
        textPrimary: '#1f2148',
        textSecondary: '#5f6485',
        textMuted: '#8b90a8',
        border: '#e8e3ff',
        borderStrong: '#dad2ff',
        brand: '#5c48f0',
        brandDark: '#4434cc',
        brandSoft: '#f0edff',
        success: '#0f9f71',
        warning: '#d98b12',
        danger: '#e14b61',
        info: '#2f7ddf',
    },
    radius: {
        xs: 8,
        sm: 12,
        md: 16,
        lg: 20,
        xl: 24,
        pill: 999,
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 20,
        xxl: 24,
    },
    typography: {
        h1: { fontFamily: fontFamilies.display, fontSize: 25, fontWeight: '800' as TextStyle['fontWeight'], letterSpacing: -0.25 },
        h2: { fontFamily: fontFamilies.display, fontSize: 20, fontWeight: '800' as TextStyle['fontWeight'], letterSpacing: -0.15 },
        h3: { fontFamily: fontFamilies.display, fontSize: 16, fontWeight: '700' as TextStyle['fontWeight'], letterSpacing: -0.1 },
        body: { fontFamily: fontFamilies.body, fontSize: 14, fontWeight: '500' as TextStyle['fontWeight'], letterSpacing: 0.12 },
        bodyStrong: { fontFamily: fontFamilies.body, fontSize: 14, fontWeight: '700' as TextStyle['fontWeight'], letterSpacing: 0.12 },
        caption: { fontFamily: fontFamilies.body, fontSize: 12, fontWeight: '600' as TextStyle['fontWeight'], letterSpacing: 0.16 },
        overline: { fontFamily: fontFamilies.body, fontSize: 11, fontWeight: '700' as TextStyle['fontWeight'], letterSpacing: 0.3 },
        metric: { fontFamily: fontFamilies.display, fontSize: 20, fontWeight: '800' as TextStyle['fontWeight'], letterSpacing: -0.2 },
    },
};

export const gradients = {
    screen: [appTheme.colors.backgroundTop, appTheme.colors.backgroundMid, appTheme.colors.backgroundBottom] as [string, string, string],
    primaryHeader: [appTheme.colors.brand, appTheme.colors.brandDark] as [string, string],
};

export const shadows = {
    card: {
        shadowColor: appTheme.colors.brand,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
    } as ViewStyle,
    cardSoft: {
        shadowColor: appTheme.colors.brand,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    } as ViewStyle,
};
