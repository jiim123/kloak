import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Disable right-click globally except on elements with a custom context menu
document.addEventListener("contextmenu", (e) => {
  const target = e.target as HTMLElement;
  // Allow on inputs/textareas for native copy/paste
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
  // Allow if inside a Radix ContextMenuTrigger (has data-state attr from radix context-menu)
  if (target.closest("[data-radix-context-menu-trigger]")) return;
  e.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
