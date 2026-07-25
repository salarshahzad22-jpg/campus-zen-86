const KEY = "chai_theme";

export function getTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem(KEY) as "light" | "dark") ?? "light";
}

export function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(KEY, theme);
}

export function initTheme() {
  applyTheme(getTheme());
}
