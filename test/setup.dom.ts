import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Testing Library only unmounts automatically when test globals are on; we
// import `it`/`expect` explicitly, so do it here.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
