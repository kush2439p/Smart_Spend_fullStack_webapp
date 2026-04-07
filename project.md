# SmartSpend — Full-Stack Personal Finance App

## Overview

SmartSpend is a full-stack personal finance tracker with:
- **Frontend**: Expo (React Native) app running in web mode (`Smart_Spend_Frontend/`)
- **Backend**: Spring Boot Java REST API (`smartspend/`)

## Stack

- **Frontend**: Expo SDK 54, React Native, Expo Router, TypeScript, pnpm monorepo
- **Backend**: Spring Boot 3.2, Java 19, Spring Security (JWT), Spring Data JPA
- **Database**: PostgreSQL
- **Build tool**: Maven (backend), pnpm (frontend)

## Project Structure

```
.
├── Smart_Spend_Frontend/           # Frontend monorepo (pnpm)
│   ├── artifacts/smartspend/       # Main Expo app
│   │   ├── app/                    # Expo Router screens
│   │   ├── context/AuthContext.tsx # JWT auth context
│   │   ├── services/api.ts         # Backend API calls
│   │   └── metro.config.js         # Metro bundler config (port from $PORT)
│   ├── lib/                        # Shared TS libraries
│   └── pnpm-workspace.yaml
└── smartspend/                     # Spring Boot backend
    ├── src/main/java/com/smartspend/
    └── src/main/resources/application.properties
```

## Workflows

- **Start application**: Expo Metro dev server on port 5000 (webview)
  - Command: `cd Smart_Spend_Frontend && PORT=5000 pnpm --filter @workspace/smartspend run dev`
- **Backend API**: Spring Boot on port 8080 (console)
  - Command: `cd smartspend && mvn spring-boot:run`

## Configuration

### Backend (application.properties)
- Uses `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` env vars for database connection
- Server port: 8080
- JWT auth enabled

### Frontend (services/api.ts)
- `BASE_URL` uses `EXPO_PUBLIC_DOMAIN` env var (injected by dev script) to point to backend
- Falls back to `http://localhost:8080/api` if not set

## Switching to MySQL (when ready)

Set these environment variables:
- `MYSQL_URL=jdbc:mysql://host:3306/dbname`
- `MYSQL_USER=your_user`
- `MYSQL_PASSWORD=your_password`
- `DB_DRIVER=com.mysql.cj.jdbc.Driver`

Both MySQL and PostgreSQL drivers are in pom.xml.

## Authentication Flow

1. **Register** → `POST /api/auth/register` → sends verification email → frontend routes to `/verify-email`
2. **Verify Email** → user clicks link in email → `GET /verify-email?token=XXX` → styled HTML page (browser)
   - App can also verify via `GET /api/auth/verify?token=XXX` (JSON)
   - Tokens expire after 24 hours
3. **Login** → `POST /api/auth/login` → rejects unverified emails with clear error + resend option
4. **Forgot Password** → `POST /api/auth/forgot-password` → sends reset email with token
5. **Reset Password** → `POST /api/auth/reset-password` → resets, sends confirmation email
6. **Resend Verification** → `POST /api/auth/resend-verification` → issues new 24hr token

Email sender: kushv619@gmail.com (Gmail SMTP)

## Key Notes

- Database URL built from `PGHOST`, `PGPORT`, `PGDATABASE` env vars
- Hibernate auto-creates/updates all tables on startup (`ddl-auto=update`)
- The Expo app runs in web mode; QR code in Expo console lets users open on real device via Expo Go
- `pending_verify_email` stored in AsyncStorage after registration — used by verify-email screen for resend
- `verificationTokenExpiry` field on User — 24h expiry enforced on backend
