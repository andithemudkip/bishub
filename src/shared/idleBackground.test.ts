import { describe, expect, it } from "vitest";
import {
  DEFAULT_IDLE_BACKGROUND,
  IDLE_GRADIENTS,
  clampIdleBlur,
  clampIdleDim,
  idleBlurStyle,
  idleBackgroundStyle,
  validateIdleBackground,
} from "./idleBackground";

describe("validateIdleBackground", () => {
  it("accepts each kind", () => {
    expect(validateIdleBackground({ kind: "gradient", preset: "navy" })).toEqual({
      kind: "gradient",
      preset: "navy",
    });
    expect(validateIdleBackground({ kind: "color", color: "#1A2B3C" })).toEqual({
      kind: "color",
      color: "#1a2b3c",
    });
    expect(validateIdleBackground({ kind: "image", imageId: "abc" })).toEqual({
      kind: "image",
      imageId: "abc",
      path: null,
    });
  });

  it("never trusts a file path sent by a remote", () => {
    expect(
      validateIdleBackground({ kind: "image", imageId: "abc", path: "/etc/passwd" })
    ).toEqual({ kind: "image", imageId: "abc", path: null });
  });

  it("drops extra fields", () => {
    expect(validateIdleBackground({ kind: "color", color: "#000000", extra: 1 })).toEqual({
      kind: "color",
      color: "#000000",
    });
  });

  it.each([
    null,
    undefined,
    "navy",
    {},
    { kind: "video" },
    { kind: "gradient", preset: "nope" },
    { kind: "gradient", preset: "toString" },
    { kind: "color", color: "red" },
    { kind: "color", color: "#fff" },
    { kind: "color", color: "#12345g" },
    { kind: "image", imageId: "" },
    { kind: "image", imageId: 5 },
  ])("rejects %j", (value) => {
    expect(validateIdleBackground(value)).toBeNull();
  });
});

describe("idleBackgroundStyle", () => {
  it("covers the screen with an image", () => {
    expect(
      idleBackgroundStyle({ kind: "image", imageId: "a", path: "/x.jpg" }, "file:///x.jpg")
    ).toEqual({
      backgroundImage: 'url("file:///x.jpg")',
      backgroundSize: "cover",
      backgroundPosition: "center",
    });
  });

  it("shows the default gradient when an image can't be reached", () => {
    expect(idleBackgroundStyle({ kind: "image", imageId: "a", path: null }, null)).toEqual({
      background: IDLE_GRADIENTS.navy,
    });
  });

  it("paints a color or a preset gradient", () => {
    expect(idleBackgroundStyle({ kind: "color", color: "#123456" }, null)).toEqual({
      background: "#123456",
    });
    expect(idleBackgroundStyle(DEFAULT_IDLE_BACKGROUND, null)).toEqual({
      background: IDLE_GRADIENTS.navy,
    });
  });

  it("falls back to the default for a preset this version doesn't know", () => {
    expect(idleBackgroundStyle({ kind: "gradient", preset: "removed" }, null)).toEqual({
      background: IDLE_GRADIENTS.navy,
    });
  });
});

describe("clampIdleDim", () => {
  it("keeps the overlay between clear and mostly dark", () => {
    expect(clampIdleDim(-5)).toBe(0);
    expect(clampIdleDim(45.4)).toBe(45);
    expect(clampIdleDim(100)).toBe(80);
    expect(clampIdleDim(Number.NaN)).toBe(30);
  });
});

describe("idle blur", () => {
  const photo = { kind: "image", imageId: "a", path: "/a.jpg" } as const;

  it("clamps to 0-100, and treats junk as sharp", () => {
    expect(clampIdleBlur(-1)).toBe(0);
    expect(clampIdleBlur(120)).toBe(100);
    expect(clampIdleBlur(Number.NaN)).toBe(0);
  });

  it("blurs only images, enlarged so the soft edges stay off screen", () => {
    expect(idleBlurStyle(photo, 100)).toEqual({ filter: "blur(24px)", transform: "scale(1.08)" });
    expect(idleBlurStyle(photo, 0)).toEqual({});
    expect(idleBlurStyle(DEFAULT_IDLE_BACKGROUND, 100)).toEqual({});
    expect(idleBlurStyle({ kind: "color", color: "#000000" }, 100)).toEqual({});
  });
});
