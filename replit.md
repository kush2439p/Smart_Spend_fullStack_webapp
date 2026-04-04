# SmartSpend — Full-Stack Personal Finance App

## Overview

SmartSpend is a full-stack personal finance tracker with:
- **Frontend**: Expo (React Native) app running in web mode (`Smart_Spend_Frontend/`)
- **Backend**: Spring Boot Java REST API (`smartspend/`)

## Stack

- **Frontend**: Expo SDK 54, React Native, Expo Router, TypeScript, pnpm monorepo
- **Backend**: Spring Boot 3.2, Java 19, Spring Security (JWT), Spring Data JPA
- **Database**: PostgreSQL (Replit built-in)
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
- Uses `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` env vars (Replit PostgreSQL)
- Server port: 8080
- JWT auth enabled

### Frontend (services/api.ts)
- `BASE_URL` uses `EXPO_PUBLIC_DOMAIN` env var (injected by dev script) to point to backend
- Falls back to `http://localhost:8080/api` if not set

## Key Notes

- Original project used MySQL; switched to PostgreSQL for Replit compatibility
- Original backend port was 8081; changed to 8080 (required by Replit)
- Hibernate auto-creates all tables on first run (`ddl-auto=update`)
- The Expo app runs in web mode on Replit (not native mobile)
