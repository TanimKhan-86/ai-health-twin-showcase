import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import User from '../models/User';
import HealthEntry from '../models/HealthEntry';
import MoodEntry from '../models/MoodEntry';
import { Avatar } from '../models/Avatar';
import { AvatarAnimation } from '../models/AvatarAnimation';
import WeeklyAnalysisCache from '../models/WeeklyAnalysisCache';
import { AuthSessionDto, AuthUserDto } from '../contracts/api';
import { getErrorMessage, sendError, sendSuccess } from '../lib/apiResponse';
import { parseBody } from '../lib/validation';
import {
    ensureMediaRefFromValue,
    resolveMediaUrlForClient,
} from '../services/mediaStoreService';

const router = Router();

const registerSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
    email: z.string().trim().email('Invalid email format').transform((value) => value.toLowerCase()),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    profileImage: z.string().trim().min(1).optional(),
    age: z.coerce.number().int().min(1).max(120).optional(),
    heightCm: z.coerce.number().min(40).max(250).optional(),
    weightKg: z.coerce.number().min(20).max(400).optional(),
});

const loginSchema = z.object({
    email: z.string().trim().email('Invalid email format').transform((value) => value.toLowerCase()),
    password: z.string().min(1, 'Password is required'),
});

const resetPasswordSchema = z.object({
    email: z.string().trim().email('Invalid email format').transform((value) => value.toLowerCase()),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

interface LoginAttemptRecord {
    attempts: number;
    windowStartMs: number;
    lockUntilMs: number | null;
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, LoginAttemptRecord>();

async function toAuthUser(
    req: Request,
    user: {
    _id: unknown;
    name: string;
    email: string;
    age?: number;
    heightCm?: number;
    weightKg?: number;
    profileImage?: string | null;
}): Promise<AuthUserDto> {
    const normalizedProfileImage = await ensureMediaRefFromValue(
        user.profileImage ?? null,
        { userId: String(user._id), kind: 'profile-image' },
        'profile-image'
    );

    if (normalizedProfileImage && normalizedProfileImage !== user.profileImage) {
        await User.updateOne({ _id: user._id }, { $set: { profileImage: normalizedProfileImage } });
        user.profileImage = normalizedProfileImage;
    }

    return {
        id: String(user._id),
        name: user.name,
        email: user.email,
        age: user.age,
        heightCm: user.heightCm,
        weightKg: user.weightKg,
        profileImage: resolveMediaUrlForClient(req, user.profileImage ?? null),
    };
}

function createAuthToken(userId: string): string | null {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}

function resolveClientIp(req: Request): string {
    const forwardedHeader = req.headers?.['x-forwarded-for'];
    const forwardedValue = Array.isArray(forwardedHeader) ? forwardedHeader[0] : forwardedHeader;
    if (typeof forwardedValue === 'string' && forwardedValue.trim().length > 0) {
        const firstIp = forwardedValue.split(',')[0]?.trim();
        if (firstIp) return firstIp;
    }
    return req.ip || 'unknown';
}

function getLoginAttemptKey(email: string, ip: string): string {
    return `${email}::${ip}`;
}

function cleanupLoginAttempts(now: number): void {
    for (const [key, value] of loginAttempts.entries()) {
        const expiredWindow = now - value.windowStartMs > LOGIN_WINDOW_MS;
        const lockExpired = value.lockUntilMs !== null && now >= value.lockUntilMs;
        if (expiredWindow && (value.lockUntilMs === null || lockExpired)) {
            loginAttempts.delete(key);
        }
    }
}

function getActiveLockRemainingMs(key: string, now: number): number {
    cleanupLoginAttempts(now);
    const record = loginAttempts.get(key);
    if (!record || record.lockUntilMs === null) return 0;
    return Math.max(0, record.lockUntilMs - now);
}

function recordFailedLogin(key: string, now: number): LoginAttemptRecord {
    const existing = loginAttempts.get(key);

    if (!existing || now - existing.windowStartMs > LOGIN_WINDOW_MS) {
        const fresh: LoginAttemptRecord = {
            attempts: 1,
            windowStartMs: now,
            lockUntilMs: null,
        };
        loginAttempts.set(key, fresh);
        return fresh;
    }

    if (existing.lockUntilMs !== null && now >= existing.lockUntilMs) {
        existing.attempts = 1;
        existing.windowStartMs = now;
        existing.lockUntilMs = null;
        loginAttempts.set(key, existing);
        return existing;
    }

    existing.attempts += 1;
    if (existing.attempts >= LOGIN_MAX_ATTEMPTS) {
        existing.lockUntilMs = now + LOGIN_LOCKOUT_MS;
    }
    loginAttempts.set(key, existing);
    return existing;
}

function clearLoginAttempt(key: string): void {
    loginAttempts.delete(key);
}

function clearLoginAttemptsForEmail(email: string): void {
    const prefix = `${email}::`;
    for (const key of loginAttempts.keys()) {
        if (key.startsWith(prefix)) {
            loginAttempts.delete(key);
        }
    }
}

function lockoutMessage(remainingMs: number): string {
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    return `Too many failed login attempts. Try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`;
}

// POST /api/auth/register
router.post('/register', async (req, res: Response): Promise<void> => {
    const input = parseBody(res, registerSchema, req.body);
    if (!input) return;

    try {
        const existing = await User.findOne({ email: input.email });
        if (existing) {
            sendError(res, 409, 'Email already registered');
            return;
        }

        const normalizedProfileImage = await ensureMediaRefFromValue(
            input.profileImage ?? null,
            { email: input.email, kind: 'profile-image' },
            'profile-image'
        );
        const user = await User.create({
            ...input,
            profileImage: normalizedProfileImage ?? input.profileImage,
        });
        const token = createAuthToken(String(user._id));
        if (!token) {
            sendError(res, 500, 'JWT secret is not configured');
            return;
        }

        const payload: AuthSessionDto = {
            token,
            user: await toAuthUser(req, user),
        };
        sendSuccess(res, payload, 201);
    } catch (error: unknown) {
        console.error('Register error:', error);
        sendError(res, 500, getErrorMessage(error));
    }
});

// POST /api/auth/login
router.post('/login', async (req, res: Response): Promise<void> => {
    const input = parseBody(res, loginSchema, req.body);
    if (!input) return;
    const now = Date.now();
    const ip = resolveClientIp(req);
    const loginKey = getLoginAttemptKey(input.email, ip);
    const activeLockRemainingMs = getActiveLockRemainingMs(loginKey, now);
    if (activeLockRemainingMs > 0) {
        sendError(res, 429, lockoutMessage(activeLockRemainingMs));
        return;
    }

    try {
        const user = await User.findOne({ email: input.email });
        if (!user) {
            const result = recordFailedLogin(loginKey, now);
            if (result.lockUntilMs && result.lockUntilMs > now) {
                sendError(res, 429, lockoutMessage(result.lockUntilMs - now));
            } else {
                sendError(res, 401, 'Invalid credentials');
            }
            return;
        }

        const valid = await user.comparePassword(input.password);
        if (!valid) {
            const result = recordFailedLogin(loginKey, now);
            if (result.lockUntilMs && result.lockUntilMs > now) {
                sendError(res, 429, lockoutMessage(result.lockUntilMs - now));
            } else {
                sendError(res, 401, 'Invalid credentials');
            }
            return;
        }
        clearLoginAttempt(loginKey);

        const token = createAuthToken(String(user._id));
        if (!token) {
            sendError(res, 500, 'JWT secret is not configured');
            return;
        }

        const payload: AuthSessionDto = {
            token,
            user: await toAuthUser(req, user),
        };
        sendSuccess(res, payload);
    } catch (error: unknown) {
        console.error('Login error:', error);
        sendError(res, 500, getErrorMessage(error));
    }
});

// POST /api/auth/reset-password
// Prototype reset flow: email + new password (no email token).
router.post('/reset-password', async (req, res: Response): Promise<void> => {
    const input = parseBody(res, resetPasswordSchema, req.body);
    if (!input) return;

    try {
        const user = await User.findOne({ email: input.email });
        if (!user) {
            sendError(res, 404, 'No account found with this email');
            return;
        }

        user.password = input.newPassword;
        await user.save();
        clearLoginAttemptsForEmail(input.email);

        sendSuccess(res, {
            message: 'Password reset successful. You can now sign in with your new password.',
        });
    } catch (error: unknown) {
        console.error('Reset password error:', error);
        sendError(res, 500, getErrorMessage(error));
    }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.userId) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            sendError(res, 404, 'User not found');
            return;
        }

        sendSuccess(res, { user: await toAuthUser(req, user) });
    } catch (error: unknown) {
        sendError(res, 500, getErrorMessage(error));
    }
});

// DELETE /api/auth/me
router.delete('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.userId) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

        const userId = req.userId;
        const deletedUser = await User.findByIdAndDelete(userId);
        if (!deletedUser) {
            sendError(res, 404, 'User not found');
            return;
        }

        await Promise.all([
            HealthEntry.deleteMany({ userId }),
            MoodEntry.deleteMany({ userId }),
            Avatar.deleteMany({ userId }),
            AvatarAnimation.deleteMany({ userId }),
            WeeklyAnalysisCache.deleteMany({ userId }),
        ]);

        sendSuccess(res, { message: 'Account and associated data deleted successfully' });
    } catch (error: unknown) {
        console.error('Delete account error:', error);
        sendError(res, 500, getErrorMessage(error));
    }
});

export default router;
