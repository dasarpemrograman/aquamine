# AquaMine UI Revamp Plan

## Context and current state
- Scope confirmed: full app revamp (dashboard, forecast, alerts, recipients, CV, chat) plus shared layout and components.
- Current layout is light theme with a centered top nav in `dashboard/app/layout.tsx` and per-page layouts in `dashboard/app/page.tsx`, `dashboard/app/forecast/page.tsx`, `dashboard/app/alerts/page.tsx`, `dashboard/app/recipients/page.tsx`, `dashboard/app/cv/page.tsx`, `dashboard/app/chat/page.tsx`.
- Components like `dashboard/app/components/SensorStatus.tsx`, `dashboard/app/components/AlertList.tsx`, and `dashboard/app/components/ForecastChart.tsx` use simple white cards with borders and shadows; chart styling uses default Recharts grid/legend; icons are from `lucide-react` plus some emoji usage in CV tabs.
- The current codebase does not implement the dark sidebar dashboard seen in the screenshot, so the revamp will treat the existing layout as the real baseline and restructure as needed.
- References used:
  - Image 2: glassmorphism and card separation (soft glass cards, floating layout, no hard dividers).
  - Image 3: simple, minimal icons and charts (clean strokes, restrained legend, minimal grid lines).
  - Image 4: gradient accents for feature cards and highlights.

## Design goals (from brief)
- Light theme only. No dark mode.
- Glassmorphism as the primary surface language, with separated cards instead of dividers.
- Simple but unique minimal icons and charts.
- Soft gradients for background and select cards. Clean, modern, and youthful.
- Overhaul allowed: reflow layouts, merge sections, and move content between pages as needed.

## Visual direction and tokens
- Typography: keep Plus Jakarta Sans (already installed), emphasize 600-800 weights for headings, 400-500 for body.
- Core palette (light, youthful):
  - Base background: #f5f7fb
  - Secondary background: #eef2f7
  - Glass surface: rgba(255, 255, 255, 0.6)
  - Glass border: rgba(255, 255, 255, 0.75)
  - Primary accent (aqua): #22d3ee
  - Secondary accent (teal): #14b8a6
  - Warm accent (coral): #fb7185
  - Neutral text: #0f172a (primary), #475569 (secondary), #94a3b8 (muted)
- Gradient usage:
  - App background: subtle radial or linear gradient layered over base.
  - Feature cards: soft diagonal gradients using aqua/teal with low opacity.
  - Avoid heavy gradients on all cards; use selectively to preserve clarity.
- Glassmorphism rules:
  - Backdrop blur: 16-24px.
  - Saturation boost: 120-140%.
  - Soft shadow: 0 16px 40px rgba(15, 23, 42, 0.08).
  - Thin border and inner glow for separation instead of dividers.

## Information architecture and layout
- New app shell:
  - Left glass rail for primary navigation (Dashboard, Forecast, Alerts, Sensors, CV, Recipients, AI Assistant).
  - Top header inside content area for search, quick actions, and user chip.
- Grid strategy:
  - 12-column grid on desktop with consistent spacing (24-32px gaps).
  - 2-3 column cards for highlights; 1 column stacking on mobile.
- Sectioning:
  - Replace line dividers with card groupings and spacing.
  - Use section headers with compact filters and micro badges.

## Page-by-page plan
- Dashboard (`dashboard/app/page.tsx`):
  - Convert to a true overview page with 3 zones: summary metrics, system status, and alerts.
  - Add a glass hero row: health score, active sensors, anomaly status, last update.
  - Provide a forecast mini-preview card and a CV quick action card.
  - Use minimal line/area sparklines instead of heavy charts.
- Forecast (`dashboard/app/forecast/page.tsx`):
  - Wrap chart in a glass card with a gradient header badge.
  - Simplify axes, lighten grid, reduce legend noise.
  - Add a side column for anomaly summary and latest reading cards.
- Alerts (`dashboard/app/alerts/page.tsx` and `dashboard/app/components/AlertList.tsx`):
  - Shift to card stacks with severity chips and subtle colored glows.
  - Provide a compact filter bar (severity, time range) in the header.
- Recipients (`dashboard/app/recipients/page.tsx`):
  - Replace heavy table look with card rows or a glass table shell.
  - Clean iconography: use single-stroke icons, remove emoji contact icons.
  - Simplify modal styling with glass panel and soft gradient CTA.
- CV Analysis (`dashboard/app/cv/page.tsx` and related components):
  - Use a gradient hero similar to the reference, minimal icon tabs, and glass media panels.
  - Replace emoji tab icons with lucide icons in pill buttons.
- Chat (`dashboard/app/chat/page.tsx` and `dashboard/app/components/ChatInterface.tsx`):
  - Frame chat in glass card with a subtle gradient header and minimal input controls.

## Component system to add or refactor
- New shared UI components under `dashboard/app/components/ui/`:
  - `GlassCard` and `GlassPanel` for consistent surfaces.
  - `SectionHeader` for titles, filters, and context badges.
  - `StatPill` and `StatusChip` for compact metrics.
  - `IconBadge` for minimal icon styling (single stroke, soft background).
  - `MiniChart` wrapper for Recharts with a minimal style preset.
- Update existing components:
  - `SensorStatus` and `AlertList` to use the new card system.
  - `ForecastChart` to use the minimal chart preset.

## Implementation steps (execution plan)
- Step 1: Define visual tokens and base surfaces.
  - Update `dashboard/app/globals.css` with color variables, gradients, and glass utility classes.
  - Add Tailwind custom utilities for glass blur and soft shadows.
- Step 2: Replace layout shell.
  - Update `dashboard/app/layout.tsx` with a left rail and top header.
  - Add a light gradient background layer for the app shell.
- Step 3: Build shared UI components.
  - Implement `GlassCard`, `GlassPanel`, `StatusChip`, and `IconBadge`.
  - Create a minimal chart theme for Recharts.
- Step 4: Rebuild the dashboard page.
  - Move core summary metrics to top cards.
  - Reframe alerts and sensor status into glass card stacks.
- Step 5: Update Forecast, Alerts, Recipients, CV, and Chat pages.
  - Apply the new layout and card system.
  - Simplify icons and charts to match the references.
- Step 6: Polish spacing, micro interactions, and responsive behavior.
  - Ensure mobile stacking and safe padding.
  - Add subtle hover lifts and blur transitions on cards.

## Validation checklist
- Visual direction matches references: glass cards, soft gradients, light theme, minimal icons.
- No dark mode colors or heavy dividers remain.
- All pages share the new layout shell and card system.
- Charts are simplified and readable without dense grids.
- Mobile layout stays legible and consistent.
