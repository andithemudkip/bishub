"""Low-level PDF -> geometric primitives for LilyPond-engraved hymn scores.

The hymnal PDFs (see docs/ttml-from-scores.md) are LilyPond vector output whose
embedded Emmentaler CFF subsets keep their real glyph names, so every musical
symbol is addressable by name plus position. Everything that is *not* a glyph --
staff lines, stems, barlines, beams, lyric hyphens -- is a filled or stroked
path, recovered here by shape.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field

import pymupdf
from fontTools.cffLib import CFFFontSet


@dataclass
class Glyph:
    name: str
    x: float  # origin x (LilyPond anchors noteheads by their left edge)
    y: float  # origin y (baseline; for noteheads this is the vertical centre)
    size: float
    bbox: tuple[float, float, float, float]

    # NB: `bbox` from get_texttrace is the font's metric box -- every glyph in a
    # span shares its height, so it says nothing about where the symbol sits.
    # `y` (the origin) is the real vertical position: for a notehead, its centre.

    @property
    def w(self) -> float:
        return self.bbox[2] - self.bbox[0]

    @property
    def right(self) -> float:
        return self.x + self.w

    @property
    def cx(self) -> float:
        return self.x + self.w / 2


@dataclass
class Seg:
    """An axis-aligned filled/stroked rectangle or line."""

    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def w(self) -> float:
        return self.x1 - self.x0

    @property
    def h(self) -> float:
        return self.y1 - self.y0

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2


@dataclass
class Poly:
    """A filled polygon -- in practice a beam (parallelogram)."""

    pts: list[tuple[float, float]]

    @property
    def x0(self) -> float:
        return min(p[0] for p in self.pts)

    @property
    def x1(self) -> float:
        return max(p[0] for p in self.pts)

    @property
    def y0(self) -> float:
        return min(p[1] for p in self.pts)

    @property
    def y1(self) -> float:
        return max(p[1] for p in self.pts)

    def y_at(self, x: float) -> float:
        """Centre-line y of the parallelogram at a given x (beams slant)."""
        top = sorted(self.pts, key=lambda p: p[1])[:2]
        (ax, ay), (bx, by) = sorted(top, key=lambda p: p[0])
        if abs(bx - ax) < 1e-6:
            return (self.y0 + self.y1) / 2
        t = (x - ax) / (bx - ax)
        return ay + t * (by - ay) + (self.y1 - self.y0) / 4


@dataclass
class TextChar:
    ch: str
    x: float
    y: float  # baseline
    font: str
    size: float
    bbox: tuple[float, float, float, float]


@dataclass
class Page:
    index: int
    width: float
    height: float
    glyphs: list[Glyph] = field(default_factory=list)
    chars: list[TextChar] = field(default_factory=list)
    hlines: list[Seg] = field(default_factory=list)  # staff lines, ledger lines
    vrects: list[Seg] = field(default_factory=list)  # stems, barlines
    dashes: list[Seg] = field(default_factory=list)  # lyric hyphens, short ticks
    beams: list[Poly] = field(default_factory=list)


def _glyph_orders(doc: pymupdf.Document) -> dict[str, list[str]]:
    """Map each embedded Emmentaler variant to its CFF glyph order.

    A single score can embed several optical sizes (Emmentaler-11..-20); their
    subsets have *different* glyph orders, so the mapping must be per font.
    """
    orders: dict[str, list[str]] = {}
    for page in doc:
        for info in page.get_fonts(full=True):
            xref, base = info[0], info[3].split("+")[-1]
            if "Emmentaler" not in base or base in orders:
                continue
            try:
                _, _, _, buf = doc.extract_font(xref)
                cff = CFFFontSet()
                cff.decompile(io.BytesIO(buf), None)
                orders[base] = cff[cff.fontNames[0]].getGlyphOrder()
            except Exception:
                continue
    return orders


def _dedupe(segs: list[Seg]) -> list[Seg]:
    """Drop duplicates -- pymupdf reports a fill and a stroke of the same rect
    as two paths."""
    seen: set[tuple[float, ...]] = set()
    out: list[Seg] = []
    for s in segs:
        key = (round(s.x0, 1), round(s.y0, 1), round(s.x1, 1), round(s.y1, 1))
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out


def _dedupe_polys(polys: list[Poly]) -> list[Poly]:
    seen: set[tuple[float, ...]] = set()
    out: list[Poly] = []
    for p in polys:
        key = (round(p.x0, 1), round(p.y0, 1), round(p.x1, 1), round(p.y1, 1))
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out


def load(path: str) -> tuple[list[Page], dict[str, list[str]]]:
    doc = pymupdf.open(path)
    orders = _glyph_orders(doc)
    pages: list[Page] = []

    for pno, pg in enumerate(doc):
        page = Page(index=pno, width=pg.rect.width, height=pg.rect.height)

        for span in pg.get_texttrace():
            order = orders.get(span["font"])
            for ucs, gid, origin, bbox in span["chars"]:
                if order is not None:
                    name = order[gid] if 0 <= gid < len(order) else f"?{gid}"
                    page.glyphs.append(
                        Glyph(name, origin[0], origin[1], span["size"], tuple(bbox))
                    )
                else:
                    page.chars.append(
                        TextChar(
                            chr(ucs), origin[0], origin[1], span["font"],
                            span["size"], tuple(bbox),
                        )
                    )

        hl: list[Seg] = []
        vr: list[Seg] = []
        da: list[Seg] = []
        for p in pg.get_drawings():
            items = p["items"]
            kinds = {it[0] for it in items}

            # Filled parallelogram (beam) -- 3 line segments closing a quad,
            # or a single 'qu' item when pymupdf recognises the shape.
            if p["type"] in ("f", "fs") and kinds == {"l"} and len(items) == 3:
                pts: list[tuple[float, float]] = []
                for it in items:
                    pts.append((it[1].x, it[1].y))
                    pts.append((it[2].x, it[2].y))
                page.beams.append(Poly(pts))
                continue

            for it in items:
                if it[0] == "qu":
                    q = it[1]
                    page.beams.append(
                        Poly([(q.ul.x, q.ul.y), (q.ur.x, q.ur.y),
                              (q.lr.x, q.lr.y), (q.ll.x, q.ll.y)])
                    )
                elif it[0] in ("re", "l"):
                    if it[0] == "re":
                        r = it[1]
                        x0, y0, x1, y1 = r.x0, r.y0, r.x1, r.y1
                    else:
                        a, b = it[1], it[2]
                        x0, y0 = min(a.x, b.x), min(a.y, b.y)
                        x1, y1 = max(a.x, b.x), max(a.y, b.y)
                    seg = Seg(x0, y0, x1, y1)
                    if seg.h < 0.6 and seg.w > 8:
                        hl.append(seg)
                    elif seg.w < 1.6 and seg.h > 2.5:
                        vr.append(seg)
                    elif 0.8 < seg.h < 4.0 and seg.w >= 3.0:
                        # A horizontal beam: too thick for a staff line, too wide
                        # and short for a stem. Slanted beams arrive as polygons
                        # instead, so both paths have to be covered.
                        page.beams.append(Poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)]))
                    elif seg.h < 0.8 and 0.5 < seg.w <= 8:
                        da.append(seg)

        page.beams = _dedupe_polys(page.beams)
        page.hlines = _dedupe(hl)
        page.vrects = _dedupe(vr)
        page.dashes = _dedupe(da)
        pages.append(page)

    doc.close()
    return pages, orders
