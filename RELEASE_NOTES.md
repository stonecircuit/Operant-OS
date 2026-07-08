# Release Notes - Operant OS v1.0.0-rc1

We are proud to announce the release of **Operant OS v1.0.0-rc1** (Release Candidate 1). 

Operant OS is an AI-powered Business Operating System designed for modern enterprises. It integrates core accounting ledgers, advanced inventory tracking, real-time notifications, and an AI Financial Copilot.

---

## 🌟 Release Highlights

### 1. Advanced Inventory Core
- **catalog catalogue**: Complete product catalogue metadata registry including name, SKU codes, categories, purchase/selling price pairs, alert limits, and units (pcs, kg, box, etc.).
- **Atomic Operations**: Core stock adjustments (Stock In / Stock Out) operate within database transactions to prevent race conditions and synchronize stock levels accurately.
- **Reporting & Export**: Recharts visual graphs representing value distribution and available stocks compared against minimum alerts, plus CSV export for spreadsheet tools.
- **Low Stock Detection**: Highlights low stock levels instantly and generates real-time dashboard notifications.

### 2. Upgraded AI Financial Copilot
- **Live Inventory Context**: Injects products catalog context into Gemini prompts, enabling natural conversation regarding item availability (e.g. *"How many keyboards do I have?"*) and asset valuation (e.g. *"What's my inventory value?"*).
- **Interactive Draft Cards**: Detects natural language commands (e.g. *"Sold 5 laptops"*) and generates interactive, editable stock adjustment drafts in chat, allowing direct validation and catalog logging.

### 3. Polish & Production Readiness
- **Placeholder Redaction**: Removed dev placeholder landing pages, establishing root Next.js redirects directly into `/dashboard`.
- **Typing & Linter Polish**: Cleaned up all implicit `any` definitions, cascading React render cycles, and unescaped quote symbols.
- **Rules Hardening**: Hardened `firestore.rules` preventing unauthorized multi-tenant catalog read/writes.

---

## 🛠️ Installation & Setup

### Environment Prerequisites
Rename `.env.example` to `.env.local` and configure the following variables:
- `GEMINI_API_KEY`: Secure server-side key for Google Generative AI.
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, etc.: Public configuration variables for client Firebase auth/firestore initialization.

### Running Locally
```bash
# Clone the repository and navigate to the web app
cd apps/web

# Install dependencies
npm install

# Run the development server
npm run dev
```

### Production Verification Gates
Ensure that all code quality gates compile cleanly:
```bash
# TypeScript compiler check
npx tsc --noEmit

# Code linter check
npm run lint

# Production compilation check
npm run build
```

---

## 🛡️ Verification & Security Status
- **Static Analysis**: TypeScript compilation and ESLint execution pass with **zero errors**.
- **Rate Limiting**: Lightweight IP-controlled rate limiter protects all AI API endpoints against brute force / denial-of-service attempts.
- **Data Integrity**: Firestore rules mandate immutable transaction associations, authenticated audit logging, and business-scoped resource boundaries.
