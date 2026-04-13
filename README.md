# 🩺 Health Twin App

A React Native + Expo health tracking application with a Node.js/Express backend and MongoDB Atlas.

---

## 📁 Project Structure

```
health-twin-app/
├── App.tsx                  # Expo app entry point
├── screens/                 # All app screens
├── components/              # Reusable UI components
├── lib/                     # Services, analytics, gamification logic
├── contexts/                # React context (Auth)
├── .env                     # Frontend env (API URL)
└── server/                  # Express backend
    ├── src/
    │   ├── index.ts         # Entry point
    │   ├── db.ts            # MongoDB connection
    │   ├── middleware/
    │   │   └── auth.ts      # JWT middleware
    │   ├── models/
    │   │   ├── User.ts
    │   │   ├── HealthEntry.ts
    │   │   └── MoodEntry.ts
    │   └── routes/
    │       ├── auth.ts      # Register / Login / Me
    │       ├── health.ts    # Health entries CRUD
    │       ├── mood.ts      # Mood entries CRUD
    │       ├── analytics.ts # Aggregated stats
    │       ├── achievements.ts # Badges
    │       └── seed.ts      # Demo data seeder
    ├── package.json
    ├── tsconfig.json
    ├── .env                 # Backend secrets (MongoDB URI, JWT)
    └── .env.example         # Template for new devs
```

---

## 🚀 Quick Start (Second Developer)

### Prerequisites
- Node.js 18+
- npm
- Expo CLI (`npm install -g expo-cli`)

---

### 1. Clone the repo

```bash
git clone https://github.com/TanimKhan-86/health-twin-app.git
cd health-twin-app
```

### Demo Login (Examiner / Developer)

Use this test account for the prototype:

- Email: `elora.demo@healthtwin.app`
- Password: `HealthTwinDemo#2026`

If needed, reset via `POST /api/auth/reset-password` (prototype flow).

---

### 2. Start the Backend

```bash
cd server
npm install
npm run dev
```

The server will start on **http://localhost:4000**

> ✅ `.env` is already included with the MongoDB Atlas credentials.  
> If you need a fresh DB, update `MONGODB_URI` in `server/.env`.

---

### 3. Start the Frontend

In a **new terminal** from the project root:

```bash
npm install
```

Copy the env file:
```bash
cp .env.example .env
```

Edit `.env` based on how you're running:

| Mode | `EXPO_PUBLIC_API_URL` |
|---|---|
| Expo Web / browser | `http://localhost:4000` |
| Expo Go on phone (same Wi-Fi) | `http://YOUR_LOCAL_IP:4000` |
| Android Emulator | `http://10.0.2.2:4000` |
| ngrok tunnel | `https://xxxx.ngrok-free.app` |

Then start the app:
```bash
npx expo start
```

---

## 🔑 API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | ❌ | Create account |
| POST | `/api/auth/login` | ❌ | Login + get JWT |
| POST | `/api/auth/reset-password` | ❌ | Prototype reset (email + new password) |
| GET | `/api/auth/me` | ✅ | Get current user |
| GET | `/api/health?days=7` | ✅ | Get health entries |
| POST | `/api/health` | ✅ | Add health entry |
| PUT | `/api/health/:id` | ✅ | Update entry |
| DELETE | `/api/health/:id` | ✅ | Delete entry |
| GET | `/api/mood?days=7` | ✅ | Get mood entries |
| POST | `/api/mood` | ✅ | Add mood entry |
| GET | `/api/analytics/summary?days=7` | ✅ | Aggregated stats |
| GET | `/api/achievements` | ✅ | Badges/gamification |
| POST | `/api/seed/demo` | ✅ | Seed 7 days of demo data |
| POST | `/api/avatar/setup` | ✅ | Avatar setup endpoint (generation in `nanobana` mode, no-op readiness in `prebuilt` mode) |
| GET | `/api/avatar/status` | ✅ | Avatar readiness + generated state list |
| GET | `/api/avatar/state` | ✅ | Return one dynamic looping animation for dashboard |
| GET | `/api/future/insight?days=7` | ✅ | Analyze last 7 days and project next-week dominant state + matching avatar media |

All protected routes require: `Authorization: Bearer <token>`

### Auth Security Notes

- JWT lifetime is `7d` (shortened from long-lived tokens for safer demos).
- Login protection on `/api/auth/login`: max `5` failures in `15` minutes per `email + IP`.
- Temporary lockout: `10` minutes after threshold is reached.
- Password reset endpoint is prototype-grade (no email OTP/token yet).

---

## 🧰 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React Native, Expo, NativeWind |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB Atlas (Mongoose) |
| Auth | JWT (7-day tokens) + login rate limiting/temporary lockout |

---

## 🎭 Avatar System (Prebuilt + NanoBana)

The app supports 2 modes via `server/.env`:

1. `AVATAR_MODE=prebuilt` (recommended for prototype/cost control)
2. `AVATAR_MODE=nanobana` (live Gemini/Veo generation)

### Prebuilt mode flow (no Gemini usage for avatar generation)

1. Keep `AVATAR_MODE=prebuilt` in `server/.env`
2. Seed pre-generated assets (avatar PNG + `happy/sad/sleepy` MP4 loops, optional `calm`) into MongoDB
3. Dashboard fetches `/api/avatar/state` and loops exactly one state video in the circular frame
4. State selection updates from daily vitals and mood metrics

Use the seed importer:

```bash
cd server
cp scripts/prebuilt-avatar-seed.example.json scripts/prebuilt-avatar-seed.json
# edit paths/emails in scripts/prebuilt-avatar-seed.json
npm run seed:avatars:prebuilt -- --config ./scripts/prebuilt-avatar-seed.json
```

### NanoBana mode flow (live generation)

1. User uploads a real selfie during profile creation
2. Selfie is saved in MongoDB (`User.profileImage`)
3. Backend generates stylized avatar image
4. Avatar image is saved in MongoDB (`Avatar`) and synced for top-right/settings display
5. Avatar is used to generate emotional loops and save them in MongoDB (`AvatarAnimation`)
6. Dashboard requests `/api/avatar/state` to play one looping animation

### Backend env vars

Add these to `server/.env`:

```bash
AVATAR_MODE=prebuilt # prebuilt or nanobana

# Google AI Studio key (Gemini image + Veo video)
NANO_BANA_API_KEY=your_google_ai_studio_api_key_here
NANO_BANA_STYLE_PRESET=health_twin_demo_style_v1
NANO_BANA_VIDEO_MODEL=veo-2.0-generate-001
# Optional style demo avatar reference as data URI (used to keep style consistent)
NANO_BANA_STYLE_REFERENCE_DATA_URI=
```

If `AVATAR_MODE=prebuilt`, avatar generation endpoints do not call Gemini/Veo.
