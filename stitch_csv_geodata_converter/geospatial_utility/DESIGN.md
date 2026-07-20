---
name: Geospatial Utility
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#bdc8d1'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#87929a'
  outline-variant: '#3e484f'
  surface-tint: '#7bd0ff'
  primary: '#8ed5ff'
  on-primary: '#00354a'
  primary-container: '#38bdf8'
  on-primary-container: '#004965'
  inverse-primary: '#00668a'
  secondary: '#bcc7de'
  on-secondary: '#263143'
  secondary-container: '#3e495d'
  on-secondary-container: '#aeb9d0'
  tertiary: '#c5cce6'
  on-tertiary: '#283044'
  tertiary-container: '#a9b1ca'
  on-tertiary-container: '#3c4459'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c4e7ff'
  primary-fixed-dim: '#7bd0ff'
  on-primary-fixed: '#001e2c'
  on-primary-fixed-variant: '#004c69'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#dae2fd'
  tertiary-fixed-dim: '#bec6e0'
  on-tertiary-fixed: '#131b2e'
  on-tertiary-fixed-variant: '#3f465c'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-sm:
    fontFamily: monospace
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin: 24px
  container-max: 1440px
---

## Brand & Style
The brand personality is precise, technical, and high-performance. This design system targets professionals in data science, urban planning, and logistics who require a high-density interface that remains legible under intense cognitive load. 

The aesthetic is **Corporate Modern** with a lean toward **Minimalism**. It emphasizes utility through a streamlined, contemporary look that avoids decorative flourishes. The emotional response should be one of confidence, reliability, and technical proficiency, achieved through a structured grid and a rigorous sans-serif typographic system.

## Colors
The palette is built on a foundation of Slate and Navy to maintain a "mission control" atmosphere. 

- **Primary:** A vibrant Sky Blue (#38BDF8) used for actionable items, active states, and data highlights.
- **Secondary:** A deep Slate (#1E293B) for container backgrounds and sidebars.
- **Tertiary:** A Rich Navy (#0F172A) for the primary application background, providing deep contrast.
- **Neutral:** A range of Slate grays used for borders, secondary text, and inactive iconography.

The default mode is **Dark**, optimized for long-duration monitoring and reducing eye strain in technical environments.

## Typography
This design system utilizes **Inter** for all typographic roles to ensure maximum legibility and a contemporary technical feel. All serif influences have been removed in favor of this neutral, systematic typeface.

Headlines use tighter letter-spacing and heavier weights to create a strong visual hierarchy. Body text is optimized for readability with generous line heights. A specific `label-md` style is utilized for metadata and category headers, featuring uppercase styling and increased tracking for a "data-heavy" utility look. A fallback monospaced stack is reserved strictly for coordinate data and code snippets.

## Layout & Spacing
The layout follows a strict **Fixed Grid** philosophy based on a 4px baseline shift. This ensures precision in geospatial data visualization.

- **Desktop:** 12-column grid with 16px gutters and 24px side margins. 
- **Tablet:** 8-column grid with 16px gutters.
- **Mobile:** 4-column grid with 12px gutters.

The interface should feel "docked," with sidebars and tool panels snapped to the edges of the viewport. Use consistent 16px (4 units) padding within cards and containers to maintain a rhythmic, organized flow of information.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** rather than heavy shadows. In a dark, technical interface, subtle shifts in background color create the necessary hierarchy.

- **Level 0 (Background):** #0F172A (Tertiary).
- **Level 1 (Cards/Panels):** #1E293B (Secondary).
- **Level 2 (Modals/Popovers):** #334155 with a very subtle, 10% opacity black shadow (4px blur).

Use **Low-contrast outlines** (#334155) to define boundaries between panels. This "ghost border" technique replaces the need for elevation shadows, maintaining a flat, streamlined aesthetic.

## Shapes
The shape language balances technical precision with modern approachability. All primary UI elements (buttons, input fields, cards) use a **0.5rem (8px)** corner radius. 

- **Standard:** 0.5rem (8px) for cards and main containers.
- **Small Components:** 0.25rem (4px) for checkboxes and tags.
- **Large Components:** 1rem (16px) for major modal overlays.

This "Round Four" (8px) logic ensures the interface feels contemporary and refined without losing its professional, grid-aligned structure.

## Components
- **Buttons:** Primary buttons are solid #38BDF8 with white text. Secondary buttons use a ghost style with a #94A3B8 border.
- **Input Fields:** Darker than the container background (#0F172A), using an 8px radius and a 1px border that glows primary blue on focus.
- **Chips/Tags:** Used for data filtering. Small (12px text), 4px radius, using a semi-transparent primary blue background (15% opacity).
- **Lists:** High-density rows with 1px slate separators. Interactive states should highlight the entire row in #334155.
- **Data Cards:** No shadows. Use Level 1 Tonal Layering with a 1px border. Title areas should be clearly defined by the `label-md` typographic style.
- **Navigation:** Vertical sidebar using iconography and `body-sm` text. Active states indicated by a 2px primary blue vertical bar on the left edge.