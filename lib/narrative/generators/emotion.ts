import { NarrativeTemplate } from '../templates';

export const emotionTemplates: NarrativeTemplate[] = [
    // 1. Positive Mood & Improving
    {
        id: 'emotion-positive-improving',
        category: 'emotion',
        subCategory: 'improvement',
        condition: (data) => data.avg_emotion_score > 70 && data.emotion_trend === 'improving',
        template: (data, name) => `Your emotional well-being is flourishing, ${name}. We've noticed a lift in your spirits this week, with your mood scores trending upward. Embrace this positive momentum!`,
        weight: 1.5,
    },
    // 2. Consistently Positive
    {
        id: 'emotion-high-stable',
        category: 'emotion',
        subCategory: 'high',
        condition: (data) => data.avg_emotion_score > 75 && data.emotion_trend === 'stable',
        template: (data, name) => `You've maintained a great positive outlook this week. Your emotional stability is strong, averaging a score of ${data.avg_emotion_score}. Keep nurturing what makes you happy.`,
        weight: 1.0,
    },
    // 3. Mixed/Neutral Mood
    {
        id: 'emotion-neutral',
        category: 'emotion',
        subCategory: 'stable',
        condition: (data) => data.avg_emotion_score >= 45 && data.avg_emotion_score <= 70,
        template: (data, name) => `It's been a balanced week emotionally. You've had some ups and downs, averaging a score of ${data.avg_emotion_score}. Remember, feeling "okay" is perfectly normal and part of the journey.`,
        weight: 1.0,
    },
    // 4. Low Mood
    {
        id: 'emotion-low',
        category: 'emotion',
        subCategory: 'low',
        condition: (data) => data.avg_emotion_score < 45,
        template: (data, name) => `This week seems to have been emotionally challenging for you, ${name}. Your average score was ${data.avg_emotion_score}. Be gentle with yourself and prioritize self-care in the coming days.`,
        weight: 1.2,
    },
    // 5. Mood Variety Insight
    {
        id: 'emotion-variety',
        category: 'emotion',
        subCategory: 'insight',
        condition: (data) => data.most_common_mood !== 'okay' && data.total_entries > 3,
        template: (data, name) => `Your most frequent mood this week was "${data.most_common_mood}". Recognizing patterns like this is the first step to understanding your emotional landscape.`,
        weight: 0.8,
    },
];
