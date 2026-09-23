# Frontend Design, Responsiveness & Interaction Rules

Read this file before writing any frontend code, component or layout. It is the implementation rulebook: the tokens, the primitives, and the mobile, touch, scroll and accessibility rules every screen follows.

**Precedence.** The visual direction lives in [`docs/visual-design-system.md`](docs/visual-design-system.md) (the VDS). If this file and the VDS ever disagree, **the VDS wins** and this file is corrected. Product and screen decisions live in [`docs/redesign-blueprint.md`](docs/redesign-blueprint.md) and [`docs/decisions.md`](docs/decisions.md).

**Where things are.**

| What | Where |
|---|---|
| Tokens | `frontend/src/index.css`, inside `@theme` |
| Primitives | `frontend/src/components/ui/`, imported from `components/ui` |
| Live preview of every primitive and state | `/__ui` (development server only; not in production builds) |
| Primitive tests | `frontend/src/components/ui/*.test.tsx` |

---

## 1. Visual direction

> **Cinematic when inspiring, minimal when executing.** The interface should feel like a journey, not a dashboard. (VDS §33)

### Use

- **Deep architectural darkness.** Dark only; there is no light mode or theme toggle. Light surfaces (`surface-inverse`) are compositional: a section, an achievement moment. They are not a theme. **For now they hold text and `TextLink` only** (see §3).
- **Solid dark surfaces inside the app.** Cards are dark, thin-bordered, moderately rounded, generously padded, and may carry a deep, soft shadow (`shadow-raised`, `shadow-overlay`). They are architectural surfaces, not floating candy-coloured cards.
- **Light glass, only over imagery.** Backdrop blur and translucency are allowed when a component sits over an image or an atmospheric background (`Surface tone="glass"`). Never make every element glass. On mobile, avoid `backdrop-blur` over large moving images; use a pre-darkened image layer instead.
- **Moderate radii.** Four named radii (see §2.4). Special cards can be almost rectangular.
- **One botanical accent, one warm achievement tone.** `accent` (green) marks progress and focus; `achievement` (gold) marks milestones, destinations and premium. `caution` and `danger` are status colours only, never decoration.
- **Massive typography and negative space.** Let headings be large and let sections breathe.
- **The progression grammar.** Step ○, active ●, completed ✓, milestone ◆, destination ✦, via `StepMarker`. The ✦ mark is the destination and Coach sign, not a generic "AI" sparkle.
- **One icon family.** lucide-react, stroke width 1.5, thin and geometric. Don't add a second icon set.

### Don't

- No purple-to-blue or rainbow gradients, and no gradient text (`bg-clip-text text-transparent`).
- No neon green, and no arbitrary saturated background tints.
- No dashboards full of cards, and no charts that don't answer a user question.
- No rockets or generic AI icons, and no ✦ used as decoration.
- No generic marketing copy ("Elevate your workflow", "Seamless experience"). Say what the product does.
- No excessive animation. Motion is subtle and always has a reduced-motion path.
- Never sacrifice usability or contrast for cinematic visuals.

### Component states

Every interactive element has visible, intentional **hover**, **active**, **focus-visible**, **disabled** and, where it can wait on the network, **loading** states. The primitives already implement all of them; screens get them for free by using the primitives.

---

## 2. Tokens

Tokens are named by **role, never by colour**, so a rebrand changes only the `@theme` block. Tailwind generates the utilities: `--color-surface` gives `bg-surface`, `border-surface`, `text-surface` and so on.

**Never hard-code a hex value, font size, radius or shadow in a component.** If a role is missing, add it to `@theme` and to this file.

### 2.1 Colour roles

| Token | Value | Use it for |
|---|---|---|
| `background` | `#0B0B0A` | Page background |
| `surface` | `#141413` | Cards, panels, inputs |
| `surface-elevated` | `#1C1C1A` | Dialogs, sheets, raised cards |
| `surface-inverse` | `#F1EFE8` | Light compositional sections (add `on-inverse`, see §3) |
| `scrim` | `rgba(6,6,5,0.72)` | Overlay behind dialogs |
| `text` | `#F5F3EC` | Primary text; the primary button fill |
| `text-secondary` | `#A7A59E` | Supporting text, labels, **all micro text** |
| `text-muted` | `#6F6D67` | Large text, placeholders and decorative dividers only (see §2.2) |
| `text-on-inverse` | `#0B0B0A` | Text on `surface-inverse`, on the primary button, and on accent fills |
| `accent` | `#7FA58B` | Progress, selected state, active markers |
| `accent-hover` | `#A8C8A9` | Hover of accent elements; **the focus ring**; accent text on dark |
| `accent-on-inverse` | `#3F6B4E` | Any green text, icon or focus ring on `surface-inverse` |
| `achievement` | `#C8A96B` | Milestones, destination, premium |
| `caution` | `#D9A05B` | Warnings, offline, "at risk" status |
| `danger` | `#E0897A` | Errors, destructive actions |
| `border` | `rgba(245,243,236,0.08)` | Default hairline; card and choice-card outlines |
| `border-strong` | `rgba(245,243,236,0.16)` | Outlined buttons, segmented tracks, emphasised dividers |
| `border-control` | `rgba(245,243,236,0.38)` | The boundary of inputs, textareas, selects, checkboxes and radios (≥ 3:1, see §2.2) |

Opacity modifiers are fine for tints (`bg-accent/[0.06]`, `border-danger/40`), as long as the text on top still meets §2.2.

### 2.2 Contrast

WCAG ratios, measured from the token values. AA needs **4.5:1** for normal text and **3:1** for large text (≥ 18px, or ≥ 14px bold) and for UI shapes such as borders and focus rings.

| Foreground | on `background` | on `surface` | on `surface-elevated` |
|---|---|---|---|
| `text` | 17.73 | 16.60 | 15.37 |
| `text-secondary` | 7.99 | 7.48 | 6.92 |
| `text-muted` | 3.81 | 3.56 | 3.30 |
| `accent` | 7.18 | 6.72 | 6.22 |
| `accent-hover` | 10.78 | 10.09 | 9.35 |
| `achievement` | 8.76 | 8.20 | 7.59 |
| `caution` | 8.56 | 8.01 | 7.42 |
| `danger` | 7.53 | 7.05 | 6.53 |

Borders are blended over each surface. UI boundaries need 3:1.

| Border | on `background` | on `surface` | on `surface-elevated` | Verdict |
|---|---|---|---|---|
| `border` | 1.18 | 1.22 | 1.24 | Decorative only |
| `border-strong` | 1.49 | 1.57 | 1.60 | Decorative only |
| `border-control` | 3.28 | 3.35 | 3.33 | Pass (3:1) |

On the light surface:

| Pair | Ratio | Verdict |
|---|---|---|
| `text-on-inverse` on `surface-inverse` | 17.11 | Pass |
| `accent-on-inverse` on `surface-inverse` | 5.33 | Pass |
| `text-muted` on `surface-inverse` | 4.496 | **Fail** for normal text (large text only) |
| `text-secondary` on `surface-inverse` | 2.14 | **Fail** |
| `accent` on `surface-inverse` | 2.38 | **Fail.** Use `accent-on-inverse`. |
| `danger` on `surface-inverse` | 2.27 | **Fail** |
| `caution` on `surface-inverse` | 2.00 | **Fail** |
| `achievement` on `surface-inverse` | 1.95 | **Fail** |
| `accent-hover` on `surface-inverse` | 1.59 | **Fail** (this is why the focus ring switches, see §3) |
| `text-on-inverse` on an `accent` fill | 7.18 | Pass |
| `text` on an `accent` fill | 2.47 | **Fail.** Use `text-on-inverse`. |

Rules that follow from this:

- **`text-muted` fails AA for normal text.** Use it only for large text, placeholders and decorative marks. Anything a user must read at body size or smaller uses `text-secondary` or stronger.
- **Micro text (`text-micro`, 12px) always uses `text-secondary` or stronger, never `text-muted`.**
- **Controls a user must find have a 3:1 boundary.** Inputs, textareas, selects, checkboxes and radios use `border-control`. `border` and `border-strong` are decorative: they may outline buttons, cards, choice cards and segmented tracks only because those are identified by their text label, not by the line around them.
- **On `surface-inverse`, only `text-on-inverse` and `accent-on-inverse` pass.** Every status colour, `text-secondary` and `accent-hover` fail there, which is why the light surface holds text and `TextLink` only for now.
- **Colour is never the only signal.** Status has a word (Badge), progress has a number (`ProgressBar` `valueText`), step states have different shapes (`StepMarker`), and errors have an icon and a sentence.

### 2.3 Typography

Geist for the interface and Geist Mono for numbers, labels and data (decision D-7). Use `font-ui` and `font-ui-mono`.

| Utility | Size | Line height | Tracking | Weight | Use |
|---|---|---|---|---|---|
| `text-display` | clamp(3rem → 6.25rem) | 0.95 | -0.045em | 600 | Marketing hero only |
| `text-h1` | clamp(2.25rem → 4rem) | 1.02 | -0.04em | 600 | Page title |
| `text-h2` | clamp(1.75rem → 2.75rem) | 1.08 | -0.03em | 600 | Section title |
| `text-h3` | clamp(1.25rem → 1.625rem) | 1.2 | -0.02em | 500 | Card and dialog titles |
| `text-body-lg` | 1.125rem | 1.6 | — | — | Lead paragraphs |
| `text-body` | 1rem | 1.6 | — | — | Default text; **all form controls** |
| `text-small` | 0.875rem | 1.5 | — | — | Labels, hints, secondary copy |
| `text-micro` | 0.75rem | 1.35 | 0.16em | — | Mono uppercase eyebrows and meta; `text-secondary` |
| `text-numeral` | clamp(4rem → 9rem) | 0.82 | -0.06em | 600 | The big day counter (`27`) |

Each utility sets its own line height, tracking and weight, so don't add `leading-*` or `tracking-*` next to it unless you mean to override.

**Numbers that change** (day counts, timers, `27 / 90`) use the `tabular` class so their width doesn't shift as they count.

### 2.4 Spacing, radius, shadow

| Token | Value | Utility | Use |
|---|---|---|---|
| `--spacing-gutter` | clamp(1.25rem → 3rem) | `px-gutter` | Page side padding |
| `--spacing-section` | clamp(6rem → 11rem) | `py-section` | Vertical rhythm between marketing sections |
| `--radius-block` | 4px | `rounded-block` | Checkboxes, skeletons, small blocks |
| `--radius-control` | 8px | `rounded-control` | Inputs, textareas, selects |
| `--radius-card` | 10px | `rounded-card` | Cards, choice cards, states |
| `--radius-panel` | 14px | `rounded-panel` | Dialogs, sheets, large panels |
| `--shadow-raised` | soft, deep, with a 1px inner highlight | `shadow-raised` | Elevated cards, glass |
| `--shadow-overlay` | deeper | `shadow-overlay` | Dialogs and sheets |

Buttons, badges and segmented controls are pills (`rounded-full`). Use Tailwind's default spacing scale for everything else.

### 2.5 Motion

| Token | Value | Use |
|---|---|---|
| `--duration-quick` | 160ms | Colour and hover changes |
| `--duration-base` | 280ms | Buttons, small state changes |
| `--duration-slow` | 700ms | Progress fills |
| `--duration-reveal` | 1100ms | Marketing reveals |
| `ease-ascend` | cubic-bezier(0.22, 1, 0.36, 1) | Default: things arriving |
| `ease-settle` | cubic-bezier(0.32, 0.72, 0, 1) | Sheets and panels settling |
| `animate-overlay-in` / `-out` | 240ms / 180ms | Dialog scrim |
| `animate-dialog-in` / `-out` | 320ms / 160ms | Centred dialog |
| `animate-sheet-in` / `-out` | 420ms / 240ms | Bottom sheet |
| `animate-rise-in` | 520ms | A step or question arriving (onboarding) |

Write durations as `duration-(--duration-base)`. Under `prefers-reduced-motion: reduce`, the global base rule reduces every animation and transition to near-instant, so primitives need no extra work. Custom scroll-driven or JavaScript motion must check the preference itself.

### 2.6 Legacy, not for new code

These stay only until their screens migrate (decision ND-1). **Don't use them in new code.**

- `font-sans` (Plus Jakarta Sans) and `font-mono` (JetBrains Mono), plus the base `body` colours in `index.css`.
- The `--radius-xl/2xl/3xl` override that forces those radii to 0.375rem. `OnboardingWizard` and `FocusSessionModal` depend on it.
- The legacy mint `*:focus-visible` outline and the dark-green scrollbar colours.

---

## 3. Conventions

- **`ui-root`.** Put it on the outermost element of every migrated screen. It sets Geist, the text colour and the selection colour, overriding the legacy body font. `DialogContent` adds it to itself, because dialogs render in a portal outside the screen.
- **`focus-ring`.** Every focusable element in a primitive has it. It draws a 2px outline in `var(--focus-ring-color)` with a 2px offset on `:focus-visible` only, overriding the legacy mint rule. Add it to any custom focusable element you build. Never remove an outline without replacing it.
- **`focus-ring-inset`.** The same ring drawn 2px inside the element, for controls in a scrolling track that would clip an outer ring (`TabsTrigger` uses it). Prefer `focus-ring`, or padding on the track, wherever the ring fits.
- **`--focus-ring-color`.** The one source for the ring colour: `accent-hover` by default, `accent-on-inverse` inside `.on-inverse`. Controls whose ring is drawn on a wrapper (choice cards, segmented tracks, the checkbox box) use `outline-(--focus-ring-color)`, so they adapt too. Never hard-code the ring colour.
- **`on-inverse`.** Put it on any container with `surface-inverse` (`Surface tone="inverse"` does this for you). It switches the focus ring and `TextLink` to `accent-on-inverse`. **Only plain text and `TextLink` go inside it for now.** `Button`, `Badge`, `StepMarker`, fields and choice controls have no inverse variant yet; add one to the primitive (and to `/__ui`) before using it on a light surface.
- **`tabular`.** Tabular figures for any changing number.
- **Pathways.** Pathway data lives only in `lib/certifiedPresets.ts`, grouped by `PATHWAY_GROUPS`. Every in-app pathway gallery is `PathwayLibrary` (or its compact `PathwayStrip`, which opens `PathwaysExplorerModal`) from `components/pathways`, and every launch goes through `usePathwayLaunch`. Don't build another gallery or copy the launch state.
- **Class merging.** Use `cx()` from `components/ui/cx` to join conditional classes. Primitives accept `className` for layout (margins, width, grid placement). Don't use it to restyle colours or type; if a variant is missing, add it to the primitive.
- **`className` goes on the outermost element.** When a primitive wraps its control (`Checkbox`, `Select`, `Input` with `trailing`), your `className` lands on the wrapper, so layout classes behave the same everywhere.

---

## 4. Primitives

```tsx
import { Button, Field, Input, Dialog, DialogTrigger, DialogContent } from '../components/ui';
```

Use a primitive whenever one fits. Don't build another button, input, dialog or card. Open `/__ui` in the dev server to see every primitive in every state.

### Button, IconButton

```tsx
<Button onClick={start} trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}>
  Start your journey
</Button>
<Button variant="secondary" loading={saving}>Save</Button>
<Button asChild variant="quiet"><Link to="/journey">See the journey</Link></Button>
<IconButton label="Close" icon={<X aria-hidden="true" strokeWidth={1.5} className="size-5" />} />
```

| Prop | Values | Notes |
|---|---|---|
| `variant` | `primary` (default), `secondary`, `quiet`, `premium`, `danger` | One `primary` per view. `premium` is achievement gold. `danger` is for destructive actions. |
| `size` | `sm` (44px), `md` (48px, default), `lg` (56px) | Every size meets the 44px touch target. |
| `loading` | boolean | Shows a spinner and keeps the label and full opacity. The button stays focusable (it is **not** natively disabled, so focus isn't lost mid-save) and gets `aria-busy` and `aria-disabled`; clicks are ignored and a submit button doesn't submit. |
| `disabled` | boolean | Native `disabled`. With `asChild`, the child gets `aria-disabled` and its clicks are blocked instead, because links can't be disabled natively. |
| `leadingIcon`, `trailingIcon` | node | Mark icons `aria-hidden`. |
| `fullWidth` | boolean | |
| `asChild` | boolean | Styles a single child, such as a router `Link`, as a button. |

`type` defaults to `"button"`; pass `type="submit"` in forms. `IconButton` requires `label`, which becomes its accessible name. It is always 44×44px, in `quiet` (default) or `secondary`, and takes `loading` with the same behaviour as `Button` (the icon becomes a spinner).

### TextLink

```tsx
Already have an account? <TextLink asChild><Link to="/sign-in">Sign in</Link></TextLink>
```

An inline, underlined link inside running text, in `accent-hover` (and `accent-on-inverse` on a light surface). Use `asChild` for router links. Inline links are exempt from the 44px target rule (WCAG 2.5.8 inline exception); a link that stands alone as an action is a `Button variant="quiet"` instead.

### Field, Input, Textarea, Select

```tsx
<Field label="Your goal" hint="One sentence is enough." error={errors.goal} required>
  <Input value={goal} onChange={(e) => setGoal(e.target.value)} />
</Field>
```

`Field` renders the label, hint and error, and wires `id`, `aria-describedby` and `aria-invalid` into its single child control. Props are `label`, `hint`, `error` (setting it marks the control invalid), `required`, `showOptional` (adds "(optional)") and `id`.

**Errors are announced.** The error sits in a polite live region that is always mounted, so a message that appears after validation is read out without moving focus. Write it as what to do: "Enter your goal in one sentence.", not "Invalid input". The same pattern is used by every choice control.

`Input`, `Textarea` (default 4 rows, resizable vertically) and `Select` take every native prop. `Select` is native on purpose, because the platform picker is the most usable on mobile. All three are 16px, at least 48px tall, and bordered in `border-control`.

`Input` takes `trailing` for one control inside its right edge, typically an `IconButton` that shows or hides a password:

```tsx
<Input type={shown ? 'text' : 'password'} trailing={
  <IconButton label={shown ? 'Hide password' : 'Show password'} onClick={() => setShown(!shown)}
    icon={shown ? <EyeOff aria-hidden="true" strokeWidth={1.5} className="size-5" /> : <Eye aria-hidden="true" strokeWidth={1.5} className="size-5" />} />
} />
```

### Checkbox, ChoiceGroup, ChoiceCard, SegmentedControl

All choice controls are native inputs, visually hidden. Keyboard, forms and screen readers behave natively.

```tsx
<ChoiceGroup legend="How much time can you give each day?" value={minutes} onChange={setMinutes} columns={3}>
  <ChoiceCard value="30" title="30 minutes" description="A light, steady pace." meta="3.5 h a week" />
  <ChoiceCard value="60" title="60 minutes" description="The recommended pace." meta="7 h a week" />
</ChoiceGroup>

<SegmentedControl legend="When do you work on it?" value={slot} onChange={setSlot}
  options={[{ value: 'morning', label: 'Morning' }, { value: 'evening', label: 'Evening' }]} />

<Checkbox label="Include weekends" description="Sessions can be planned on Saturday and Sunday." checked={weekends} onChange={(e) => setWeekends(e.target.checked)} />
```

- **`ChoiceGroup`** is a fieldset with a legend, for picking one option such as a pathway or a time budget. Props are `legend`, `description`, `hideLegend`, `value`, `onChange(value)`, `columns` (1, 2 or 3; always 1 column on mobile), `name`, `required` and `error`.
- **`ChoiceCard`** must sit inside a `ChoiceGroup`. Props are `value`, `title`, `description`, `meta` (mono micro detail), `icon` and `disabled`. Its accessible name is the title only; the description and meta are its description.
- **`SegmentedControl`** takes two to four short options. Props are `legend`, `hideLegend`, `options`, `value`, `onChange`, `required` and `error`.
- **`Checkbox`** takes `label`, `description`, `error` and every native checkbox prop.

**Errors on choice controls.** `error` on `ChoiceGroup` or `SegmentedControl` links the message to the fieldset, turns the card outlines or the track `danger`, and announces it; `required` marks the radios required. `error` on `Checkbox` marks that checkbox invalid. The message says what to choose: "Choose where you're starting from."

### Surface, Badge

```tsx
<Surface tone="elevated" padding="lg" radius="panel" as="section">…</Surface>
<Badge tone="accent">On track</Badge>
```

| `Surface` prop | Values |
|---|---|
| `tone` | `base` (default), `elevated` (raised shadow), `inset` (sunken), `glass` (**only over imagery**), `inverse` (light section; adds `on-inverse`; text and `TextLink` only for now) |
| `padding` | `none`, `sm`, `md` (default), `lg` |
| `radius` | `block`, `card` (default), `panel` |
| `as` | `div` (default), `section`, `article`, `aside`, `li` |

`Badge` is a short mono uppercase status label, with `tone` `neutral` (default), `accent`, `achievement`, `caution` or `danger`, and an optional `icon`. The text must name the state, because colour alone doesn't.

### Dialog, SheetContent

Built on Radix: focus trap, Escape to close, scroll lock, inert background and focus returned to the trigger.

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild><Button variant="danger">Reset goal</Button></DialogTrigger>
  <DialogContent
    title="Reset this goal?"
    description="Your journey and progress will be archived."
    size="sm"
    footer={<>
      <DialogClose asChild><Button variant="quiet">Keep my goal</Button></DialogClose>
      <Button variant="danger" onClick={reset}>Reset goal</Button>
    </>}
  >
    …optional body…
  </DialogContent>
</Dialog>
```

| `DialogContent` prop | Notes |
|---|---|
| `title` | Required. The accessible name. `hideTitle` keeps it for screen readers only. |
| `description` | Optional. Linked as the accessible description. |
| `layout` | `auto` (default): a bottom sheet below 768px and a centred dialog above. `sheet`: a bottom sheet at every size. `SheetContent` is the same as `layout="sheet"`. |
| `size` | `sm`, `md` (default), `lg`. Max width on desktop. |
| `footer` | Actions in desktop order: secondary first, primary last. They are right-aligned on desktop and stack full-width on mobile, with the primary on top. |
| `hideClose`, `closeLabel` | The ✕ button (44px). Only hide it if the footer has a clear way out. |

The body scrolls inside the dialog (`overscroll-contain`), never the page behind it. The sheet respects the bottom safe area.

### Tabs

Built on Radix: arrow-key navigation, roving focus and the tab/tabpanel wiring.

```tsx
<Tabs defaultValue="today">
  <TabsList aria-label="Step details">
    <TabsTrigger value="today">Today</TabsTrigger>
    <TabsTrigger value="why">Why it matters</TabsTrigger>
  </TabsList>
  <TabsContent value="today">…</TabsContent>
  <TabsContent value="why">…</TabsContent>
</Tabs>
```

The list scrolls horizontally on narrow screens instead of wrapping, so triggers draw `focus-ring-inset`. Give `TabsList` an `aria-label`.

### ProgressBar, StepMarker

```tsx
<ProgressBar label="Journey" value={27} max={90} showValue valueText="27 of 90 days" />
<StepMarker state="milestone" label="Phase 1 milestone, reached" />
```

- **`ProgressBar`** props: `value`, `max` (default 100), `label` (required; the accessible name, shown unless `hideLabel`), `showValue`, `valueText` (replaces the percentage and is announced), and `tone` (`accent` or `achievement`). Values outside the range are clamped.
- **`StepMarker`** draws the progression grammar. `state` is `upcoming` ○, `active` ●, `completed` ✓, `milestone` ◆ or `destination` ✦; `size` is `sm`, `md` or `lg`. Each state has a distinct shape. It is decorative unless you pass `label`; pass one whenever the marker is the only thing showing the state.

### EmptyState, LoadingState, Skeleton, ErrorState

```tsx
<LoadingState label="Loading today's step"><Skeleton className="h-6 w-1/2" /></LoadingState>
<ErrorState description="We couldn't load your plan. Your progress is safe." onRetry={refetch} retrying={isFetching} />
<EmptyState title="No journey yet" description="Pick a pathway to begin." action={<Button>Choose a pathway</Button>} />
```

- **`LoadingState`** is a polite live region. `label` is announced (visible with `showLabel`). Children are skeletons shaped like the content; the default is three lines.
- **`ErrorState`** is an alert. Props are `title` (default "Something went wrong"), `description`, `onRetry`, `retryLabel` and `retrying`. Say what happened and what to do next, and never blame the user.
- **`EmptyState`** takes `title`, `description`, one `action` and an optional `icon`.

### VisuallyHidden, SkipLink

`<SkipLink />` is the first element of every page. It links to `#main` by default (`targetId`), so give the main landmark `id="main"`. `<VisuallyHidden>` is text for screen readers only.

---

## 5. Mobile-first responsiveness and touch

### Hard constraints

- **Mobile-first CSS.** Base classes target mobile (`flex flex-col md:flex-row`). Never write desktop-first CSS and override it with `max-md:`.
- **No horizontal overflow.** Never hide it with `overflow-x: hidden` on `html` or `body`; fix the element. Use fluid widths (`w-full`, `max-w-*`), never fixed pixel widths such as `w-[600px]`.
- **Touch targets of at least 44×44px** for every interactive element: buttons, tabs, inputs, choice rows, menu items. All primitives already meet this.
- **Safe areas.** Fixed top bars, sticky headers and bottom navigation add `pt-[env(safe-area-inset-top)]` or `pb-[env(safe-area-inset-bottom)]`. The sheet already does.
- **Dynamic viewport height.** Don't use `h-screen` or `100vh` on layout wrappers; use `min-h-[100dvh]` or `h-[100dvh]` (or `svh` for hero art that mustn't resize).
- **16px inputs.** Inputs, textareas and selects are at least 16px (`text-body`), so iOS Safari doesn't zoom on focus.
- **Flex children with truncated text** get `min-w-0`.

### Breakpoints

- **Mobile (< 768px):** a single column. Dialogs become bottom sheets (`DialogContent` does this). Prioritise Today → Start → Complete → Progress, and hide complexity rather than shrinking desktop.
- **Tablet (`md`, 768–1023px):** at most two columns. Persistent navigation collapses into an overlay or compact bar.
- **Desktop (`lg`, 1024px+):** multi-pane layouts, persistent navigation and more environmental depth.

---

## 6. Scroll and overflow

### Mechanics

- **No scroll chaining.** Inner scroll areas (dialog bodies, sheets, drawers, logs) use `overscroll-contain`; full-screen overlays use `overscroll-none`.
- **Smooth scrolling only for in-page anchor jumps.** The global reduced-motion rule resets it to `auto`.
- **Momentum scrolling** on touch devices is preserved (`-webkit-overflow-scrolling: touch` is set globally).

### Scrollbars

- **No layout shift.** `html` has `scrollbar-gutter: stable`.
- **Minimal scrollbars.** Thin custom scrollbars are applied globally in `index.css`; don't add default wide scrollbars inside panels. Horizontal strips that scroll by swipe (such as `TabsList`) hide the scrollbar.
- **Sticky headers change on scroll.** Add an elevation border or a background shift once the page scrolls.

### Specific components

- **Logs and live output:** auto-scroll only while the user is pinned to the bottom. Stop as soon as they scroll up, and show a "Jump to latest" button when new entries arrive.
- **Data tables:** never squash columns. Wrap them in `overflow-x-auto`, pin the identifying column (`sticky left-0 bg-inherit`), and collapse rows into key-value cards below 768px.
- **Code and diff views:** `overflow-x-auto`, with line numbers pinned (`sticky left-0`).

---

## 7. Accessibility checklist

Premium never means inaccessible (VDS §29). Before a screen ships:

- Every text and surface pair meets §2.2, with no body text in `text-muted`.
- Inputs, checkboxes and radios have a 3:1 boundary (`border-control`).
- Nothing but text and `TextLink` sits on `surface-inverse`.
- Everything works by keyboard, in a logical order, with a visible `focus-ring`.
- Dialogs trap focus, close on Escape and return focus (use `Dialog`).
- Every control has a name: a visible label, a `Field`, or `IconButton label`.
- Status, progress and step state don't rely on colour alone.
- Important information never exists only in imagery; decorative images have `alt=""`.
- Motion respects `prefers-reduced-motion`.
- The page has a `SkipLink` and a `main#main` landmark.
- Loading uses `LoadingState` (announced) and errors use `ErrorState` (an alert with a way forward).
- Validation errors go through the primitive's `error` prop, so they are linked, announced and say what to do.
- A button that is saving uses `loading`, not `disabled`, so keyboard focus stays on it.

---

## 8. Tooling

Run from `frontend/`:

| Command | What it does |
|---|---|
| `npm run lint` | ESLint (TypeScript, React Hooks, React Refresh) over the whole frontend. It exits non-zero until the pre-Phase-0 baseline (48 errors, 6 warnings in 14 unmigrated files) is fixed by the phases that own those screens. |
| `npx eslint <paths>` | Lints only the files you touched. New and changed files must be clean. |
| `npm test` | Vitest with Testing Library, in jsdom. `npm run test:watch` for watch mode. |
| `npm run build` | Type-check and production build. |

Put tests next to their component as `*.test.tsx`. Test behaviour through roles and accessible names (`getByRole('button', { name: 'Save' })`), not class names.
