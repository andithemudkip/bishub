"""Musical analysis: geometric primitives -> melody notes, lyrics, onsets.

Strategy notes (the non-obvious bits):

* The **melody is the soprano**: the top staff's stem-up voice. We only need
  the soprano, so we never attempt full voice separation of the inner parts.
* Syllable durations are computed as **differences between consecutive syllable
  onsets**, not from the note each syllable sits on. Ties, slurs and melismas
  therefore need no special handling -- they fall out of the arithmetic.
* Every measure's summed duration is checked against the time signature. That
  gives a free per-hymn confidence signal, so bad extractions are identifiable
  rather than silently wrong.

Durations are in quarter notes throughout.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import scoredoc
from scoredoc import Glyph, Page, Seg

# Semitones above the bottom staff line, walking up the diatonic ladder that
# starts there: E for a treble staff, G for a bass one.
LADDER = {"G": (64, (0, 1, 3, 5, 7, 8, 10)),      # bottom line E4
          "F": (43, (0, 2, 4, 5, 7, 9, 10))}      # bottom line G2
SHARP_ORDER = "FCGDAEB"
FLAT_ORDER = "BEADGCF"
LETTERS = "CDEFGAB"
ACCIDENTAL_SHIFT = {"accidentals.sharp": 1, "accidentals.flat": -1,
                    "accidentals.natural": 0, "accidentals.doublesharp": 2,
                    "accidentals.flatflat": -2}

NOTEHEAD_DUR = {"noteheads.s0": 4.0, "noteheads.s1": 2.0, "noteheads.s2": 1.0,
                "noteheads.s2cross": 1.0}
REST_DUR = {"rests.0": 4.0, "rests.0o": 4.0, "rests.1": 2.0, "rests.1o": 2.0,
            "rests.2": 1.0, "rests.3": 0.5, "rests.4": 0.25}
FLAG_HALVINGS = {"flags.u3": 1, "flags.d3": 1, "flags.u4": 2, "flags.d4": 2,
                 "flags.u5": 3, "flags.d5": 3}
DIGIT = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
         "seven": 7, "eight": 8, "nine": 9, "zero": 0}


@dataclass
class Staff:
    ys: list[float]            # the 5 line y positions, top first
    x0: float
    x1: float
    clef: str = "?"

    @property
    def space(self) -> float:
        return (self.ys[-1] - self.ys[0]) / 4

    @property
    def top(self) -> float:
        return self.ys[0]

    @property
    def bottom(self) -> float:
        return self.ys[-1]


@dataclass
class Note:
    x: float
    y: float
    dur: float                 # quarter notes
    stem_up: bool | None
    is_rest: bool = False
    fermata: bool = False
    midi: int | None = None    # None for rests


@dataclass
class Syllable:
    text: str
    x: float
    x1: float = 0.0
    joins_next: bool = False   # hyphen to the following syllable (same word)

    @property
    def cx(self) -> float:
        return (self.x + self.x1) / 2 if self.x1 else self.x


@dataclass
class System:
    page: int
    staves: list[Staff]
    notes: list[Note] = field(default_factory=list)
    barlines: list[float] = field(default_factory=list)
    lyric_rows: dict[int, list[Syllable]] = field(default_factory=dict)

    @property
    def melody_staff(self) -> Staff:
        return self.staves[0]


def find_staves(page: Page) -> list[Staff]:
    """Group horizontal lines into 5-line staves."""
    lines = sorted((s for s in page.hlines if s.w > page.width * 0.3),
                   key=lambda s: s.y0)
    staves: list[Staff] = []
    i = 0
    while i + 4 < len(lines):
        grp = lines[i:i + 5]
        gaps = [grp[k + 1].y0 - grp[k].y0 for k in range(4)]
        if max(gaps) - min(gaps) < 0.6 and 2.0 < gaps[0] < 20.0:
            staves.append(Staff([g.y0 for g in grp],
                                min(g.x0 for g in grp), max(g.x1 for g in grp)))
            i += 5
        else:
            i += 1
    return staves


def assign_clefs(staves: list[Staff], glyphs: list[Glyph]) -> None:
    for st in staves:
        best, bestd = "?", 1e9
        for g in glyphs:
            if not g.name.startswith("clefs."):
                continue
            if not (st.top - st.space * 3 < g.y < st.bottom + st.space * 3):
                continue
            d = abs(g.x - st.x0)
            if d < bestd and d < st.space * 12:
                best, bestd = g.name.split(".")[1], d
        st.clef = best


def group_systems(page: Page, staves: list[Staff]) -> list[list[Staff]]:
    """A system is a G-clef staff plus any F-clef staves braced below it."""
    systems: list[list[Staff]] = []
    for st in staves:
        if st.clef == "G" or not systems:
            systems.append([st])
        else:
            systems[-1].append(st)
    return systems


def staff_step(st: Staff, y: float) -> int:
    """Diatonic steps above the bottom staff line (negative below)."""
    return int(round((st.bottom - y) / (st.space / 2)))


def step_to_midi(st: Staff, step: int) -> int:
    base, ladder = LADDER.get(st.clef, LADDER["G"])
    octave, within = divmod(step, 7)
    return base + 12 * octave + ladder[within]


def step_letter(st: Staff, step: int) -> str:
    """Letter name of a staff position, ignoring accidentals."""
    start = {"G": 2, "F": 4}.get(st.clef, 2)          # E for treble, G for bass
    return LETTERS[(start + step) % 7]


def key_signature(st: Staff, glyphs: list[Glyph]) -> dict[str, int]:
    """Which letter names the key signature alters, and by how much.

    Read from the accidentals' own staff positions rather than by counting them
    against the circle of fifths -- the position states the letter directly, so a
    courtesy or unusual signature cannot throw the mapping off.
    """
    band = [g for g in glyphs
            if g.name in ("accidentals.sharp", "accidentals.flat")
            and st.top - st.space * 2 < g.y < st.bottom + st.space * 2
            and st.x0 <= g.x <= st.x0 + st.space * 14]
    out: dict[str, int] = {}
    for g in sorted(band, key=lambda g: g.x):
        out[step_letter(st, staff_step(st, g.y))] = ACCIDENTAL_SHIFT[g.name]
    return out


def _stems_for(nh: Glyph, vrects: list[Seg], space: float) -> tuple[Seg | None, Seg | None]:
    """The (up, down) stems touching a notehead.

    A notehead can carry both when two voices share a unison, so this returns
    each direction separately rather than a single nearest stem. An up-stem
    rises from the notehead's right edge; a down-stem falls from its left.
    """
    # A stem ends half a notehead away from the note's centre, so candidates are
    # ranked by how close their end lands -- picking the *longest* candidate
    # instead would let a neighbouring voice's stem win, and a beamed stem
    # (shortened to meet the beam) would lose its beam.
    tol_x, tol_y = space * 0.6, space * 0.55
    up = down = None
    up_d = down_d = tol_y
    for v in vrects:
        if abs(v.cx - nh.right) < tol_x and v.y0 < nh.y:
            d = abs(v.y1 - nh.y)
            if d < up_d:
                up, up_d = v, d
        if abs(v.cx - nh.x) < tol_x and v.y1 > nh.y:
            d = abs(v.y0 - nh.y)
            if d < down_d:
                down, down_d = v, d
    return up, down


def _beam_count(stem: Seg, beams: list[scoredoc.Poly], space: float) -> int:
    """How many beam *layers* cross this stem.

    One drawn beam can reach us several times over -- as a quad, as the filled
    polygon of the same shape, and as rectangular strips -- so the count has to
    come from clustering the crossing heights rather than tallying paths.
    Consecutive beam layers are about a staff space apart, comfortably more than
    the spread of duplicates describing a single beam.
    """
    ys: list[float] = []
    for b in beams:
        if not (b.x0 - 0.4 <= stem.cx <= b.x1 + 0.4):
            continue
        if (b.y1 - b.y0) > space * 2.5:      # too tall to be a beam
            continue
        y = b.y_at(stem.cx)
        if stem.y0 - space * 0.6 <= y <= stem.y1 + space * 0.6:
            ys.append(y)
    if not ys:
        return 0
    layers = 1
    ys.sort()
    last = ys[0]
    for y in ys[1:]:
        if y - last > space * 0.6:
            layers += 1
            last = y
    return layers


def _assign_dots(heads: list[Glyph], dots: list[Glyph], space: float,
                 x_limit: float) -> dict[int, int]:
    """Dot count per notehead within one rhythmic column.

    Dots for a chord are stacked in a single x-slot, one per note, so they have
    to be paired with the noteheads in vertical order -- matching each note to
    its nearest dot independently makes the top note swallow both and read as
    double-dotted. A genuine double dot is a *second* x-slot further right, so
    slot k only pairs with notes that already collected k dots.
    """
    counts: dict[int, int] = {id(h): 0 for h in heads}
    if not heads:
        return counts
    right = max(h.right for h in heads)
    cand = sorted((d for d in dots if right < d.x < min(right + space * 3.2, x_limit)),
                  key=lambda d: d.x)

    slots: list[list[Glyph]] = []
    for d in cand:
        if slots and d.x - slots[-1][0].x < space * 0.35:
            slots[-1].append(d)
        else:
            slots.append([d])

    for k, slot in enumerate(slots):
        eligible = sorted((h for h in heads if counts[id(h)] == k), key=lambda h: h.y)
        for h, d in zip(eligible, sorted(slot, key=lambda d: d.y)):
            # sanity: a dot sits level with its note, or half a space above it
            dy = d.y - h.y
            if abs(dy) < space * 1.3 or abs(dy + space / 2) < space * 1.3:
                counts[id(h)] += 1
    return counts


def _dotted(dur: float, dots: int) -> float:
    total, add = dur, dur
    for _ in range(dots):
        add /= 2
        total += add
    return total


def extract_notes(page: Page, system: list[Staff],
                  all_staves: list[Staff] | None = None) -> tuple[list[Note], list[float]]:
    """Notes on the melody staff plus barline x positions.

    The vertical search window has to reach several spaces past the staff for
    ledger-line notes, which is far enough to touch a neighbouring staff -- on a
    tight page that pulls the previous system's bass notes in. Clamp it to the
    gap between this staff and its neighbours.
    """
    st = system[0]
    space = st.space
    lo, hi = st.top - space * 6, st.bottom + space * 6
    if all_staves:
        above = [o for o in all_staves if o.bottom < st.top - 0.5]
        below = [o for o in all_staves if o.top > st.bottom + 0.5]
        if above:
            lo = max(lo, max(o.bottom for o in above) + space)
        if below:
            hi = min(hi, min(o.top for o in below) - space)

    in_staff = [g for g in page.glyphs if lo < g.y < hi and st.x0 - space <= g.x <= st.x1 + space]
    heads = [g for g in in_staff if g.name in NOTEHEAD_DUR]
    # A unison between two voices is drawn as two identical noteheads stacked on
    # the same spot but carries only one augmentation dot; collapse them, or the
    # second copy reads as undotted and drags the column's duration down.
    _seen: set[tuple[str, float, float]] = set()
    _uniq: list[Glyph] = []
    for g in heads:
        key = (g.name, round(g.x, 1), round(g.y, 1))
        if key in _seen:
            continue
        _seen.add(key)
        _uniq.append(g)
    heads = _uniq
    rests = [g for g in in_staff if g.name in REST_DUR]
    dots = [g for g in in_staff if g.name == "dots.dot"]
    flags = [g for g in in_staff if g.name in FLAG_HALVINGS]
    ferms = [g for g in page.glyphs if g.name.endswith("fermata")]

    # A barline spans the staff exactly top-to-bottom (or the whole grand staff)
    # and is drawn thicker than a stem. Stems reach roughly the same height, so
    # the tight match at *both* ends is what separates them.
    sys_bottom = system[-1].bottom
    tol = space * 0.45
    raw_bars = sorted(
        v.cx for v in page.vrects
        if v.w > 0.4 and abs(v.y0 - st.top) < tol
        and (abs(v.y1 - st.bottom) < tol or abs(v.y1 - sys_bottom) < tol)
    )
    # A double barline or a repeat sign draws two or three verticals within a
    # space of each other; they mark one position, not several measures.
    barlines: list[float] = []
    for bx in raw_bars:
        if barlines and bx - barlines[-1] < space * 1.6:
            continue
        barlines.append(bx)
    # The vertical that opens a system is not a measure boundary. Left in, it
    # splits a measure that runs across the system break into two short ones.
    first_note = min((g.x for g in heads + rests), default=None)
    if first_note is not None:
        barlines = [bx for bx in barlines if bx > first_note]

    # Group noteheads into rhythmic columns before reading dots: dot ownership
    # can only be resolved by looking at the whole chord at once.
    head_cols: list[list[Glyph]] = []
    for nh in sorted(heads, key=lambda g: g.x):
        if head_cols and nh.x - head_cols[-1][0].x < space * 1.35:
            head_cols[-1].append(nh)
        else:
            head_cols.append([nh])
    dot_counts: dict[int, int] = {}
    for ci, col in enumerate(head_cols):
        nxt = head_cols[ci + 1][0].x if ci + 1 < len(head_cols) else st.x1 + space
        dot_counts.update(_assign_dots(col, dots, space, nxt))

    key = key_signature(st, in_staff)
    accidentals = [g for g in in_staff if g.name in ACCIDENTAL_SHIFT
                   and g.x > st.x0 + space * 14]

    notes: list[Note] = []
    for nh in heads:
        up, down = _stems_for(nh, page.vrects, space)
        # A unison notehead carries both stems; it belongs to the soprano.
        stem_up = True if up is not None else (False if down is not None else None)
        stem = up if up is not None else down

        dur = NOTEHEAD_DUR[nh.name]
        if dur == 1.0 and stem is not None:
            halvings = _beam_count(stem, page.beams, space)
            if halvings == 0:
                tip = stem.y0 if stem is up else stem.y1
                for f in flags:
                    if abs(f.x - stem.cx) < space * 1.4 and abs(f.y - tip) < space * 3.0:
                        halvings = max(halvings, FLAG_HALVINGS[f.name])
            dur /= 2 ** halvings
        dur = _dotted(dur, dot_counts.get(id(nh), 0))
        fermata = any(abs(f.cx - nh.cx) < space * 2.0 and abs(f.y - nh.y) < space * 10
                      for f in ferms)
        step = staff_step(st, nh.y)
        alter = key.get(step_letter(st, step), 0)
        for a in accidentals:                       # an accidental just left of the note wins
            if abs(a.y - nh.y) < space * 0.3 and 0 < nh.x - a.x < space * 2.6:
                alter = ACCIDENTAL_SHIFT[a.name]
                break
        notes.append(Note(nh.x, nh.y, dur, stem_up, fermata=fermata,
                          midi=step_to_midi(st, step) + alter))

    for r in rests:
        notes.append(Note(r.x, r.y, REST_DUR[r.name], None, is_rest=True))

    return notes, barlines


def columns(notes: list[Note], space: float) -> list[Note]:
    """Collapse the staff into one onset per rhythmic column.

    Deliberately *not* a voice separation. Everything sounding at the same x is
    one column, and the column advances by its shortest note -- which is where
    the next column begins. That is all the syllable timing needs, and unlike
    picking out the soprano it survives the two ways hymnals engrave the upper
    parts (separate stems per voice, or one shared stem for a chord).

    A consequence worth keeping: notes tied or slurred across columns need no
    special handling, because a syllable's length is later taken as the distance
    to the *next syllable*, not the length of its own note.

    The grouping tolerance exceeds a notehead width so that a second -- which
    LilyPond offsets sideways rather than overlapping -- stays a single column.
    """
    cols: list[list[Note]] = []
    for n in sorted(notes, key=lambda n: n.x):
        if cols and n.x - cols[-1][0].x < space * 1.35:
            cols[-1].append(n)
        else:
            cols.append([n])

    out: list[Note] = []
    for col in cols:
        lead = min(col, key=lambda n: n.y)          # topmost: carries the lyric
        out.append(Note(col[0].x, lead.y, min(n.dur for n in col),
                        lead.stem_up, all(n.is_rest for n in col),
                        any(n.fermata for n in col), lead.midi))
    return out


def time_signature(pages: list[Page]) -> tuple[int, int]:
    """Numerator/denominator from stacked digits or the C glyphs."""
    for pg in pages:
        for g in pg.glyphs:
            if g.name == "timesig.C44":
                return 4, 4
            if g.name == "timesig.C22":
                return 2, 2
        digits = [g for g in pg.glyphs if g.name in DIGIT]
        if len(digits) >= 2:
            digits.sort(key=lambda g: (round(g.x, 1), g.y))
            x0 = digits[0].x
            col = [g for g in digits if abs(g.x - x0) < 3.0]
            if len(col) >= 2:
                col.sort(key=lambda g: g.y)
                return DIGIT[col[0].name], DIGIT[col[-1].name]
    return 4, 4


# --- lyrics -----------------------------------------------------------------

def _rows_between(page: Page, y_lo: float, y_hi: float,
                  space: float) -> dict[float, list]:
    """Group characters into text rows by baseline.

    Baselines within one row jitter by up to ~0.1pt, so rounding to a fixed
    number of decimals tears a row in half whenever it straddles a rounding
    boundary. Cluster instead: real rows are a whole line-height apart.
    """
    chars = sorted((c for c in page.chars if y_lo < c.y < y_hi), key=lambda c: c.y)
    rows: dict[float, list] = {}
    key: float | None = None
    for c in chars:
        if key is None or c.y - key > space * 0.5:
            key = c.y
            rows[key] = []
        rows[key].append(c)
    return rows


def _split_syllables(chars: list, space: float) -> list[Syllable]:
    chars = sorted(chars, key=lambda c: c.x)
    groups: list[list] = [[chars[0]]]
    for c in chars[1:]:
        if c.x - groups[-1][-1].bbox[2] > space * 0.22:
            groups.append([c])
        else:
            groups[-1].append(c)
    return [Syllable("".join(ch.ch for ch in g), g[0].x, g[-1].bbox[2]) for g in groups]


# Attribution lines printed below the last staff, never lyrics.
CREDIT_LABELS = {"textul", "muzica", "melodia", "text", "metrul", "traducerea",
                 "text diferit", "aranjament", "armonizarea", "letra", "música",
                 "texte", "musique"}


def extract_lyrics(page: Page, system: list[Staff], next_top: float,
                   note_xs: list[float] | None = None) -> dict[int, list[Syllable]]:
    """Lyric rows sitting under the melody staff, one row per verse.

    LilyPond puts hymnal lyrics *between* the treble and bass staves. Syllables
    of one word are joined by a drawn dash (a tiny filled rect on the row's
    x-height), or occasionally by a literal trailing hyphen in the text.

    `note_xs` (notehead centres) filters out prose that merely happens to sit in
    the same band -- extra verses set below the last system, performance notes.
    Real lyrics are engraved under the notes, so their syllables line up with
    them; a paragraph of running text does not.
    """
    st = system[0]
    space = st.space
    y_lo = st.bottom + space * 1.2
    y_hi = next_top - space * 0.8
    rows = _rows_between(page, y_lo, y_hi, space)
    sizes = [c.size for chars in rows.values() for c in chars]
    lyric_size = max(set(sizes), key=sizes.count) if sizes else 0.0

    out: dict[int, list[Syllable]] = {}
    for idx, (y, chars) in enumerate(sorted(rows.items())):
        if len(chars) < 3:
            continue
        if lyric_size and abs(chars[0].size - lyric_size) > lyric_size * 0.12:
            continue  # credits and attributions are set smaller than the lyrics
        syls = _split_syllables(chars, space)
        if syls and syls[0].text.rstrip(":").lower() in CREDIT_LABELS:
            continue
        if note_xs:
            hits = sum(1 for s in syls
                       if min(abs(nx - s.cx) for nx in note_xs) < space * 2.2)
            if hits < len(syls) * 0.7:
                continue

        # A leading "1." / "2." labels the verse; otherwise rows keep page order.
        verse = len(out) + 1
        if syls and syls[0].text.rstrip(".").isdigit() and syls[0].text.endswith("."):
            verse = int(syls[0].text.rstrip("."))
            syls = syls[1:]
        if not syls:
            continue

        dashes = [d for d in page.dashes if y - space * 1.4 < d.cy < y - space * 0.1]
        for i, s in enumerate(syls[:-1]):
            nxt = syls[i + 1]
            gap_dash = any(s.x < d.cx < nxt.x for d in dashes)
            if gap_dash or s.text.endswith("-"):
                s.joins_next = True
                if s.text.endswith("-"):
                    s.text = s.text[:-1]
        out[verse] = syls
    return out


def words_from(syllables: list[Syllable]) -> list[tuple[str, float]]:
    """Reconstruct whole words: (text, x of the word's first syllable)."""
    words: list[tuple[str, float]] = []
    cur, cur_x = "", None
    for s in syllables:
        if cur_x is None:
            cur_x = s.x
        cur += s.text
        if not s.joins_next:
            words.append((cur, cur_x))
            cur, cur_x = "", None
    if cur:
        words.append((cur, cur_x if cur_x is not None else 0.0))
    return words
