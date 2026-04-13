import { HealthService, MoodService, type HealthEntry, type MoodEntry } from './services';
import { calculateEnergyScore, calculateAverageEnergy, detectEnergyTrend, getEnergyExtremes } from './energyScore';
import { calculateEmotionScore, calculateAverageEmotion, detectEmotionTrend, analyzeMoodPattern, correlateMoodWithSleep } from './emotionScore';

/**
 * Analytics Module
 * 
 * Provides high-level analytics combining health and mood data
 * Used for dashboard insights and weekly summaries
 */

export interface WeeklyAnalytics {
    week_start: string;
    week_end: string;

    // Energy metrics
    avg_energy_score: number;
    energy_trend: 'improving' | 'declining' | 'stable';
    best_energy_day: { date: string; score: number } | null;
    worst_energy_day: { date: string; score: number } | null;

    // Emotion metrics
    avg_emotion_score: number;
    emotion_trend: 'improving' | 'declining' | 'stable';
    most_common_mood: string;

    // Activity metrics
    avg_steps: number;
    avg_sleep: number;
    total_entries: number;

    // Correlations
    sleep_mood_correlation: string;
}

/**
 * Generate comprehensive weekly analytics for a user
 */
export async function generateWeeklyAnalytics(
    userId: string,
    weekStartDate: string,
    weekEndDate: string
): Promise<WeeklyAnalytics> {
    // Fetch data from database
    const healthEntries = await HealthService.getHealthEntriesRange(userId, weekStartDate, weekEndDate);
    const moodEntries = await MoodService.getMoodsRange(userId, weekStartDate, weekEndDate);

    // Energy analysis
    const energyInputs = healthEntries.map(entry => ({
        sleep_hours: entry.sleep_hours || 0,
        steps: entry.steps || 0,
    }));

    const energyScores = energyInputs.map(input => calculateEnergyScore(input).score);
    const avgEnergyScore = energyScores.length > 0
        ? Number((energyScores.reduce((a, b) => a + b, 0) / energyScores.length).toFixed(1))
        : 0;

    const energyTrendData = detectEnergyTrend(energyScores);

    const entriesWithDates = healthEntries.map(entry => ({
        date: entry.date,
        sleep_hours: entry.sleep_hours || 0,
        steps: entry.steps || 0,
    }));

    const { best: bestEnergyDay, worst: worstEnergyDay } = getEnergyExtremes(entriesWithDates);

    // Emotion analysis
    const emotionInputs = moodEntries.map(entry => ({
        mood_value: entry.mood_value,
        diary_text: entry.diary_text,
    }));

    const emotionScores = emotionInputs.map(input => calculateEmotionScore(input).score);
    const avgEmotionScore = emotionScores.length > 0
        ? Number((emotionScores.reduce((a, b) => a + b, 0) / emotionScores.length).toFixed(1))
        : 0;

    const emotionTrendData = detectEmotionTrend(emotionScores);

    const moodValues = moodEntries.map(entry => entry.mood_value);
    const moodPattern = analyzeMoodPattern(moodValues);

    // Activity metrics
    const avgSteps = healthEntries.length > 0
        ? Math.round(healthEntries.reduce((sum, e) => sum + (e.steps || 0), 0) / healthEntries.length)
        : 0;

    const avgSleep = healthEntries.length > 0
        ? Number((healthEntries.reduce((sum, e) => sum + (e.sleep_hours || 0), 0) / healthEntries.length).toFixed(1))
        : 0;

    // Sleep-mood correlation
    const sleepHours = healthEntries.map(e => e.sleep_hours || 0);
    const sleepMoodCorr = correlateMoodWithSleep(emotionScores, sleepHours);

    return {
        week_start: weekStartDate,
        week_end: weekEndDate,
        avg_energy_score: avgEnergyScore,
        energy_trend: energyTrendData.trend,
        best_energy_day: bestEnergyDay,
        worst_energy_day: worstEnergyDay,
        avg_emotion_score: avgEmotionScore,
        emotion_trend: emotionTrendData.trend,
        most_common_mood: moodPattern.mostCommon,
        avg_steps: avgSteps,
        avg_sleep: avgSleep,
        total_entries: healthEntries.length,
        sleep_mood_correlation: sleepMoodCorr.description,
    };
}

/**
 * Update health entry with calculated energy score
 */
export async function updateHealthEntryWithScore(
    userId: string,
    date: string,
    steps: number,
    sleepHours: number
): Promise<void> {
    // Calculate energy score
    const { score } = calculateEnergyScore({
        sleep_hours: sleepHours,
        steps,
    });

    // Save to database
    await HealthService.upsertHealthEntry({
        user_id: userId,
        date,
        steps,
        sleep_hours: sleepHours,
        energy_score: score,
    });
}

/**
 * Add mood entry with calculated emotion score
 */
export async function addMoodEntryWithScore(
    userId: string,
    date: string,
    moodValue: 'great' | 'good' | 'okay' | 'low' | 'bad',
    diaryText?: string
): Promise<void> {
    // Calculate emotion score
    const { score } = calculateEmotionScore({
        mood_value: moodValue,
        diary_text: diaryText,
    });

    // Save to database
    await MoodService.addMoodEntry({
        user_id: userId,
        date,
        mood_value: moodValue,
        emotion_score: score,
        diary_text: diaryText,
    });
}

/**
 * Get daily summary for dashboard
 */
export async function getDailySummary(userId: string, date: string): Promise<{
    energy: {
        score: number;
        level: string;
        feedback: string;
    } | null;
    emotion: {
        score: number;
        level: string;
        feedback: string;
    } | null;
}> {
    const healthEntry = await HealthService.getHealthEntry(userId, date);
    const moodEntry = await MoodService.getMoodForDate(userId, date);

    let energy = null;
    if (healthEntry) {
        const energyData = calculateEnergyScore({
            sleep_hours: healthEntry.sleep_hours || 0,
            steps: healthEntry.steps || 0,
        });

        energy = {
            score: energyData.score,
            level: energyData.level,
            feedback: energyData.feedback,
        };
    }

    let emotion = null;
    if (moodEntry) {
        const emotionData = calculateEmotionScore({
            mood_value: moodEntry.mood_value,
            diary_text: moodEntry.diary_text,
        });

        emotion = {
            score: emotionData.score,
            level: emotionData.level,
            feedback: emotionData.feedback,
        };
    }

    return { energy, emotion };
}
