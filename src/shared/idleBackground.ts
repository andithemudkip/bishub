/**
 * What the idle screen shows behind the clock.
 *
 * One value covers every kind of background, so the display, the Stage preview
 * and the Settings preview all render it through `idleBackgroundStyle` and
 * can't disagree. Values arriving from a remote go through
 * `validateIdleBackground` first; a library image's file `path` is filled in by
 * the main process and never trusted from a client.
 */

import type { IdleBackground } from "./types";

/**
 * Gradient presets, in picker order. All dark enough that the white clock
 * stays readable without dimming. The ids are stored, so never rename one; the
 * names are `t.settings.idleGradients`.
 */
export const IDLE_GRADIENTS = {
  // The historical hardcoded look, kept as the default so upgrading changes
  // nobody's screen.
  navy: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  ocean: "linear-gradient(135deg, #0b2545 0%, #13315c 50%, #1d4e89 100%)",
  dusk: "linear-gradient(135deg, #1f1c3a 0%, #4a2545 55%, #8c3b3b 100%)",
  forest: "linear-gradient(135deg, #0b2117 0%, #14402c 50%, #1f5f3f 100%)",
  plum: "linear-gradient(135deg, #1c0d24 0%, #3f1a4f 50%, #5e2a6e 100%)",
  ember: "linear-gradient(135deg, #1f0b07 0%, #5c1f12 55%, #8a3a14 100%)",
  slate: "linear-gradient(135deg, #161b22 0%, #2f3a48 50%, #475569 100%)",
  stone: "linear-gradient(135deg, #1f1a16 0%, #4a3f35 50%, #6b5b4a 100%)",
} as const;

export type IdleGradientId = keyof typeof IDLE_GRADIENTS;

export const IDLE_GRADIENT_IDS = Object.keys(IDLE_GRADIENTS) as IdleGradientId[];

/** Suggested solid colors beside the free color picker; dark, for the same reason. */
export const IDLE_COLOR_SUGGESTIONS = ["#000000", "#0f172a", "#1e3a5f", "#14361f", "#3b0d1a"];

const DEFAULT_GRADIENT: IdleGradientId = "navy";

export function isIdleGradientId(id: string): id is IdleGradientId {
  return Object.prototype.hasOwnProperty.call(IDLE_GRADIENTS, id);
}

export const DEFAULT_IDLE_BACKGROUND: IdleBackground = {
  kind: "gradient",
  preset: DEFAULT_GRADIENT,
};

/** Overlay opacity (%) over the background; 30 is the historical fixed overlay. */
export const DEFAULT_IDLE_DIM = 30;
export const MAX_IDLE_DIM = 80;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * A well-formed background from untrusted input, or null. Library images come
 * back without a `path`: the main process resolves it from the id.
 */
export function validateIdleBackground(value: unknown): IdleBackground | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  switch (v.kind) {
    case "gradient":
      return typeof v.preset === "string" && isIdleGradientId(v.preset)
        ? { kind: "gradient", preset: v.preset }
        : null;
    case "color":
      return typeof v.color === "string" && HEX_COLOR.test(v.color)
        ? { kind: "color", color: v.color.toLowerCase() }
        : null;
    case "image":
      return typeof v.imageId === "string" && v.imageId.length > 0
        ? { kind: "image", imageId: v.imageId, path: null }
        : null;
    default:
      return null;
  }
}

export function clampIdleDim(dim: number): number {
  if (!Number.isFinite(dim)) return DEFAULT_IDLE_DIM;
  return Math.round(Math.max(0, Math.min(MAX_IDLE_DIM, dim)));
}

/** Blur strength (%) of a background image; 0 is sharp. */
export function clampIdleBlur(blur: number): number {
  if (!Number.isFinite(blur)) return 0;
  return Math.round(Math.max(0, Math.min(100, blur)));
}

/** Blur radius at 100%, in pixels of the 1920×1080 screen (previews scale it with everything else). */
const MAX_BLUR_PX = 24;

/**
 * Filter for the background layer. Only images blur: on a gradient or a flat
 * color it would change next to nothing. The layer is enlarged a little so
 * the blur's soft, see-through edges fall outside the screen.
 */
export function idleBlurStyle(background: IdleBackground, blur: number): Record<string, string> {
  if (background.kind !== "image" || blur <= 0) return {};
  return { filter: `blur(${(blur / 100) * MAX_BLUR_PX}px)`, transform: "scale(1.08)" };
}

/**
 * CSS for a background. `imageUrl` is how this renderer reaches a library
 * image (a file URL on the display, an HTTP route on remotes); without one the
 * default gradient stands in rather than a blank screen.
 */
export function idleBackgroundStyle(
  background: IdleBackground,
  imageUrl: string | null
): Record<string, string> {
  if (background.kind === "image" && imageUrl) {
    return {
      backgroundImage: `url("${imageUrl}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  if (background.kind === "color") return { background: background.color };
  const preset =
    background.kind === "gradient" && isIdleGradientId(background.preset)
      ? background.preset
      : DEFAULT_GRADIENT;
  return { background: IDLE_GRADIENTS[preset] };
}
