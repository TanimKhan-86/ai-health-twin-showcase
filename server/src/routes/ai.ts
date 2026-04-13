import { Router, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import WeeklyAnalysisCache from '../models/WeeklyAnalysisCache';
import { generateWellnessAnalysis, WellnessAnalysis } from '../lib/wellnessEngine';
import { sendError, sendSuccess } from '../lib/apiResponse';
import { parseBody } from '../lib/validation';

const router = Router();
router.use(authenticate);

const healthDataPointSchema = z.object({
    steps: z.coerce.number().min(0).optional(),
    sleepHours: z.coerce.number().min(0).max(24).optional(),
    waterLitres: z.coerce.number().min(0).max(20).optional(),
    heartRate: z.coerce.number().min(0).max(260).optional(),
    energyScore: z.coerce.number().min(0).max(100).optional(),
    date: z.union([z.string(), z.date()]).optional(),
});

const moodDataPointSchema = z.object({
    mood: z.string().trim().min(1).optional(),
    energyLevel: z.coerce.number().min(1).max(10).optional(),
    stressLevel: z.coerce.number().min(1).max(10).optional(),
    date: z.union([z.string(), z.date()]).optional(),
});

const weeklyAnalysisRequestSchema = z.object({
    healthData: z.array(healthDataPointSchema).min(1, 'No health data provided. Please log some data first.'),
    moodData: z.array(moodDataPointSchema).default([]),
});

type WeeklyAnalysisRequest = z.infer<typeof weeklyAnalysisRequestSchema>;

interface LlmAnalysisPayload {
    narrative?: string;
    tips?: string[];
    predictedOutcome?: string;
    disclaimer?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeParsedResponse(value: unknown): WellnessAnalysis {
    if (isObject(value)) {
        const narrative = typeof value.narrative === 'string' && value.narrative.trim().length > 0
            ? value.narrative
            : 'You logged data this week and showed consistency. Keep tracking daily to strengthen your Digital Twin insights.';
        const tips = Array.isArray(value.tips)
            ? value.tips.filter((item): item is string => typeof item === 'string')
            : ['Log your health data daily for more personalised tips.'];
        const predictedOutcome = typeof value.predictedOutcome === 'string' && value.predictedOutcome.trim().length > 0
            ? value.predictedOutcome
            : 'With consistent tracking, you will start seeing meaningful patterns in your health.';
        const disclaimer = typeof value.disclaimer === 'string' && value.disclaimer.trim().length > 0
            ? value.disclaimer
            : '⚠️ This is general wellness guidance only and is not medical advice. Please consult a healthcare professional for medical concerns.';

        return { narrative, tips, predictedOutcome, disclaimer };
    }

    return {
        narrative: 'Your data could not be parsed into a full AI summary.',
        tips: ['Log your health data daily for more personalised tips.'],
        predictedOutcome: 'With consistent tracking, you will start seeing meaningful patterns in your health.',
        disclaimer: '⚠️ This is general wellness guidance only and is not medical advice. Please consult a healthcare professional for medical concerns.',
    };
}

// Returns "YYYY-WW" — year + ISO week number
function getWeekKey(date: Date = new Date()): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

const SYSTEM_PROMPT = `You are a wellness coach AI assistant for a student health tracking app called HealthTwin.
Your ONLY role is to give friendly, general lifestyle and habit suggestions based on tracked data (steps, sleep, water intake, heart rate, mood, energy, stress levels).

STRICT RULES — follow these without exception:
1. DO NOT diagnose any medical condition
2. DO NOT prescribe any medication or treatment
3. DO NOT make specific clinical health claims (e.g. "this increases your risk of X disease")
4. DO NOT replace professional medical advice
5. ONLY reference widely accepted general wellness principles (sleep 7-9hrs, 8000+ steps/day, hydration, stress management)
6. Frame everything as personal observations from their tracked data
7. Be encouraging, positive and motivational in tone
8. Keep the total response concise and practical`;

router.post('/weekly-analysis', async (req: AuthRequest, res: Response): Promise<void> => {
    const input = parseBody(res, weeklyAnalysisRequestSchema, req.body);
    if (!input) return;

    const userId = req.userId;
    if (!userId) {
        sendError(res, 401, 'Unauthorized');
        return;
    }

    const weekKey = getWeekKey();

    try {
        const cached = await WeeklyAnalysisCache.findOne({ userId, weekKey });
        if (cached) {
            sendSuccess(res, {
                narrative: cached.narrative,
                tips: cached.tips,
                predictedOutcome: cached.predictedOutcome,
                disclaimer: cached.disclaimer,
                fromCache: true,
                cacheWeek: weekKey,
                generatedAt: cached.createdAt.toISOString(),
            });
            return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('Gemini API key not configured');
        }

        const avgSteps = Math.round(
            input.healthData.reduce((sum, entry) => sum + (entry.steps ?? 0), 0) / input.healthData.length
        );
        const avgSleep = (
            input.healthData.reduce((sum, entry) => sum + (entry.sleepHours ?? 0), 0) / input.healthData.length
        ).toFixed(1);
        const avgWater = (
            input.healthData.reduce((sum, entry) => sum + (entry.waterLitres ?? 0), 0) / input.healthData.length
        ).toFixed(1);
        const avgHR = Math.round(
            input.healthData.reduce((sum, entry) => sum + (entry.heartRate ?? 0), 0) / input.healthData.length
        );

        const moodSummary = input.moodData.length > 0
            ? `Mood entries: ${input.moodData.map((entry) => `${entry.mood ?? 'unknown'} (energy: ${entry.energyLevel ?? 0}/10, stress: ${entry.stressLevel ?? 0}/10)`).join(', ')}`
            : 'No mood data logged this week.';

        const userPrompt = `Here is the user's health tracking data for the past ${input.healthData.length} day(s):

HEALTH METRICS:
- Average daily steps: ${avgSteps.toLocaleString()}
- Average sleep: ${avgSleep} hours/night
- Average water intake: ${avgWater} litres/day
- Average heart rate: ${avgHR} BPM
- Days logged: ${input.healthData.length} out of 7

MOOD & ENERGY:
${moodSummary}

Please provide:
1. NARRATIVE: A warm, personal 2-3 sentence summary of their week based on this data
2. TIPS: Exactly 3 specific, actionable wellness tips tailored to their data
3. OUTCOME: One motivational sentence describing what they could feel like in 2 weeks if they follow the tips

Format your response as JSON with this exact structure:
{
  "narrative": "...",
  "tips": ["tip1", "tip2", "tip3"],
  "predictedOutcome": "...",
  "disclaimer": "⚠️ This is general wellness guidance only and is not medical advice. Please consult a healthcare professional for medical concerns."
}`;

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: SYSTEM_PROMPT,
        });

        const result = await model.generateContent(userPrompt);
        const text = result.response.text();
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        let llmParsed: LlmAnalysisPayload;
        try {
            llmParsed = JSON.parse(cleaned) as LlmAnalysisPayload;
        } catch {
            llmParsed = {
                narrative: text,
                tips: ['Log your health data daily for more personalised tips.'],
                predictedOutcome: 'With consistent tracking, you will start seeing meaningful patterns in your health.',
                disclaimer: '⚠️ This is general wellness guidance only and is not medical advice. Please consult a healthcare professional for medical concerns.',
            };
        }

        const normalized = normalizeParsedResponse(llmParsed);

        const generatedAt = new Date();
        await WeeklyAnalysisCache.findOneAndUpdate(
            { userId, weekKey },
            {
                userId,
                weekKey,
                narrative: normalized.narrative,
                tips: normalized.tips,
                predictedOutcome: normalized.predictedOutcome,
                disclaimer: normalized.disclaimer,
                createdAt: generatedAt,
            },
            { upsert: true, new: true }
        );

        sendSuccess(res, { ...normalized, fromCache: false, cacheWeek: weekKey, generatedAt: generatedAt.toISOString() });
    } catch (error: unknown) {
        console.warn('[AI] Gemini unavailable — activating rule-based fallback');

        try {
            const fallback = generateWellnessAnalysis(input.healthData, input.moodData);
            const generatedAt = new Date();
            await WeeklyAnalysisCache.findOneAndUpdate(
                { userId, weekKey },
                { userId, weekKey, ...fallback, createdAt: generatedAt },
                { upsert: true, new: true }
            ).catch(() => undefined);

            sendSuccess(res, { ...fallback, fromFallback: true, fromCache: false, cacheWeek: weekKey, generatedAt: generatedAt.toISOString() });
        } catch {
            sendError(res, 500, 'Could not generate your analysis. Please try again.');
        }
    }
});

// DELETE /api/ai/weekly-analysis/cache — force refresh (regenerate this week)
router.delete('/weekly-analysis/cache', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

        const weekKey = getWeekKey();
        await WeeklyAnalysisCache.deleteOne({ userId, weekKey });
        sendSuccess(res, { message: 'Cache cleared — next request will regenerate from Gemini' });
    } catch {
        sendError(res, 500, 'Failed to clear cache');
    }
});

export default router;
