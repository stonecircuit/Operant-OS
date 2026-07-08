# Changelog

All notable changes to the **Operant OS** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-rc1] - 2026-07-08

### Added
- **Inventory Core Module**:
  - Full product catalog CRUD operations.
  - SKU support, product category, unit configurations, purchase price, and selling price tracking.
  - Transaction-based Stock In and Stock Out adjustments with automatic inventory recalculation.
  - Low stock warning flags and automated real-time notification warnings.
  - Beautiful visual analytics dashboard (charts on stock level vs min, stock value by category) using Recharts.
  - Instant downloadable CSV reports.
- **AI Copilot & Router Integrations**:
  - Centralized routing for financial queries and inventory tracking commands.
  - Extracted conversational stock operations ("Add 20 CPUs", "Sold 5 laptops") and presented as interactive, editable stock adjustment confirmation cards.
  - Provided Gemini with live product context to answer inventory level inquiries and valuation consults dynamically.

### Changed
- **Landing Entry Redirect**: Replaced root dev test placeholder page `/` with a clean Next.js router redirect to `/dashboard`.
- **Package Unification**: Unify package name as `operant-os` and unified metadata version under `1.0.0-rc1`.

### Fixed
- **Type Checking Compliance**: Resolved TypeScript errors regarding nullable fallback values, charts type safety parameters, and closures.
- **Linter Formatting Warnings**: Cleaned up React hook set-state cascading render issues, missing dependency arrays, unescaped JSX quotes, and implicit `any` parameter types.
- **Firestore Security Rules**: Secured database catalogs, ensuring that only verified business members can perform inventory/products read and write actions.

---

## [0.2.0] - 2026-07-05

### Added
- **Collaboration & Multi-User Business Switching**: Enabled staff/admin collaborators to joined businesses.
- **Firestore Query Pagination**: Integrated server-side cursor-based paging for database lists.
- **Centralized Environment Validator**: Enforced startup validations for secure backend secrets and client-side config keys.

### Fixed
- **Currency Config Safe Validation**: Replaced basic regex checks with runtime `Intl.NumberFormat` checks to prevent range error crashes on invalid currency codes.
- **Firestore Schema Indexing**: Configured index rules for transactions and audit logs.

---

## [0.1.0] - 2026-06-15

### Added
- **Accounting Core**:
  - Ledger Transactions logging.
  - Core Profit and Loss reports.
  - Centralized audit logging.
  - IP-based lightweight API rate limiting.
