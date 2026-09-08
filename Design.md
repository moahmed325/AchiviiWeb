# Frontend Design, Responsiveness & Interaction Constraints

Read this file before writing any frontend code, components, or layout structures. Strictly comply with every section.

---

## 1. Anti-Slop & Aesthetics (Hard Restrictions)

### Forbidden Patterns
- **No Glassmorphism:** Never use `backdrop-blur` with low-opacity translucent backgrounds.
- **No Text Gradients:** Avoid rainbow or purple-to-blue gradient text (`bg-clip-text text-transparent`).
- **No Cliché Feature Grids:** Never default to centered hero templates with three floating marketing cards.
- **No Oversized Corner Radii:** Do not use `rounded-2xl` or `rounded-3xl` on standard UI components. Keep radii purposeful and tight (`rounded-md` or `rounded-sm`).
- **No Cliché AI Icons:** Avoid sparkles, stars, or rocket icons. Use clear, descriptive text labels.
- **No Marketing Fluff Copy:** Do not insert generic placeholder phrases like "Elevate your workflow" or "Seamless experience."

### Density & Styling Standards
- **Borders Over Shadows:** Build layout structure using subtle 1px borders (`border border-neutral-200 dark:border-neutral-800`) rather than heavy drop shadows (`shadow-xl`).
- **Color Palette:** High-contrast neutral palette (black, slate/zinc, white) with exactly **one** functional accent color (e.g., emerald for connected states, amber for alerts). Never apply arbitrary saturated background tints.
- **Typography:** Use an intentional sans/grotesque stack for user interface labels and an explicit monospace stack for code, terminals, and numeric data.
- **Explicit Component States:** Every button and input must include visible, intentional `:hover`, `:active`, `:focus-visible`, `:disabled`, and loading states.

---

## 2. Mobile-First Responsiveness & Touch Architecture

### Mobile Hard Constraints
- **Strictly Mobile-First CSS:** Base utility classes must target mobile viewports first (e.g., `flex flex-col md:flex-row`). Never write desktop-first CSS and override with `max-md:`.
- **No Horizontal Viewport Overflow:** Never use `overflow-x: hidden` on `html` or `body` to mask overflowing layout elements. Use fluid widths (`w-full`, `max-w-*`) and never hardcode fixed pixel widths (`w-[600px]`).
- **Touch Target Sizing:** Every interactive element (buttons, tabs, inputs, dropdown items) must have an absolute minimum touch target size of 44×44px (`min-h-[44px] min-w-[44px]` or `p-3`).
- **Safe Area Insets:** Fixed top bars, sticky headers, and floating bottom navigation must incorporate mobile safe areas:
  - Top: `pt-[env(safe-area-inset-top)]`
  - Bottom: `pb-[env(safe-area-inset-bottom)]`
- **Dynamic Viewport Heights:** Avoid `h-screen` or `100vh` on layout wrappers to prevent layout shifting when mobile URL bars show/hide. Use `h-[100dvh]` or `min-h-[100dvh]`.
- **Input Font Scaling:** All inputs, textareas, and select elements must use a minimum font size of `16px` (`text-base`) on mobile to stop iOS Safari from auto-zooming.
- **Flex Child Containment:** Always place `min-w-0` on flex children that contain truncated text (`truncate`) to prevent layout blowout.

### Viewport Breakpoint Adaptations
- **Mobile (< 768px):** Single-column vertical stacks (`grid-cols-1`). Bottom drawers or sheets instead of centered modal popups.
- **Tablet (md: 768px – 1023px):** Maximum 2-column layouts. Persistent navigation collapses into an overlay slide-out.
- **Desktop (lg: 1024px+):** Multi-pane split layouts, persistent sidebars, and dense data tables.

---

## 3. Scroll Behaviors & Overflow Handling

### Scroll Mechanics
- **Scroll Chaining & Overscroll:** Prevent inner scrollable panels (modals, drawers, terminal logs, code previews) from bouncing or scrolling the outer parent page once the edge is reached:
  - Apply `overscroll-contain` to all inner scrollable containers.
  - Apply `overscroll-none` on full-screen modals, sheets, and overlay backdrops.
- **Smooth Scrolling Rules:** Enable smooth scrolling **only** on explicit in-page anchor jumps:
  - Add `scroll-smooth` to target containers.
  - Respect system accessibility preferences by always resetting under `motion-reduce`:
    ```css
    @media (prefers-reduced-motion: reduce) {
      html, * {
        scroll-behavior: auto !important;
      }
    }
    ```
- **Momentum Scrolling:** Ensure momentum scroll behavior is preserved on touch devices:
  - Use `-webkit-overflow-scrolling: touch;` on all scrollable elements.

### Scrollbar Ergonomics & Visuals
- **No Jarring Layout Shifts:** Use `scrollbar-gutter: stable` on root containers or main feed panels to prevent content from jumping when scrollbars appear or disappear.
- **Scrollbar Styling:** Never display default wide desktop scrollbars inside application panels. Use minimal custom tracks or auto-hiding scroll utilities:
  - `scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent`
- **Header Scroll Transitions:** Do not leave sticky navigation bars identical in appearance during page scroll. Add an elevation border or subtle background shift on scroll engagement.

### Specialized Component Scroll Rules
- **Terminal & Log Outputs:**
  - Auto-scroll to bottom only when the user is already pinned to the bottom.
  - If the user scrolls up to inspect previous output, lock autoscroll immediately.
  - Include an explicit "Jump to Bottom" button when new log entries arrive while scrolled up.
- **Data Tables:**
  - Never squash table columns to fit screen width.
  - Wrap tables in a dedicated horizontal scroll container (`overflow-x-auto`).
  - Pin primary identification columns using sticky positioning (`sticky left-0 bg-inherit`).
  - Collapse table rows into vertical key-value cards on viewports smaller than `768px`.
- **Code & Diff Viewers:**
  - Code blocks and unified diff viewers must always use `overflow-x-auto` with isolated horizontal scrolling.
  - Line numbers must remain fixed in place (`sticky left-0`) while code lines scroll horizontally.
