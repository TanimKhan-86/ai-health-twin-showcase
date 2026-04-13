import { NarrativeTemplate } from '../templates';

export const correlationTemplates: NarrativeTemplate[] = [
    // 1. Strong Sleep-Mood Correlation (Positive)
    {
        id: 'corr-sleep-mood-strong',
        category: 'correlation',
        subCategory: 'insight',
        condition: (data) => data.sleep_mood_correlation.includes('strongly improves'),
        template: (data, name) => `Here's a key insight, ${name}: There is a strong link between your sleep and your happiness. On days you slept well, your mood soared. Prioritizing rest is your secret weapon!`,
        weight: 2.0, // High priority
    },
    // 2. Moderate Sleep-Mood Correlation
    {
        id: 'corr-sleep-mood-moderate',
        category: 'correlation',
        subCategory: 'insight',
        condition: (data) => data.sleep_mood_correlation.includes('tends to improve'),
        template: (data, name) => `We noticed that better sleep often leads to better days for you. It's not a perfect rule, but getting those extra Zzz's definitely seems to help your mood.`,
        weight: 1.5,
    },
    // 3. Weekly Summary - High Activity
    {
        id: 'summary-active',
        category: 'summary',
        subCategory: 'high',
        condition: (data) => data.avg_steps > 8000,
        template: (data, name) => `You were really moving this week! Averaging ${data.avg_steps} steps a day is a fantastic achievement. Your body thanks you for the activity.`,
        weight: 1.0,
    },
    // 4. Weekly Summary - Sleep Focus Needed
    {
        id: 'summary-sleep-low',
        category: 'summary',
        subCategory: 'low',
        condition: (data) => data.avg_sleep < 6,
        template: (data, name) => `Rest was a bit elusive this week, with an average of only ${data.avg_sleep} hours per night. Trying to get to bed 30 minutes earlier might make a big difference next week.`,
        weight: 1.2,
    },
    // 5. Weekly Summary - Balanced
    {
        id: 'summary-balanced',
        category: 'summary',
        subCategory: 'stable',
        condition: (data) => data.avg_sleep >= 6 && data.avg_steps >= 5000,
        template: (data, name) => `A solid week in the books, ${name}. You managed a healthy balance of rest (${data.avg_sleep} hrs) and activity (${data.avg_steps} steps). Keep finding that sweet spot!`,
        weight: 0.8,
    },
];
