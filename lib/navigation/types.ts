import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
    SignIn: undefined;
    SignUp: undefined;
    Main: undefined;
    DailyLog: undefined;
    DataEntry: undefined;
    FutureYou: undefined;
    WhatIf: undefined;
    Achievements: undefined;
    WeeklySummary: undefined;
    AIWeeklyAnalysis: undefined;
    Analytics: undefined;
    Settings: undefined;
    AvatarSetup: undefined;
    DatabaseViewer: undefined;
};

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;
export type AppScreenProps<Screen extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, Screen>;
