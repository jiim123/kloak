import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Disable right-click globally except on elements with a custom context menu or text inputs
document.addEventListener("contextmenu", (e) => {
  const target = e.target as HTMLElement;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
  if (target.closest("[data-context-menu]")) return;
  e.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
