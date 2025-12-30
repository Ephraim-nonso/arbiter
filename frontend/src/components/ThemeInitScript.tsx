export function ThemeInitScript() {
  // Runs before React hydration to avoid flash.
  const code = `
(() => {
  try {
    const key = "arbiter.theme";
    const v = localStorage.getItem(key);
    const theme = (v === "dark" || v === "light") ? v : "light";
    const el = document.documentElement;
    if (theme === "dark") el.classList.add("dark");
    else el.classList.remove("dark");
  } catch {}
})();
`.trim();

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}


