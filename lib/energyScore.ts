/**
 * Energy Score Calculation Module
 * 
 * Calculates a user's energy score (0-100) based on sleep and activity data
 * Formula: Energy = (sleep_hours / 8) × 0.6 + (steps / 10000) × 0.4
 * 
 * Weights:
 * - Sleep: 60% (optimal = 8 hours)
 * - Steps: 40% (optimal = 10,000 steps)
 */

export interface EnergyInput {
    sleep_hours: number;
    steps: number;
}

export interface EnergyScore {
    score: number; // 0-100
    sleep_contribution: number;
    steps_contribution: number;
    level: 'very_low' | 'low' | 'moderate' | 'good' | 'excellent';
    feedback: string;
}

/**
 * Calculate energy score from sleep and steps
 */
export function calculateEnergyScore(input: EnergyInput): EnergyScore {
    const { sleep_hours, steps } = input;

    // Normalize sleep (optimal = 8 hours, max considered = 10 hours)
    const sleepNormalized = Math.min(sleep_hours / 8, 1.25); // Cap at 125% for oversleep
    const sleepContribution = sleepNormalized * 0.6;

    // Normalize steps (optimal = 10,000 steps)
    const stepsNormalized = Math.min(steps / 10000, 1.5); // Cap at 150% for super active
    const stepsContribution = stepsNormalized * 0.4;

    // Calculate total score (0-100)
    const rawScore = (sleepContribution + stepsContribution) * 100;
    const score = Math.min(Math.max(rawScore, 0), 100); // Clamp to 0-100

    // Determine energy level
    const level = getEnergyLevel(score);

    // Generate feedback
    const feedback = getEnergyFeedback(score, sleep_hours, steps);

    return {
        score: Number(score.toFixed(1)),
        sleep_contribution: Number((sleepContribution * 100).toFixed(1)),
        steps_contribution: Number((stepsContribution * 100).toFixed(1)),
        level,
        feedback,
    };
}

/**
 * Categorize energy score into levels
 */
function getEnergyLevel(score: number): 'very_low' | 'low' | 'moderate' | 'good' | 'excellent' {
    if (score < 30) return 'very_low';
    if (score < 50) return 'low';
    if (score < 70) return 'moderate';
    if (score < 85) return 'good';
    return 'excellent';
}

/**
 * Generate contextual feedback based on energy components
 */
function getEnergyFeedback(score: number, sleep: number, steps: number): string {
    if (score >= 85) {
        return 'Fantastic! Your energy levels are excellent. Keep up the great routine!';
    }

    if (score >= 70) {
        return 'Great job! Your energy is good. Small improvements could make it even better.';
    }

    if (score >= 50) {
        const needsSleep = sleep < 6;
        const needsSteps = steps < 5000;

        if (needsSleep && needsSteps) {
            return 'Your energy is moderate. Try getting more sleep and increasing your daily activity.';
        }
        if (needsSleep) {
            return 'Your energy is moderate. Getting more sleep could help boost your levels.';
        }
        if (needsSteps) {
            return 'Your energy is moderate. Try moving more throughout the day.';
        }
        return 'Your energy is moderate. Maintain consistency to improve further.';
    }

    if (score >= 30) {
        return 'Your energy is low. Consider prioritizing rest and gentle movement today.';
    }

    return 'Your energy is very low. Please prioritize rest and self-care.';
}

/**
 * Calculate average energy score from multiple entries
 */
export function calculateAverageEnergy(entries: EnergyInput[]): number {
    if (entries.length === 0) return 0;

    const total = entries.reduce((sum, entry) => {
        const { score } = calculateEnergyScore(entry);
        return sum + score;
    }, 0);

    return Number((total / entries.length).toFixed(1));
}

/**
 * Detect energy trend (improving, declining, stable)
 */
export function detectEnergyTrend(scores: number[]): {
    trend: 'improving' | 'declining' | 'stable';
    change: number;
    description: string;
} {
    if (scores.length < 2) {
        return {
            trend: 'stable',
            change: 0,
            description: 'Not enough data to determine trend',
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
            description: `Your energy has improved by ${change} points!`,
        };
    }

    if (change < -5) {
        return {
            trend: 'declining',
            change,
            description: `Your energy has decreased by ${Math.abs(change)} points.`,
        };
    }

    return {
        trend: 'stable',
        change,
        description: 'Your energy levels are stable.',
    };
}

/**
 * Get best and worst energy days from a week's data
 */
export function getEnergyExtremes(
    entries: Array<EnergyInput & { date: string }>
): {
    best: { date: string; score: number } | null;
    worst: { date: string; score: number } | null;
} {
    if (entries.length === 0) {
        return { best: null, worst: null };
    }

    const withScores = entries.map((entry) => ({
        date: entry.date,
        score: calculateEnergyScore(entry).score,
    }));

    const best = withScores.reduce((max, curr) => (curr.score > max.score ? curr : max));
    const worst = withScores.reduce((min, curr) => (curr.score < min.score ? curr : min));

    return { best, worst };
}
