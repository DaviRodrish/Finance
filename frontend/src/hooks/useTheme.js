import { useSyncExternalStore } from "react";

const KEY = "luzzy-theme";
const listeners = new Set();

function getInitial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {}
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

let current = typeof window !== "undefined" ? getInitial() : "light";

function apply(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
if (typeof window !== "undefined") apply(current);

function setTheme(theme) {
  current = theme;
  apply(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  listeners.forEach((l) => l());
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current, () => "light");
  return {
    theme,
    setTheme,
    toggleTheme: () => setTheme(current === "dark" ? "light" : "dark"),
  };
}