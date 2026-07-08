# Operant OS - Manual QA Checklist (v1.0.0-rc1)

This manual QA plan outlines the comprehensive testing checklist for **Operant OS** prior to its first private beta release. It covers all key system modules, workflows, role permissions, and edge cases.

---

## 📋 Table of Contents
1. [Authentication](#1-authentication)
2. [Businesses & Team Permissions](#2-businesses--team-permissions)
3. [Transactions Ledger](#3-transactions-ledger)
4. [Reports](#4-reports)
5. [AI Financial Copilot](#5-ai-financial-copilot)
6. [Receipt Scanner](#6-receipt-scanner)
7. [Dashboard](#7-dashboard)
8. [System Notifications](#8-system-notifications)
9. [Settings](#9-settings)
10. [Error Handling & Reliability](#10-error-handling--reliability)
11. [Responsive Layout & Mobile UX](#11-responsive-layout--mobile-ux)
12. [Accessibility (a11y)](#12-accessibility-a11y)
13. [Performance & Rate Limiting](#13-performance--rate-limiting)

---

## 🔑 1. Authentication

Testing the user authentication lifecycle using Firebase Auth.

### TC-AUTH-01: User Signup
* **Objective:** Verify a new user can successfully register an account.
* **Steps:**
  1. Open the web browser and navigate to `/signup`.
  2. Enter a valid email address not currently registered.
  3. Enter a strong password (minimum 6 characters).
  4. Click the **Sign Up** button (verify loading state disabled/double-submit guard is active).
* **Expected Result:** The user account is created in Firebase Auth, and the user is redirected to the `/business` setup onboarding flow. A success notification is shown.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-AUTH-02: User Login
* **Objective:** Verify an existing user can log in with correct credentials.
* **Steps:**
  1. Navigate to `/login`.
  2. Input a registered email and password.
  3. Click **Log In** (verify the button disables and displays `Logging in...` / loading state).
* **Expected Result:** The user is logged in successfully and redirected to the `/dashboard` (or `/businesses` if no active business is selected).
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-AUTH-03: Invalid Credentials
* **Objective:** Verify validation and error display for incorrect email or password.
* **Steps:**
  1. Navigate to `/login`.
  2. Input an incorrect password for a registered user or enter an unregistered email.
  3. Click **Log In**.
* **Expected Result:** Login fails. An error message appears (e.g. `Invalid credentials` or `Auth error: ...`), buttons are re-enabled, and no session is started.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-AUTH-04: Session Persistence
* **Objective:** Verify user sessions persist across page refreshes and tab closures.
* **Steps:**
  1. Log in successfully.
  2. Navigate to the `/dashboard` and perform a hard page refresh (F5 / Cmd+R).
  3. Close the tab, open a new tab, and navigate directly to `/dashboard`.
* **Expected Result:** The user remains authenticated, their active business data loads immediately, and they are not redirected back to `/login`.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-AUTH-05: User Logout
* **Objective:** Verify the user session terminates correctly upon logging out.
* **Steps:**
  1. Navigate to the `/dashboard` or ledger views.
  2. Locate the navigation header profile section and click the **Logout** button.
  3. Once logged out, click the browser's "Back" button.
* **Expected Result:** The user is redirected to `/login`. Clicking the back button does not display authenticated dashboard panels or bypass auth.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-AUTH-06: Unauthorized Access Guard
* **Objective:** Verify private pages cannot be accessed by unauthenticated users.
* **Steps:**
  1. Open a clean incognito window.
  2. Attempt to navigate directly to `/dashboard`, `/transactions`, `/reports`, `/settings`, `/copilot`, or `/business`.
* **Expected Result:** Navigation is intercepted. The user is redirected to the `/login` route.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

---

## 🏢 2. Businesses & Team Permissions

Testing multi-tenant business creation, metadata profile updating, switcher logic, and role constraints.

### TC-BIZ-01: Create Business
* **Objective:** Verify that users can initialize a new business ledger scope.
* **Steps:**
  1. Navigate to `/business`.
  2. Input a business name (e.g. "Stark Enterprises"). Leave blank to test validation first.
  3. Click **Create Business** (verify loading state `Creating...`).
* **Expected Result:** Validation fails if blank. On valid input, the business document is successfully saved to Firestore with the current user's UID as `ownerId` and member role `'owner'`. The app automatically switches to this new business and redirects to `/dashboard`.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-BIZ-02: Edit Business Profile (Localization & Metadata)
* **Objective:** Verify owners/admins can modify business profile variables in settings.
* **Steps:**
  1. Navigate to `/settings`.
  2. Modify **Business Name**, **Tax ID**, **Business Description**, and **Address**.
  3. Update **Base Currency** (e.g. change USD to INR or EUR), **Timezone**, and **Financial Year**.
  4. Click **Save Changes**.
* **Expected Result:** Profile parameters update in Firestore. The currency symbol throughout the application updates to reflect the selected base currency (e.g. `₹` for INR, `€` for EUR) format via `Intl.NumberFormat`.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-BIZ-03: Switch Active Business
* **Objective:** Verify a user can switch contexts between multiple businesses they own or belong to.
* **Steps:**
  1. Create a second business (e.g. "Wayne Enterprises").
  2. Navigate to `/businesses`.
  3. Identify "Stark Enterprises" in the list (shows **Select** button) and click it.
* **Expected Result:** The active business switches. The selector updates to read **Selected** (disabled). Dashboard and transactions display Stark Enterprises’ financial data.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-BIZ-04: Invite Team Member (Role Assignment)
* **Objective:** Verify that owners/admins can invite other registered users to join the business ledger.
* **Steps:**
  1. Navigate to `/settings` as a business owner.
  2. Under the "Invite Member" section, enter the email address of another registered user.
  3. Select the role: **Admin** or **Staff**.
  4. Click **Add Member** (verify double-submit protection).
* **Expected Result:** The member's UID is successfully associated with the business's `members` map in Firestore. A success toast notification is displayed. The invited user can now see the business under their `/businesses` directory.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-BIZ-05: Remove Team Member
* **Objective:** Verify that owners/admins can remove members from the business directory.
* **Steps:**
  1. Navigate to `/settings` as a business owner.
  2. Under "Team Members", locate an invited collaborator.
  3. Click the **✕** or **Remove** button.
  4. Click **OK** on the browser confirmation prompt.
* **Expected Result:** The member is removed from the `members` map. A warning toast is shown. The removed user can no longer switch to this business ledger context.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-BIZ-06: Read-Only Access enforcement (Staff Role Restrictions)
* **Objective:** Verify that users joined with the **Staff** role have read-only settings and cannot mutate resources.
* **Steps:**
  1. Log in as a user added to a business with the **Staff** role.
  2. Navigate to `/settings`.
  3. Look for the warning banner: `⚠️ You are accessing this business as a Staff member...`
  4. Try to edit inputs, invite members, or click save actions.
* **Expected Result:** All business profile form inputs, selectors, and buttons are disabled. The Invite Member fields and actions are disabled/hidden. Staff members cannot update configuration.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-BIZ-07: Business Deletion & Security Gates
* **Objective:** Verify that only the business owner can delete a business, and that database records are protected.
* **Steps:**
  1. Business deletion is not exposed in the UI. Open a Firestore console or construct a test Firestore write.
  2. Attempt to delete a business document as its **Owner**.
  3. Attempt to delete a business document as an **Admin** or **Staff** member.
* **Expected Result:** Owner deletion succeeds. Admin or Staff deletion fails with a Firestore permission error (per `allow delete` rule in `firestore.rules`).
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

---

## 💸 3. Transactions Ledger

Testing manual transaction lifecycle, form validations, duplicate, and query mechanisms.

### TC-TX-01: Create Expense / Income
* **Objective:** Verify users can record manually entered financial transactions.
* **Steps:**
  1. Navigate to `/transactions`.
  2. Under the transaction editor, set the type to **Expense**.
  3. Enter **Amount** (e.g. `120.50`), **Description** (e.g. "Software Subscription"), **Category** (e.g. "Software"), and select a **Date**.
  4. Leave **Merchant** and **Currency** optional, then click **Add Transaction**.
  5. Repeat the process but select **Income** and Category **Revenue** (e.g. amount `5000.00`).
* **Expected Result:** The transactions save to Firestore, write a log to audit collection, and prepend to the visible ledger list. Success toasts are displayed.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-TX-02: Form Inputs & Currency Input Validation
* **Objective:** Verify that malformed amounts, negative numbers, or invalid inputs are rejected.
* **Steps:**
  1. Navigate to `/transactions` and try submitting with:
     - Empty description
     - Negative amount (`-45`)
     - String/letters inside amount field (`abc`)
     - Invalid currency code override if input is exposed
* **Expected Result:** The application rejects input. Form displays error warnings (e.g., indicating required fields or rejecting negative values), and Firestore writes are blocked.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-TX-03: Edit Transaction
* **Objective:** Verify existing ledger entries can be modified.
* **Steps:**
  1. On `/transactions`, click **Edit** (or pencil icon) next to a transaction.
  2. Modify the amount (e.g., change `120.50` to `150.00`) and update the description.
  3. Click **Save Changes**.
* **Expected Result:** The ledger transaction updates in Firestore. The list refreshes with the new details. An audit log entry `"edit_transaction"` is recorded.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-TX-04: Duplicate Transaction
* **Objective:** Verify transactions can be cloned without re-typing.
* **Steps:**
  1. Locate a transaction in the ledger list.
  2. Click the **Duplicate** button.
* **Expected Result:** A new transaction with identical fields is generated. An audit log entry `"duplicate_transaction"` is written. The cloned entry is prepended to the list, showing a success toast notification.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-TX-05: Delete Transaction (Role Enforcement)
* **Objective:** Verify that transactions can only be deleted by Admin or Owner roles.
* **Steps:**
  1. Log in as an **Owner** or **Admin**. Navigate to `/transactions` and click **Delete** next to a transaction. Confirm the dialog.
  2. Log in as a **Staff** member. Navigate to `/transactions` and try to delete a transaction.
* **Expected Result:** Owner/Admin can delete successfully. Staff cannot delete (the button is disabled/hidden in the UI, and if simulated programmatically, blocked by the `allow delete: if isBusinessAdmin(...)` Firestore security rules).
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-TX-06: Search Bar (Prefix Match & Live Filters)
* **Objective:** Verify description search behaves correctly on paginated databases.
* **Steps:**
  1. Enter a unique keyword into the search bar (e.g. "Software").
  2. Wait for the debounce timer (approx 500ms).
* **Expected Result:** The transactions ledger updates. Only items where the description contains or matches the prefix of "Software" are displayed.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-TX-07: Filters (Type, Category, Date Ranges)
* **Objective:** Verify combining ledger filters updates queries correctly.
* **Steps:**
  1. Select filter **Type**: "Expense".
  2. Select filter **Category**: "Software".
  3. Select **Date Range** (e.g. start date and end date).
* **Expected Result:** Only matching expenses appear. The app handles Firestore query composition without crash or index failures.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-TX-08: Pagination (Load More Scroll / Buttons)
* **Objective:** Verify paginated data fetching and scroll limits.
* **Steps:**
  1. Seed at least 30 transactions for the active business.
  2. Navigate to `/transactions`.
  3. Check that only the first 25 transactions display initially.
  4. Scroll down or click the **Load More** button.
* **Expected Result:** The next page of transactions fetches using the last visible document cursor, appending successfully to the bottom of the list.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

---

## 📊 4. Reports

Testing Profit & Loss aggregation, chart renderings, and CSV output files.

### TC-REP-01: Profit & Loss Aggregation
* **Objective:** Verify that income and expense numbers are summed accurately.
* **Steps:**
  1. Navigate to `/reports`.
  2. Check total income, total expenses, and net profit values against the transactions ledger.
* **Expected Result:** Figures must match the sum of transactions for the active date range.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-REP-02: Date Range Filters
* **Objective:** Verify that changing report durations updates dashboard metrics.
* **Steps:**
  1. Change the date filter options: "Last 7 Days", "Last 30 Days", "Last 90 Days", and "All Time".
* **Expected Result:** Line charts and statistics reload dynamically to only capture transactions within the selected range boundaries.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-REP-03: Category Breakdown
* **Objective:** Verify expenses are categorized and formatted correctly in the report breakdown list.
* **Steps:**
  1. Navigate to `/reports`.
  2. Look at the percentage / value category table list.
* **Expected Result:** Categories sum up correctly (e.g. all software expenses grouped under "Software") and render using the correct active business base currency format.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-REP-04: Empty Report State
* **Objective:** Verify report panels behave gracefully when no data is loaded.
* **Steps:**
  1. Create a brand new business with zero transactions.
  2. Navigate to `/reports`.
* **Expected Result:** The page does not crash. It displays an empty state message (e.g. "No transactions found for this period") and empty/zeroed charts.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-REP-05: Export CSV
* **Objective:** Verify report data can be exported to a CSV spreadsheet.
* **Steps:**
  1. Click the **Export CSV** button.
  2. Open the downloaded file.
* **Expected Result:** A file named in format `${business-name}-${date-range}-report.csv` downloads. The CSV file must contain columns for Date, Description, Category, Type, Amount, and Currency, showing the filtered transaction list correctly.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

---

## 🤖 5. AI Copilot

Testing AI conversational finance queries, intent routing, and natural language ledger entry.

### TC-COP-01: General Financial Questions
* **Objective:** Verify the AI Copilot can answer questions about business health.
* **Steps:**
  1. Navigate to `/copilot`.
  2. Ask a question: "What was my highest expense category?" or click a suggested question: "How is my business doing?".
* **Expected Result:** The assistant answers accurately, referencing database categories, transaction records, and net balance summaries.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-COP-02: Natural Language Transaction Extraction
* **Objective:** Verify conversational entry parses text parameters into transactions.
* **Steps:**
  1. Navigate to `/copilot` (or `/transactions/ai`).
  2. Enter: "Spent $45.90 on Marketing ads yesterday".
  3. Send query.
* **Expected Result:** The AI identifies the intent as transaction creation. An interactive confirmation card displays showing:
   - Type: Expense
   - Amount: 45.90
   - Category: Marketing
   - Description: Marketing ads
   - Date: Yesterday's date (YYYY-MM-DD)
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-COP-03: Transaction Saving & Confirmation
* **Objective:** Verify that confirming an AI extracted card writes to the database.
* **Steps:**
  1. In the AI extraction preview, edit the description or amount if needed.
  2. Click the **Confirm / Save** button inside the card.
* **Expected Result:** The transaction is added to the database. The card status changes to "confirmed" or shows a saved state. The transaction appears in the ledger list.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-COP-04: Invalid AI Prompts & Sanitization
* **Objective:** Verify fallback actions for unrelated, malicious, or malformed prompt text.
* **Steps:**
  1. Navigate to `/copilot` and submit non-financial questions: "What is the capital of France?" or write a script tag `Hello <script>alert(1)</script>`.
* **Expected Result:** The prompt does not execute scripting. The Copilot replies politely, explaining its capability is limited to financial analysis and transaction booking.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-COP-05: Context Accuracy & Business isolation
* **Objective:** Verify the AI Copilot does not leak information or access data from other businesses.
* **Steps:**
  1. Have Business A (active) and Business B (inactive) owned by the same user.
  2. Query Copilot: "Summarize my transactions".
* **Expected Result:** The AI answers using details exclusively from Business A. It must not list or calculate any financial records belonging to Business B.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

---

## 📷 6. Receipt Scanner

Testing client-side OCR parsing, validation pipelines, and Gemini-based mapping.

### TC-REC-01: Valid Receipt Processing
* **Objective:** Verify a high-quality receipt image is read and extracted.
* **Steps:**
  1. Navigate to `/transactions/receipt`.
  2. Upload/Drop a clean PNG or JPG invoice receipt (e.g. $25.00 from AWS on Software).
  3. Click **Scan / Run Pipeline** (verify stage flows: `ocr` -> `validation` -> `extraction` -> `ready`).
* **Expected Result:** Tesseract.js recognizes the text. The API parses details. An editable form populates with: Type: expense, Amount: 25.00, Category: Software, Merchant: AWS, Currency: USD.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-REC-02: Blurry / Unreadable Receipt
* **Objective:** Verify the pipeline detects illegible receipts and fails gracefully.
* **Steps:**
  1. Upload a blurry image, an abstract design, or a blank photo.
  2. Click **Scan**.
* **Expected Result:** The pipeline stops at the OCR or validation stage. It displays the error: `"The scanner could not extract legible text. Please upload a clearer, well-lit receipt."` or `"OCR Processing failed. The receipt image might be too blurry or corrupted."`
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-REC-03: Unsupported Image Format
* **Objective:** Verify file extensions are validated before execution.
* **Steps:**
  1. Attempt to drag/upload a `.pdf`, `.txt`, `.gif`, or `.zip` file.
* **Expected Result:** The upload is rejected immediately. The UI displays the error: `"Unsupported file format. Please upload a JPG, JPEG, or PNG image."`
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-REC-04: OCR Failures & Custom Corrections
* **Objective:** Verify users can manually correct low-confidence scanner outputs.
* **Steps:**
  1. Upload an image with partial handwriting or low contrast.
  2. Let the pipeline load the fields (some may be empty or incorrect).
  3. Manually type the missing amount, correct the merchant, change category from dropdown, and click **Save**.
* **Expected Result:** The modified transaction records successfully in the ledger with the user's manual adjustments.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

---

## 📊 7. Dashboard

Testing the aggregate analytics layout.

### TC-DSH-01: Metrics Overview & Currency Formatting
* **Objective:** Verify aggregate values show the correct values and currency symbol.
* **Steps:**
  1. View the main dashboard page.
  2. Check the four widgets: Income, Expenses, Net Balance, Total Transactions.
* **Expected Result:** If base currency is USD, fields format as `$1,200.00`. If changed to EUR, fields display as `€1,200.00` using localized formatting rules.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-DSH-02: Chart Hydration Mismatch Safety
* **Objective:** Verify no page flicker or Next.js hydration crashes occur.
* **Steps:**
  1. Open `/dashboard` and perform a hard reload.
  2. Monitor console for React/Next.js hydration warnings.
* **Expected Result:** The page renders cleanly. No "text content did not match" console errors appear, as charts render only after client mounting.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-DSH-03: AI Financial Insights Panel
* **Objective:** Verify automated financial feedback is loaded.
* **Steps:**
  1. Check the Dashboard "Insights" section.
* **Expected Result:** The app summarizes budget flags, spending spikes, or positive margin metrics generated via Gemini.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

---

## 🔔 8. System Notifications

Testing the in-app alert framework and automated insights warning banner.

### TC-NTF-01: Form Action Success/Error Toasts
* **Objective:** Verify UI feedback floats on top of the layout and slides out correctly.
* **Steps:**
  1. Add a transaction or invite a member.
* **Expected Result:** A toast message slides in from the right edge with appropriate styling:
   - Green (Success) with `✓` icon
   - Yellow (Warning) with `⚠️` icon
   - Red (Error) with `✕` icon
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-NTF-02: Notification Dropdown Feed
* **Objective:** Verify the Navbar dropdown stores and updates notifications.
* **Steps:**
  1. Locate the bell icon in the Navbar (shows unread badge count).
  2. Click it to open the feed.
  3. Click a notification item.
* **Expected Result:** Clicking the item marks it as read, reducing the unread badge count. The item updates visual read indicators.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-NTF-03: AI Insights Spike Alerting
* **Objective:** Verify automated notifications trigger on extreme spending.
* **Steps:**
  1. Add a transaction with an abnormally high amount (e.g. 500% of average expense).
  2. Refresh the insight alerts.
* **Expected Result:** An AI warning notification triggers (e.g., "Expense Spike Detected") and inserts into the notification center.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

---

## ⚙️ 9. Settings

Testing the system parameters configuration screen.

### TC-SET-01: Profile Settings Input Fields
* **Objective:** Verify business details can be saved and retrieved.
* **Steps:**
  1. Go to `/settings`.
  2. Fill out **Business Name**, **Tax ID**, **Description**, **Address**, **Base Currency**, **Timezone**, and **Financial Year**.
  3. Click **Save Changes** and refresh the page.
* **Expected Result:** Saved values load back into their respective fields. Changes apply immediately across the workspace.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

---

## 🛡️ 10. Error Handling & Reliability

Testing resilience during network failure and backend exceptions.

### TC-ERR-01: Network Disconnect & Firebase Retries
* **Objective:** Verify the application handles temporary offline scenarios.
* **Steps:**
  1. Log in. Go to `/transactions`.
  2. Turn off your internet connection (or set DevTools Network to Offline).
  3. Try to add a transaction.
  4. Turn the network connection back on.
* **Expected Result:** The write queues. The application retries the request using the `retry` utility, completing the transaction write once connection is restored without crashing the UI.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-ERR-02: Global Error Boundary
* **Objective:** Verify unexpected React crashes do not break the browser.
* **Steps:**
  1. Force an unhandled error inside a rendering component (e.g. simulate a null property read).
* **Expected Result:** The screen is intercepted by the `ErrorBoundary` fallback component, displaying a user-friendly error message, details summary, and a **Reload Page** button.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-ERR-03: API Universal 401 Masking
* **Objective:** Verify security token expiration or absence triggers authentication redirection.
* **Steps:**
  1. Call `/api/copilot` or `/api/receipts/analyze` endpoints directly using postman or curl without authorization headers.
* **Expected Result:** The backend responds with status `401` and a clean authentication failure exception (rather than exposing raw database exceptions).
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

---

## 📱 11. Responsive Layout & Mobile UX

Testing multi-device adaptability.

### TC-RESP-01: Collapsible Navigation Hamburger
* **Objective:** Verify the navbar adjusts on smaller viewport resolutions.
* **Steps:**
  1. Resize window width to under `768px` (Mobile view).
* **Expected Result:** Desktop link panels hide, replacing themselves with a mobile hamburger icon. Clicking it reveals the navigation drawer link panel.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-RESP-02: Mobile Ledger Layout & Grid adaptivity
* **Objective:** Verify tables and columns remain usable without breaking overflow.
* **Steps:**
  1. View `/transactions` and `/reports` on a narrow mobile layout.
* **Expected Result:** Transaction listings compress elegantly. Horizontal scrolling is active for wide data tables. Text values do not overflow screen boundaries.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

---

## ♿ 12. Accessibility (a11y)

Testing screen reader support and keyboard-only operability.

### TC-ACC-01: Keyboard Navigation Focus Ring
* **Objective:** Verify full keyboard interaction capabilities.
* **Steps:**
  1. Unplug mouse or use tab keys.
  2. Tab through all form links, input fields, checkboxes, and buttons on `/login`, `/dashboard`, `/transactions`, and `/settings`.
* **Expected Result:** A clear visual focus outline ring highlights the currently selected interactive HTML element. The user can submit forms by pressing Enter.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-ACC-02: Semantic Elements & Aria Labels
* **Objective:** Verify accessibility tagging structures.
* **Steps:**
  1. Inspect the DOM structures.
* **Expected Result:** Standard semantic landmarks (`<main>`, `<header>`, `<nav>`, `<ul>`, `<li>`) are used. Icons and buttons (especially close elements and visual flags) contain descriptive `aria-label` or alternate text tags.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

---

## ⚡ 13. Performance & Rate Limiting

Testing server load mitigation, database access optimizations, and rate-control limits.

### TC-PERF-01: API Rate Limiting Guards
* **Objective:** Verify client rate limiting restricts excessive AI endpoint hits.
* **Steps:**
  1. Send 15 continuous requests within 60 seconds to `/api/copilot`, `/api/transactions/ai`, or `/api/receipts/analyze`.
* **Expected Result:** Rate limit is hit. The API rejects subsequent requests with a status `429 Too Many Requests` (or returns rate-limited warning states), protecting server API credentials.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 

### TC-PERF-02: Minimised Firestore Reads via Pagination
* **Objective:** Verify page updates avoid massive document reads.
* **Steps:**
  1. Monitor Firestore reads during ledger navigation.
* **Expected Result:** Initial reads are capped strictly at 25 items using query limit parameters. Moving between dashboard and reports does not trigger full collection scans.
* **Status:** [ ] Pass | [ ] Fail
* **Notes:** 
