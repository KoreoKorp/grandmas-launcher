# Cuts the buddy puppet layers from cutout.png — 4-piece rig per
# catsplit.jpg: HEAD, TORSO, LEGS, TAIL.
#
# Every joint uses OVERLAP, never exact fits (exact rects are what caused
# the original "cat gaps"): each moving layer carries a feathered fur
# skirt past the cut line, and the layer under it keeps its pixels there,
# so rotations/scales always slide fur over fur. The feet stay planted:
# legs are their own layer and never bob with the body.
#
# Outputs (assets/): layer-head/torso/legs/tail.png, plus gap-check.png
# (rig at extreme poses) and boxes.png (cut outlines on a coordinate grid).
#
# Usage:  python rig_cut.py
# Requires: pip install Pillow

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = Path(__file__).parent
ASSETS = HERE / "assets"

# ── Cut rects in natural cutout pixels (397x478). Derived from the
#    display boxes in preview.html (rig 175x211) via the 2.2686/2.2654
#    scales. Re-pick these for new reference art — see boxes.png. ──
HEAD = (9, 0, 340, 204)      # bottom edge = neck seam, above the bow tie
TAIL = (259, 109, 397, 263)  # left/bottom edges = tail-base seam
TORSO = (6, 190, 368, 352)   # bottom edge = waist seam, below jacket hem
LEGS = (18, 338, 354, 478)   # top edge tucks under the torso skirt; left edge
                             # catches the dangling left paw (reaches y~460)

# ── Overlap skirts (natural px; ~2.27px per display px) ──
HEAD_SKIRT_X = 16
HEAD_BOTTOM_ABS = 216        # head extends down to this y (above the bow tie)
HEAD_FADE = 10
TAIL_SKIRT_X = 26
TAIL_SKIRT_Y = 16
TAIL_FADE = 12
WAIST_FADE = 14              # torso's bottom skirt overlapping the legs.
                             # Only the torso fades at the waist: fading both
                             # sides made the overlap band semi-transparent.

BG = (36, 64, 58, 255)       # --bg-card, so exposed seams show like in-app


def rect_fade_mask(size, left=0, top=0, right=0, bottom=0, fade=10):
    """L mask: 255 core, linear fade to 0 across each skirt margin."""
    w, h = size
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    d.rectangle((left, top, w - right, h - bottom), fill=255)
    if fade > 0:
        grad = Image.linear_gradient("L")  # black top -> white bottom
        if left:
            g = grad.rotate(90, expand=True).resize((left, h))
            mask.paste(Image.composite(g, mask.crop((0, 0, left, h)), g), (0, 0))
        if right:
            g = grad.rotate(-90, expand=True).resize((right, h))
            box = mask.crop((w - right, 0, w, h))
            mask.paste(Image.composite(g.transpose(Image.FLIP_LEFT_RIGHT), box, g), (w - right, 0))
        if top:
            g = grad.resize((w, top))
            mask.paste(Image.composite(g, mask.crop((0, 0, w, top)), g), (0, 0))
        if bottom:
            g = grad.resize((w, bottom))
            box = mask.crop((0, h - bottom, w, h))
            mask.paste(Image.composite(g.transpose(Image.FLIP_TOP_BOTTOM), box, g), (0, h - bottom))
    return mask


def erase(img, box_abs, crop_box, feather=1.5):
    """Zero out alpha inside box_abs (cutout coords), relative to crop_box."""
    x0, y0, x1, y1 = box_abs
    cx, cy = crop_box[0], crop_box[1]
    hole = Image.new("L", img.size, 255)
    ImageDraw.Draw(hole).rectangle((x0 - cx, y0 - cy, x1 - cx, y1 - cy), fill=0)
    hole = hole.filter(ImageFilter.GaussianBlur(feather))
    img.putalpha(ImageChops.multiply(img.getchannel("A"), hole))
    return img


def faded_crop(cutout, box, **skirts):
    """Crop a region and feather the given skirt margins."""
    layer = cutout.crop(box)
    fade = skirts.pop("fade", 10)
    skirt = rect_fade_mask(layer.size, fade=fade, **skirts)
    layer.putalpha(ImageChops.multiply(layer.getchannel("A"), skirt))
    return layer


def rotated_paste(canvas, layer, box, deg, origin_frac):
    """Rotate layer about origin_frac (CSS transform-origin semantics)."""
    import math
    w, h = layer.size
    cx, cy = w * origin_frac[0], h * origin_frac[1]
    rot = layer.rotate(-deg, resample=Image.BICUBIC, expand=True)  # CSS +deg = clockwise
    rw, rh = rot.size
    dx, dy = cx - w / 2, cy - h / 2
    a = math.radians(deg)  # y-down clockwise
    rx = dx * math.cos(a) - dy * math.sin(a)
    ry = dx * math.sin(a) + dy * math.cos(a)
    px = box[0] + cx - rx - rw / 2
    py = box[1] + cy - ry - rh / 2
    canvas.alpha_composite(rot, (int(px), int(py)))


def scaled_paste(canvas, layer, box, sx, sy, origin_frac):
    """Scale layer about origin_frac, like CSS transform scale()."""
    w, h = layer.size
    fx, fy = origin_frac
    nw, nh = max(1, int(w * sx)), max(1, int(h * sy))
    sc = layer.resize((nw, nh), Image.LANCZOS)
    px = box[0] + fx * w - fx * nw
    py = box[1] + fy * h - fy * nh
    canvas.alpha_composite(sc, (int(px), int(py)))


def main():
    cutout = Image.open(ASSETS / "cutout.png").convert("RGBA")
    hl, ht, hr, hb = HEAD
    tl, tt, tr, tb = TAIL
    sol, sot, sor, sob = TORSO
    lel, let, ler, leb = LEGS

    # ── LEGS: planted anchor layer. Hard edges — the top edge lives under
    #    the torso's fade zone, the rest is silhouette. ──
    legs_box = (lel, let, ler, leb)
    legs = cutout.crop(legs_box)
    legs.save(ASSETS / "layer-legs.png")

    # ── TAIL: skirt extends into the hip (left) and down past the old cut ──
    tail_box = (tl - TAIL_SKIRT_X, tt, tr, tb + TAIL_SKIRT_Y)
    tail = faded_crop(cutout, tail_box, left=TAIL_SKIRT_X,
                      bottom=tail_box[3] - tb, fade=TAIL_FADE)
    tail.save(ASSETS / "layer-tail.png")

    # ── TORSO: shoulders to below the jacket hem. Holes where the head and
    #    tail live; bottom skirt overlaps the legs' top. ──
    torso_box = (sol, sot, sor, sob)
    torso = faded_crop(cutout, torso_box, bottom=WAIST_FADE)
    erase(torso, (hl + HEAD_SKIRT_X, ht, hr, hb - 8), torso_box)   # neck hole
    erase(torso, (tl + 14, tt, tr, tb - 4), torso_box)             # tail hole
    torso.save(ASSETS / "layer-torso.png")

    # ── HEAD: skirt left + below only (right would slice into the tail's
    #    white tip); subtract tail pixels so nods can't carry ghost tail. ──
    head_box = (hl - HEAD_SKIRT_X, ht, hr, HEAD_BOTTOM_ABS)
    head = cutout.crop(head_box)
    skirt = rect_fade_mask(head.size, left=HEAD_SKIRT_X,
                           bottom=head.size[1] - (hb - ht), fade=HEAD_FADE)
    core = Image.new("L", head.size, 255)
    ImageDraw.Draw(core).rectangle(
        (HEAD_SKIRT_X, 0, head.size[0], (hb - ht) - HEAD_FADE), fill=255)
    head.putalpha(ImageChops.multiply(head.getchannel("A"), ImageChops.lighter(skirt, core)))
    zone = Image.new("L", head.size, 0)
    ImageDraw.Draw(zone).rectangle((300 - head_box[0], tt - head_box[1],
                                    head.size[0], head.size[1]), fill=255)
    tail_abs = Image.new("L", head.size, 0)
    tail_abs.paste(tail.getchannel("A"), (tail_box[0] - head_box[0], tail_box[1] - head_box[1]))
    head.putalpha(ImageChops.multiply(head.getchannel("A"),
                                      ImageChops.invert(ImageChops.multiply(zone, tail_abs))))
    head.save(ASSETS / "layer-head.png")

    stale = ASSETS / "layer-body.png"
    if stale.exists():
        stale.unlink()  # superseded by torso + legs

    # ── Pivots (same absolute points as the original rig) ──
    head_pivot = (hl + 0.50 * (hr - hl), 0.96 * (hb - ht))
    tail_pivot = (tl + 0.09 * (tr - tl), tt + 0.92 * (tb - tt))
    head_origin = ((head_pivot[0] - head_box[0]) / head.size[0],
                   (head_pivot[1] - head_box[1]) / head.size[1])
    tail_origin = ((tail_pivot[0] - tail_box[0]) / tail.size[0],
                   (tail_pivot[1] - tail_box[1]) / tail.size[1])
    torso_origin = (0.50, 1.0)  # hem: breathe scales up from the waist

    # ── boxes.png: cut outlines over a labeled coordinate grid ──
    vis = cutout.copy()
    d = ImageDraw.Draw(vis)
    for x in range(0, cutout.size[0], 50):
        d.line((x, 0, x, cutout.size[1]), fill=(255, 255, 255, 70), width=1)
        if x % 100 == 0:
            d.text((x + 3, 3), str(x), fill=(255, 255, 255, 220))
    for y in range(0, cutout.size[1], 50):
        d.line((0, y, cutout.size[0], y), fill=(255, 255, 255, 70), width=1)
        if y % 100 == 0:
            d.text((3, y + 3), str(y), fill=(255, 255, 255, 220))
    d.rounded_rectangle(head_box, radius=16, outline=(0, 225, 255, 255), width=3)
    d.rounded_rectangle(tail_box, radius=16, outline=(255, 80, 255, 255), width=3)
    d.rounded_rectangle(torso_box, radius=16, outline=(120, 255, 120, 255), width=3)
    d.rounded_rectangle(legs_box, radius=16, outline=(255, 170, 60, 255), width=3)
    d.rounded_rectangle((hl + HEAD_SKIRT_X, ht, hr, hb - 8), radius=12,
                        outline=(255, 255, 255, 160), width=2)   # neck hole
    d.rounded_rectangle((tl + 14, tt, tr, tb - 4), radius=12,
                        outline=(255, 255, 255, 160), width=2)   # tail hole
    for px, py in (head_pivot, tail_pivot):
        d.line((px - 14, py, px + 14, py), fill=(255, 255, 0, 255), width=3)
        d.line((px, py - 14, px, py + 14), fill=(255, 255, 0, 255), width=3)
    vis.convert("RGB").save(HERE / "boxes.png")

    # ── gap-check.png: extreme poses; torso at tap-squash scale (the
    #    harshest waist-seam stress) ──
    cell = 320
    sheet = Image.new("RGBA", (cell * 3, cell * 3), BG)
    for i, hdeg in enumerate((-14, 0, 14)):
        for j, tdeg in enumerate((-24, 0, 16)):  # actual animation extremes
            frame = Image.new("RGBA", cutout.size, (0, 0, 0, 0))
            frame.alpha_composite(legs, legs_box[:2])
            rotated_paste(frame, tail, tail_box, tdeg, tail_origin)
            scaled_paste(frame, torso, torso_box, 0.86, 1.14, torso_origin)
            rotated_paste(frame, head, head_box, hdeg, head_origin)
            s = cell / max(frame.size)
            frame = frame.resize((int(frame.size[0] * s), int(frame.size[1] * s)))
            sheet.alpha_composite(frame, (j * cell + (cell - frame.size[0]) // 2,
                                          i * cell + (cell - frame.size[1]) // 2))
    sheet.convert("RGB").save(HERE / "gap-check.png")

    # ── Rest-pose fidelity: 0°/0°/scale-1 composite must match the cutout ──
    rest = Image.new("RGBA", cutout.size, (0, 0, 0, 0))
    rest.alpha_composite(legs, legs_box[:2])
    rest.alpha_composite(tail, tail_box[:2])
    rest.alpha_composite(torso, torso_box[:2])
    rest.alpha_composite(head, head_box[:2])
    da = ImageChops.difference(rest.getchannel("A"), cutout.getchannel("A"))
    hist = da.histogram()
    bad = sum(hist[41:])
    bbox = da.point(lambda p: 255 if p > 40 else 0).getbbox()
    print(f"rest pose: {bad} px differ in alpha by >40; bbox={bbox}")

    print("wrote layer-head/torso/legs/tail.png, gap-check.png, boxes.png")


if __name__ == "__main__":
    main()
