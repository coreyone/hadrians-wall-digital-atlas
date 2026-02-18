# Junior Designer Playbook — “Gin Lane / Red Antler” Homepage
Goal: Make a homepage that feels **calm**, **premium**, **editorial**, and **inevitable**—like it has always existed.

North Star:
- Users understand **what it is**, **why it matters**, and **what to do next** in **≤ 5 seconds**.
- The page looks *simple* because the thinking is *complex*.

---

## 0) Your Deliverables (What you must produce)
1. **Homepage wireframe** (low-fi)
2. **Homepage hi-fi** (desktop + mobile)
3. **Mini design system** for the page:
   - Color tokens
   - Type scale
   - Spacing scale
   - Button styles + states
4. **Prototype** (hover + scroll + basic transitions)
5. **Handoff notes** (for engineering)

---

## 1) Inputs You Need (No Pixels Yet)
### A) Clarify the narrative
Write these in a doc:
- **Value prop (1 sentence):** “We help [who] do [job] without [pain].”
- **3 brand adjectives:** e.g., Calm · Smart · Human
- **Primary CTA:** one action only (e.g., “Shop”, “Get started”, “Take the quiz”)

### B) List the top questions users need answered
Usually:
- What is this?
- Is it for me?
- Why trust you?
- How does it work?
- What do I do now?

---

## 2) Homepage Structure (The “Challenger DTC” Template)
Use this sequence. Don’t improvise until you’ve nailed the basics.

1. **Hero** (value + CTA + proof cue)
2. **Proof strip** (press / ratings / social proof)
3. **How it works** (3 steps, minimal)
4. **Product/offer modules** (1–3 core offerings)
5. **Benefits** (outcome-driven, not feature soup)
6. **Testimonials** (short, real, skimmable)
7. **FAQ** (objection killers)
8. **Final CTA** (repeat the promise + action)
9. **Footer** (trust + utility)

Rule: Each section should answer **one** question.

---

## 3) Layout & Grid (The Editorial Spine)
### Grid
- Desktop: **12-column grid**
- Content: usually spans **6–8 columns** (keep margins generous)
- Max content width: **~1100–1200px**
- Gutters: consistent (e.g., 24–32px)

### Spacing scale
Pick one scale and stick to it (8px or 4px system). Suggested section padding:
- Mobile section padding: **48–72px**
- Desktop section padding: **80–120px**

### Composition rules
- Left-align most content (editorial feel).
- Use whitespace like it’s a brand asset.
- One hero message per screen.

---

## 4) Typography (This Is the Brand)
### Font strategy (2 families max)
- **Brand font:** Serif OR high-quality humanist sans (headlines, big moments)
- **Utility font:** Neutral sans (body, labels, forms)

### What “Gin Lane / Red Antler” type feels like
- Headline: confident, roomy, not loud
- Body: highly readable, slightly larger than typical SaaS

### Practical type specs (starting point)
- Body: **16–18px**, line-height **1.5–1.7**
- H1: **44–64px** desktop, **32–40px** mobile
- H2: **28–40px** desktop, **24–32px** mobile
- Label/UI: **12–14px** with clear contrast

### Type rules
- Sentence case (avoid ALL CAPS for headlines)
- Avoid ultra-thin weights
- Tighten tracking slightly on large headlines if needed
- Keep paragraph widths to **~55–75 characters**

---

## 5) Color Palette (Quiet Neutrals + One Accent)
### Palette structure (90 / 9 / 1 rule)
- 90% neutrals
- 9% brand accent
- 1% error/emphasis

### Neutrals (execution)
- Use an **off-white** background (never pure white)
- Text in **soft charcoal** (never pure black)
- Borders/dividers in **low-contrast** gray

### Accent color (execution)
- One accent only
- Use it for:
  - Primary CTA fill
  - Links (optional)
  - Small highlights (icons, bullets, active states)

### Color rules
- Never use multiple bright accents on one page
- Avoid loud gradients unless the brand is explicitly gradient-led
- Make sure CTA contrast passes accessibility

Deliverable: create tokens like:
- `bg / surface / text / mutedText / border / accent / accentHover / focus / error`

---

## 6) Photography & Visual Style (Human, Real, Premium)
### Photography direction
- Natural light > studio perfection
- Real people, real environments
- “Magazine feature” framing
- One strong hero image beats a collage

### Usage rules
- Hero: either product-in-context or a human moment that implies the benefit
- Secondary images: show proof, texture, and real detail
- Avoid generic stock smiles

### Cropping + composition
- Leave negative space for type overlays
- Keep horizons level
- Make the product or face the focal point (clean depth of field)

---

## 7) Graphic Design: Icons, Lines, and “Quiet UI”
### Icon style
- Simple line icons
- Consistent stroke weight (e.g., 1.5–2px)
- One icon system only

### Dividers + rules
- Use thin rules to structure the page (editorial vibe)
- Use subtle borders for cards, not heavy shadows

### Illustration
Only if the brand supports it.
- Keep it monochrome or lightly tinted
- Avoid mixing illustration styles

---

## 8) Components (Premium Minimalism)
### Buttons
- Primary: solid fill with accent color
- Secondary: outline or text
- Rounded corners: subtle (6–12px), not trendy “pill everything”

Button copy rules:
- Specific beats generic
  - “Get started” → “Find your routine”
  - “Shop now” → “Shop the essentials”

### Cards
- Use spacing and borders more than shadows
- Consistent padding (e.g., 24–32px)

### Forms
- Visible labels (not placeholder-only)
- Helpful microcopy
- Clear errors (don’t shame users)

---

## 9) Motion & Interaction (Subtle, Purposeful)
### Motion principles
Motion should feel **inevitable**—not “animated.”

Allowed patterns:
- Fade + slight translate on section reveal
- Button hover: small brightness shift or subtle elevation
- Focus rings: clear, brand-aligned

Timing (starting point):
- 150–250ms
- ease-in-out
- No bounce, no springy playful motion (unless brand is playful)

Never:
- Autoplay carousels
- Big parallax gimmicks
- Looping decorative animation

---

## 10) Copy & Microcopy (Confidence Engineering)
Voice:
- Calm, direct, human.
- No hype. No jargon.

Execution rules:
- Short paragraphs (1–3 lines)
- Bullets for benefits
- Objection-handling FAQ near the bottom
- Proof close to claims (don’t separate them)

---

## 11) Proof & Trust (Where DTC wins)
Include at least 3 of these:
- Press logos
- Star ratings + review count
- “Dermatologist tested” / certifications (if real)
- Shipping/returns clarity
- Money-back guarantee
- Founder story (short)
- UGC / testimonials with names + city (if allowed)

Rule: Trust elements should be **quietly present**, not screaming.

---

## 12) Desktop + Mobile Execution Checklist
### Desktop
- Hero reads in 5 seconds
- One primary CTA above the fold
- Strong hierarchy: headline → subhead → proof → CTA
- No section feels crowded

### Mobile
- Keep headline short
- CTA appears early and often
- No tiny text
- Touch targets ≥ 44px
- Images crop intentionally (avoid awkward face crops)

---

## 13) QA: The “Studio Smell Tests”
Ask these before you ship:
- If I delete 20% of elements, does it feel better? (Often yes → delete.)
- Does the type feel like a magazine?
- Does the page feel calm or busy?
- Is the accent color doing real work?
- Would I trust this brand with my money in 10 seconds?

---

## 14) Suggested Starter Section Specs (Copy/Paste)
Hero:
- H1: Outcome statement
- Subhead: who it’s for + how it’s different
- CTA: one primary + one secondary (optional)
- Proof cue: rating / press / guarantee

How it works:
- 3 steps max
- Each step: 3–5 words headline + 1 sentence

Benefits:
- 3–6 bullets
- Outcomes first, features second

Testimonials:
- 3 quotes max
- Short and specific
- Add human detail (name, city, role)

FAQ:
- 6–10 questions
- Start with the objections that block purchase (price, shipping, returns, trust)

Final CTA:
- Repeat the promise
- Repeat the primary action
- Add reassurance (shipping/returns/guarantee)

---

## 15) What to Hand Off to Engineering
- Design tokens (colors, type, spacing)
- Component specs + states
- Responsive rules + breakpoints (content-driven)
- Motion specs (what animates, timing, easing)
- Image export guidance (sizes, formats)

Done right, the homepage will feel “simple.”
Because you sweated every detail.


# Challenger-Brand Web Design Execution — Aesthetic Deep Dive
(Practical, repeatable, studio-grade)

North Star  
Feel **calm**, **considered**, and **inevitable**.  
Nothing flashy. Nothing accidental.

---

## 1) Color Palette — Muted, Modern, Trust-Building

### Core Palette Structure
Use a **90 / 9 / 1** approach.

- 90% → neutrals
- 9% → brand accent
- 1% → emphasis / surprise

### Neutrals (Foundation)
Preferred tones:
- Warm white (never pure #FFFFFF)
- Soft charcoal (never pure black)
- Warm gray range (3–5 steps)

Execution:
- Backgrounds live in warm whites.
- Body text in soft charcoal.
- Dividers in low-contrast gray.

Example ranges (conceptual, not prescriptive):
- Background: #FAFAF8 → #F4F3EF
- Text: #1F1F1F → #333333
- Borders: #E5E5E0

Why:
- Feels editorial.
- Reduces visual fatigue.
- Signals maturity.

---

### Brand Color (Accent)
Rules:
- One primary brand color only.
- Slightly desaturated.
- Must work on white and off-white.

Usage:
- Primary CTA
- Key highlights
- Progress or active states

Never:
- Use brand color for large backgrounds.
- Use more than one accent per page.

---

### Emphasis Color (Rare)
Purpose:
- Errors
- Warnings
- Critical moments

Rule:
- If users see it often, it’s wrong.

---

## 2) Typography — Editorial First, Interface Second

### Font Stack Strategy
Two families. No exceptions.

1. **Primary Brand Typeface**
   - Serif *or* humanist sans
   - Used for:
     - Headlines
     - Key statements
     - Brand moments

2. **Utility Typeface**
   - Neutral sans
   - Used for:
     - Body copy
     - UI labels
     - Forms
     - Navigation

---

### Preferred Typeface Characteristics

#### Serif (if used)
- Modern serif
- Moderate contrast
- Not ornamental

Feels:
- Thoughtful
- Established
- Trustworthy

#### Sans (if used)
- Humanist or grotesk
- Open apertures
- Neutral personality

Feels:
- Clear
- Modern
- Calm

---

### Typography Execution Rules
- Body text: **16–18px**
- Headings: large and confident
- Line height: generous (1.4–1.6)
- Sentence case > ALL CAPS
- Tracking stays tight

Avoid:
- Ultra-thin weights
- Condensed fonts
- Trend fonts

---

## 3) Layout & White Space — Confidence Through Restraint

Execution tactics:
- Oversized margins.
- Clear section breaks.
- Predictable vertical rhythm.
- One idea per section.

Rules:
- White space is not empty—it’s structural.
- If it feels sparse, you’re close.
- If it feels empty, you went too far.

---

## 4) Graphics & Illustration — Minimal, Functional

Preferred styles:
- Simple line icons
- Editorial diagrams
- Flat, monochrome illustrations

Rules:
- Icons match stroke weight across the system.
- No gradients unless brand-defining.
- No playful doodles unless brand is playful by nature.

Purpose:
- Explain
- Orient
- Reduce cognitive load

Never:
- Use graphics as decoration alone.
- Mix illustration styles.

---

## 5) Photography — Human, Honest, Editorial

### Photography Direction
- Natural light
- Real environments
- Real people
- Minimal retouching

Execution:
- Shoot like a magazine feature.
- Slight imperfections allowed.
- Avoid overly staged compositions.

Rules:
- One strong image beats a collage.
- Faces build trust faster than objects.
- Lifestyle > product glamour shots.

---

## 6) Motion & Animation — Subtle, Purposeful

### Motion Philosophy
Motion should feel *inevitable*, not impressive.

### Allowed Animations
- Fade-in on scroll (slow, subtle)
- Small position shifts (4–8px)
- Button hover transitions
- Focus state emphasis

Timing:
- 150–250ms
- Ease-in-out
- Never bouncy

---

### Motion Rules
- Motion explains hierarchy.
- Motion reinforces action.
- Motion never distracts.

Never:
- Use autoplay carousels.
- Use looping decorative animations.
- Animate without purpose.

---

## 7) Buttons & CTAs — Clear, Calm, Confident

Execution:
- Rectangular or softly rounded.
- Solid fill for primary.
- Outline or text for secondary.

Rules:
- One primary CTA per view.
- CTA copy is specific and reassuring.
- Hover states are subtle, not flashy.

Examples:
- “Start now” → “Check availability”
- “Buy” → “Add to routine”

---

## 8) Forms — Minimal Friction, Maximum Trust

Execution:
- Visible labels (not placeholders only).
- Minimal fields.
- Inline validation.

Microcopy:
- Explain *why* information is needed.
- Reduce anxiety before it appears.

---

## 9) Brand Polish Checklist (Pre-Launch)
Run this before shipping.

- Does this feel calm?
- Is the value obvious in 5 seconds?
- Are colors doing real work?
- Is typography doing the heavy lifting?
- Would this feel credible in print?

---

## Final Rule (The Gin Lane / Red Antler Test)
If you removed:
- One color
- One font
- One animation
- One section

Would it feel **better**?

If yes—remove it.


--

# High-Chroma DTC “Playful Maximalism” Homepage — Execution Instructions
North Star: Deliver “nostalgic delight” + “adult trust” in one scroll story.

---

## 1) Visual Strategy (what this look signals)
- Make the brand feel: **fun, bold, safe, simple**
- Use: **loud color + clean layout** (high energy, low clutter)
- Anchor everything in: **packaging-first hero visuals** + **proof-first copy**

---

## 2) Color System (the 핵심)
### Palette roles (define tokens first)
- `BG_BASE`: off-white / very light warm neutral (resting zones)
- `BG_POP[]`: 4–8 high-chroma brand fields (pink, purple, blue, yellow, mint, orange)
- `INK`: near-black (never pure black) for readability
- `INK_MUTED`: softer gray for secondary text
- `CTA`: single “action” color (high contrast on all BG_POP)
- `CTA_HOVER`: darker/lighter variant
- `BORDER`: faint neutral line (used sparingly)

### Rules
- Use **big flat color fields** for section backgrounds (not gradients-first).
- Keep **1 dominant color per section** (avoid rainbow inside one block).
- Keep CTA consistent: **one CTA color across the site**.
- “Saturation gating”: loud backgrounds, but limit UI elements per section:
  - max 1 headline + 1 subhead + 1 CTA + 1 hero visual

### Practical checks
- Ensure text/CTA contrast remains legible on every BG_POP.
- If a background is ultra-bright, switch text to INK or white only if contrast holds.

---

## 3) Illustration + Graphics System (build a “brand world”)
### Core style
- Use **flat-vector shapes** (minimal shading).
- Add **floating motif confetti** (product shapes, icons, little pieces) as punctuation.
- Keep geometry consistent:
  - one corner radius family
  - one icon stroke weight (if using strokes)
  - limited detail (works at scroll speed)

### Where illustrations live
- Primary: **packaging / product art** (box-first, label-first, can-first)
- Secondary: **icons** for benefit proof + “how it works”
- Tertiary: **section accents** (sparingly, never competing with CTAs)

### Rules
- 2–4 colors max per illustration scene.
- Avoid complex characters; keep it iconic and repeatable.
- Repeat motifs across sections to create cohesion (same shapes appear everywhere).

---

## 4) Typography (cereal box energy, modern clarity)
### Hierarchy
- Hero headline: **short, punchy, declarative** (6–10 words)
- Subhead: one sentence that resolves the tension:
  - “kid joy” + “adult outcome” (taste + nutrition / fun + function)
- Section headers: terse, benefit-led
- Body copy: minimal; rely on modules and labels

### Rules
- Use **big type** + generous spacing.
- Keep paragraphs rare; prefer bullets and micro-labels.
- Use typographic contrast (size/weight), not color, for hierarchy.

---

## 5) Layout & Modules (loud visuals, quiet structure)
### Default scroll sequence
1) Hero: value prop + CTA + packaging visual
2) “Shop what’s new” / seasonal hook
3) Best sellers grid (price, rating, quick add)
4) Subscribe & Save value stack (discount + perks)
5) Benefit proof cards (icons + metrics)
6) Taste/social proof (reviews, press)
7) How it works (3 steps)
8) FAQ accordion
9) Guarantee + final CTA

### Layout rules
- Use strict grid + consistent spacing (8pt system).
- Keep nav minimal (Shop, Bundles, Subscribe, FAQ, Account).
- Keep sections modular and repeatable (same card patterns).

---

## 6) Photography / Product Rendering (tactile + graphic)
- Prefer **packaging-forward** shots on clean backgrounds.
- Use crisp lighting; show texture only where it helps (crunch, pour, scoop).
- Lifestyle: minimal, controlled, “bright morning” energy.

---

## 7) Motion (premium restraint)
- Use subtle reveals (opacity + small translate).
- Hover states: gentle lift + soft shadow.
- Optional: micro-loops (2–4s) showing “use” (pour/scoop/open).
- Never let motion compete with reading or CTAs.

---

## 8) Conversion Psychology (what to emphasize)
- Reduce risk fast:
  - clear price, shipping/returns, guarantee near CTA
- Increase certainty:
  - quantified benefits (protein/sugar/etc.), reviews, press
- Keep choices simple:
  - best sellers + bundles + subscribe option (few decision paths)

---

## 9) Do / Don’t
### Do
- One loud color field per section
- Packaging as the main “illustration canvas”
- Icons + metrics to prove claims
- Short copy + strong hierarchy + repeatable modules

### Don’t
- Multiple CTA colors
- Busy backgrounds behind long paragraphs
- Over-detailed illustrations that break at scroll speed
- Too many competing motifs per section
