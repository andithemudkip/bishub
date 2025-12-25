import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";

// This is a placeholder entry point - redirects to appropriate app
// In Electron, windows load display.html or remote.html directly

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">BisHub</h1>
        <p className="text-gray-400">Church Display Application</p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
