export type ScenarioAvatarState = 'happy' | 'sad' | 'sleepy' | 'calm';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type ScenarioSlot = 'A' | 'B';

export interface ScenarioStateDecision {
    state: ScenarioAvatarState;
    ruleName: string;
    ruleExpression: string;
    matchedBecause: string;
}

export interface SavedScenario {
    sleep: number;
    steps: number;
    energy: number;
    mood: string;
    avatarState: ScenarioAvatarState;
    confidence: ConfidenceLevel;
    savedAtLabel: string;
}

export interface FeasibilityAssessment {
    confidence: ConfidenceLevel;
    warnings: string[];
    isUnrealistic: boolean;
}

export interface DataConfidenceAssessment {
    confidence: ConfidenceLevel;
    loggedDays: number;
    totalDays: number;
    note: string;
}

export const SCENARIO_STATES: ScenarioAvatarState[] = ['happy', 'sad', 'sleepy', 'calm'];

export const AVATAR_STATE_META: Record<ScenarioAvatarState, { label: string; emoji: string }> = {
    happy: { label: 'Happy', emoji: '😄' },
    sad: { label: 'Sad', emoji: '😔' },
    sleepy: { label: 'Sleepy', emoji: '😴' },
    calm: { label: 'Calm', emoji: '😌' },
};

export const CONFIDENCE_META: Record<ConfidenceLevel, { label: string; color: string; bg: string; border: string }> = {
    high: { label: 'High', color: '#047857', bg: '#ecfdf5', border: '#6ee7b7' },
    medium: { label: 'Medium', color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
    low: { label: 'Low', color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' },
};

export function inferSimulationAvatarDecision(simSleep: number, predictedEnergy: number): ScenarioStateDecision {
    if (simSleep <= 4.5) {
        return {
            state: 'sleepy',
            ruleName: 'Rule A',
            ruleExpression: 'if sleep <= 4.5h -> sleepy',
            matchedBecause: `sleep=${simSleep.toFixed(1)}h`,
        };
    }

    if (simSleep <= 5.5 && predictedEnergy < 55) {
        return {
            state: 'sleepy',
            ruleName: 'Rule B',
            ruleExpression: 'if sleep <= 5.5h and predictedEnergy < 55 -> sleepy',
            matchedBecause: `sleep=${simSleep.toFixed(1)}h and energy=${predictedEnergy}`,
        };
    }

    if (simSleep >= 7.5 && predictedEnergy >= 80) {
        return {
            state: 'happy',
            ruleName: 'Rule C',
            ruleExpression: 'if sleep >= 7.5h and predictedEnergy >= 80 -> happy',
            matchedBecause: `sleep=${simSleep.toFixed(1)}h and energy=${predictedEnergy}`,
        };
    }

    if (simSleep >= 6 && predictedEnergy >= 55) {
        return {
            state: 'calm',
            ruleName: 'Rule D',
            ruleExpression: 'if sleep >= 6h and predictedEnergy >= 55 -> calm',
            matchedBecause: `sleep=${simSleep.toFixed(1)}h and energy=${predictedEnergy}`,
        };
    }

    return {
        state: 'sad',
        ruleName: 'Rule E',
        ruleExpression: 'otherwise -> sad',
        matchedBecause: `sleep=${simSleep.toFixed(1)}h and energy=${predictedEnergy}`,
    };
}

export function normalizeStateVideos(raw?: Record<string, string> | null): Partial<Record<ScenarioAvatarState, string>> {
    if (!raw) return {};
    return {
        happy: typeof raw.happy === 'string' ? raw.happy : undefined,
        sad: typeof raw.sad === 'string' ? raw.sad : undefined,
        sleepy: typeof raw.sleepy === 'string' ? raw.sleepy : undefined,
        calm: typeof raw.calm === 'string' ? raw.calm : undefined,
    };
}

export function hasAllScenarioStates(videoByState: Partial<Record<ScenarioAvatarState, string>>): boolean {
    return SCENARIO_STATES.every((state) => typeof videoByState[state] === 'string' && !!videoByState[state]);
}

export function assessScenarioFeasibility(
    simSleep: number,
    simSteps: number,
    baselineSleep: number,
    baselineSteps: number
): FeasibilityAssessment {
    let risk = 0;
    const warnings: string[] = [];

    if (simSleep < 4) {
        risk += 3;
        warnings.push(`Sleep at ${simSleep.toFixed(1)}h is likely unsustainable for daily planning.`);
    } else if (simSleep < 5) {
        risk += 1;
        warnings.push(`Very low sleep (${simSleep.toFixed(1)}h) may reduce forecast reliability.`);
    }

    if (simSleep > 10) {
        risk += 3;
        warnings.push(`Sleep at ${simSleep.toFixed(1)}h is unusually high for a long-term routine.`);
    } else if (simSleep > 9) {
        risk += 1;
        warnings.push(`High sleep (${simSleep.toFixed(1)}h) is less common in day-to-day patterns.`);
    }

    if (simSteps < 1000) {
        risk += 1;
        warnings.push(`Very low steps (${simSteps.toLocaleString()}) may represent an outlier day.`);
    }

    if (simSteps > 18000) {
        risk += 2;
        warnings.push(`Very high steps (${simSteps.toLocaleString()}) can be hard to maintain daily.`);
    }

    if (Math.abs(simSleep - baselineSleep) >= 3) {
        risk += 2;
        warnings.push(`Sleep change is large vs baseline (${(simSleep - baselineSleep).toFixed(1)}h).`);
    }

    if (Math.abs(simSteps - baselineSteps) >= 9000) {
        risk += 1;
        warnings.push(`Step change is large vs baseline (${(simSteps - baselineSteps).toLocaleString()}).`);
    }

    if (simSleep >= 10 && simSteps >= 16000) {
        risk += 2;
        warnings.push('Combining very high sleep with very high steps is likely unrealistic.');
    }

    if (simSleep <= 4.5 && simSteps >= 16000) {
        risk += 2;
        warnings.push('Low sleep with very high activity is an extreme combination.');
    }

    if (risk >= 6) {
        return { confidence: 'low', warnings, isUnrealistic: true };
    }
    if (risk >= 3) {
        return { confidence: 'medium', warnings, isUnrealistic: false };
    }
    return { confidence: 'high', warnings, isUnrealistic: false };
}

function confidenceRank(confidence: ConfidenceLevel): number {
    if (confidence === 'high') return 3;
    if (confidence === 'medium') return 2;
    return 1;
}

export function lowerConfidence(a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel {
    return confidenceRank(a) <= confidenceRank(b) ? a : b;
}

export function assessDataConfidence(loggedDays: number, totalDays: number = 7): DataConfidenceAssessment {
    const safeLogged = Math.max(0, Math.min(totalDays, loggedDays));
    if (safeLogged <= 2) {
        return {
            confidence: 'low',
            loggedDays: safeLogged,
            totalDays,
            note: `Only ${safeLogged}/${totalDays} recent logs found. Forecast is tentative.`,
        };
    }
    if (safeLogged <= 4) {
        return {
            confidence: 'medium',
            loggedDays: safeLogged,
            totalDays,
            note: `Partial history (${safeLogged}/${totalDays} logs). Use forecast directionally.`,
        };
    }
    return {
        confidence: 'high',
        loggedDays: safeLogged,
        totalDays,
        note: `Good recent coverage (${safeLogged}/${totalDays} logs).`,
    };
}
