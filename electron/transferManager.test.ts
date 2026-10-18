import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { TransferManager } from "./transferManager";

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
