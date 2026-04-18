# Design System Strategy: The Sovereign Institution

## 1. Overview & Creative North Star
This design system is built upon the North Star of **"The Sovereign Institution."** In the intersection of FinTech and Web3, we must bridge the gap between the immovable weight of traditional banking and the ethereal transparency of the blockchain. 

We move away from the "SaaS-standard" grid of uniform boxes. Instead, we embrace a **High-End Editorial** aesthetic. This means intentional asymmetry, generous "breathing room," and a hierarchy driven by scale and tonal depth rather than structural lines. The interface should feel like a premium digital ledger—authoritative, sophisticated, and impossibly clean. 

By utilizing overlapping glass layers and high-contrast typography, we create an environment where data is not just displayed, but curated.

---

## 2. Colors & Surface Philosophy
The palette is rooted in the depth of the night and the vibrance of digital growth.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections. Conventional lines create visual "noise" that cheapens the experience. Boundaries must be established through:
- **Tonal Shifts:** Placing a `surface-container-low` section against the primary `surface` background.
- **Negative Space:** Using the spacing scale to create clear mental groupings.
- **Glass Overlays:** Using `surface-container-high` with a backdrop blur to suggest a new functional layer.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of semi-transparent materials.
- **Base Layer:** `surface` (#0b1326) – The bedrock of the application.
- **Sub-Sections:** `surface-container-low` (#131b2e) – Used for grouping large content blocks.
- **Interactive Cards:** `surface-container-highest` (#2d3449) – Reserved for the most important data points that require user focus.

### The "Glass & Gradient" Rule
To evoke "Tech Innovation," use **Glassmorphism** for floating elements (modals, dropdowns, hovered cards).
- **Recipe:** Apply a semi-transparent `surface-variant` with a `backdrop-filter: blur(24px)`.
- **Signature Polish:** Primary CTAs should use a subtle linear gradient from `primary` (#4edea3) to `primary_container` (#10b981) at a 135-degree angle. This adds "soul" and dimension that flat emerald green lacks.

---

## 3. Typography
We use a dual-typeface system to balance institutional authority with modern readability.

*   **Display & Headlines (Plus Jakarta Sans):** These are our "Editorial" voices. Use `display-lg` and `headline-lg` with tightened letter-spacing (-0.02em) to create a sense of prestige. Don't be afraid of oversized numbers for portfolio balances; they are the hero of the page.
*   **Body & Labels (Inter):** The "Functional" voice. Inter provides high legibility for complex data. Use `body-md` for standard text and `label-sm` (all caps, +0.05em tracking) for metadata and "Verified on Chain" indicators.

The hierarchy is strict: Information density should decrease as the importance of the metric increases.

---

## 4. Elevation & Depth
In this system, depth is a functional tool, not a decoration.

### The Layering Principle
Achieve lift by "stacking" container tiers. A `surface-container-lowest` card placed on a `surface-container-low` section creates a natural "recessed" look, suggesting stability and permanence.

### Ambient Shadows
When an element must float (e.g., a "Credibility Score" popover), use **Ambient Shadows**:
- **Color:** `on-surface` (#dae2fd) at 4%–8% opacity.
- **Blur:** Large values (30px–60px) with 0 spread.
- **Intent:** The shadow should feel like a soft glow of dark light, mimicking natural depth without looking like a "drop shadow" effect from 2010.

### The "Ghost Border" Fallback
If a boundary is required for accessibility, use a **Ghost Border**:
- **Token:** `outline-variant` (#3c4a42) at 20% opacity. 
- **Rule:** Never use 100% opacity borders. The goal is a suggestion of a container, not a cage.

---

## 5. Components

### Primary Investment Action (Button)
- **Style:** `primary` fill with `on-primary` text.
- **Shape:** `md` (0.375rem) for a precise, institutional feel.
- **Interaction:** On hover, apply a soft outer glow using the `surface_tint` color at 10% opacity.

### Verified on Chain Badge
- **Background:** `primary_container` (#10b981) at 15% opacity.
- **Text:** `primary` (#4edea3).
- **Typography:** `label-sm` (Bold).
- **Icon:** A 12px checkmark or chain-link icon. 
- **Note:** No border. The subtle background shift is enough to denote status.

### Credibility Score Cards
- **Background:** Glassmorphic `surface-container-highest` with 40% opacity and 20px blur.
- **Visual:** Use a high-contrast circular progress ring using `primary` for the score and `outline-variant` (low opacity) for the track.
- **Placement:** Use asymmetrical placement—offset the score from the label to create an editorial layout.

### Data Inputs
- **Style:** Underline only or Ghost Border.
- **States:** `error` (#ffb4ab) should be used sparingly. For errors, shift the entire input background to a 5% `error_container` tint to ensure the user cannot miss it.

### Lists & Tables
- **Constraint:** **Forbid dividers.**
- **Strategy:** Use `body-sm` for labels and `title-md` for values. Increase the vertical padding (e.g., 24px–32px) between rows. The "white space" acts as the separator, creating a cleaner, more premium data view.

---

## 6. Do’s and Don'ts

### Do
- **Do** use `surface-container-lowest` for deep background sections to create a "sunken" effect for secondary data.
- **Do** use asymmetrical margins. For example, a headline might be indented more than the body text to create a sophisticated "editorial" rhythm.
- **Do** lean into the "Emerald Green" (`primary`) for success states, but balance it with "Slate Gray" (`on-surface-variant`) for secondary data to prevent visual fatigue.

### Don't
- **Don't** use pure black (#000000) or pure white (#FFFFFF). Use the provided `surface` and `on-surface` tokens to maintain the midnight-blue tonal integrity.
- **Don't** use standard 1px borders. If you feel the need for a line, try using a 4px vertical "accent bar" of `primary` color on the left side of a container instead.
- **Don't** crowd the dashboard. If a user has 10 data points, show the top 3 with `display-md` scale and hide the rest behind a "View Detailed Analytics" glass action.