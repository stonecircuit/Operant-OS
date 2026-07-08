# Release Checklist: v1.0.0-rc1

This document defines the release candidate quality verification gates, pre-deployment checklists, post-deployment smoke tests, and rollback procedures for version `v1.0.0-rc1` of Operant OS.

---

## 📋 1. Pre-Release Verification (QA Gates)

Before tagging the release candidate, verify that the following quality gates compile successfully:

- [ ] **Type-Safety Check:** Ensure TypeScript compiled cleanly.
  ```bash
  npx tsc --noEmit
  ```
- [ ] **Lint Rule Compliance:** Ensure code quality matches all guidelines.
  ```bash
  npm run lint
  ```
- [ ] **Production Build Check:** Verify page hydration and static site compilations generate without errors.
  ```bash
  npm run build
  ```
- [ ] **Security Scanning Check:** Inspect source code and assure no Firebase API keys or Gemini secrets are committed to the repository (only references to `.env.local` / config). Confirm that no sensitive `.env*` files are tracked in Git:
  ```bash
  git status --ignored
  ```

---

## 🚀 2. Deploy Sequence

Execute the production rollout in the following logical sequence:

- [ ] **Step 1: Backup Database State**
  - Export a Firestore backup data store using Google Cloud CLI:
    ```bash
    gcloud firestore export gs://operant-os-backups/pre-v1.0.0-rc1
    ```
  - Verify that the export job completed successfully via the Google Cloud Console.
- [ ] **Step 2: Deploy Firestore Schemas**
  - Update rules and database composite query parameters:
    ```bash
    firebase deploy --only firestore
    ```
  - Verify rules deployment on the Firebase Console rules tab.
- [ ] **Step 3: Setup Production Environment Variables**
  - Check Vercel project variables match `.env.example` configurations. Ensure `GEMINI_API_KEY` and all `NEXT_PUBLIC_FIREBASE_*` variables are set.
- [ ] **Step 4: Rollout Frontend Web App**
  - Compile, build, and deploy the production bundle:
    ```bash
    vercel --prod
    ```

---

## 🔍 3. Post-Deployment Smoke Tests

Verify system behavior on the live production URL:

- [ ] **Authentication Flow:**
  - Create a new test user account at `/signup`.
  - Log out and log back in at `/login`.
  - Verify that the session cookie/token persists on page reload.
- [ ] **Business Operations:**
  - Create a new business profile.
  - Verify currency configuration settings (e.g. valid ISO 4217 code checks).
  - Verify that the Business Switcher menu displays the new business and allows switching.
- [ ] **Ledger Transactions:**
  - Log an expense transaction (e.g., "$50 for Office Supplies" under Category "Utilities").
  - Log an income transaction (e.g., "$500 for Consulting" under Category "Sales").
  - Edit a transaction description and verify the change updates the ledger.
  - Test pagination by verifying that the list displays exactly 25 items per page.
- [ ] **Inventory Management:**
  - Navigate to `/inventory`.
  - Create a new product (e.g., "Office Chair", SKU: "OC-001", Initial Stock: 10, Min Stock: 2).
  - Verify the product appears in the inventory list with correct current stock.
  - Perform a **Stock In** operation (add 5 items) and verify the current stock updates to 15.
  - Perform a **Stock Out** operation (remove 3 items) and verify the current stock updates to 12.
  - Verify that both operations are recorded in the **Inventory History** log with correct timestamps and user credentials.
- [ ] **AI Financial Copilot:**
  - Open the Copilot chat interface.
  - Query the chat box (e.g., "Summarize my net profit"). Verify the response aggregates transactions correctly.
  - Test natural language transactions parsing (e.g., type "Spent $20 on Coffee today"). Verify it parses and adds the transaction.
  - Test receipt scanning: Upload a mock scanned receipt. Verify text extraction parses price and description.
- [ ] **Settings and Audit Logs:**
  - Update settings parameters (e.g., timezone, currency format).
  - Invite a mock team member and verify the role settings.
  - Open the audit log view (as admin/owner) and verify that all business mutations (business creation, transaction updates, inventory edits) are correctly recorded in the immutable logs.

---

## 🚨 4. Rollback Plan

If critical smoke tests fail or outages occur, execute the rollback procedures immediately:

### A. Frontend Rollback (Vercel)
To revert the frontend static build to the previous stable deployment:
1. Open the Vercel dashboard for the project.
2. Navigate to the **Deployments** tab.
3. Find the previous stable build, click the three dots, and select **Redeploy**.
4. Confirm redeployment.

### B. Database Rollback (Firestore Rules)
If rules or index updates break API operations:
1. Revert rules to the previous stable state in git:
   ```bash
   git checkout HEAD~1 firestore.rules firestore.indexes.json
   ```
2. Deploy previous stable versions:
   ```bash
   firebase deploy --only firestore
   ```

### C. Database Data Restoration
If datastore structures get corrupted:
1. Restore the Firestore backup:
   ```bash
   gcloud firestore import gs://operant-os-backups/pre-v1.0.0-rc1
   ```

