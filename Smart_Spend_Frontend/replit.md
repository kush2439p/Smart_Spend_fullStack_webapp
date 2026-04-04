# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains the SmartSpend mobile app (Expo/React Native) and an Express API server.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (backend) + Spring Boot (user's own backend)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Mobile**: Expo SDK 54, Expo Router (file-based routing)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (placeholder)
│   ├── mockup-sandbox/     # Design sandbox
│   └── smartspend/         # SmartSpend Expo mobile app
│       ├── app/            # Expo Router screens
│       │   ├── _layout.tsx        # Root layout with auth
│       │   ├── index.tsx          # Auth redirect
│       │   ├── onboarding.tsx     # Splash/onboarding
│       │   ├── login.tsx          # Login screen
│       │   ├── register.tsx       # Register screen
│       │   ├── add-transaction.tsx
│       │   ├── receipt-scanner.tsx
│       │   ├── categories.tsx
│       │   ├── budgets.tsx
│       │   └── (tabs)/            # 5 bottom tabs
│       │       ├── index.tsx      # Dashboard
│       │       ├── transactions.tsx
│       │       ├── ai.tsx         # AI Chat
│       │       ├── analytics.tsx
│       │       └── profile.tsx
│       ├── context/
│       │   └── AuthContext.tsx    # JWT auth context
│       ├── services/
│       │   ├── api.ts             # All API calls (easy to swap backend)
│       │   └── mockData.ts        # Mock data for development
│       └── constants/
│           └── colors.ts          # App theme (purple #6C63FF)
├── lib/                    # Shared libraries
├── scripts/                # Utility scripts
├── SmartSpend-SpringBoot-Backend-Spec.md  # Backend documentation
└── pnpm-workspace.yaml
```

## SmartSpend App

### Key Design Choices
- Primary color: `#6C63FF` (purple)
- Income: `#00C897` (green), Expense: `#FF6B6B` (red)
- Inter font family throughout
- Mock data fallback when backend is not connected

### Connecting Spring Boot Backend
Edit `artifacts/smartspend/services/api.ts` line 7:
```typescript
export const BASE_URL = "https://your-spring-boot-server.com/api";
```
All API endpoints, request/response shapes, and auth flows are documented in `SmartSpend-SpringBoot-Backend-Spec.md`.

### Auth Flow
- JWT token stored in AsyncStorage
- `AuthContext` handles login/register/logout
- Auto-redirects to tabs if token exists, else onboarding
- Mock fallback: logs in with mock user if backend not connected
