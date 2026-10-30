import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { parsePortalConfig } from "./config.ts";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("root is missing");

fetch("/config.json")
  .then((response) => {
    if (!response.ok) throw new Error("portal config is missing");
    return response.json();
  })
  .then((json: unknown) => {
    createRoot(root).render(
      <StrictMode>
        <App config={parsePortalConfig(json)} />
      </StrictMode>,
    );
  })
  .catch(() => {
    root.textContent =
      "The portal config is missing. Copy portal/config.example.json to portal/public/config.json.";
  });
