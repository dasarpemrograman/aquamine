# AquaMine Design System (Light Glassmorphism)

**Goal**: Light, modern, and sleek. Cards feel separated by glass and soft elevation, not dividers. Blue is dominant, with gradients and minimal iconography.

## Visual Direction
- Light mode only. No dark backgrounds.
- Glassmorphism on cards and top-level panels.
- Card separation uses spacing, soft shadow, and translucent borders instead of lines.
- Minimal icons and graphics with thin strokes and simple shapes.
- Gradients are subtle, used as large background washes and gentle accents.

## Reference Alignment
- Card separation and glass styling: use floating cards with soft blur and a semi-transparent border.
- Icon/graphic handling: thin line icons, minimal data graphics, low-contrast gridlines.
- Gradients: large, soft pastel-blue gradients in the background and hero cards.

## Color Palette (Aqua Dominant, Light)

### Base
- **Background Base**: `#F5F8FF`
- **Background Wash**: `#EAF3FF`
- **Surface Solid**: `#FFFFFF`
- **Glass Surface**: `rgba(255, 255, 255, 0.65)`

### Text
- **Primary Text**: `#0F172A`
- **Secondary Text**: `#475569`
- **Muted Text**: `#94A3B8`

### Brand Aqua
- **Aqua Primary**: `#1BA9E8`
- **Aqua Light**: `#64D4FF`
- **Aqua Deep**: `#2F7BFF`

### Functional
- **Success**: `#10B981`
- **Warning**: `#F59E0B`
- **Danger**: `#EF4444`

### Gradients
- **Primary Gradient**: `linear-gradient(135deg, #64D4FF 0%, #2F7BFF 100%)`
- **Soft Background Wash**: `radial-gradient(circle at 20% 20%, #D6ECFF 0%, transparent 60%)`
- **Secondary Wash**: `radial-gradient(circle at 80% 30%, #E6F7FF 0%, transparent 55%)`

## Glassmorphism Recipe

Use this for all primary cards and panels:

```css
.glass-card {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 20px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
}
```

### Card Separation Rules
- No horizontal dividers for layout separation.
- Use spacing: `gap-6` to `gap-10` between cards.
- Use elevation: soft shadow and a translucent edge.
- Use rounded corners: `rounded-2xl` to `rounded-3xl`.

## Typography
- **Font**: Plus Jakarta Sans (keep existing to avoid rework).
- **Headings**: 700 weight, slight tracking (-0.015em).
- **Body**: 400 to 500 weight.
- **Numbers**: 600 weight, tabular if available.

## Iconography and Graphics
- Icons should be thin stroke (1.5px to 2px), minimal outline.
- Use a single dominant icon color: `#2F7BFF` or `#1BA9E8`.
- Avoid multi-color icons; use small colored dots for status only.

### Chart Style
- Line charts: single thin stroke, minimal points, soft gradient fill.
- Grid lines: extremely faint or none.
- Axis text: muted (`#94A3B8`), small, unobtrusive.
- Chart cards use glass effect with padding and soft shadow.

## Layout Structure
- **Top Bar**: glass container, subtle blur, minimal controls.
- **Sidebar**: light surface with soft shadow and rounded edges; icons only on small screens.
- **Main Content**: grid layout with varied card sizes for hierarchy.

## Components

### Buttons
- Primary: gradient fill with subtle glow, `rounded-xl`.
- Secondary: white glass surface with soft border and blue text.
- Hover: slight lift or glow, no heavy transitions.

### Cards
- Glass surface, blur, soft edge, and subtle shadow.
- Use whitespace and spacing to show separation.

### Tables
- Light background, row separation via padding and subtle row hover.
- Avoid heavy grid borders.

### Modals
- Glass panel on top of a dimmed blur overlay.
- No harsh outlines; keep rounded corners.

## Motion
- Subtle entrance (fade + 8px lift).
- Hover states: small shadow increase, no aggressive scaling.

## Implementation Notes (Tailwind v4)
- Define tokens in `app/globals.css` using CSS variables.
- Replace hardcoded `bg-white/5` and `border-white/10` with semantic tokens for light surfaces and borders.
- Use `backdrop-blur` on top-level cards and panels only.

---
**Status**: DRAFT - Pending approval before implementation.
