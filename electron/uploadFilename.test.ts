import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  claimFilePath,
  copyIntoDir,
  decodeUploadName,
  moveToOriginalName,
  safeFilename,
} from "./uploadFilename";

// What busboy hands multer for a UTF-8 filename: each byte as a latin1 char.
const asBusboy = (name: string) => Buffer.from(name, "utf8").toString("latin1");

describe("decodeUploadName", () => {
  it("recovers Romanian diacritics busboy decoded as latin1", () => {
    expect(decodeUploadName(asBusboy("Cântare ți Ștefan.mp4"))).toBe("Cântare ți Ștefan.mp4");
  });

  it("leaves plain ASCII names alone", () => {
    expect(decodeUploadName("slides v2.pdf")).toBe("slides v2.pdf");
  });

  it("keeps a name that really was latin1", () => {
    expect(decodeUploadName("café.mp3")).toBe("café.mp3");
  });

  it("keeps a name that was already decoded", () => {
    expect(decodeUploadName("Cântare ți.mp4")).toBe("Cântare ți.mp4");
  });
});

describe("safeFilename", () => {
  it("keeps an ordinary name, diacritics and all", () => {
    expect(safeFilename("Cântare ți (live).mp4")).toBe("Cântare ți (live).mp4");
  });

  it("replaces path separators and characters Windows rejects", () => {
    expect(safeFilename('../a/b\\c:d*e?"f<g>h|.txt')).toBe('.._a_b_c_d_e__f_g_h_.txt');
  });

  it("replaces control characters", () => {
    expect(safeFilename("a\nb\u0001c\u007f.txt")).toBe("a_b_c_.txt");
  });

  it("drops trailing dots and spaces from the name", () => {
    expect(safeFilename("notes. .txt")).toBe("notes.txt");
  });

  it("falls back to a name when nothing usable is left", () => {
    expect(safeFilename("???.mp4")).toBe("file.mp4");
    expect(safeFilename("")).toBe("file");
  });

  it("prefixes Windows device names", () => {
    expect(safeFilename("CON.txt")).toBe("_CON.txt");
  });

  it("caps very long names but keeps the extension", () => {
    const name = safeFilename(`${"a".repeat(400)}.mov`);
    expect(name).toHaveLength(154);
    expect(name.endsWith(".mov")).toBe(true);
  });
});

describe("placing files", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bishub-upload-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const write = (name: string, contents = "") => {
    fs.writeFileSync(path.join(dir, name), contents);
    return path.join(dir, name);
  };

  it("claims the name as-is when it's free", () => {
    expect(claimFilePath(dir, "song.mp3")).toBe(path.join(dir, "song.mp3"));
    expect(fs.existsSync(path.join(dir, "song.mp3"))).toBe(true);
  });

  it("numbers the name when it's taken", () => {
    write("song.mp3");
    write("song (2).mp3");
    expect(claimFilePath(dir, "song.mp3")).toBe(path.join(dir, "song (3).mp3"));
  });

  it("gives each claim of the same name its own path", () => {
    const a = claimFilePath(dir, "song.mp3");
    const b = claimFilePath(dir, "song.mp3");
    expect(a).not.toBe(b);
  });

  it("moves a random-named upload to its original name", () => {
    const temp = write("6f1c2e.mp4", "video");
    const moved = moveToOriginalName(temp, "Cântare: live.mp4");
    expect(moved).toBe(path.join(dir, "Cântare_ live.mp4"));
    expect(fs.readFileSync(moved, "utf8")).toBe("video");
    expect(fs.existsSync(temp)).toBe(false);
  });

  it("copies into a folder under the source's name, without a timestamp", async () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), "bishub-src-"));
    try {
      const source = path.join(src, "Predica.mp4");
      fs.writeFileSync(source, "one");
      write("Predica.mp4", "existing");

      const [first, second] = await Promise.all([copyIntoDir(source, dir), copyIntoDir(source, dir)]);

      expect([first, second].sort()).toEqual([
        path.join(dir, "Predica (2).mp4"),
        path.join(dir, "Predica (3).mp4"),
      ]);
      expect(fs.readFileSync(first, "utf8")).toBe("one");
      expect(fs.readFileSync(path.join(dir, "Predica.mp4"), "utf8")).toBe("existing");
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  });

  it("doesn't leave an empty file behind when the copy fails", async () => {
    const missing = path.join(os.tmpdir(), "bishub-missing", "Predica.mp4");
    await expect(copyIntoDir(missing, dir)).rejects.toThrow();
    expect(fs.readdirSync(dir)).toEqual([]);
  });
});
