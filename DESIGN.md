---
name: Agent News
description: A fast, dense news aggregator for the AI agent space.
colors:
  ink: "#e8eaed"
  body: "#b0b8c1"
  muted: "#7a838d"
  border: "#2a2e33"
  surface: "#1a1d21"
  background: "#111316"
  primary: "#e8eaed"
  primary-foreground: "#111316"
  accent: "#5b9cf5"
  destructive: "#f87171"
typography:
  display:
    fontFamily: "Merriweather, Georgia, serif"
    fontSize: "clamp(1.75rem, 4vw, 2.75rem)"
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Merriweather, Georgia, serif"
    fontSize: "clamp(1.25rem, 2.5vw, 1.5rem)"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.body}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-ghost-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Design System: Agent News

## 1. Overview

**Creative North Star: "The Wire Desk"**

A newsroom wire service desk — information arrives, gets triaged, gets scanned. The interface exists to compress time-to-comprehension. Every element earns its presence by making the reader faster. Decoration that doesn't aid scanning is cut.

The system is dark-mode only. A developer checking the feed at their desk, in a dim office or late at night, surrounded by dark IDE windows and terminal panes — the product lives in that ambient context and matches it. The palette is near-achromatic dark: deep charcoal backgrounds, light text, and a single desaturated blue accent for interactive affordances.

The system pairs Merriweather's editorial weight on headlines with Geist's neutral clarity on body text. Serif signals authority and editorial curation; sans signals utility and speed. Color carries meaning, never mood.

This system explicitly rejects generic SaaS landing page aesthetics (hero metrics, gradient CTAs, social proof templates), social media feed patterns (infinite scroll, engagement bait), and overly minimal empty layouts that lack design craft.

**Key Characteristics:**
- Dark-mode only; lives alongside dark IDEs and terminals
- Information density prioritized over whitespace
- Serif headlines for editorial authority, sans body for scanning speed
- Near-achromatic dark palette; desaturated blue accent reserved for actions and links
- Compact, refined components with restrained hover states
- Typography hierarchy does the heavy lifting — not color, not decoration

## 2. Colors

A dark newsroom palette: light text on deep charcoal, nothing more. The single accent is reserved for interactive elements and used below 10% of any surface.

### Primary
- **Ink** (oklch(0.93 0.004 260) / #e8eaed): Primary text, headings, and high-emphasis UI elements. The lightest value in the system.

### Secondary
- **Wire Blue** (oklch(0.68 0.12 260) / #5b9cf5): Links, interactive affordances, active states. Desaturated relative to pure blue to sit comfortably on dark backgrounds without glaring. The only chromatic color in the core palette. Never decorative.

### Neutral
- **Body** (oklch(0.76 0.01 250) / #b0b8c1): Secondary text, descriptions, metadata. Contrast on background: ~8:1.
- **Muted** (oklch(0.58 0.012 250) / #7a838d): Tertiary text, timestamps, deemphasized labels. Contrast on background: ~4.8:1.
- **Border** (oklch(0.24 0.008 250) / #2a2e33): Dividers, input borders, card edges. Subtle structural separation.
- **Surface** (oklch(0.17 0.006 250) / #1a1d21): Card backgrounds, grouped content, elevated layers.
- **Void** (oklch(0.13 0.005 250) / #111316): Page background. Deep charcoal with a barely perceptible cool cast.

### Named Rules
**The One-Accent Rule.** Wire Blue is the only chromatic color. Its rarity is the signal. If a second accent appears, the hierarchy is broken.

**The No-Tint Rule.** Backgrounds are achromatic or near-achromatic (chroma ≤ 0.008). The dark palette stays neutral; no purple, no navy, no warm gray. Cool cast comes from extremely low chroma toward blue, never from visible saturation.

## 3. Typography

**Display Font:** Merriweather (with Georgia, serif fallback)
**Body Font:** Geist (with system-ui, sans-serif fallback)

**Character:** The pairing works on a contrast axis — Merriweather's thick serifs and tight fit carry editorial weight on headlines; Geist's geometric neutrality clears the way for fast body scanning. The serif says "someone curated this." The sans says "now read it quickly." On dark backgrounds, Merriweather's weight anchors headings that might otherwise feel insubstantial.

### Hierarchy
- **Display** (900, clamp(1.75rem, 4vw, 2.75rem), line-height 1.15, -0.02em tracking): Page titles, hero headlines. Used once per page maximum.
- **Headline** (700, clamp(1.25rem, 2.5vw, 1.5rem), line-height 1.3, -0.01em tracking): Section headings, article titles in feeds.
- **Title** (600, 1.125rem, line-height 1.4): Component headings, card titles, sidebar section labels. Set in Geist.
- **Body** (400, 0.9375rem, line-height 1.6, max-width 65ch): Running text, descriptions, article summaries. Set in Geist.
- **Label** (500, 0.8125rem, line-height 1.4, 0.01em tracking): Metadata, timestamps, tags, filter labels. Set in Geist.

### Named Rules
**The Serif-Headlines Rule.** Merriweather is for headlines and display text only. Body text, labels, UI chrome, and interactive elements are always Geist. Mixing serif into body text undermines the speed-reading function.

**The Density Rule.** Body text is 15px (0.9375rem), not 16px. One pixel tighter across the system compounds into meaningfully higher information density without sacrificing readability.

## 4. Elevation

The system is flat by default. Depth is conveyed through tonal layering (Surface vs Void backgrounds) and subtle border separation. Shadows appear only on transient, elevated layers — dropdowns, tooltips, modals — where they signal "this floats above your content and will go away." On dark backgrounds, shadows are heavier to register against already-dark surfaces.

### Shadow Vocabulary
- **Ambient** (`0 4px 16px oklch(0 0 0 / 0.3)`): Dropdowns, popovers, floating menus.
- **Modal** (`0 8px 32px oklch(0 0 0 / 0.5)`): Dialogs and modal overlays.

### Named Rules
**The Flat-By-Default Rule.** No component has a shadow at rest. Shadows are reserved for floating, transient layers. Cards, sections, and containers use borders or background tints to separate — never box-shadow.

## 5. Components

Refined and restrained. Subtle radii (6px default), considered spacing, quiet hover states. Professional but not cold. On dark backgrounds, hover states use surface-tint shifts rather than opacity changes.

### Buttons
- **Shape:** Gently rounded (6px radius)
- **Primary:** Ink (light) background, Void (dark) text, 10px 20px padding. Inverted from the page for maximum contrast.
- **Hover / Focus:** Background shifts to Wire Blue. Focus ring: 2px offset, Wire Blue at 50% opacity. Transition: 150ms ease-out.
- **Ghost:** Transparent background, Body text color. Hover reveals Surface background. For secondary actions in toolbars and navigation.

### Cards / Containers
- **Corner Style:** Gently rounded (8px radius)
- **Background:** Surface (#1a1d21) with a 1px Border edge. Sits above the Void page background.
- **Shadow Strategy:** None at rest (see Elevation). Tonal layering only.
- **Internal Padding:** 16px default, 24px on wider viewports.

### Inputs / Fields
- **Style:** 1px Border stroke, Surface background, 6px radius.
- **Focus:** Border shifts to Wire Blue. No glow, no resize. Clean state change.
- **Error:** Border and label shift to Destructive red. Inline error text below the field, never a tooltip.

### Navigation
- **Style:** Geist at Label weight. Ink (light) text, no background.
- **Hover:** Text shifts to Wire Blue. No underline, no background change.
- **Active:** Wire Blue text, 2px bottom border. Current location is always visible.
- **Mobile:** Full-width slide panel, not a dropdown. Same typography, same hierarchy.

## 6. Do's and Don'ts

### Do:
- **Do** use Merriweather for headlines and Geist for everything else. The pairing is the system's identity.
- **Do** maintain 4.5:1 minimum contrast on all text. Muted text (#7a838d) on Void (#111316) meets this threshold.
- **Do** cap body text at 65ch line length. Wider lines break scanning rhythm.
- **Do** use Wire Blue exclusively for interactive elements (links, buttons, active states). Color = "you can act on this."
- **Do** use `text-wrap: balance` on h1–h3 and `text-wrap: pretty` on body paragraphs.
- **Do** vary spacing for rhythm — not uniform 16px everywhere. Sections breathe (64px), related items cluster (8px).
- **Do** use heavier shadows on floating elements to register against dark backgrounds.

### Don't:
- **Don't** use gradient text, side-stripe borders, or glassmorphism. These are decorative patterns that contradict the Wire Desk's utility-first identity.
- **Don't** build hero-metric templates (big number + small label + supporting stats). This is a news product, not a SaaS dashboard — per PRODUCT.md's anti-references.
- **Don't** add shadows to cards, list items, or static surfaces. Flat by default; shadows float.
- **Don't** use Merriweather below headline size. Serif at body scale fights scanning speed.
- **Don't** introduce a second chromatic color. Wire Blue is the only accent. If the design feels flat, increase contrast and density, not color count.
- **Don't** add tiny uppercase tracked eyebrows above every section. One kicker as a deliberate system element is acceptable; repeating it is AI scaffolding.
- **Don't** use numbered section markers (01 / 02 / 03) as default structure. Numbers earn their place only in actual sequences.
- **Don't** use infinite scroll or engagement-bait patterns — per PRODUCT.md's explicit rejection of social media feed aesthetics.
- **Don't** use pure white (#ffffff) text. Ink (#e8eaed) is the lightest text value; pure white glares on dark backgrounds.
- **Don't** use opacity-based hover states (bg-white/10, bg-white/20). Use named surface tints for predictable contrast.
