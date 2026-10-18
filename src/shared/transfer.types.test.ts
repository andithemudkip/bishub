import { describe, expect, it } from "vitest";
import { libraryAlreadyCopiedTo, libraryForExtension, type TransferItem } from "./transfer.types";

describe("libraryForExtension", () => {
  it("finds the one library each media type belongs to", () => {
    expect(libraryForExtension(".mp4")).toBe("video");
    expect(libraryForExtension(".mp3")).toBe("audio");
    expect(libraryForExtension(".jpg")).toBe("image");
  });

  it("ignores case, since phones send .JPG and .MOV", () => {
    expect(libraryForExtension(".JPG")).toBe("image");
    expect(libraryForExtension(".MOV")).toBe("video");
  });

  it("has no library for other files", () => {
    expect(libraryForExtension(".pdf")).toBeNull();
    expect(libraryForExtension("")).toBeNull();
  });
});

describe("libraryAlreadyCopiedTo", () => {
  const transfer = (flags: Partial<TransferItem>): TransferItem => ({
    id: "t",
    name: "a",
    filename: "a.mp4",
    path: "/a.mp4",
    dateAdded: 0,
    fileSize: 1,
    extension: ".mp4",
    ...flags,
  });

  it("names the library an older version copied the file into", () => {
    expect(libraryAlreadyCopiedTo(transfer({ addedToAudio: true }))).toBe("audio");
    expect(libraryAlreadyCopiedTo(transfer({}))).toBeNull();
  });
});
