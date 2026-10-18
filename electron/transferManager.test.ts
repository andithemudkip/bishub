import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedStore } from "../test/mocks/electron-store";
import { TransferManager } from "./transferManager";

const libraries = vi.hoisted(() => ({
  addVideo: vi.fn(),
  addAudio: vi.fn(),
  addImage: vi.fn(),
}));
vi.mock("./videoLibrary", () => ({ getVideoLibrary: () => ({ addVideo: libraries.addVideo }) }));
vi.mock("./audioLibrary", () => ({ getAudioLibrary: () => ({ addAudio: libraries.addAudio }) }));
vi.mock("./imageLibrary", () => ({ getImageLibrary: () => ({ addImage: libraries.addImage }) }));

describe("TransferManager.addTransfer", () => {
  let manager: TransferManager;
  let dir: string;

  beforeEach(() => {
    manager = new TransferManager();
    dir = manager.getTransfersDir();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  });

  // An upload as multer leaves it: a random temp name in the transfers folder.
  const upload = (tempName: string, contents = "data") => {
    const tempPath = path.join(dir, tempName);
    fs.writeFileSync(tempPath, contents);
    return tempPath;
  };

  it("stores the file under its original name", () => {
    const tempPath = upload("3f2a9c.mp4");
    const transfer = manager.addTransfer(tempPath, "Cântare ți.mp4", 4);

    expect(transfer.filename).toBe("Cântare ți.mp4");
    expect(transfer.path).toBe(path.join(dir, "Cântare ți.mp4"));
    expect(transfer.name).toBe("Cântare ți");
    expect(fs.readFileSync(transfer.path, "utf8")).toBe("data");
    expect(fs.existsSync(tempPath)).toBe(false);
  });

  it("keeps both files when the same name is sent twice", () => {
    const first = manager.addTransfer(upload("a.pdf", "one"), "Program.pdf", 3);
    const second = manager.addTransfer(upload("b.pdf", "two"), "Program.pdf", 3);

    expect(first.filename).toBe("Program.pdf");
    expect(second.filename).toBe("Program (2).pdf");
    expect(fs.readFileSync(first.path, "utf8")).toBe("one");
    expect(fs.readFileSync(second.path, "utf8")).toBe("two");
  });

  it("can't be pointed outside the transfers folder by the sent name", () => {
    const transfer = manager.addTransfer(upload("c.txt"), "../../escape.txt", 4);
    expect(path.dirname(transfer.path)).toBe(dir);
  });
});

describe("TransferManager moving files out of Transfers", () => {
  let manager: TransferManager;
  let dir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new TransferManager();
    dir = manager.getTransfersDir();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  });

  const send = (name: string, contents = "data") => {
    const tempPath = path.join(dir, `tmp-${name}`);
    fs.writeFileSync(tempPath, contents);
    return manager.addTransfer(tempPath, name, contents.length);
  };

  it("hands the file to its library to move in, then forgets it", async () => {
    const transfer = send("Predica.mp4");
    libraries.addVideo.mockResolvedValue({ id: "v1" });

    await expect(manager.moveToLibrary(transfer.id, "video")).resolves.toEqual({ id: "v1" });
    expect(libraries.addVideo).toHaveBeenCalledWith(transfer.path, "upload", {
      name: "Predica",
      move: true,
    });
    expect(manager.getAll()).toEqual([]);
  });

  it("won't put a file in a library it doesn't belong to", async () => {
    const transfer = send("Program.pdf");
    await expect(manager.moveToLibrary(transfer.id, "image")).resolves.toBeNull();
    expect(libraries.addImage).not.toHaveBeenCalled();
    expect(manager.getAll()).toHaveLength(1);
  });

  it("keeps the transfer when the library can't take it", async () => {
    const transfer = send("Cantare.mp3");
    libraries.addAudio.mockRejectedValue(new Error("disk full"));

    await expect(manager.moveToLibrary(transfer.id, "audio")).rejects.toThrow("disk full");
    expect(manager.getAll().map((t) => t.id)).toEqual([transfer.id]);
  });

  it("deletes only the spare copies older versions left behind", () => {
    const spare = send("Vechi.mp4");
    const waiting = send("Nou.mp4");
    seedStore("transfers", {
      transfers: manager.getAll().map((t) => (t.id === spare.id ? { ...t, addedToVideo: true } : t)),
      version: 1,
    });

    expect(manager.deleteSpareCopies()).toBe(1);
    expect(manager.getAll().map((t) => t.id)).toEqual([waiting.id]);
    expect(fs.existsSync(spare.path)).toBe(false);
    expect(fs.existsSync(waiting.path)).toBe(true);
  });
});
