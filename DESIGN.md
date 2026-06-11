---
name: AI Sheet Prompter
description: Bulk-submit prompts from Google Sheets to Gemini or ChatGPT sequentially.
colors:
  primary: "#7c3aed"
  chatgpt: "#10a37f"
  neutral-bg: "#0c0e17"
  neutral-card: "#141b2d"
  text-primary: "#f8fafc"
  text-secondary: "#94a3b8"
  text-muted: "#64748b"
  border-glass: "#1e293b"
typography:
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Outfit, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  sm: "8px"
  md: "10px"
  lg: "16px"
spacing:
  sm: "6px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "#8b5cf6"
  button-secondary:
    backgroundColor: "rgba(255, 255, 255, 0.04)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
---

# Design System: AI Sheet Prompter

## 1. Overview

**Creative North Star: "The Precise Control Deck"**

The AI Sheet Prompter visual system is styled like a professional developer tool or system administration panel. Density is medium-high, layouts are predictable, and interactions are immediate. The interface uses a dark background with tinted neutrals to prevent raw contrast strain and relies on context-aware accent colors to instantly indicate active target state (Gemini vs ChatGPT). 

This design explicitly rejects the decorative glassmorphism default, floating card patterns, and glowing neon slop common in AI web interfaces. Instead, it adopts structured layouts, clear visual frames, and crisp, responsive inputs.

**Key Characteristics:**
- **Compact Denseness:** Standard 340px width extension popup format with dense, clear grid alignments.
- **Dynamic Accent State:** Action buttons and focus borders dynamically shift colors based on the active target AI model.
- **Utilitarian Borders:** Fine borders define frames; layout spacing is tight and rhythmic.
- **Immediate Micro-interactions:** Precise transition easing (ease-out-quint) conveying state changes under 200ms.

## 2. Colors

All colors are defined inside the OKLCH space and mapped to sRGB Hex values for browser rendering compatibility. Neutrals are tinted toward a cool violet hue to anchor the brand.

### Primary
- **Gemini Purple** (`#7c3aed` / `oklch(49% 0.25 291)`): Used for primary action indicators, active toggle state, and focus outlines when Gemini is the selected model.
- **ChatGPT Green** (`#10a37f` / `oklch(63% 0.17 165)`): Used for primary actions, active states, and focus outlines when ChatGPT is the selected model.

### Neutral
- **Deep Navy Black** (`#0c0e17` / `oklch(9% 0.012 280)`): The outer background surface of the browser extension popup.
- **Tinted Slate Card** (`#141b2d` / `oklch(14% 0.018 280)`): Inner container surface to frame configuration elements.
- **Slate Text Primary** (`#f8fafc` / `oklch(98% 0.005 286)`): Used for headings, active labels, and form values.
- **Slate Text Secondary** (`#94a3b8` / `oklch(71% 0.015 280)`): Default color for labels and descriptions.
- **Slate Text Muted** (`#64748b` / `oklch(53% 0.02 280)`): Disabled elements, placeholders, and secondary indicators.
- **Glass Border** (`#1e293b` / `oklch(20% 0.015 280)`): Used for bounding boxes, dividers, and card borders.

### Named Rules
**The Model-Theme Rule.** Accent styling must change dynamically between Gemini Purple and ChatGPT Green to mirror the active target selection. There must never be a split accent state (e.g., Gemini selected but ChatGPT colors shown on the Start button).
**The Tinted Neutral Rule.** Never use pure `#000` or `#fff`. All neutral colors must be tinted toward the core brand hue (chroma range between 0.005 and 0.02) to create a premium feel.

## 3. Typography

**Display Font:** Outfit (fallback `sans-serif`)
**Body/Input Font:** Inter (fallback `system-ui`, `-apple-system`, `sans-serif`)

The typography relies on a single sans-serif stack for inputs and labels, paired with a geometric display typeface for headers. Contrast is created through font weight and tracking, not size jumps.

### Hierarchy
- **Headline** (Outfit, Bold, `16px`, line-height `1.2`): Extension brand title.
- **Body** (Inter, Regular, `13px`, line-height `1.5`): Standard messages, loaded file statuses, and field inputs.
- **Label** (Outfit, Bold/Semibold, `11px`, letter-spacing `0.06em`, Uppercase): Configuration field headers and toggles.
- **Mini Status** (Inter, Medium, `11px`, line-height `1.3`): Queue logs and small indicators.

## 4. Elevation

The system is flat-by-default, emphasizing structured layout columns rather than deep spatial planes. Depth is conveyed using tonal layering and subtle, high-contrast borders.

### Named Rules
**The Flat-By-Default Rule.** Do not use shadows to float cards or containers. Containers are flat, defined by high-contrast fine borders (`1px solid var(--border-glass)`). Shadows are restricted to button click micro-interactions and active state focuses.

## 5. Components

### Buttons
- **Shape:** Soft square with a 8px radius (`rounded-sm`).
- **Primary:** Dynamic background (Gemini Purple or ChatGPT Green). Custom transitions for background changes under 200ms.
- **Secondary (Load Prompts):** Semi-transparent white overlay background (`rgba(255, 255, 255, 0.04)`) with a fine border. On hover, background deepens to `0.08` opacity.
- **Danger (Stop):** Solid Red (`#dc2626`) with a dark hover shift.

### Inputs / Fields
- **Corner Style:** 8px radius (`rounded-sm`).
- **Background:** Slate input field (`rgba(15, 23, 42, 0.4)`) with an inset shadow.
- **Focus state:** 1px border colored as the active model accent, with a 3px matching glow ring.

### Toggles / Segmented Controls
- **Toggle Container:** Soft container background (`rgba(15, 23, 42, 0.6)`) holding model choices.
- **Active State:** Clear accent color overlay behind the selected model name with an inset border.

### Progress Indicators
- **Track:** 6px tall channel, colored slate-gray.
- **Fill:** Accent-matched gradient bar with a subtle glow representing queue completion percentage.

## 6. Do's and Don'ts

### Do:
- **Do** tint all dark backgrounds toward the primary blue/violet hue.
- **Do** align all label headers to the left, using uppercase and letter-spacing tracking.
- **Do** provide immediate hover and focus indicators for every interactive element.
- **Do** use standard system font families for UI labels and text.

### Don't:
- **Don't** use decorative gradient text or background-clip text combinations.
- **Don't** use side-stripe borders or high-thickness highlight borders on cards or panels.
- **Don't** use decorative blurs and glass effects that reduce contrast and legibility.
- **Don't** allow active state elements to show conflicting model colors.
