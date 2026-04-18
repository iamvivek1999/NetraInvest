# Design System: The Institutional Futurist

## 1. Overview & Creative North Star
The "Creative North Star" for this design system is **The Digital Curator**. 

In the world of early-stage investment, "Institutional Trust" often translates to rigid, boring grids, while "Tech Innovation" often results in chaotic, over-stimulating interfaces. This system rejects that binary. We treat the UI as a high-end editorial gallery—a space where blockchain-verified data is presented with the weight of a legacy bank but the fluidity of a modern tech pioneer.

By utilizing **intentional asymmetry**, we break the "template" look. We favor large, breathing white space (or "dark space") and overlapping glass layers to create a sense of depth and physical presence. This isn't just a dashboard; it’s a professional ecosystem designed to feel bespoke, secure, and ahead of the curve.

---

## 2. Colors: Tonal Depth & Soul
We move beyond flat hex codes to create a living, breathing environment.

### The Palette
*   **Primary (Growth/Action):** `primary` (#4edea3) and `primary_container` (#10b981). Use these for high-conviction actions and representing financial growth.
*   **Surface (Institutional Foundation):** `surface` (#0b1326). This deep midnight blue provides the "institutional" weight required for investor trust.
*   **Secondary (Data/Insight):** `secondary` (#b7c8e1) and `secondary_container` (#3a4a5f). Use these for analytical data and meta-information.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off content. 
Structure is achieved through **Background Color Shifts**. To separate the sidebar from the main feed, use `surface_container_low` against the `surface` background. The eye should perceive change through tonal transition, not a "stroke."

### The "Glass & Gradient" Rule
To elevate the UI from a generic SaaS look, all floating modules must utilize **Glassmorphism**. 
*   **Execution:** Use `surface_container` at 60-80% opacity with a `20px` to `40px` backdrop-blur. 
*   **Signature Textures:** For Hero CTAs and primary cards, apply a subtle linear gradient from `primary` to `primary_container` at a 135-degree angle. This adds "visual soul"—a shimmer that suggests the high-value nature of the investments.

---

## 3. Typography: Editorial Authority
We use **Plus Jakarta Sans** not just for legibility, but as a brand voice.

*   **Display (The Statement):** `display-lg` (3.5rem) and `display-md` (2.75rem). Use these for "Big Numbers" (Portfolio totals, growth percentages). They should feel like headlines in an annual report.
*   **Headlines (The Anchor):** `headline-lg` (2rem). Use for section titles. Pair these with significant top-padding to let the content breathe.
*   **Body (The Intelligence):** `body-lg` (1rem). Our workhorse. Ensure line-height is set to 1.6 to maintain an editorial, high-end feel.
*   **Labels (The Verification):** `label-md` (0.75rem). Used for "Blockchain Verified" timestamps and metadata. These should always use `on_surface_variant` (#bbcabf) for a sophisticated, subdued look.

---

## 4. Elevation & Depth: The Layering Principle
Depth is not a shadow; depth is a hierarchy of light.

*   **Tonal Layering:** Instead of shadows, stack containers using the tier system.
    *   *Base:* `surface`
    *   *Section:* `surface_container_low`
    *   *Card/Element:* `surface_container` or `surface_container_highest`
*   **Ambient Shadows:** If an element must float (e.g., a dropdown or a critical modal), use an ultra-diffused shadow: `box-shadow: 0 20px 40px rgba(6, 14, 32, 0.4)`. The shadow color is a darker tint of the background, making it feel like a natural light obstruction rather than a "drop shadow."
*   **The "Ghost Border" Fallback:** If accessibility requires a container edge, use the `outline_variant` token at **10% opacity**. It should be felt, not seen.

---

## 5. Components: The Primitive Set

### Cards & Lists (The Core of Netra)
*   **Style:** No dividers. Use `surface_container` with a `xl` (0.75rem) roundedness. 
*   **Interaction:** On hover, the card should transition from `surface_container` to `surface_container_high` with a subtle 2px vertical "lift" (TranslateY).

### Buttons (The High-Conviction Action)
*   **Primary:** Filled with `primary` (#4edea3), text in `on_primary`. Shape: `md` (0.375rem).
*   **Secondary (The Institutional Choice):** Ghost style with the "Ghost Border" (outline_variant at 20%) and `on_surface` text.
*   **Tertiary:** Text-only using `primary` for the label, used for "See Details" or "View Ledger."

### Input Fields (Data Entry)
*   Background: `surface_container_lowest`. 
*   States: Focus state should never use a thick border. Use a subtle glow effect (1px `primary` shadow) and a shift to `surface_container_low`.

### Specialized Component: "Verification Badge"
A custom chip for blockchain-verified data. 
*   **Look:** A Glassmorphic pill (`full` roundedness) with a 10% `primary` tint and a tiny `primary` dot icon. This signals "Tech Innovation" and "Trust" simultaneously.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical layouts. A chart on the left should not always be perfectly mirrored by text on the right.
*   **Do** use the `primary` color sparingly. It is a "Success/Growth" signal; overusing it dilutes its financial authority.
*   **Do** use `Plus Jakarta Sans` with slightly tighter letter-spacing (-0.02em) for headlines to create a premium, "Swiss-designed" feel.

### Don’t
*   **Don’t** use 1px solid dividers. Use vertical whitespace (16px, 24px, 32px increments) to separate ideas.
*   **Don’t** use pure black (#000000) or pure white (#FFFFFF). Use the `surface` and `on_surface` tokens to maintain the midnight-blue atmosphere.
*   **Don’t** use standard "Material Design" shadows. They are too heavy for this refined investment ecosystem. Stick to tonal shifts and high-blur ambient glows.