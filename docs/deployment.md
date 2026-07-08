# Operant OS - Production Deployment Guide

This document outlines deployment configurations, environment variable requirements, and monitoring integrations for preparing Operant OS for production release.

---

## 📦 1. Database Deployment (Firebase)

Operant OS uses Firestore for ledger storage, user permissions, and audit logging. Rules and indexes must be deployed before the application goes live.

### Prerequisites
1. Install the Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
2. Log in and configure the active Firebase project:
   ```bash
   firebase login
   firebase use <your-firebase-project-id>
   ```

### Deploying Configuration
To deploy security rules and composite queries indexes (configured in [firestore.rules](file:///d:/Tabysh/stone%20circuit/Operant%20OS/firestore.rules) and [firestore.indexes.json](file:///d:/Tabysh/stone%20circuit/Operant%20OS/firestore.indexes.json) via [firebase.json](file:///d:/Tabysh/stone%20circuit/Operant%20OS/firebase.json)):

```bash
# Deploy firestore rules & indexes simultaneously
firebase deploy --only firestore
```

---

## 🚀 2. Frontend Deployment (Vercel)

The Next.js application compiles statically and hosts dynamic serverless endpoints.

### Prerequisites
1. Install the Vercel CLI (or link via Vercel GitHub integration):
   ```bash
   npm install -g vercel
   ```

### Environment Variables
Configure the following keys in the Vercel Project Settings (Environment Variables):

| Variable | Scope | Value | Description |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Server-only | Secure token | Google Gemini API integration key (Required on Server) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Browser-accessible | Public key | Client-side Firebase instance key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Browser-accessible | Domain name | Firebase login domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Browser-accessible | String identifier | Firestore project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Browser-accessible | URL | Firebase file storage URL |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`| Browser-accessible | Numeric code | Cloud messaging identifier |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Browser-accessible | String hash | Client application ID |

> [!WARNING]
> **Client-side Fallbacks:** In development, if client-side variables (prefixed with `NEXT_PUBLIC_`) are omitted, the application will fallback to a default Firebase configuration. In production, these variables MUST be configured in Vercel. Leaving them unconfigured will trigger validation warnings during static generation and client execution.

### Deploy Command
To compile and deploy:
```bash
# Compile and build the project preview
vercel

# Deploy production bundle
vercel --prod
```

---

## 📈 3. Production Monitoring & Logging

Structured logging is managed via [logger.ts](file:///d:/Tabysh/stone%20circuit/Operant%20OS/apps/web/lib/logger.ts). For production environments, integrating external monitoring tools is highly recommended.

### Error Tracking (Sentry Integration)
Configure Sentry to capture client and server errors automatically:
1. Install Sentry Next.js SDK:
   ```bash
   npx @sentry/wizard@latest -i nextjs
   ```
2. Set `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` in Vercel Environment Variables.
3. The server-side error handler in `logger.error` should forward exceptions to Sentry:
   ```typescript
   import * as Sentry from "@sentry/nextjs";
   
   // inside writeLog case "error":
   Sentry.captureMessage(sanitizedMsg, {
     level: "error",
     extra: sanitizedDetails,
   });
   ```

### Structured Log Monitoring (Axiom / Datadog)
Structured server logs (with recursive password/token redactions) can be forwarded to Axiom or Datadog using Next.js custom transports:
1. Set up an ingestion webhook in Axiom or Datadog.
2. In production, uncomment the monitoring service hook in `writeLog`:
   ```typescript
   if (process.env.NODE_ENV === "production") {
     sendToMonitoringService(payload); // forward redacted payload to Datadog Log intake API
   }
   ```
3. The rate limiter in `lib/rateLimit.ts` is in-memory. For highly distributed multi-instance production environments, replace it with a centralized Redis-based rate limiter to coordinate limits across instances.

