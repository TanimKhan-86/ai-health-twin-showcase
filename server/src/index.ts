import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { connectDB } from './db';
import authRoutes from './routes/auth';
import healthRoutes from './routes/health';
import moodRoutes from './routes/mood';
import analyticsRoutes from './routes/analytics';
import achievementsRoutes from './routes/achievements';
import seedRoutes from './routes/seed';
import aiRoutes from './routes/ai';
import streakRoutes from './routes/streak';
import avatarRoutes from './routes/avatar';
import futureRoutes from './routes/future';
import dailyLogRoutes from './routes/dailyLog';
import mediaRoutes from './routes/media';
import { sendSuccess } from './lib/apiResponse';

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware — dynamically accept all origins for local dev Expo testing
app.use(cors({
    origin: (origin, callback) => {
        // Echo the origin back so `credentials: true` works without a wildcard
        callback(null, origin || true);
    },
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/mood', moodRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/streak', streakRoutes);
app.use('/api/avatar', avatarRoutes);
app.use('/api/future', futureRoutes);
app.use('/api/daily-log', dailyLogRoutes);
app.use('/api/media', mediaRoutes);

// Health check
app.get('/', (_req, res) => {
    sendSuccess(res, { status: 'ok', message: 'Health Twin API is running' });
});

app.listen(Number(PORT), HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
    if (HOST === '0.0.0.0') {
        console.log('🌐 Listening on all network interfaces (LAN enabled)');
    }
});

export default app;
