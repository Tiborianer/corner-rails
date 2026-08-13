import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CornerRails from "../app/CornerRails";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Corner Rails root element was not found.");
}

createRoot(root).render(
  <StrictMode>
    <CornerRails />
  </StrictMode>,
);
