---
name: My Design System 3
colors:
  surface: '#f9f9ff'
  surface-dim: '#d8dae3'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3fd'
  surface-container: '#ecedf7'
  surface-container-high: '#e6e8f1'
  surface-container-highest: '#e0e2ec'
  on-surface: '#181c22'
  on-surface-variant: '#414753'
  inverse-surface: '#2d3038'
  inverse-on-surface: '#eff0fa'
  outline: '#717785'
  outline-variant: '#c1c6d5'
  surface-tint: '#005db8'
  primary: '#005cb8'
  on-primary: '#ffffff'
  primary-container: '#1275e2'
  on-primary-container: '#000512'
  inverse-primary: '#aac7ff'
  secondary: '#465f88'
  on-secondary: '#ffffff'
  secondary-container: '#b6d0ff'
  on-secondary-container: '#3f5881'
  tertiary: '#9c4300'
  on-tertiary: '#ffffff'
  tertiary-container: '#c35600'
  on-tertiary-container: '#ffffff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#aac7ff'
  on-primary-fixed: '#001b3e'
  on-primary-fixed-variant: '#00458d'
  secondary-fixed: '#d6e3ff'
  secondary-fixed-dim: '#aec7f7'
  on-secondary-fixed: '#001b3d'
  on-secondary-fixed-variant: '#2d476f'
  tertiary-fixed: '#ffdbca'
  tertiary-fixed-dim: '#ffb68f'
  on-tertiary-fixed: '#331100'
  on-tertiary-fixed-variant: '#773200'
  background: '#f9f9ff'
  on-background: '#181c22'
  surface-variant: '#e0e2ec'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

# Design System Document

## Brand & Style
The design system embraces a **Corporate / Modern** aesthetic, prioritizing clarity, trust, and exceptional usability. The style is clean, balanced, and professional, drawing inspiration from high-fidelity design standards. It leverages a light color mode by default, ensuring clean readability and an accessible, bright feel for professional software and digital tools.

## Colors
The color palette is built on semantic principles, establishing clear hierarchies and functional states across the UI:
- **Primary Color (`#1275e2`)**: Used for primary actions, active states, and key interactive elements.
- **Secondary Color (`#5f78a3`)**: Provides balanced support for secondary components and UI accents.
- **Tertiary Color (`#c55b00`)**: Used selectively for calls to action, highlights, or important notifications.
- **Neutral Color (`#74777f`)**: Versatile cool gray used for typography, borders, and surface tones.

## Typography
The typography system relies exclusively on **Inter** for headlines, body text, and labels, ensuring a uniform visual voice.
- **Headlines**: SemiBold weight for strong hierarchy.
- **Body**: Optimized for readability at 16px.
- **Labels**: Compact and precise at 14px for interface elements.

## Layout & Spacing
The layout uses a **fluid grid** system with responsive adaptation:
- Standard 1rem gutters and 1.5rem outer canvas margins.
- Predictable spacing scale (`space-xs` to `space-xl`) for consistent padding and gaps.

## Elevation & Depth
Visual hierarchy relies on **tonal layers** and soft **ambient shadows**, separating containers cleanly without heavy borders.

## Shapes
The **Rounded** shape language (`roundedness: 2`) applies a 0.5rem baseline corner radius to components, scaling up to 1rem and 1.5rem for larger containers.

## Components
Components consistently incorporate our design tokens:
- **Buttons**: Rounded (0.5rem) primary actions in `#1275e2`.
- **Inputs & Controls**: Clean input fields and selection controls with accessible contrast and rounded styling.
- **Cards**: Structured surface containers with subtle depth and clear content padding.