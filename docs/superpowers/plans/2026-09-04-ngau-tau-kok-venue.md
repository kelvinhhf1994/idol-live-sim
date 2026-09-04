# Ngau Tau Kok Venue Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and render the Ngau Tau Kok (牛頭角) live house venue matching real floor plans and photos (12.7m x 19.3m, 9.2m main stage with stairs, 8.1m LED wall backdrop, wood plank floor, disco ball, trusses, PA panel, crowd barrier) and run local Vite server for user preview.

**Architecture:** Add `NGAU_TAU_KOK_VENUE` definition in `src/config/venue.ts`, implement dedicated procedural 3D builder in `src/scene/createNgauTauKokVenue.ts` (or `createVenue.ts`), integrate dynamic venue loading in `App.ts` and `StationSelector.ts`, verify with unit and layout tests, and launch Vite dev server.

**Tech Stack:** Three.js, TypeScript, Vite, Vitest, Playwright.

## Global Constraints
- Always use English in comments inside code.
- Always respond in Traditional Chinese.
- Adhere to Karpathy guidelines: surgical changes, minimal complexity, goal-driven execution.
- Maintain existing tests passing without regressing NeoBackstage venue behavior.

---

### Task 1: Ngau Tau Kok Venue Definition & Bounds
**Files:**
- Modify: `src/config/venue.ts`
- Test: `src/config/venueLayout.test.ts`
- Test: `src/config/ngauTauKokVenue.test.ts`

### Task 2: Ngau Tau Kok 3D Scene Builder
**Files:**
- Create: `src/scene/createNgauTauKokVenue.ts`
- Modify: `src/scene/createVenue.ts`
- Test: `src/scene/createNgauTauKokVenue.test.ts`

### Task 3: StationSelector & App Dynamic Venue Loading
**Files:**
- Modify: `src/ui/StationSelector.ts`
- Modify: `src/ui/StationSelector.test.ts`
- Modify: `src/app/App.ts`
- Modify: `src/main.ts`

### Task 4: Test Verification & Preview Server Launch
**Files:**
- Run Vitest suite: `npm test`
- Run typecheck: `npm run typecheck`
- Start Vite preview server: `npm run dev`
