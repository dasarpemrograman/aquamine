# UI Audit Findings: Post-Redesign

**Date:** January 28, 2026
**Scope:** Dashboard, Forecast, Chat, Alerts, Recipients, CV pages
**Reviewer:** Design Systems Lead

## 1. Glass vs Solid Surface Inconsistencies
*   **Sidebar Mismatches:** The sidebar uses a translucent "glass" background in some views (Dashboard) but appears solid in others (Forecast). The "Admin User" profile card is consistently a solid white opaque card with a shadow, floating awkwardly on top of the sidebar surface instead of blending or using a compatible glass treatment.
*   **Card Opacity Mixing:** Main content cards (e.g., "System Overview", "Sensor Status") are solid white with drop shadows, creating a "flat material" look that clashes with the glassmorphism intended for the sidebar and top navigation.
*   **Input Fields:** The top search bar uses a translucent style in some views, while the Chat message input is a solid white block with a hard border, breaking the depth illusion.
*   **CV Overlay:** The "Live Camera" switcher bar uses a floating glass effect, while the main "Real-time Inference" card is a heavy, opaque solid element.

## 2. Hierarchy Issues
*   **Dashboard Grid:** The "Visual Analysis" card is significantly taller than the "Quick Actions" card adjacent to it, creating a broken grid line and unbalanced whitespace.
*   **Alerts Empty State:** The "No alerts found" container is excessively large, consuming more visual weight than the actual page content headers.
*   **Recipients Layout:** The "Notification Recipients" table has excessive vertical whitespace below the single entry, making the card feel broken or empty.
*   **Header Redundancy:**
    *   **Dashboard:** "Sensor Status" appears as a section header and again as a card title.
    *   **Chat:** The header subtitle "Ask about sensors..." is immediately repeated by the empty state prompt "Ask about sensor anomalies...".

## 3. Status Semantics Conflicts
*   **Dashboard Global vs Local:** The global status badge shows "System Online" (Green), while the main dashboard card screams "Critical" (Red) and "System Health" is "60% Attention" (Orange). The user receives mixed signals on system state.
*   **Forecast Color Overload:** Green is used for Connectivity ("Real-time Connected"), Data Thresholds ("NORMAL"), and Hardware State ("ACTIVE"). This flattens the semantic meaning of "success" vs "operational" vs "safe".
*   **CV Active State:** The sidebar active item uses a Teal background for "CV Analysis", but the status dot is Blue, clashing with the branding.
*   **Sidebar Active States:**
    *   Some items use a blue vertical bar + gradient.
    *   Others use a blue dot.
    *   Some use both.
    *   The "Forecast" item uses a cyan border + cyan dot.

## 4. Iconography Inconsistencies
*   **Style Mixing:**
    *   **Sidebar:** Thin, linear stroke icons.
    *   **Dashboard Content:** Icons in colored circles/squares with varying container shapes.
    *   **Empty States:** Thick, bold icons (e.g., "No alerts found").
    *   **Buttons:** Solid filled icons (Chat Send) vs Outline icons (Chat Mute).
*   **Bell Icon variations:** The bell icon appears in three different styles across the app: blue outline (Sidebar), grey outline (Top Bar), and teal circle (Header).
*   **Warning Triangles:** Used for "Critical" status (Red) and "Recent Alerts" (Header) with different visual weights.

## 5. Component Mapping & Prioritized Issues

| Priority | Issue | Likely Component / File |
| :--- | :--- | :--- |
| **P0** | **"Visual Analysis" card size breaking layout** | `dashboard/app/components/ForecastChart.tsx` or `dashboard/app/page.tsx` |
| **P0** | **Global vs Critical Status Conflict** | `dashboard/app/components/TopBar.tsx` vs `dashboard/app/components/SensorStatus.tsx` |
| **P1** | **Mixed Glass/Solid Surfaces (Sidebar Profile)** | `dashboard/app/components/Sidebar.tsx` |
| **P1** | **Inconsistent Sidebar Active States** | `dashboard/app/components/Sidebar.tsx` |
| **P1** | **Redundant "Sensor Status" Headers** | `dashboard/app/components/SensorStatus.tsx` |
| **P1** | **Chat Header vs Message Area Radius/Style** | `dashboard/app/components/ChatInterface.tsx` |
| **P2** | **Inconsistent Button Styles (Pill vs Square)** | `dashboard/app/recipients/page.tsx` |
| **P2** | **Icon Style Mixing (Outline vs Filled)** | `dashboard/app/components/IconBadge.tsx` / `Sidebar.tsx` |
| **P2** | **Excessive Whitespace in Empty States** | `dashboard/app/components/AlertList.tsx` |

## 6. Actionable Fix List

1.  **Standardize Sidebar Profile:** Refactor the "Admin User" card in `Sidebar.tsx` to use `GlassPanel` or a transparent style that matches the sidebar container.
2.  **Fix Dashboard Grid:** Adjust the height of `ForecastChart` (Visual Analysis) to match the height of `Sidebar` or `QuickActions` container in `dashboard/app/page.tsx`.
3.  **Unify Status Semantics:** Update `TopBar.tsx` to reflect the actual worst-case status from `SensorStatus` (if Critical, TopBar should likely not say "System Online" in green).
4.  **Remove Redundant Headers:** In `SensorStatus.tsx`, remove the outer section header if the card title exists, or merge them.
5.  **Standardize Active States:** Update `Sidebar.tsx` to use a single active state pattern (e.g., vertical bar + subtle background, no dot).
6.  **Fix Chat Styling:** Update `ChatInterface.tsx` to match the `GlassCard` border radius and remove the redundant subtitle.
7.  **Icon Audit:** specific pass on `Sidebar.tsx` and `TopBar.tsx` to use the same icon library/stroke weight.
