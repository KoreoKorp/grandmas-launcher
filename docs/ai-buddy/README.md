# AI Buddy Redesign — Design Notes

Status: **Mockup animation-complete — not yet wired into the app.**
This is a design working folder: a clickable HTML mockup plus the source
image assets it's built from. It exists so the redesign can continue from
any machine without redoing the exploration.

## What this is

Grandma's launcher currently has an AI Buddy as a floating round button in
the bottom-right corner (`BuddyFloat.jsx`) that opens a full-screen modal
chat (`AIBuddy.jsx`). The ask: move Buddy into the sidebar (the spot marked
in the caregiver's `AIBUDDYSPOT.png` screenshot, between the daily note and
the "Need help?" button), make him a cat, and make him feel like a real
desktop pet — not just a chat icon.

Open `preview.html` in a browser to see the current state of the mockup.

## Decisions made so far

- **Character**: a ginger tabby cat with sunglasses and a bow tie, matching
  the caregiver-supplied reference art in `assets/reference-cat.jpeg`
  (background removed → `assets/cutout.png`).
- **Placement**: inline in the sidebar, not a floating corner button.
- **Interaction model**: tapping Buddy opens chat *inline*, in the same
  card, not a modal popup. A "Let's chat" affordance swaps the pet view for
  a compact chat view (header + message list + input) sized to fit the
  sidebar column; a back arrow returns to the pet view.
- **Pet behaviors** (caregiver picked all four when asked):
  - Petting reactions — tapping Buddy triggers a happy animation.
  - Idle wandering — drifts left/right on its own when untouched.
  - Proactive commentary — speech bubble occasionally comments unprompted
    (weather, etc.), beyond the existing random hint bubbles.
  - Moods/expressions — a mood chip that shifts with context.
- **Animation approach**: no AI-generated video (would cost real credits
  for a one-off asset that isn't reusable in-app anyway). The source image
  is cut into **four** independent transparent-PNG layers with Pillow —
  `assets/layer-head.png`, `layer-torso.png`, `layer-legs.png`,
  `layer-tail.png`, matching the 4-piece split in `catsplit.jpg` — and
  rigged as a CSS "puppet": the torso breathes, the head tilts and
  glances, the tail swishes, and only the torso/head/tail bob — the legs
  are their own layer and stay planted on the ground. See
  `preview.html`'s `.cat-rig` / `.buddy-float` / `.rig-*` CSS for how the
  layers are positioned and animated.
- **Joint overlap (the "cat gaps" fix)**: the first cut used exact
  rectangles — head crop == hole in body — so any rotation exposed
  transparent slits at the neck and tail base. `rig_cut.py` now re-cuts
  the layers puppet-style: the head carries a feathered fur skirt past the
  old cut line (left + below only — extending right would slice into the
  tail's white tip), the tail gets a skirt at its base, the torso gets one
  at the waist (only the torso fades there — fading both sides of a seam
  makes the overlap band semi-transparent), and the holes/rects are sized
  so the parts always overlap. Rest pose composites pixel-identical to
  the original cutout, and `gap-check.png` verifies the seams stay covered
  at the animation's extreme angles (head ±14°, tail −24/+16°, torso at
  tap-squash scale).

## Where it stands

Animation pass is **complete** (this session). The rig now runs layered,
desynchronized loops so motion never looks metronomic:

- **Layered rig** — one-shot gesture wraps sit *outside* the looping layers
  (glances / double-takes / nods on the head, flicks on the tail), so
  one-off moves never interrupt or snap the idle loops underneath.
- **Compound tail** — fast swish (2.2s) nested inside a slow sway (5.7s).
- **Asymmetric breathing** — quicker inhale, slower settle; a floor shadow
  pulses opposite the body bob.
- **Strolling** — wander is a JS random-walk (`requestAnimationFrame` lerp)
  instead of CSS margin keyframes: smooth starts/stops, rests twice as
  likely as moves, and Buddy leans into his direction of travel.
- **Petting** — springy squash-and-stretch, purr micro-jiggle, head nod +
  tail flick combo, 2–4 heart burst at random offsets, mood chip bump
  ("🥰 Loved", escalates to "😻 Overjoyed!" after 3+ pets).
- **Proactive commentary** — bubbles pop in/out on a 14–26s schedule with
  lines picked by time of day (morning/afternoon/evening/night pools);
  suppressed while chatting.
- **Mood chip** follows the actual clock (refreshes every minute).
- Keyboard accessible (Tab + Enter/Space pets him); blanket
  `prefers-reduced-motion` handling.

Still open for caregiver review: whether he needs sound effects (purr/meow
on pet), and any specific notes behind the earlier "needs significant
improvement" feedback.

## Next steps

1. Once the mockup is approved, port it into real components:
   - Replace `BuddyFloat.jsx`'s floating button with an inline sidebar
     component (new component, or fold into `Sidebar.jsx`).
   - Decide whether `AIBuddy.jsx`'s chat logic gets adapted to render
     inline (reusing its `sendMessage`/speech/history logic against a
     narrower layout) or a new component wraps that logic.
   - Move the cut cat-layer PNGs from `docs/ai-buddy/assets/` into
     `resources/` or `src/renderer/launcher/src/assets/` (wherever the
     app's build actually expects static assets — check
     `electron.vite.config.mjs`) rather than referencing the docs folder.
2. Optional polish if wanted: synthesized purr/meow on pet (Web Audio, no
   asset files needed).
3. Re-run the rig-cutting script (see below) if the reference art changes,
   since the crop boxes are hand-picked pixel coordinates specific to
   `reference-cat.jpeg`'s exact composition.

## Regenerating the layers

Run `python rig_cut.py` (requires `pip install Pillow`). It re-cuts all
four layers from `assets/cutout.png` with the overlap skirts, writes them
back to `assets/`, renders `gap-check.png` (the rig at extreme poses),
and prints a rest-pose fidelity check (must report 0 px differing).

It also writes **`boxes.png`** — the cut outlines drawn over the art on a
labeled 50px grid: cyan = head crop, magenta = tail crop, green = torso
crop, orange = legs crop, white = the holes erased from the torso, yellow
crosses = rotation pivots.

**Prefer pointing to typing?** Run `python pick_boxes.py` for a visual
editor: the cat in a window, drag to redraw the HEAD/TAIL boxes, nudge
with arrow keys (Shift+Arrow resizes), then hit **Save + Re-cut** to write
the rects into `rig_cut.py` and re-run it in one step.

The cut rects live at the top of `rig_cut.py` as `HEAD` / `TAIL` /
`TORSO` / `LEGS` — specific to this exact composition. If the reference
art changes, re-derive them from the display boxes in `preview.html`
(natural = display × 397/175 horizontally, × 478/211 vertically). The
skirt margins are constants there too, if seams ever need more coverage.
