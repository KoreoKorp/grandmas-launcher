# AI Buddy Redesign — Design Notes

Status: **Draft / in-progress — nothing in this folder is wired into the app yet.**
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
  for a one-off asset that isn't reusable in-app anyway). Instead the
  source image was cut into three independent transparent-PNG layers with
  Pillow — `assets/layer-body.png`, `assets/layer-head.png`,
  `assets/layer-tail.png` — and rigged as a CSS "puppet": head tilts, tail
  swishes, and body breathes, all independently, plus the whole rig bobs
  and drifts. See `preview.html`'s `.cat-rig` / `.rig-*` CSS and
  `petBuddy()` JS for how the layers are cropped, positioned, and animated.

## Where it stands

Caregiver feedback on the last round (3-layer puppet rig): **"good start
but needs significant improvement."** No specifics given yet on what to
improve — that's the open question for the next session.

## Next steps

1. Get specifics on what "needs significant improvement" means — likely
   candidates: smoother/more natural motion curves, more expressive
   reactions, sound effects, more proactive-commentary variety, or the
   rig's seams showing at certain rotation angles.
2. Once the mockup is approved, port it into real components:
   - Replace `BuddyFloat.jsx`'s floating button with an inline sidebar
     component (new component, or fold into `Sidebar.jsx`).
   - Decide whether `AIBuddy.jsx`'s chat logic gets adapted to render
     inline (reusing its `sendMessage`/speech/history logic against a
     narrower layout) or a new component wraps that logic.
   - Move the cut cat-layer PNGs from `docs/ai-buddy/assets/` into
     `resources/` or `src/renderer/launcher/src/assets/` (wherever the
     app's build actually expects static assets — check
     `electron.vite.config.mjs`) rather than referencing the docs folder.
3. Re-run the rig-cutting script (see below) if the reference art changes,
   since the crop boxes are hand-picked pixel coordinates specific to
   `reference-cat.jpeg`'s exact composition.

## Regenerating the layers

The cutout/layer PNGs were produced with Python + Pillow (`pip install
Pillow`), not committed as a script yet. Steps, if the reference image
changes:

1. Load the reference JPEG, convert to RGBA, key out near-white background
   pixels (`r,g,b > 235`) to alpha 0, then crop to the opaque bounding box.
2. Hand-pick pixel rectangles for the head and tail regions (viewed via a
   coordinate-grid overlay), erase those rectangles from a copy of the
   cutout to make `layer-body.png`, and crop those same rectangles out to
   make `layer-head.png` / `layer-tail.png`.
3. Check for accidental overlap between the head and tail crop boxes
   before finalizing — zoom into the shared corner to confirm no content
   gets duplicated across layers.
