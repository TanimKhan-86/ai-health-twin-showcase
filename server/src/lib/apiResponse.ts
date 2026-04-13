import { Response } from 'express';
import { ZodError } from 'zod';
import { ApiEnvelope, ApiErrorDetail } from '../contracts/api';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
    const payload: ApiEnvelope<T> = { success: true, data };
    res.status(statusCode).json(payload);
}

export function sendError(
    res: Response,
    statusCode: number,
    message: string,
    details?: ApiErrorDetail[]
): void {
    const payload: ApiEnvelope<never> = {
        success: false,
        error: message,
        ...(details && details.length > 0 ? { details } : {}),
    };
    res.status(statusCode).json(payload);
}

export function zodErrorDetails(error: ZodError): ApiErrorDetail[] {
    return error.issues.map((issue) => ({
        field: issue.path.length > 0 ? issue.path.join('.') : 'request',
        message: issue.message,
    }));
}

export function getErrorMessage(error: unknown, fallback = 'Server error'): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }
    if (
        typeof error === 'object'
        && error !== null
        && 'message' in error
        && typeof (error as { message?: unknown }).message === 'string'
    ) {
        return (error as { message: string }).message;
    }
    return fallback;
}

interface MongooseValidationErrorLike {
    name?: string;
    errors?: Record<string, { message?: string }>;
    code?: number;
    message?: string;
}

export function getMongooseValidationMessage(error: unknown, duplicateMessage: string): string {
    const err = error as MongooseValidationErrorLike;
    if (err?.name === 'ValidationError') {
        const first = Object.values(err.errors || {})[0];
        return first?.message || 'Validation failed';
    }
    if (err?.code === 11000) {
        return duplicateMessage;
    }
    return getErrorMessage(error);
}
