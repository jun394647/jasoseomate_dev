export type Theme = "light" | "dark";

type Listener = () => void;
const listeners = new Set<Listener>();
let cached: Theme = "light";

function isTheme(v: string | null): v is Theme {
  return v === "light" || v === "dark";
}

export function getSnapshot(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (isTheme(attr)) cached = attr;
  return cached;
}

export function getServerSnapshot(): Theme {
  return "light";
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  cached = theme;
  listeners.forEach((l) => l());
}
