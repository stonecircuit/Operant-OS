# Operant OS - Sprint QA Bug Tracker & Feature Logs

This document tracks all verified issues discovered during manual QA, along with their resolution status and engineering descriptions.

---

## 1. BUG-001 (Critical) - AI-Created Transactions Fail due to Undefined Fields
* **Issue:** AI-created transactions failed to write to Firestore with error `invalid document field: undefined`. The parser outputted `merchant: undefined` or `currency: undefined` when not found in user speech.
* **Impact:** 100% crash rate for natural language transaction entries without explicit merchant names.
* **Resolution:** 
  * Updated `createTransaction` in [transactionService.ts](file:///d:/Tabysh/stone%20circuit/Operant%20OS/apps/web/services/transactionService.ts) to clean and strip any properties with `undefined` values from the payload data object before calling `addDoc`.
  * Ensured optional fields are written as `null` or omitted to satisfy Firestore strict write schemas.

## 2. BUG-002 (Critical) - Active Business & Ledger Records Disappear on Page Refresh
* **Issue:** 
  1. Business selection context was cleared on refresh because Firebase Auth initializes with `loading: true` and `user: null`, which triggered the logout/cleanup hook prematurely.
  2. Submitting filters and search queries crashed query execution or returned zero results due to unindexed description filter combinations and Firebase range/inequality constraints.
* **Impact:** Lost active business state on reload; crashed transaction lists when applying complex search/sort filters.
* **Resolution:**
  * Modified the logout hook in [BusinessContext.tsx](file:///d:/Tabysh/stone%20circuit/Operant%20OS/apps/web/contexts/BusinessContext.tsx) to only reset local storage settings once auth finished loading (`!loading && !user`).
  * Refactored query compilation in `getTransactionsPaginated` in [transactionService.ts](file:///d:/Tabysh/stone%20circuit/Operant%20OS/apps/web/services/transactionService.ts). If description search is active, it drops date filters (preventing multiple inequality filters in the same Firestore query). If date ranges are active but user sorts by description or amount, the system falls back to `date-desc` database query sorting and performs client-side sorting when necessary to obey Firestore constraints.

## 3. BUG-003 (Critical) - Verify Firestore Composite Indexes
* **Issue:** Missing composite indexes for transaction queries sorting by description or amount combined with date ranges and business scopes.
* **Impact:** Query crashes when searching or sorting in the transaction ledger page.
* **Resolution:**
  * Added 8 new composite index mappings to [firestore.indexes.json](file:///d:/Tabysh/stone%20circuit/Operant%20OS/firestore.indexes.json) to cover sorting by amount and description alongside business filters.

## 4. BUG-004 (High) - Inability to Create Multiple Businesses
* **Issue:** UI hid the "Create Business" button on the business selector page once a user owned one or more businesses.
* **Impact:** Users were locked into their first business and could not create additional ledger spaces.
* **Resolution:**
  * Updated [businesses/page.tsx](file:///d:/Tabysh/stone%20circuit/Operant%20OS/apps/web/app/businesses/page.tsx) to render a "＋ Create Business" action card next to the business total metric when the user owns one or more business scopes.

## 5. FEATURE-001 (High) - Business-Specific Categories
* **Goal:** Replace hardcoded global income and expense category sets with business-specific categories, while preserving default categories for new businesses.
* **Resolution:**
  * Added `incomeCategories` and `expenseCategories` string arrays to the `Business` type definition in [business.ts](file:///d:/Tabysh/stone%20circuit/Operant%20OS/apps/web/types/business.ts).
  * Populated defaults during new business creation in [businessService.ts](file:///d:/Tabysh/stone%20circuit/Operant%20OS/apps/web/services/businessService.ts).
  * Exposed active category lists in [BusinessContext.tsx](file:///d:/Tabysh/stone%20circuit/Operant%20OS/apps/web/contexts/BusinessContext.tsx).
  * Integrated custom category arrays into transaction validation rules in [validation.ts](file:///d:/Tabysh/stone%20circuit/Operant%20OS/apps/web/lib/validation.ts).
  * Injected custom categories into the Gemini prompt instructions and response validation within [transactionExtractor.ts](file:///d:/Tabysh/stone%20circuit/Operant%20OS/apps/web/services/ai/transactionExtractor.ts).
  * Built a beautiful **Category Management** dashboard card in [settings/page.tsx](file:///d:/Tabysh/stone%20circuit/Operant%20OS/apps/web/app/settings/page.tsx) allowing business owners and administrators to add and delete categories dynamically with full GCP logging audit logs.

## 6. BUG-005 (Medium) - Missing Reset Action in Transaction Filters
* **Issue:** No quick way to clear applied search inputs and filter drop-downs.
* **Impact:** Poor user experience; required manual erasure of fields and select resetting.
* **Resolution:**
  * Implemented a `Clear Filters` action link next to the filters header inside [transactions/page.tsx](file:///d:/Tabysh/stone%20circuit/Operant%20OS/apps/web/app/transactions/page.tsx). It shows dynamically only when one or more filters are dirty, and resets all inputs to default settings on click.

## 7. BUG-006 (Medium) - Missing Redirect after Switching Active Business
* **Issue:** Setting a business active kept the user on the switcher page.
* **Impact:** Required additional manual clicks to go back to the dashboard.
* **Resolution:**
  * Added automatic router redirecting to `/dashboard` immediately after setting the active business scope in [businesses/page.tsx](file:///d:/Tabysh/stone%20circuit/Operant%20OS/apps/web/app/businesses/page.tsx).
