import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { getTranslations } from "../../../shared/i18n";
import { StageFooter } from "./StageFooter";

// The real QR is an opaque grid of paths; expose what it encodes instead.
vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => <svg data-testid="qr" data-value={value} />,
}));

const t = getTranslations("en");

function inElectron() {
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: {
      getLocalIP: async () => "192.168.1.20",
      getSecurityKey: async () => "a1b2c3d4",
    },
  });
}

async function renderFooter() {
  const result = render(<StageFooter serverPort={3847} connectedDeviceCount={0} t={t} />);
  // Let the IP and pairing key lookups resolve.
  await act(async () => {});
  return result;
}

afterEach(() => {
  delete (window as { electronAPI?: unknown }).electronAPI;
});

describe("StageFooter phone QR", () => {
  it("shows the pairing QR by default in the app", async () => {
    inElectron();
    await renderFooter();
    expect(screen.getByTestId("qr").getAttribute("data-value")).toBe(
      "http://192.168.1.20:3847/remote?key=a1b2c3d4",
    );
    expect(screen.getByText(t.stage.phoneRemoteTitle)).toBeTruthy();
    expect(screen.getByText("192.168.1.20:3847")).toBeTruthy();
    // The count moves onto the card too, rather than leaving a row of its own.
    expect(screen.getAllByRole("img", { name: "Devices: 0" })).toHaveLength(1);
  });

  it("hides it on request, remembers that, and can bring it back", async () => {
    inElectron();
    const { unmount } = await renderFooter();

    fireEvent.click(screen.getByRole("button", { name: t.stage.hidePhoneQr }));
    expect(screen.queryByTestId("qr")).toBeNull();
    // The address goes with the card; the row offers only the way back.
    expect(screen.queryByText("192.168.1.20:3847")).toBeNull();

    // Still hidden after the remote is reopened.
    unmount();
    await renderFooter();
    expect(screen.queryByTestId("qr")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: t.stage.showPhoneQr }));
    expect(screen.getByTestId("qr")).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.stage.showPhoneQr })).toBeNull();
  });

  it("isn't offered on a web remote, which keeps the address in the row", async () => {
    await renderFooter();
    expect(screen.getByText(window.location.host)).toBeTruthy();
    expect(screen.queryByTestId("qr")).toBeNull();
    expect(screen.queryByRole("button", { name: t.stage.showPhoneQr })).toBeNull();
  });
});
