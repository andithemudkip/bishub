/**
 * Colour scheme for text and karaoke slides.
 *
 * The operator picks only the two gradient stops; every foreground on the slide
 * — body text, title, slide counter, dots, and the karaoke sung/unsung palette —
 * is derived from them here. That derivation is the point of this module: the
 * slide markup used to hardcode white (and a yellow karaoke highlight tuned for
 * a dark backdrop), so a light background would otherwise render the slide
 * unreadable mid-service with no way to tell before it is on the projector.
 *
 * A slide's stops come from the global background, except Bible slides when the
 * operator has opted into a separate Bible background — see
 * `resolveSlideBackground`.
 *
 * Shared by `TextMode`, `KaraokeMode` and `ScaledSlide` in `LivePreview` so the
 * preview keeps matching the real display.
 */

import type { TextContentType } from "./types";

export interface SlideBackgroundPreset {
  /** Stable id — also the `t.settings.backgroundPresets` translation key. */
  id: string;
  from: string;
  to: string;
}

/** Ships one light option on purpose: bright rooms need it, and it exercises
 * the derived-foreground path so the inverted palette is never untested. */
export const SLIDE_BACKGROUND_PRESETS: SlideBackgroundPreset[] = [
  // The historical hardcoded look (`from-gray-900 to-black`), kept first so the
  // default stays a preset rather than reading as a custom colour.
  { id: "midnight", from: "#111827", to: "#000000" },
  { id: "charcoal", from: "#374151", to: "#111827" },
  { id: "ocean", from: "#1a1a2e", to: "#0f3460" },
  { id: "plum", from: "#2e1065", to: "#0b0416" },
  { id: "forest", from: "#052e16", to: "#010a04" },
  { id: "parchment", from: "#faf7f0", to: "#e7dfd0" },
];

export const DEFAULT_SLIDE_BACKGROUND = SLIDE_BACKGROUND_PRESETS[0];

/**
 * What the Bible override starts on when first enabled. Parchment rather than a
 * copy of the global background: turning the toggle on should immediately show
 * the differentiation it exists for, not look like nothing happened.
 */
export const DEFAULT_BIBLE_BACKGROUND =
  SLIDE_BACKGROUND_PRESETS.find((p) => p.id === "parchment") ??
  SLIDE_BACKGROUND_PRESETS[0];

/** Matches the slide-change transition, so a content-type switch reads as one move. */
export const BACKGROUND_TRANSITION_MS = 300;

/** Ink used on dark backgrounds. */
const INK_LIGHT = "#ffffff";
/** Ink used on light backgrounds — gray-900 rather than pure black, to match
 * the rest of the app and avoid the harshness of #000 on a projector. */
const INK_DARK = "#111827";

/** Karaoke highlight candidates. Yellow reads well on dark but disappears on
 * light; amber is the inverse. Which one is used is decided by contrast, not by
 * assuming the background is one or the other. */
const SUNG_ON_DARK = "#fde047"; // yellow-300
const SUNG_ON_LIGHT = "#b45309"; // amber-700

/**
 * Below these ratios, text gets a halo in the opposing colour to lift it off the
 * background. WCAG AA-Large wants 3:1 for display-sized type; body text carries
 * extra margin because projector washout is worse than any monitor. The karaoke
 * highlight is judged separately and more leniently — it is an accent on top of
 * already-legible text, and holding it to the body threshold would flag our own
 * light preset.
 */
const BODY_HALO_THRESHOLD = 4.5;
const ACCENT_HALO_THRESHOLD = 3;

interface RGB {
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Coerce user input to a `#rrggbb` string, falling back when it is not a colour
 * we can parse. Settings arrive from a colour input, an older persisted config,
 * or a web remote, so this is the trust boundary for all three.
 */
export function normalizeHex(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const match = value.trim().match(HEX_RE);
  if (!match) return fallback;
  const digits = match[1];
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((c) => c + c)
          .join("")
      : digits;
  return `#${full.toLowerCase()}`;
}

function parseHex(hex: string): RGB {
  const normalized = normalizeHex(hex, "#000000").slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

/** WCAG relative luminance. */
function luminance({ r, g, b }: RGB): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two luminances. */
function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface SlideTheme {
  /** Normalized gradient stops. */
  from: string;
  to: string;
  /** Ready-to-use CSS `background` value, for contexts that never animate. */
  background: string;
  /** True when the ink had to invert — useful for tuning shadows/scrims. */
  isLight: boolean;
  body: string;
  title: string;
  counter: string;
  dotActive: string;
  dotInactive: string;
  karaokeSung: string;
  karaokeUnsung: string;
  karaokeLabel: string;
  /** `text-shadow` colours for a lit vs. unlit karaoke word. Same colour either
   * side so the CSS transition fades the glow in rather than cross-fading hues. */
  karaokeGlowOn: string;
  karaokeGlowOff: string;
  /**
   * A `text-shadow` halo, or `"none"`. Only set when the chosen ink cannot clear
   * `HALO_THRESHOLD` somewhere on the gradient — a wide-range custom pick such
   * as black→white has no single ink that works at both ends, and this is what
   * keeps such a slide legible instead of letting half of it vanish.
   */
  textShadow: string;
  /** Worst-case body-text contrast across the gradient — surfaced so the
   * settings UI can warn before the colour reaches a projector. */
  minContrast: number;
}

export interface SlideBackgroundSettings {
  slideBackgroundFrom: string;
  slideBackgroundTo: string;
  bibleBackgroundEnabled: boolean;
  bibleBackgroundFrom: string;
  bibleBackgroundTo: string;
}

/**
 * Resolve the two gradient stops into the full slide palette.
 *
 * The body text is vertically centred, so the colour it actually sits on is the
 * midpoint of the gradient — that is what the ink is chosen against, by
 * whichever of the two inks wins on WCAG contrast rather than a fixed
 * lightness threshold.
 */
export function getSlideTheme(fromInput: string, toInput: string): SlideTheme {
  const from = normalizeHex(fromInput, DEFAULT_SLIDE_BACKGROUND.from);
  const to = normalizeHex(toInput, DEFAULT_SLIDE_BACKGROUND.to);

  const a = parseHex(from);
  const b = parseHex(to);
  // Browsers interpolate legacy gradients in sRGB, so sample the midpoint the
  // same way rather than in linear space.
  const mid: RGB = {
    r: (a.r + b.r) / 2,
    g: (a.g + b.g) / 2,
    b: (a.b + b.b) / 2,
  };

  // Sample all three points, not just the middle. Text is centred, but a slide
  // fills the height: judging by the midpoint alone picks white ink for a
  // black→white gradient and makes the bottom half unreadable.
  const stopLums = [luminance(a), luminance(mid), luminance(b)];
  const worstAgainstStops = (color: string): number => {
    const lum = luminance(parseHex(color));
    return Math.min(...stopLums.map((s) => contrast(lum, s)));
  };
  const bestOf = (candidates: string[]): [string, number] =>
    candidates
      .map((c): [string, number] => [c, worstAgainstStops(c)])
      .reduce((best, next) => (next[1] > best[1] ? next : best));

  const [ink, minContrast] = bestOf([INK_LIGHT, INK_DARK]);
  const isLight = ink === INK_DARK;
  const [sung, sungContrast] = bestOf([SUNG_ON_DARK, SUNG_ON_LIGHT]);

  // Halo in the opposing colour — the same trick IdleMode uses to hold the
  // clock over an arbitrary wallpaper. A weak accent pulls the halo in too:
  // a background can leave the body perfectly readable while swallowing the
  // karaoke highlight whole.
  const needsHalo =
    minContrast < BODY_HALO_THRESHOLD || sungContrast < ACCENT_HALO_THRESHOLD;
  const textShadow = needsHalo
    ? `0 0 10px ${withAlpha(isLight ? INK_LIGHT : "#000000", 0.85)}`
    : "none";

  return {
    from,
    to,
    background: `linear-gradient(to bottom, ${from} 0%, ${to} 100%)`,
    isLight,
    body: ink,
    // Alphas match what the markup used to hardcode as `text-white/60` etc.
    title: withAlpha(ink, 0.6),
    counter: withAlpha(ink, 0.4),
    dotActive: ink,
    dotInactive: withAlpha(ink, 0.3),
    karaokeSung: sung,
    // Unsung words sit dimmer than sung ones but must stay readable; dark ink
    // needs a touch more weight than white to hold up at the same apparent dim.
    karaokeUnsung: withAlpha(ink, isLight ? 0.55 : 0.7),
    karaokeLabel: withAlpha(ink, 0.4),
    // A wide glow smudges rather than pops on a light background, so it is
    // dialled back there instead of matching the dark-background strength.
    karaokeGlowOn: withAlpha(sung, isLight ? 0.28 : 0.5),
    karaokeGlowOff: withAlpha(sung, 0),
    textShadow,
    minContrast,
  };
}

/**
 * Which gradient a slide of this content type uses.
 *
 * Only Bible gets an override: the global background already serves as the hymn
 * background, and free-form text is too ad-hoc to be worth its own setting.
 */
export function resolveSlideBackground(
  settings: SlideBackgroundSettings,
  contentType: TextContentType,
): { from: string; to: string } {
  if (contentType === "bible" && settings.bibleBackgroundEnabled) {
    return {
      from: settings.bibleBackgroundFrom,
      to: settings.bibleBackgroundTo,
    };
  }
  return { from: settings.slideBackgroundFrom, to: settings.slideBackgroundTo };
}

/** The palette for a slide of this content type. What the renderers call. */
export function resolveSlideTheme(
  settings: SlideBackgroundSettings,
  contentType: TextContentType,
): SlideTheme {
  const { from, to } = resolveSlideBackground(settings, contentType);
  return getSlideTheme(from, to);
}

/**
 * Inline style for a slide container.
 *
 * The stops go through custom properties rather than straight into the
 * `linear-gradient`, because CSS cannot interpolate between two gradient
 * *images* — a plain `transition: background` hard-cuts. Registered `<color>`
 * properties (see `@property` in `styles/index.css`) do interpolate, which is
 * what turns a hymn→Bible switch into a cross-fade instead of a flash of a
 * bright screen in a dark room. Browsers without `@property` fall back to the
 * instant swap, which is merely the old behaviour.
 */
export function slideBackgroundStyle(theme: SlideTheme): Record<string, string> {
  return {
    "--slide-bg-from": theme.from,
    "--slide-bg-to": theme.to,
    background:
      "linear-gradient(to bottom, var(--slide-bg-from) 0%, var(--slide-bg-to) 100%)",
    transition: `--slide-bg-from ${BACKGROUND_TRANSITION_MS}ms ease, --slide-bg-to ${BACKGROUND_TRANSITION_MS}ms ease`,
  };
}

/** Text colours cross-fade alongside the background when the theme flips. */
export const SLIDE_TEXT_TRANSITION = `color ${BACKGROUND_TRANSITION_MS}ms ease, text-shadow ${BACKGROUND_TRANSITION_MS}ms ease`;

/** The preset matching these stops, if the operator is on one rather than a custom colour. */
export function findPreset(
  fromInput: string,
  toInput: string,
): SlideBackgroundPreset | undefined {
  const from = normalizeHex(fromInput, DEFAULT_SLIDE_BACKGROUND.from);
  const to = normalizeHex(toInput, DEFAULT_SLIDE_BACKGROUND.to);
  return SLIDE_BACKGROUND_PRESETS.find(
    (p) => p.from.toLowerCase() === from && p.to.toLowerCase() === to,
  );
}

/** CSS gradient for a preset — used by the picker swatches. */
export function presetGradient(preset: SlideBackgroundPreset): string {
  return `linear-gradient(to bottom, ${preset.from} 0%, ${preset.to} 100%)`;
}
