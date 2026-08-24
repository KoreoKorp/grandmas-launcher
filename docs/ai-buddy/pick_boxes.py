# Visual editor for the puppet cut boxes.
#
# Shows cutout.png in a window; drag to draw the HEAD (cyan) or TAIL
# (magenta) crop rectangle directly on the cat, fine-tune with the number
# boxes or arrow keys, then "Save + Re-cut" writes the rects into
# rig_cut.py and runs it. Verify with boxes.png / gap-check.png as usual.
#
# Usage:  python pick_boxes.py

import math
import re
import subprocess
import sys
import tkinter as tk
from pathlib import Path

try:
    from PIL import Image, ImageTk
except ImportError:
    sys.exit("Requires Pillow:  pip install Pillow")

HERE = Path(__file__).parent
SCRIPT = HERE / "rig_cut.py"
IMG = HERE / "assets" / "cutout.png"

CYAN, MAGENTA, GRIDC = "#00E1FF", "#FF50FF", "#FFFFFF"
KEYS = ("L", "T", "R", "B")


def read_rects():
    src = SCRIPT.read_text()
    head = re.search(r"^HEAD\s*=\s*\(([^)]*)\)", src, re.M).group(1)
    tail = re.search(r"^TAIL\s*=\s*\(([^)]*)\)", src, re.M).group(1)
    return ([int(v) for v in head.split(",")], [int(v) for v in tail.split(",")])


def write_rects(head, tail):
    src = SCRIPT.read_text()
    src = re.sub(r"^HEAD\s*=\s*\([^)]*\)",
                 f"HEAD = ({head[0]}, {head[1]}, {head[2]}, {head[3]})", src, flags=re.M)
    src = re.sub(r"^TAIL\s*=\s*\([^)]*\)",
                 f"TAIL = ({tail[0]}, {tail[1]}, {tail[2]}, {tail[3]})", src, flags=re.M)
    SCRIPT.write_text(src)


class Picker:
    def __init__(self, root):
        self.root = root
        root.title("Buddy cut-box picker")
        self.src = Image.open(IMG).convert("RGB")
        self.W, self.H = self.src.size
        self.scale = min(1.7, 620 / self.W, 760 / self.H)
        self.head, self.tail = read_rects()
        self.which = tk.StringVar(value="head")
        self.show_grid = tk.BooleanVar(value=True)
        self.status = tk.StringVar(
            value="Drag on the cat to draw a box. Arrow keys move it, Shift+Arrow resizes.")
        self.drag_start = None
        self.preview = None

        top = tk.Frame(root)
        top.pack(fill="x", padx=8, pady=(8, 2))
        tk.Label(top, text="Editing:", font=("Segoe UI", 10, "bold")).pack(side="left")
        for val, lab, col in (("head", "HEAD box", CYAN), ("tail", "TAIL box", MAGENTA)):
            tk.Radiobutton(top, text=lab, variable=self.which, value=val,
                           command=self.sync_entries, selectcolor="white").pack(side="left", padx=6)
        tk.Checkbutton(top, text="Grid", variable=self.show_grid, command=self.redraw).pack(side="left", padx=18)

        self.canvas = tk.Canvas(root, width=int(self.W * self.scale), height=int(self.H * self.scale),
                                highlightthickness=1, highlightbackground="#666")
        self.canvas.pack(padx=8, pady=4)
        self.tkimg = ImageTk.PhotoImage(
            self.src.resize((int(self.W * self.scale), int(self.H * self.scale)), Image.LANCZOS))

        bottom = tk.Frame(root)
        bottom.pack(fill="x", padx=8, pady=(2, 4))
        self.vars = {}
        for key in KEYS:
            tk.Label(bottom, text=key).pack(side="left", padx=(12, 2))
            v = tk.StringVar()
            v.trace_add("write", lambda *a, k=key: self.on_entry(k))
            tk.Spinbox(bottom, from_=0, to=max(self.W, self.H), textvariable=v, width=5,
                       command=lambda k=key: self.on_entry(k)).pack(side="left")
            self.vars[key] = v
        tk.Button(bottom, text="Save to rig_cut.py", command=lambda: self.save(run=False)).pack(side="left", padx=(20, 6))
        tk.Button(bottom, text="Save + Re-cut", bg="#2E8B57", fg="white",
                  command=lambda: self.save(run=True)).pack(side="left")
        tk.Label(root, textvariable=self.status, anchor="w", fg="#444").pack(fill="x", padx=10, pady=(0, 6))

        self.canvas.bind("<ButtonPress-1>", self.press)
        self.canvas.bind("<B1-Motion>", self.drag)
        self.canvas.bind("<ButtonRelease-1>", self.release)
        for key, dx, dy in (("<Left>", -1, 0), ("<Right>", 1, 0), ("<Up>", 0, -1), ("<Down>", 0, 1)):
            root.bind(key, lambda e, dx=dx, dy=dy: self.nudge(dx, dy, e))

        self.redraw()
        self.sync_entries()

    # ── coordinate helpers ──
    def rect(self, name=None):
        return self.head if (name or self.which.get()) == "head" else self.tail

    def clamp(self, r):
        r[0] = max(0, min(r[0], self.W)); r[2] = max(0, min(r[2], self.W))
        r[1] = max(0, min(r[1], self.H)); r[3] = max(0, min(r[3], self.H))
        return r

    # ── drawing ──
    @staticmethod
    def rounded_pts(x0, y0, x1, y1, r=12, steps=6):
        """Corner-arc points for a rounded rectangle (canvas has no native one)."""
        r = max(2, min(r, (x1 - x0) / 2, (y1 - y0) / 2))
        pts = []
        for cx, cy, a0 in ((x1 - r, y0 + r, 270), (x1 - r, y1 - r, 0),
                           (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
            for i in range(steps + 1):
                a = math.radians(a0 + 90 * i / steps)
                pts += [cx + r * math.cos(a), cy + r * math.sin(a)]
        return pts

    def draw_rect(self, r, color, label):
        s = self.scale
        pts = self.rounded_pts(r[0] * s, r[1] * s, r[2] * s, r[3] * s)
        self.canvas.create_polygon(pts, smooth=True, outline=color, fill="", width=2)
        self.canvas.create_text(r[0] * s + 4, max(0, r[1] * s - 9), text=label,
                                fill=color, anchor="w", font=("Segoe UI", 9, "bold"))

    def redraw(self):
        self.canvas.delete("all")
        self.canvas.create_image(0, 0, image=self.tkimg, anchor="nw")
        if self.show_grid.get():
            s = self.scale
            for gx in range(0, self.W, 50):
                self.canvas.create_line(gx * s, 0, gx * s, self.H * s, fill=GRIDC, stipple="gray50")
                self.canvas.create_text(gx * s + 2, 2, text=str(gx), fill=GRIDC, anchor="nw", font=("Segoe UI", 7))
            for gy in range(0, self.H, 50):
                self.canvas.create_line(0, gy * s, self.W * s, gy * s, fill=GRIDC, stipple="gray50")
                self.canvas.create_text(2, gy * s + 2, text=str(gy), fill=GRIDC, anchor="nw", font=("Segoe UI", 7))
        self.draw_rect(self.head, CYAN, "HEAD")
        self.draw_rect(self.tail, MAGENTA, "TAIL")

    # ── mouse: drag out a new box for the selected layer ──
    def press(self, e):
        self.drag_start = (int(e.x / self.scale), int(e.y / self.scale))

    def drag(self, e):
        if not self.drag_start:
            return
        if self.preview:
            self.canvas.delete(self.preview)
        x0, y0 = self.drag_start
        x1, y1 = int(e.x / self.scale), int(e.y / self.scale)
        s = self.scale
        col = CYAN if self.which.get() == "head" else MAGENTA
        self.preview = self.canvas.create_rectangle(min(x0, x1) * s, min(y0, y1) * s,
                                                    max(x0, x1) * s, max(y0, y1) * s,
                                                    outline=col, width=2, dash=(4, 3))

    def release(self, e):
        if not self.drag_start:
            return
        x0, y0 = self.drag_start
        x1, y1 = int(e.x / self.scale), int(e.y / self.scale)
        self.drag_start = None
        if self.preview:
            self.canvas.delete(self.preview)
            self.preview = None
        r = self.clamp([min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)])
        if r[2] - r[0] < 4 or r[3] - r[1] < 4:
            return  # too small to be intentional
        if self.which.get() == "head":
            self.head = r
        else:
            self.tail = r
        self.sync_entries()
        self.redraw()

    # ── keyboard: move / resize the selected box ──
    def nudge(self, dx, dy, e):
        r = self.rect()
        if e.state & 0x0001:  # Shift held -> resize
            if dx:
                r[2] += dx
            if dy:
                r[3] += dy
        else:
            r[0] += dx; r[1] += dy; r[2] += dx; r[3] += dy
        self.clamp(r)
        self.sync_entries()
        self.redraw()

    # ── entries ──
    def sync_entries(self):
        for key, v in zip(KEYS, self.rect()):
            self.vars[key].set(str(v))
        self.status.set(f"HEAD {tuple(self.head)}   TAIL {tuple(self.tail)}   —  "
                        f"editing {self.which.get().upper()}")

    def on_entry(self, key):
        r = self.rect()
        old = r[KEYS.index(key)]
        try:
            val = int(self.vars[key].get())
        except ValueError:
            return
        idx = KEYS.index(key)
        limit = self.W if idx % 2 == 0 else self.H
        val = max(0, min(val, limit))
        # reject edits that would invert the box
        if idx == 0 and val >= r[2] - 4: val = old
        if idx == 2 and val <= r[0] + 4: val = old
        if idx == 1 and val >= r[3] - 4: val = old
        if idx == 3 and val <= r[1] + 4: val = old
        if val != old:
            r[idx] = val
            self.redraw()

    # ── save ──
    def save(self, run):
        write_rects(self.head, self.tail)
        if run:
            out = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True,
                                 text=True, cwd=str(HERE))
            tail_line = (out.stdout.strip().splitlines() or ["(no output)"])[-1]
            self.status.set(f"Saved + re-cut: {tail_line}   —  check boxes.png / gap-check.png")
            print(out.stdout, out.stderr)
        else:
            self.status.set("Saved to rig_cut.py.  Run rig_cut.py when ready.")


def main():
    root = tk.Tk()
    Picker(root)
    root.mainloop()


if __name__ == "__main__":
    main()
