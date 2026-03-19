import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Disable right-click globally except on elements with a custom context menu or text inputs
document.addEventListener("contextmenu", (e) => {
  const target = e.target as HTMLElement;
  // Allow on inputs/textareas for native copy/paste
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
  // Allow if inside a Radix ContextMenuTrigger (renders a span with data-state)
  if (target.closest("[data-state][data-radix-collection-item]") || target.closest("[data-context-menu]")) return;
  e.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
