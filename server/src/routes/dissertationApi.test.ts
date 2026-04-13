import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { computeAvatarFingerprint } from '../services/avatarMediaService';
import User from '../models/User';
import HealthEntry from '../models/HealthEntry';
import MoodEntry from '../models/MoodEntry';
import { Avatar } from '../models/Avatar';
import { AvatarAnimation } from '../models/AvatarAnimation';

const TEST_DATE = '2026-04-07';
const TEST_DATE_ISO = `${TEST_DATE}T00:00:00.000Z`;
const RUN_ID = `dissertation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let baseUrl = '';
let server: http.Server | null = null;

interface JsonResponse<T = unknown> {
    status: number;
    body: T;
}

interface AuthSessionResponse {
    success: boolean;
    data: {
        token: string;
        user: {
            id: string;
            email: string;
        };
    };
}

interface TestUser {
    userId: string;
    email: string;
    token: string;
}

function getEnvPath(): string {
    return path.resolve(__dirname, '../../.env');
}

function buildHappyDailyLog() {
    return {
        date: TEST_DATE,
        steps: 10000,
        activeMinutes: 45,
        sleepHours: 8,
        waterLitres: 2.4,
        heartRate: 68,
        energyScore: 84,
        healthNotes: 'Dissertation test health entry',
        mood: 'happy',
        energyLevel: 8,
        stressLevel: 2,
        moodNotes: 'Dissertation test mood entry',
    };
}

async function closeServer(currentServer: http.Server): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        currentServer.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

async function cleanupRunData(): Promise<void> {
    const users = await User.find({
        email: { $regex: RUN_ID, $options: 'i' },
    }).select('_id');
    const userIds = users.map((user) => user._id);
    if (userIds.length === 0) {
        return;
    }

    await Promise.all([
        HealthEntry.deleteMany({ userId: { $in: userIds } }),
        MoodEntry.deleteMany({ userId: { $in: userIds } }),
        Avatar.deleteMany({ userId: { $in: userIds } }),
        AvatarAnimation.deleteMany({ userId: { $in: userIds } }),
        User.deleteMany({ _id: { $in: userIds } }),
    ]);
}

async function requestJson<T = unknown>(
    pathname: string,
    options: {
        method?: string;
        token?: string;
        body?: unknown;
    } = {}
): Promise<JsonResponse<T>> {
    assert.ok(baseUrl, 'Test server base URL is not initialized');

    const headers: Record<string, string> = {};
    if (options.token) {
        headers.authorization = `Bearer ${options.token}`;
    }
    if (options.body !== undefined) {
        headers['content-type'] = 'application/json';
    }

    const response = await fetch(`${baseUrl}${pathname}`, {
        method: options.method || 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const body = await response.json() as T;
    return {
        status: response.status,
        body,
    };
}

async function registerUser(label: string): Promise<TestUser> {
    const email = `${label}.${RUN_ID}@example.test`;
    const response = await requestJson<AuthSessionResponse>('/api/auth/register', {
        method: 'POST',
        body: {
            name: `Dissertation ${label}`,
            email,
            password: 'HealthTwinPass123',
        },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);

    return {
        userId: response.body.data.user.id,
        email,
        token: response.body.data.token,
    };
}

async function submitDailyLog(token: string) {
    const response = await requestJson<{
        success: boolean;
        data: {
            date: string;
            health: {
                source: string;
                steps: number;
                energyScore: number;
            };
            mood: {
                source: string;
                mood: string;
                energyLevel: number;
                stressLevel: number;
            };
        };
    }>('/api/daily-log', {
        method: 'POST',
        token,
        body: buildHappyDailyLog(),
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    return response;
}

async function seedAvatarStateFixture(userId: string): Promise<{
    avatarUrl: string;
    videoUrl: string;
    avatarFingerprint: string;
}> {
    const avatarUrl = `https://example.com/${RUN_ID}/${userId}/avatar.png`;
    const videoUrl = `https://example.com/${RUN_ID}/${userId}/happy.mp4`;
    const avatarFingerprint = computeAvatarFingerprint(avatarUrl);

    await Avatar.create({
        userId,
        avatarImageUrl: avatarUrl,
        generationMetadata: {
            provider: 'prebuilt_test',
            avatarFingerprint,
        },
    });
    await AvatarAnimation.create({
        userId,
        stateType: 'happy',
        videoUrl,
        generationMetadata: {
            provider: 'prebuilt_test',
            avatarFingerprint,
        },
    });

    return { avatarUrl, videoUrl, avatarFingerprint };
}

async function seedBrokenAvatarFixture(userId: string): Promise<{ avatarUrl: string }> {
    const avatarUrl = `https://example.com/${RUN_ID}/${userId}/fallback-avatar.png`;

    await Avatar.create({
        userId,
        avatarImageUrl: avatarUrl,
    });
    await AvatarAnimation.create({
        userId,
        stateType: 'happy',
        videoUrl: `https://example.com/${RUN_ID}/${userId}/invalid-happy.mp4`,
        generationMetadata: 'invalid-metadata-shape',
    });

    return { avatarUrl };
}

before(async () => {
    dotenv.config({ path: getEnvPath() });
    assert.ok(process.env.MONGODB_URI, 'MONGODB_URI must be configured in server/.env');
    assert.ok(process.env.JWT_SECRET, 'JWT_SECRET must be configured in server/.env');

    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI as string);
    }
    await mongoose.connection.asPromise();
    await cleanupRunData();

    const [
        { default: authRoutes },
        { default: healthRoutes },
        { default: moodRoutes },
        { default: dailyLogRoutes },
        { default: avatarRoutes },
        { default: seedRoutes },
    ] = await Promise.all([
        import('./auth'),
        import('./health'),
        import('./mood'),
        import('./dailyLog'),
        import('./avatar'),
        import('./seed'),
    ]);

    const app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
    app.use('/api/auth', authRoutes);
    app.use('/api/health', healthRoutes);
    app.use('/api/mood', moodRoutes);
    app.use('/api/daily-log', dailyLogRoutes);
    app.use('/api/avatar', avatarRoutes);
    app.use('/api/seed', seedRoutes);

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();
    assert.ok(address && typeof address === 'object' && 'port' in address, 'Server address not available');
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    await cleanupRunData();
    if (server) {
        await closeServer(server);
        server = null;
    }
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
});

test('protected routes reject requests without a bearer token', async () => {
    const response = await requestJson<{
        success: boolean;
        error: string;
    }>('/api/daily-log', {
        method: 'POST',
        body: buildHappyDailyLog(),
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
    assert.equal(response.body.error, 'Unauthorized — no token provided');
});

test('daily log rejects payloads with a missing required field', async () => {
    const user = await registerUser('missing-mood');
    const response = await requestJson<{
        success: boolean;
        error: string;
        details?: Array<{ field: string; message: string }>;
    }>('/api/daily-log', {
        method: 'POST',
        token: user.token,
        body: {
            date: TEST_DATE,
            steps: 7200,
            energyLevel: 7,
            stressLevel: 3,
        },
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.error, 'Invalid request body');
    assert.ok(response.body.details?.some((detail) => detail.field === 'mood'));
});

test('valid daily log submission persists matching health and mood records', async () => {
    const user = await registerUser('valid-log');
    const response = await submitDailyLog(user.token);

    assert.equal(response.body.data.date, TEST_DATE);
    assert.equal(response.body.data.health.source, 'daily_log');
    assert.equal(response.body.data.health.steps, 10000);
    assert.equal(response.body.data.mood.source, 'daily_log');
    assert.equal(response.body.data.mood.mood, 'happy');

    const [health, mood] = await Promise.all([
        HealthEntry.findOne({ userId: user.userId, date: new Date(TEST_DATE_ISO) }).lean(),
        MoodEntry.findOne({ userId: user.userId, date: new Date(TEST_DATE_ISO) }).lean(),
    ]);

    assert.ok(health);
    assert.ok(mood);
    assert.equal(health.steps, 10000);
    assert.equal(health.source, 'daily_log');
    assert.equal(mood.mood, 'happy');
    assert.equal(mood.energyLevel, 8);
    assert.equal(mood.source, 'daily_log');
});

test('avatar state can be retrieved after a valid daily log', async () => {
    const user = await registerUser('avatar-state');
    await submitDailyLog(user.token);
    const fixture = await seedAvatarStateFixture(user.userId);

    const response = await requestJson<{
        success: boolean;
        data: {
            state: string;
            videoUrl: string | null;
            imageUrl: string | null;
            reasoning: string;
            availableStates: string[];
        };
    }>(`/api/avatar/state?date=${TEST_DATE}&includeMedia=true`, {
        token: user.token,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.state, 'happy');
    assert.equal(response.body.data.videoUrl, fixture.videoUrl);
    assert.equal(response.body.data.imageUrl, fixture.avatarUrl);
    assert.deepEqual(response.body.data.availableStates, ['happy']);
    assert.match(response.body.data.reasoning, /Strong positive daily metrics/);
});

test('replaying the same avatar-state scenario is deterministic', async () => {
    const user = await registerUser('replay');
    await submitDailyLog(user.token);
    await seedAvatarStateFixture(user.userId);

    const first = await requestJson<{
        success: boolean;
        data: Record<string, unknown>;
    }>(`/api/avatar/state?date=${TEST_DATE}&includeMedia=true`, {
        token: user.token,
    });
    const second = await requestJson<{
        success: boolean;
        data: Record<string, unknown>;
    }>(`/api/avatar/state?date=${TEST_DATE}&includeMedia=true`, {
        token: user.token,
    });

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.deepEqual(second.body, first.body);
});

test('saved daily log values can be retrieved through existing health and mood read endpoints', async () => {
    const user = await registerUser('retrieval');
    await submitDailyLog(user.token);

    const [healthResponse, moodResponse] = await Promise.all([
        requestJson<{
            success: boolean;
            data: {
                steps: number;
                energyScore: number;
                source: string;
            } | null;
        }>(`/api/health/today?date=${TEST_DATE}`, {
            token: user.token,
        }),
        requestJson<{
            success: boolean;
            data: {
                mood: string;
                energyLevel: number;
                stressLevel: number;
                source: string;
            } | null;
        }>(`/api/mood/today?date=${TEST_DATE}`, {
            token: user.token,
        }),
    ]);

    assert.equal(healthResponse.status, 200);
    assert.equal(moodResponse.status, 200);
    assert.ok(healthResponse.body.data);
    assert.ok(moodResponse.body.data);
    assert.equal(healthResponse.body.data.steps, 10000);
    assert.equal(healthResponse.body.data.energyScore, 84);
    assert.equal(healthResponse.body.data.source, 'daily_log');
    assert.equal(moodResponse.body.data.mood, 'happy');
    assert.equal(moodResponse.body.data.energyLevel, 8);
    assert.equal(moodResponse.body.data.stressLevel, 2);
    assert.equal(moodResponse.body.data.source, 'daily_log');
});

test('users cannot retrieve another user’s daily-log data', async () => {
    const owner = await registerUser('owner');
    const outsider = await registerUser('outsider');
    await submitDailyLog(owner.token);

    const [healthResponse, moodResponse] = await Promise.all([
        requestJson<{
            success: boolean;
            data: unknown;
        }>(`/api/health/today?date=${TEST_DATE}`, {
            token: outsider.token,
        }),
        requestJson<{
            success: boolean;
            data: unknown;
        }>(`/api/mood/today?date=${TEST_DATE}`, {
            token: outsider.token,
        }),
    ]);

    assert.equal(healthResponse.status, 200);
    assert.equal(moodResponse.status, 200);
    assert.equal(healthResponse.body.success, true);
    assert.equal(moodResponse.body.success, true);
    assert.equal(healthResponse.body.data, null);
    assert.equal(moodResponse.body.data, null);
});

test('seeded weekly records load through the documented seed and history endpoints', async () => {
    const user = await registerUser('weekly-seed');

    const seedResponse = await requestJson<{
        success: boolean;
        data: {
            healthEntries: number;
            moodEntries: number;
        };
    }>('/api/seed/demo', {
        method: 'POST',
        token: user.token,
    });
    const [healthResponse, moodResponse] = await Promise.all([
        requestJson<{
            success: boolean;
            data: unknown[];
        }>('/api/health?days=7', {
            token: user.token,
        }),
        requestJson<{
            success: boolean;
            data: unknown[];
        }>('/api/mood?days=7', {
            token: user.token,
        }),
    ]);

    assert.equal(seedResponse.status, 200);
    assert.equal(seedResponse.body.success, true);
    assert.equal(seedResponse.body.data.healthEntries, 7);
    assert.equal(seedResponse.body.data.moodEntries, 7);
    assert.equal(healthResponse.status, 200);
    assert.equal(moodResponse.status, 200);
    assert.equal(healthResponse.body.data.length, 7);
    assert.equal(moodResponse.body.data.length, 7);
});

test('avatar state falls back safely when stored animation metadata is missing or unusable', async () => {
    const user = await registerUser('avatar-fallback');
    await submitDailyLog(user.token);
    const fixture = await seedBrokenAvatarFixture(user.userId);

    const response = await requestJson<{
        success: boolean;
        data: {
            state: string;
            videoUrl: string | null;
            imageUrl: string | null;
            availableStates: string[];
        };
    }>(`/api/avatar/state?date=${TEST_DATE}&includeMedia=true`, {
        token: user.token,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.state, 'happy');
    assert.equal(response.body.data.videoUrl, null);
    assert.equal(response.body.data.imageUrl, fixture.avatarUrl);
    assert.deepEqual(response.body.data.availableStates, []);
});
