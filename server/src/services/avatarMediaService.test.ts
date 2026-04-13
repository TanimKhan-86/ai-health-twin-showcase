import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseAvatarState } from './avatarMediaService';

test('chooseAvatarState returns sleepy for very low sleep', () => {
    const result = chooseAvatarState(
        { sleepHours: 3.5, steps: 2000, energyScore: 35 },
        { mood: 'tired', energyLevel: 3, stressLevel: 5 },
        ['happy', 'sad', 'sleepy', 'tired']
    );
    assert.equal(result.state, 'sleepy');
});

test('chooseAvatarState returns happy on strong positive signals', () => {
    const result = chooseAvatarState(
        { sleepHours: 8, steps: 9000, waterLitres: 2.3, energyScore: 82 },
        { mood: 'happy', energyLevel: 8, stressLevel: 2 },
        ['happy', 'sad', 'sleepy']
    );
    assert.equal(result.state, 'happy');
});

test('chooseAvatarState returns calm for balanced low-stress metrics', () => {
    const result = chooseAvatarState(
        { sleepHours: 6.7, steps: 6200, waterLitres: 1.8, energyScore: 62 },
        { mood: 'calm', energyLevel: 6, stressLevel: 2 },
        ['happy', 'sad', 'sleepy', 'calm']
    );
    assert.equal(result.state, 'calm');
});

test('chooseAvatarState prioritizes calm over happy for calm mood patterns', () => {
    const result = chooseAvatarState(
        { sleepHours: 7.1, steps: 8400, waterLitres: 2.1, energyScore: 72 },
        { mood: 'calm', energyLevel: 7, stressLevel: 2 },
        ['happy', 'sad', 'sleepy', 'calm']
    );
    assert.equal(result.state, 'calm');
});
