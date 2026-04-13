import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../lib/apiResponse';

export interface AuthRequest extends Request {
    userId?: string;
}

export const authenticate = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        sendError(res, 401, 'Unauthorized — no token provided');
        return;
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
        req.userId = decoded.userId;
        next();
    } catch {
        sendError(res, 401, 'Unauthorized — invalid token');
    }
};
