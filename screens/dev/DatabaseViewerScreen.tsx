import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { ScreenLayout } from '../../components/ScreenLayout';
import { ArrowLeft, Database } from 'lucide-react-native';
import { Card, CardContent } from '../../components/ui/Card';
import type { AppScreenProps } from '../../lib/navigation/types';

/**
 * DatabaseViewerScreen — previously showed SQLite data.
 * SQLite has been removed. All data is now in MongoDB Atlas.
 * This screen now shows a notice and could be extended to show
 * the user's MongoDB data via the API.
 */
export default function DatabaseViewerScreen({ navigation }: AppScreenProps<'DatabaseViewer'>) {
    return (
        <ScreenLayout gradientBackground>
            <View className="flex-1">
                <View className="p-4 pt-2 flex-row items-center space-x-4">
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="flex-row items-center bg-white/20 px-3 py-2 rounded-full"
                    >
                        <ArrowLeft color="white" size={20} />
                        <Text className="text-white font-bold ml-2">Back</Text>
                    </TouchableOpacity>
                    <View>
                        <Text className="text-white text-xl font-bold">Database Info</Text>
                        <Text className="text-teal-200 text-xs">Read-only storage overview</Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={{ padding: 16 }}>
                    <Card className="bg-white/95">
                        <CardContent className="p-8 items-center">
                            <Database size={48} color="#a855f7" />
                            <Text className="text-slate-800 font-bold text-xl mt-4 text-center">
                                MongoDB Atlas ☁️
                            </Text>
                            <Text className="text-slate-500 text-sm text-center mt-3 leading-6">
                                All your data is stored securely in MongoDB Atlas.
                                There is no local database on this device.
                            </Text>
                            <View className="bg-purple-50 rounded-xl p-4 mt-6 w-full">
                                <Text className="text-purple-800 font-bold mb-2">Collections:</Text>
                                {['users', 'healthentries', 'moodentries', 'streaks'].map(col => (
                                    <Text key={col} className="text-purple-600 text-sm py-1">
                                        📦 {col}
                                    </Text>
                                ))}
                            </View>
                            <Text className="text-slate-400 text-xs mt-4 text-center">
                                This screen is informational only. Use Analytics, Daily Log, and Future You for live user data.
                            </Text>
                        </CardContent>
                    </Card>
                </ScrollView>
            </View>
        </ScreenLayout>
    );
}
