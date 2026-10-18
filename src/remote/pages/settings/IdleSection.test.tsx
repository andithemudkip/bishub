import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DEFAULT_SETTINGS, DEFAULT_STATE, type IdleState } from "../../../shared/types";
import type { ImageItem } from "../../../shared/imageLibrary.types";
import { getTranslations } from "../../../shared/i18n";
import { IdleSection } from "./IdleSection";
import type { SectionProps } from "./types";

const t = getTranslations("en");

const image = (id: string, dateAdded = 0): ImageItem => ({
  id,
  name: `Photo ${id}`,
  filename: `${id}.jpg`,
  path: `/library/${id}.jpg`,
  thumbnailPath: `/thumbs/${id}.jpg`,
  dateAdded,
  fileSize: 1,
  source: "local",
  slideshowId: null,
  slideshowOrder: null,
});

const library = vi.hoisted(() => ({
  images: [] as ImageItem[],
  upload: vi.fn(),
}));
vi.mock("../../hooks/useLibraryImages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useLibraryImages")>()),
  useLibraryImages: () => library,
}));

function renderSection(idle: Partial<IdleState> = {}, overrides: Partial<SectionProps> = {}) {
  const props = {
    idleState: { ...DEFAULT_STATE.idle, ...idle },
    settings: { ...DEFAULT_SETTINGS, language: "en" },
    onSetIdleBackground: vi.fn(),
    onChooseIdleWallpaper: vi.fn(async () => false),
    onSetIdleDim: vi.fn(),
    onSetIdleBlur: vi.fn(),
    onSetIdleShowClock: vi.fn(),
    onSetIdleShowDate: vi.fn(),
    onSetClockFontSize: vi.fn(),
    onSetClockPosition: vi.fn(),
    onSetAudioWidgetPosition: vi.fn(),
    isElectron: true,
    t,
    ...overrides,
  } as unknown as SectionProps;
  render(<IdleSection {...props} />);
  return props;
}

const button = (name: string) => screen.getByRole("button", { name });

afterEach(() => {
  vi.useRealTimers();
  library.images = [];
  library.upload.mockReset();
});

describe("IdleSection", () => {
  it("marks the current gradient and switches to another", () => {
    const props = renderSection();
    expect(button("Navy").getAttribute("aria-pressed")).toBe("true");
    expect(button("Dusk").getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(button("Dusk"));
    expect(props.onSetIdleBackground).toHaveBeenCalledWith({ kind: "gradient", preset: "dusk" });
  });

  it("sets a suggested or a picked solid color", () => {
    const props = renderSection({ background: { kind: "color", color: "#0f172a" } });
    expect(button("#0f172a").getAttribute("aria-pressed")).toBe("true");
    expect(button("Navy").getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(button("#000000"));
    expect(props.onSetIdleBackground).toHaveBeenCalledWith({ kind: "color", color: "#000000" });

    const picker = screen.getByLabelText(t.settings.idleCustomColor) as HTMLInputElement;
    fireEvent.input(picker, { target: { value: "#224466" } });
    expect(props.onSetIdleBackground).toHaveBeenLastCalledWith({ kind: "color", color: "#224466" });
  });

  it("shows a rainbow on the custom pill until a color of its own is chosen", () => {
    const swatch = () => screen.getByTestId("idle-custom-swatch");

    renderSection({ background: { kind: "color", color: "#000000" } });
    expect(swatch().style.background).toContain("conic-gradient");
    expect((screen.getByLabelText(t.settings.idleCustomColor) as HTMLInputElement).value).toBe("#000000");
  });

  it("puts a color that isn't suggested on the custom pill", () => {
    renderSection({ background: { kind: "color", color: "#224466" } });
    expect(screen.getByTestId("idle-custom-swatch").style.background).toContain("#224466");
    expect((screen.getByLabelText(t.settings.idleCustomColor) as HTMLInputElement).value).toBe("#224466");
    expect(screen.getAllByRole("button").some((b) => b.getAttribute("aria-pressed") === "true")).toBe(false);
  });

  const imageTile = () =>
    screen.getByRole("button", { name: new RegExp(`^(${t.settings.idleImageChoose}|${t.settings.idleImageChange})$`) });
  const openPicker = () => fireEvent.click(imageTile());
  const dialog = () => screen.queryByRole("dialog", { name: t.settings.idleChooseImage });

  it("keeps the library out of the page until an image is asked for", () => {
    library.images = [image("a")];
    renderSection();
    expect(screen.queryByRole("button", { name: "Photo a" })).toBeNull();
    expect(imageTile().textContent).toBe(t.settings.idleImageChoose);
    expect(imageTile().getAttribute("aria-pressed")).toBe("false");

    openPicker();
    expect(dialog()).not.toBeNull();
    expect(button("Photo a").querySelector("img")!.getAttribute("src")).toBe("/api/images/thumbnail/a");
  });

  it("shows the current image on its tile, marked like any other choice", () => {
    library.images = [image("a"), image("b")];
    renderSection({ background: { kind: "image", imageId: "b", path: "/library/b.jpg" } });
    const tile = imageTile();
    expect(tile.textContent).toBe(t.settings.idleImageChange);
    expect(tile.getAttribute("aria-pressed")).toBe("true");
    expect(tile.querySelector("img")!.getAttribute("src")).toBe("/api/images/thumbnail/b");
    expect(button("Navy").getAttribute("aria-pressed")).toBe("false");

    openPicker();
    expect(button("Photo b").getAttribute("aria-pressed")).toBe("true");
    expect(button("Photo a").getAttribute("aria-pressed")).toBe("false");
  });

  it("picks an image and closes", () => {
    library.images = [image("a")];
    const props = renderSection();
    openPicker();
    fireEvent.click(button("Photo a"));
    expect(props.onSetIdleBackground).toHaveBeenCalledWith({ kind: "image", imageId: "a", path: null });
    expect(dialog()).toBeNull();
  });

  it("closes without changing anything on Escape, the close button or the backdrop", () => {
    const props = renderSection();
    openPicker();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(dialog()).toBeNull();

    openPicker();
    fireEvent.click(button(t.settings.idleCloseImages));
    expect(dialog()).toBeNull();

    openPicker();
    fireEvent.click(dialog()!.parentElement!);
    expect(dialog()).toBeNull();
    expect(props.onSetIdleBackground).not.toHaveBeenCalled();
  });

  it("adds an image with the native picker on the main computer, closing once one is chosen", async () => {
    const props = renderSection();
    openPicker();
    expect(screen.queryByTestId("idle-upload")).toBeNull();

    fireEvent.click(button(t.settings.selectWallpaper));
    expect(props.onChooseIdleWallpaper).toHaveBeenCalled();
    // Cancelled: the picker stays open.
    await waitFor(() => expect(dialog()).not.toBeNull());

    vi.mocked(props.onChooseIdleWallpaper).mockResolvedValue(true);
    fireEvent.click(button(t.settings.selectWallpaper));
    await waitFor(() => expect(dialog()).toBeNull());
  });

  it("uploads from a web remote and shows the new image", async () => {
    library.upload.mockResolvedValue(image("new"));
    const props = renderSection({}, { isElectron: false });
    openPicker();
    const file = new File(["x"], "church.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByTestId("idle-upload"), { target: { files: [file] } });

    expect(library.upload).toHaveBeenCalledWith(file);
    await waitFor(() =>
      expect(props.onSetIdleBackground).toHaveBeenCalledWith({ kind: "image", imageId: "new", path: null })
    );
    expect(dialog()).toBeNull();
    expect(props.onChooseIdleWallpaper).not.toHaveBeenCalled();
  });

  it("says so when an upload fails, and keeps the background", async () => {
    library.upload.mockResolvedValue(null);
    const props = renderSection({}, { isElectron: false });
    openPicker();
    fireEvent.change(screen.getByTestId("idle-upload"), {
      target: { files: [new File(["x"], "a.jpg")] },
    });
    expect(await screen.findByText(t.imageLibrary.uploadFailed)).toBeTruthy();
    expect(props.onSetIdleBackground).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
  });

  it("offers only the image types the library takes", () => {
    renderSection({}, { isElectron: false });
    openPicker();
    expect(screen.getByTestId("idle-upload").getAttribute("accept")).toBe(
      ".jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff"
    );
  });

  it.each([
    ["an unsupported type", new File(["x"], "IMG_0001.HEIC"), t.imageLibrary.invalidType],
    [
      "a file over the limit",
      Object.defineProperty(new File(["x"], "huge.jpg"), "size", { value: 101 * 1024 * 1024 }),
      t.imageLibrary.tooLarge,
    ],
  ])("refuses %s before uploading", async (_name, file, message) => {
    renderSection({}, { isElectron: false });
    openPicker();
    fireEvent.change(screen.getByTestId("idle-upload"), { target: { files: [file] } });
    expect(await screen.findByText(message)).toBeTruthy();
    expect(library.upload).not.toHaveBeenCalled();
  });

  it("darkens the background from the slider", () => {
    const props = renderSection();
    fireEvent.change(screen.getByRole("slider", { name: t.settings.idleDim }), {
      target: { value: "45" },
    });
    expect(props.onSetIdleDim).toHaveBeenCalledWith(45);
  });

  it("blurs only an image background", () => {
    renderSection();
    const slider = () => screen.getByRole("slider", { name: t.settings.idleBlur }) as HTMLInputElement;
    expect(slider().disabled).toBe(true);
    expect(screen.getByText(t.settings.idleBlurImageOnly)).toBeTruthy();
  });

  it("sets the blur of an image", () => {
    const props = renderSection({ background: { kind: "image", imageId: "a", path: null } });
    const slider = screen.getByRole("slider", { name: t.settings.idleBlur }) as HTMLInputElement;
    expect(slider.disabled).toBe(false);
    fireEvent.change(slider, { target: { value: "35" } });
    expect(props.onSetIdleBlur).toHaveBeenCalledWith(35);
  });

  it("can't toggle the date while the clock is hidden", () => {
    const props = renderSection({ showClock: false });
    const date = screen.getByRole("checkbox", { name: t.settings.idleShowDate });
    expect((date as HTMLInputElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: t.settings.idleShowClock }));
    expect(props.onSetIdleShowClock).toHaveBeenCalledWith(true);
  });

  it("shows a sample music widget for a moment after moving it", () => {
    vi.useFakeTimers();
    const props = renderSection();
    expect(screen.queryByText(t.settings.idleSampleAudio)).toBeNull();

    const audioPicker = screen.getByText(t.settings.audioWidgetPosition).closest("[data-setting]")!;
    fireEvent.click(audioPicker.querySelectorAll("button")[0]);
    expect(props.onSetAudioWidgetPosition).toHaveBeenCalled();
    expect(screen.getByText(t.settings.idleSampleAudio)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText(t.settings.idleSampleAudio)).toBeNull();
  });
});
