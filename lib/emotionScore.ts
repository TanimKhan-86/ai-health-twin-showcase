/**
 * Emotion Score Calculation Module
 * 
 * Analyzes mood entries and diary text to calculate emotion scores
 * Uses simple sentiment analysis and mood value mappings
 */

export type MoodValue = 'great' | 'good' | 'okay' | 'low' | 'bad';

export interface EmotionInput {
    mood_value: MoodValue;
    diary_text?: string;
}

export interface EmotionScore {
    score: number; // 0-100
    mood_base_score: number;
    text_adjustment: number;
    level: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
    feedback: string;
}

/**
 * Mood value to base score mapping
 */
const MOOD_BASE_SCORES: Record<MoodValue, number> = {
    great: 90,
    good: 75,
    okay: 50,
    low: 30,
    bad: 15,
};

/**
 * Calculate emotion score from mood and optional diary text
 */
export function calculateEmotionScore(input: EmotionInput): EmotionScore {
    const { mood_value, diary_text } = input;

    // Get base score from mood value
    const moodBaseScore = MOOD_BASE_SCORES[mood_value];

    // Analyze diary text for sentiment adjustment (if provided)
    const textAdjustment = diary_text ? analyzeSentiment(diary_text) : 0;

    // Calculate final score
    const rawScore = moodBaseScore + textAdjustment;
    const score = Math.min(Math.max(rawScore, 0), 100); // Clamp to 0-100

    // Determine emotion level
    const level = getEmotionLevel(score);

    // Generate feedback
    const feedback = getEmotionFeedback(level, mood_value);

    return {
        score: Number(score.toFixed(1)),
        mood_base_score: moodBaseScore,
        text_adjustment: Number(textAdjustment.toFixed(1)),
        level,
        feedback,
    };
}

/**
 * Simple sentiment analysis on diary text
 * Returns adjustment value (-10 to +10)
 */
function analyzeSentiment(text: string): number {
    const lowerText = text.toLowerCase();

    // Positive keywords
    const positiveKeywords = [
        'happy', 'joy', 'great', 'wonderful', 'amazing', 'excited', 'grateful',
        'love', 'awesome', 'fantastic', 'excellent', 'good', 'better', 'improved',
        'accomplished', 'proud', 'energized', 'motivated', 'peaceful', 'calm'
    ];

    // Negative keywords
    const negativeKeywords = [
        'sad', 'tired', 'exhausted', 'stressed', 'anxious', 'worried', 'frustrated',
        'angry', 'upset', 'disappointed', 'difficult', 'hard', 'struggle', 'pain',
        'hurt', 'lonely', 'depressed', 'terrible', 'awful', 'bad', 'worse'
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    // Count keyword occurrences
    positiveKeywords.forEach(keyword => {
        if (lowerText.includes(keyword)) positiveCount++;
    });

    negativeKeywords.forEach(keyword => {
        if (lowerText.includes(keyword)) negativeCount++;
    });

    // Calculate adjustment (max ±10 points)
    const netSentiment = positiveCount - negativeCount;
    const adjustment = Math.min(Math.max(netSentiment * 3, -10), 10);

    return adjustment;
}

/**
 * Categorize emotion score into levels
 */
function getEmotionLevel(score: number): 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive' {
    if (score < 25) return 'very_negative';
    if (score < 45) return 'negative';
    if (score < 65) return 'neutral';
    if (score < 85) return 'positive';
    return 'very_positive';
}

/**
 * Generate contextual feedback based on emotion level and mood
 */
function getEmotionFeedback(
    level: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive',
    mood: MoodValue
): string {
    const feedbackMap = {
        very_positive: 'Your emotional state is excellent! Embrace this positive energy.',
        positive: 'You\'re feeling good today. Keep nurturing these positive emotions.',
        neutral: 'Your emotions are balanced. It\'s okay to have neutral days.',
        negative: 'You\'re experiencing some low feelings. Be kind to yourself.',
        very_negative: 'You\'re going through a tough time. Consider reaching out for support.',
    };

    return feedbackMap[level];
}

/**
 * Calculate average emotion score from multiple entries
 */
export function calculateAverageEmotion(entries: EmotionInput[]): number {
    if (entries.length === 0) return 0;

    const total = entries.reduce((sum, entry) => {
        const { score } = calculateEmotionScore(entry);
        return sum + score;
    }, 0);

    return Number((total / entries.length).toFixed(1));
}

/**
 * Detect emotion trend over time
 */
export function detectEmotionTrend(scores: number[]): {
    trend: 'improving' | 'declining' | 'stable';
    change: number;
    description: string;
} {
    if (scores.length < 2) {
        return {
            trend: 'stable',
            change: 0,
            description: 'Not enough data to determine emotional trend',
        };
    }

    // Compare recent half vs older half
    const midpoint = Math.floor(scores.length / 2);
    const olderScores = scores.slice(0, midpoint);
    const recentScores = scores.slice(midpoint);

    const olderAvg = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
    const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

    const change = Number((recentAvg - olderAvg).toFixed(1));

    // Determine trend (threshold: ±5 points)
    if (change > 5) {
        return {
            trend: 'improving',
            change,
            description: `Your emotional wellbeing has improved by ${change} points!`,
        };
    }

    if (change < -5) {
        return {
            trend: 'declining',
            change,
            description: `Your emotional wellbeing has decreased by ${Math.abs(change)} points.`,
        };
    }

    return {
        trend: 'stable',
        change,
        description: 'Your emotional state is stable.',
    };
}

/**
 * Analyze mood patterns (most common mood)
 */
export function analyzeMoodPattern(moods: MoodValue[]): {
    mostCommon: MoodValue;
    distribution: Record<MoodValue, number>;
    variety: number; // 0-100, higher = more varied
} {
    if (moods.length === 0) {
        return {
            mostCommon: 'okay',
            distribution: { great: 0, good: 0, okay: 0, low: 0, bad: 0 },
            variety: 0,
        };
    }

    // Count occurrences
    const distribution: Record<MoodValue, number> = {
        great: 0,
        good: 0,
        okay: 0,
        low: 0,
        bad: 0,
    };

    moods.forEach(mood => {
        distribution[mood]++;
    });

    // Find most common
    const mostCommon = Object.entries(distribution).reduce((a, b) =>
        b[1] > a[1] ? b : a
    )[0] as MoodValue;

    // Calculate variety (entropy-like measure)
    const uniqueMoods = Object.values(distribution).filter(count => count > 0).length;
    const variety = Number(((uniqueMoods / 5) * 100).toFixed(1));

    return {
        mostCommon,
        distribution,
        variety,
    };
}

/**
 * Correlate mood with external factors (if data available)
 */
export function correlateMoodWithSleep(
    moodScores: number[],
    sleepHours: number[]
): {
    correlation: 'strong_positive' | 'moderate_positive' | 'weak' | 'moderate_negative' | 'strong_negative';
    description: string;
} {
    if (moodScores.length !== sleepHours.length || moodScores.length < 3) {
        return {
            correlation: 'weak',
            description: 'Not enough data to determine correlation',
        };
    }

    // Simple correlation coefficient calculation
    const n = moodScores.length;
    const meanMood = moodScores.reduce((a, b) => a + b, 0) / n;
    const meanSleep = sleepHours.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomMood = 0;
    let denomSleep = 0;

    for (let i = 0; i < n; i++) {
        const moodDiff = moodScores[i] - meanMood;
        const sleepDiff = sleepHours[i] - meanSleep;

        numerator += moodDiff * sleepDiff;
        denomMood += moodDiff ** 2;
        denomSleep += sleepDiff ** 2;
    }

    const r = numerator / Math.sqrt(denomMood * denomSleep);

    // Categorize correlation
    let correlation: 'strong_positive' | 'moderate_positive' | 'weak' | 'moderate_negative' | 'strong_negative';
    let description: string;

    if (r > 0.7) {
        correlation = 'strong_positive';
        description = 'Your mood strongly improves with better sleep!';
    } else if (r > 0.4) {
        correlation = 'moderate_positive';
        description = 'Better sleep tends to improve your mood.';
    } else if (r < -0.7) {
        correlation = 'strong_negative';
        description = 'Interesting: more sleep seems to negatively affect your mood.';
    } else if (r < -0.4) {
        correlation = 'moderate_negative';
        description = 'There may be a negative relationship between sleep and mood.';
    } else {
        correlation = 'weak';
        description = 'No clear relationship between sleep and mood detected.';
    }

    return { correlation, description };
}
