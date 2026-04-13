/**
 * Prediction Service
 * 
 * Handles logic for "What-If" simulations.
 * Predicts energy scores and mood states based on input parameters.
 */

export interface PredictionResult {
    predictedEnergy: number;
    predictedMoodState: string;
    energyImpact: number; // difference from current
    narrative: string;
}

export interface ForecastPoint {
    day: number;
    date: Date;
    predictedEnergy: number;
    predictedMood: string;
}

function createDeterministicNoiseSeed(
    baselineSleep: number,
    baselineSteps: number,
    simSleep: number,
    simSteps: number
): number {
    // Build a stable seed from inputs so forecast does not jitter between renders.
    const packed =
        Math.round(baselineSleep * 10) * 31 +
        Math.round(simSleep * 10) * 47 +
        Math.round(baselineSteps / 100) * 53 +
        Math.round(simSteps / 100) * 71;
    return Math.abs(packed) + 1;
}

function deterministicDailyNoise(day: number, seed: number): number {
    // Smooth bounded variation (~ -1.2 to +1.2) that is reproducible for same inputs.
    const waveA = Math.sin((day + seed) * 0.55);
    const waveB = Math.cos((day + seed * 0.13) * 0.34);
    return (waveA * 0.75 + waveB * 0.45);
}

/**
 * Calculate predicted energy score based on sleep and steps
 * Formula: (Sleep/8 * 60) + (Steps/10000 * 40)
 * Max score capped at 100
 */
export const calculatePredictedEnergy = (sleepHours: number, steps: number): number => {
    const sleepComp = Math.min((sleepHours / 8) * 60, 60);
    const stepsComp = Math.min((steps / 10000) * 40, 40);

    return Math.round(sleepComp + stepsComp);
};

/**
 * Determine mood state based on inputs
 */
export const predictMoodState = (sleep: number, energy: number): string => {
    if (sleep >= 7.5 && energy >= 80) return "Radiant 🌟";
    if (sleep >= 7 && energy >= 70) return "Energetic 🚀";
    if (sleep >= 6 && energy >= 50) return "Balanced 😊";
    if (sleep < 5 && energy < 40) return "Exhausted 😫";
    if (sleep < 6) return "Tired 😴";
    return "Low Energy 🔋";
};

/**
 * Generates a 30-day simulation of energy levels assuming the user transitions
 * from their baseline habits to a new simulated set of habits.
 * 
 * Uses an adaptation curve where 80% of the habit's effect takes hold over the first 10 days.
 */
export const generateHabitSimulation = (
    baselineSleep: number,
    baselineSteps: number,
    simSleep: number,
    simSteps: number,
    days: number = 30
): ForecastPoint[] => {
    const forecast: ForecastPoint[] = [];
    const baselineEnergy = calculatePredictedEnergy(baselineSleep, baselineSteps);
    const targetEnergy = calculatePredictedEnergy(simSleep, simSteps);

    // The total difference in energy expected
    const totalDiff = targetEnergy - baselineEnergy;
    const noiseSeed = createDeterministicNoiseSeed(baselineSleep, baselineSteps, simSleep, simSteps);

    const today = new Date();

    for (let day = 1; day <= days; day++) {
        // Adaptation Curve logic (Logarithmic/Asymptotic growth)
        // Day 1 = small change. Day 10 = ~85% of change. Day 30 = ~95% of change.
        // Formula: 1 - Math.exp(-day * adaptationRate)
        const adaptationRate = 0.2;
        const adaptationFactor = 1 - Math.exp(-day * adaptationRate);

        // Keep the line organic without introducing render-to-render randomness.
        const noise = deterministicDailyNoise(day, noiseSeed);

        let projectedEnergy = baselineEnergy + (totalDiff * adaptationFactor) + noise;

        // Clamp to 0-100 bounds
        projectedEnergy = Math.max(0, Math.min(100, Math.round(projectedEnergy)));

        // Create date for the point
        const pointDate = new Date(today);
        pointDate.setDate(today.getDate() + day);

        // Calculate a "simulated sleep" for mood prediction on that day
        const currentSimSleep = baselineSleep + ((simSleep - baselineSleep) * adaptationFactor);

        forecast.push({
            day,
            date: pointDate,
            predictedEnergy: projectedEnergy,
            predictedMood: predictMoodState(currentSimSleep, projectedEnergy)
        });
    }

    return forecast;
};

/**
 * Generate a short insight string
 */
export const generatePredictionInsight = (
    currentEnergy: number,
    predictedEnergy: number,
    sleepDiff: number,
    stepsDiff: number
): string => {
    const diff = predictedEnergy - currentEnergy;

    if (diff > 5) {
        if (sleepDiff > 0 && stepsDiff > 0) {
            return `Great choice! More rest and movement could boost your energy by ${diff} points.`;
        }
        if (sleepDiff > 0) {
            return `That extra sleep is powerful! It's contributing significantly to a +${diff} energy boost.`;
        }
        return `Moving more is paying off! Your activity increase adds ${diff} points to your score.`;
    }

    if (diff < -5) {
        return `Careful! Reducing your healthy habits could drop your energy by ${Math.abs(diff)} points.`;
    }

    return "Maintaining your current habits keeps your energy stable.";
};
