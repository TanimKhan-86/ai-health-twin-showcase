import { NarrativeTemplate } from '../templates';

export const energyTemplates: NarrativeTemplate[] = [
    // 1. High Energy & Improving Trend
    {
        id: 'energy-high-improving',
        category: 'energy',
        subCategory: 'improvement',
        condition: (data) => data.avg_energy_score > 75 && data.energy_trend === 'improving',
        template: (data, name) => `You've been on fire this week, ${name}! Your energy levels are soaring, averaging a fantastic ${data.avg_energy_score}. It's clear that your consistent habits are paying off.`,
        weight: 1.5,
    },
    // 2. High Energy & Stable
    {
        id: 'energy-high-stable',
        category: 'energy',
        subCategory: 'high',
        condition: (data) => data.avg_energy_score > 75 && data.energy_trend === 'stable',
        template: (data, name) => `Another solid week of high energy! You maintained an impressive average of ${data.avg_energy_score}. Consistency is key, and you've mastered it.`,
        weight: 1.0,
    },
    // 3. Moderate Energy
    {
        id: 'energy-moderate',
        category: 'energy',
        subCategory: 'stable',
        condition: (data) => data.avg_energy_score >= 50 && data.avg_energy_score <= 75,
        template: (data, name) => `Your energy was steady this week, averaging ${data.avg_energy_score}. You're doing well, but there might be room to boost those levels with a bit more sleep or movement.`,
        weight: 1.0,
    },
    // 4. Low Energy & Declining
    {
        id: 'energy-low-declining',
        category: 'energy',
        subCategory: 'decline',
        condition: (data) => data.avg_energy_score < 50 && data.energy_trend === 'declining',
        template: (data, name) => `It looks like your energy took a dip this week, ${name}. With an average score of ${data.avg_energy_score}, you might be feeling a bit drained. Let's focus on recharging next week.`,
        weight: 1.2,
    },
    // 5. Low Energy but Improving
    {
        id: 'energy-low-improving',
        category: 'energy',
        subCategory: 'improvement',
        condition: (data) => data.avg_energy_score < 50 && data.energy_trend === 'improving',
        template: (data, name) => `Even though your energy is lower than ideal (${data.avg_energy_score}), you're trending in the right direction! Small steps lead to big changes. Keep it up!`,
        weight: 1.5,
    },
    // 6. Best Day Highlight
    {
        id: 'energy-best-day',
        category: 'energy',
        subCategory: 'high',
        condition: (data) => !!data.best_energy_day && data.best_energy_day.score > 80,
        template: (data, name) => `You had a standout day on ${data.best_energy_day?.date}! Your energy peaked at ${data.best_energy_day?.score}. Think back to what you did differently that day—it clearly worked for you.`,
        weight: 0.8,
    },
];
