import { Response } from 'express';
import { ZodType } from 'zod';
import { sendError, zodErrorDetails } from './apiResponse';

export const QUERY_LIMITS = {
    days: { min: 1, max: 365, default: 30 },
    historyLimit: { min: 1, max: 365, default: 30 },
    futureDays: { min: 1, max: 30, default: 7 },
} as const;

function parseOrRespond<T>(
    res: Response,
    schema: ZodType<T>,
    input: unknown,
    message: string
): T | null {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
        sendError(res, 400, message, zodErrorDetails(parsed.error));
        return null;
    }
    return parsed.data;
}

export function parseBody<T>(res: Response, schema: ZodType<T>, body: unknown): T | null {
    return parseOrRespond(res, schema, body, 'Invalid request body');
}

export function parseQuery<T>(res: Response, schema: ZodType<T>, query: unknown): T | null {
    return parseOrRespond(res, schema, query, 'Invalid query parameters');
}

export function parseParams<T>(res: Response, schema: ZodType<T>, params: unknown): T | null {
    return parseOrRespond(res, schema, params, 'Invalid route parameters');
}
