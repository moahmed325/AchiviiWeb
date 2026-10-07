# Redesign v1: design notes (history)

**Archived 2026-10-07.** Moved out of `Design.md`, which is now rules only. This is a record of what the redesign (phases 0 to 12) did, kept for context. It is **not** current instructions: where it disagrees with `Design.md`, the code or `docs/product/visual-design-system.md`, those win.

Known to be out of date:
- Custom journeys are not "free with zero paywalls": custom (non-preset) goals are a Pro entitlement (`CLAUDE.md`, `frontend/src/components/billing/CustomGoalGate.tsx`).
- Bundle and asset figures are from Phase 12 and are not maintained.

---

## Legacy elimination (Phase 12)

All legacy remnants have been permanently eliminated from the codebase in Phase 12 (M12.2):
- **Typography:** `Plus Jakarta Sans` and `JetBrains Mono` were completely removed from Google Fonts and `index.css`. The application exclusively uses `Geist` (`font-ui`) and `Geist Mono` (`font-ui-mono`).
- **Radii:** The `--radius-xl/2xl/3xl` override in `index.css` was removed. All components use canonical VDS radii (`rounded-control`, `rounded-card`, `rounded-panel`, `rounded-full`).
- **Colors:** The legacy mint token (`#07CB6C`) was completely eliminated (0 occurrences). All UI controls use semantic tokens (`accent`, `accent-hover`, `border-control`).
- **Dead Code:** `SaaSBuilderModal.tsx`, `PlanV2Panel.tsx`, and obsolete blueprint images (5.4MB) were deleted.

---

## Redesign architecture (phases 6–12)

The redesign integrates all core product systems across Phases 0 through 12 into a unified, accessible, and high-performance application:

### Strategic Roadmap & Journey (Phase 6, VDS §9, §25)
- **Three-Layer Architecture:**
  - *Layer 1 (Immediate Orientation):* `JourneyHeader` with `Day N / 90`, tabular numerals, method badge, and back navigation.
  - *Layer 2 (Emotional Ascent):* `DesktopStaircase` (viewports ≥ 768px) with 2–4 method phase landings, daily flights, and summit destination. `MobileVerticalJourney` (< 768px) replaces the wide staircase with a vertical ascending spine, auto-scrolling to the active step with `rounded-card` phase containers.
  - *Layer 3 (Strategic Detail):* `StrategicRoadmap` collapsible method accordion with milestone deliverables and strict future honesty (zero fabricated tasks on unwritten future weeks).
- **Days 85–90 Closing Stretch (OD-2 Option A):** Unlocked upon completing Week 12, guiding the user through final capstone preparation and Roman garden arrival.

### Weekly Review & Adaptation (Phase 7, BP §18, OD-1a)
- **Analytical Level 3 Summary:** Tabular numeral metrics (`tabular-nums font-ui-mono`), practice sessions completed count (excluding rest days), and non-punitive momentum feedback.
- **Benchmark Test Scoring:** Records actual benchmark criteria from `RoadmapWeek.testResult` without fake grading or video proof requirements.
- **Adaptation Moment:** Displays server AI path rebuilds and encouraging phase-gate reinforcement copy. Unsubmitted reflections persist in `localStorage` draft storage with in-modal 503 retry resilience.

### Progress Analytics (Phase 8, ND-8 Option A)
- **Dedicated Route (`/progress`):** Visual Level 3 typographic overview of total practice hours, adherence percentage, and milestone progress.
- **Benchmark History & Adaptation Log:** Displays historical test results with target comparisons and weekly AI adaptation insights with zero gamified streaks or XP.

### Cinematic 90-Day Achievement (Phase 9, BP §28, VDS §14)
- **Arrival Experience (`/achievement`):** Visual Level 4 transition to the Roman garden (`garden.webp`), computing verified 90-day deliberate practice sessions, adherence rate, benchmark test history, and capstone evaluation.
- **Succession Safety (R-15):** Completed goals are permanently preserved in PostgreSQL history (`completedAt !== null`). "Begin another journey" safely archives active state and routes to onboarding to create a subsequent 90-day goal without data loss.

### Coach ✦ & Custom Journeys (Phase 10, BP §43, ND-10, ND-11)
- **Coach ✦ Navigation:** Placed in the left rail and bottom bar with `Sparkles` icon and `text-achievement` gold accent. Opens `CoachModal` with honest companion positioning and realistic availability notice (zero mock chat or fake AI responses).
- **Custom 90-Day Journeys:** Elevated with craft cards and available 100% free with zero paywalls, locks, or checkout flows.

### Mobile Ergonomics (Phase 11, BP §44–46, OD-5, VDS §28–29)
- **Viewport Matrix:** Rigorously verified across 360px, 375px, 390px, and 412px viewports.
- **Landscape Focus Mode:** Dynamic side-by-side grid (`landscape:grid-cols-12`) with timer on the left and scroll-contained step runner on the right.
- **Safe Area Insets:** Applied `env(safe-area-inset-*)` padding across modal headers, footers, and bottom bars.

### Performance & Bundle Hygiene (Phase 12, BP §38–41, VDS §31–32)
- **Bundle Splitting:** Secondary routes (`OnboardingPage`, `RoadmapPage`, `SignupPage`, `LoginPage`, `ProgressPage`, `AchievementPage`) code-split via `React.lazy` and `Suspense`.
- **Vendor Isolation:** Separated `vendor-react`, `vendor-radix`, and `vendor-icons` for optimal long-term browser cacheability. Main entry bundle reduced by 39.4% to 370KB (107KB gzip) with 0 Rollup warnings.
- **WebP Asset Pipeline:** Slashed asset footprint by >94% (>10MB saved), added explicit dimensions (`width`, `height`, `decoding="async"`), and guaranteed **CLS = 0.000** and **LCP < 1.0s**.
