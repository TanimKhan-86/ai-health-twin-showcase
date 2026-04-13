/**
 * HealthTwin Wellness Engine — Rule-Based AI Fallback
 *
 * Analyses real health data and generates personalised, varied
 * wellness advice. Used as a fallback when the Gemini API is unavailable.
 *
 * Designed to be academically defensible as a "deterministic AI subsystem"
 * implementing threshold-based reasoning over multivariate health metrics.
 */

export interface HealthEntry {
    steps?: number;
    sleepHours?: number;
    waterLitres?: number;
    heartRate?: number;
    energyScore?: number;
}

export interface MoodEntry {
    mood?: string;
    energyLevel?: number;
    stressLevel?: number;
}

export interface WellnessAnalysis {
    narrative: string;
    tips: string[];
    predictedOutcome: string;
    disclaimer: string;
    fromCache?: boolean;
    fromFallback?: boolean;
}

// ─── Thresholds ────────────────────────────────────────────────────────────────
const THRESHOLDS = {
    steps: { great: 9000, good: 7000, low: 4000 },
    sleep: { great: 7.5, good: 6.5, low: 5.5 },
    water: { great: 2.0, good: 1.5, low: 1.0 },
    hr: { low: 60, normal: 100 },
    energy: { great: 75, good: 55, low: 35 },
    stress: { low: 3, high: 7 },
};

function avg(arr: number[]): number {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Narrative phrases keyed by performance level ──────────────────────────────
const STEP_PHRASES = {
    great: [
        'Your step count has been impressive — you\'re clearly keeping active throughout the day.',
        'You\'ve been crushing your movement goals with great step numbers this week.',
        'Your daily steps show you\'re making physical activity a real priority.',
    ],
    good: [
        'Your activity level has been solid — a bit more movement could take you to the next level.',
        'You\'re moving well, though there\'s room to push that step count a little higher.',
        'Decent activity this week — a short walk each evening would make a real difference.',
    ],
    low: [
        'Your step count has been lower than ideal — even small walks can have a big impact.',
        'Movement has been limited this week — try breaking up sitting time with short strolls.',
        'Your activity level is something to focus on — gentle, consistent movement is key.',
    ],
};

const SLEEP_PHRASES = {
    great: [
        'Your sleep has been excellent — consistent rest is one of the biggest factors in energy and focus.',
        'You\'ve been sleeping well, which sets a strong foundation for everything else.',
        'Great sleep pattern this week — your body is clearly getting the recovery it needs.',
    ],
    good: [
        'Your sleep is decent, though nudging it closer to 7–8 hours would noticeably boost your energy.',
        'Sleep has been okay but slightly under the ideal range — an earlier bedtime could help.',
        'You\'re getting reasonable sleep, though your energy could improve with just 30 more minutes per night.',
    ],
    low: [
        'Sleep has been your biggest challenge this week — this is likely affecting your mood and energy directly.',
        'Your sleep hours are below what your body needs to recover — this should be your top focus.',
        'Limited sleep this week — even a small improvement here will cascade into better energy and mood.',
    ],
};

const WATER_PHRASES = {
    great: ['Your hydration has been excellent — this supports everything from energy to focus.'],
    good: ['Hydration is reasonable but a bit low — try keeping a water bottle visible as a reminder.'],
    low: ['You\'ve been under-hydrating this week — even mild dehydration affects energy and concentration significantly.'],
};

// ─── Tips library keyed by metric and severity ────────────────────────────────
const TIPS: Record<string, string[]> = {
    sleep_low: [
        'Set a consistent bedtime alarm 30 minutes earlier than usual — consistency matters more than total hours initially.',
        'Avoid screens for 30 minutes before bed. Try reading or light stretching instead to wind down.',
        'Keep your bedroom cool and dark — temperature regulation significantly improves sleep depth.',
    ],
    sleep_good: [
        'Try to go to bed and wake at the same time every day, even on weekends, to lock in your sleep rhythm.',
        'A 10-minute wind-down routine (journaling, deep breathing) can improve your sleep quality noticeably.',
    ],
    steps_low: [
        'Add a 15-minute walk after meals — it\'s one of the easiest ways to increase your daily step count.',
        'Take the stairs instead of the lift and park further away — these micro-habits add up quickly.',
        'Set a reminder every 90 minutes to stand up and walk for 5 minutes — this alone can add 2,000+ steps.',
    ],
    steps_good: [
        'Challenge yourself with one longer walk per week — even 30 minutes makes a meaningful difference.',
        'Try a walking meeting or listening to podcasts while walking to make extra steps feel effortless.',
    ],
    water_low: [
        'Start each morning with a full glass of water before anything else — it kickstarts hydration for the day.',
        'Set phone reminders to drink water at 10am, 1pm, 4pm, and 7pm — this alone will significantly improve intake.',
        'Keep a visible 1-litre water bottle on your desk — visibility makes drinking it near-automatic.',
    ],
    water_good: [
        'Try adding a slice of lemon or cucumber to your water to make it more appealing and increase intake naturally.',
    ],
    stress_high: [
        'Spend 5 minutes on box breathing when stress peaks: inhale 4s, hold 4s, exhale 4s, hold 4s.',
        'Try a 10-minute mindfulness session before bed — apps like Headspace have free starter programmes.',
        'Schedule one "no-obligation" hour per day where you give yourself permission to fully relax.',
    ],
    energy_low: [
        'Eat a protein-rich breakfast within an hour of waking — this stabilises energy levels throughout the morning.',
        'Avoid caffeine after 2pm — it disrupts sleep quality even if you don\'t feel its effects at night.',
    ],
    general: [
        'Log your health data daily this week — the more data your Digital Twin has, the more accurate its insights become.',
        'Track your mood alongside your physical metrics — the pattern between them often reveals your biggest lever for improvement.',
        'Share your weekly analysis with a friend or accountability partner — social commitment doubles follow-through rates.',
    ],
};

function selectTips(
    avgSteps: number,
    avgSleep: number,
    avgWater: number,
    avgStress: number,
    avgEnergy: number
): string[] {
    const priorities: Array<{ key: string; priority: number }> = [];

    if (avgSleep < THRESHOLDS.sleep.low) priorities.push({ key: 'sleep_low', priority: 10 });
    else if (avgSleep < THRESHOLDS.sleep.good) priorities.push({ key: 'sleep_good', priority: 6 });

    if (avgSteps < THRESHOLDS.steps.low) priorities.push({ key: 'steps_low', priority: 9 });
    else if (avgSteps < THRESHOLDS.steps.good) priorities.push({ key: 'steps_good', priority: 5 });

    if (avgWater < THRESHOLDS.water.low) priorities.push({ key: 'water_low', priority: 8 });
    else if (avgWater < THRESHOLDS.water.good) priorities.push({ key: 'water_good', priority: 4 });

    if (avgStress > THRESHOLDS.stress.high) priorities.push({ key: 'stress_high', priority: 7 });
    if (avgEnergy < THRESHOLDS.energy.low) priorities.push({ key: 'energy_low', priority: 6 });

    // Sort by priority, take top 3 unique categories
    priorities.sort((a, b) => b.priority - a.priority);

    const tips: string[] = [];
    const usedKeys = new Set<string>();

    for (const p of priorities) {
        if (tips.length >= 3) break;
        if (!usedKeys.has(p.key)) {
            usedKeys.add(p.key);
            const options = TIPS[p.key];
            if (options) tips.push(pick(options));
        }
    }

    // Fill remaining slots with general tips
    const generalPool = [...TIPS['general']];
    while (tips.length < 3 && generalPool.length > 0) {
        const idx = Math.floor(Math.random() * generalPool.length);
        tips.push(generalPool.splice(idx, 1)[0]);
    }

    return tips.slice(0, 3);
}

const OUTCOMES = {
    sleep_focus: [
        'In two weeks of better sleep, you\'re likely to feel noticeably sharper, more patient, and more motivated throughout the day.',
        'With consistent sleep improvements, expect to wake up feeling genuinely rested within 10–14 days.',
    ],
    active_focus: [
        'With just 2 more weeks of regular movement, your energy levels typically rise and afternoon slumps become much less common.',
        'In two weeks of consistent activity, most people report better mood, less stiffness, and more natural daytime energy.',
    ],
    hydration_focus: [
        'Better hydration usually shows results within a week — clearer thinking, better energy, and improved mood are common first effects.',
    ],
    general: [
        'Following these habits for just two weeks can noticeably shift how you feel each morning — more energy, better focus, and a stronger sense of wellbeing.',
        'In two weeks of applying even one of these tips consistently, most people feel a meaningful positive shift in their daily energy and mood.',
        'Small consistent changes compound quickly — two weeks from now, you\'ll likely notice real differences in your energy and focus.',
    ],
};

function selectOutcome(weakestMetric: string): string {
    if (weakestMetric === 'sleep') return pick(OUTCOMES.sleep_focus);
    if (weakestMetric === 'steps') return pick(OUTCOMES.active_focus);
    if (weakestMetric === 'water') return pick(OUTCOMES.hydration_focus);
    return pick(OUTCOMES.general);
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function generateWellnessAnalysis(
    healthData: HealthEntry[],
    moodData: MoodEntry[]
): WellnessAnalysis {
    // Compute averages
    const aSteps = avg(healthData.map(e => e.steps || 0));
    const aSleep = avg(healthData.map(e => e.sleepHours || 0));
    const aWater = avg(healthData.map(e => e.waterLitres || 0));
    const aHR = avg(healthData.map(e => e.heartRate || 72));
    const aEnergy = avg(moodData.map(e => e.energyLevel || 5)) * 10; // normalise to 0-100
    const aStress = avg(moodData.map(e => e.stressLevel || 5));
    const daysLogged = healthData.length;

    // ── Build narrative ─────────────────────────────────────────────────────────
    const stepPhrase = aSteps >= THRESHOLDS.steps.great ? pick(STEP_PHRASES.great) : aSteps >= THRESHOLDS.steps.good ? pick(STEP_PHRASES.good) : pick(STEP_PHRASES.low);
    const sleepPhrase = aSleep >= THRESHOLDS.sleep.great ? pick(SLEEP_PHRASES.great) : aSleep >= THRESHOLDS.sleep.good ? pick(SLEEP_PHRASES.good) : pick(SLEEP_PHRASES.low);
    const waterPhrase = aWater >= THRESHOLDS.water.great ? pick(WATER_PHRASES.great) : aWater >= THRESHOLDS.water.good ? pick(WATER_PHRASES.good) : pick(WATER_PHRASES.low);

    const loggingNote = daysLogged >= 6
        ? 'You\'ve done a great job logging consistently — your Digital Twin has a clear picture of your week.'
        : daysLogged >= 4
            ? `You logged ${daysLogged} out of 7 days — good effort, though daily logging would give even sharper insights.`
            : `You logged ${daysLogged} day(s) this week — try to log daily so your Twin can track patterns more accurately.`;

    const narrative = `${sleepPhrase} ${stepPhrase} ${loggingNote}`;

    // ── Find weakest metric for outcome selection ───────────────────────────────
    const scores: Record<string, number> = {
        sleep: aSleep / THRESHOLDS.sleep.great,
        steps: aSteps / THRESHOLDS.steps.great,
        water: aWater / THRESHOLDS.water.great,
    };
    const weakestMetric = Object.entries(scores).sort((a, b) => a[1] - b[1])[0][0];

    return {
        narrative,
        tips: selectTips(aSteps, aSleep, aWater, aStress, aEnergy),
        predictedOutcome: selectOutcome(weakestMetric),
        disclaimer: '⚠️ This is general wellness guidance only and is not medical advice. Please consult a healthcare professional for medical concerns.',
        fromFallback: true,
    };
}
