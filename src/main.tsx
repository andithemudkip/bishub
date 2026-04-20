import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

// Placeholder entry point — Electron windows load display.html or remote.html directly.

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
