export type TemaFp = "negro" | "gris";

export const TEMA_STORAGE_KEY = "fp-tema";

/**
 * Script que aplica el tema guardado antes de pintar la página (evita parpadeo).
 * Se inserta en <head> desde el layout raíz.
 */
export const temaInitScript = `(function () {
  try {
    var t = localStorage.getItem("${TEMA_STORAGE_KEY}");
    if (t !== "negro" && t !== "gris") t = "negro";
    var c = document.documentElement.classList;
    c.remove("theme-negro", "theme-gris", "theme-blanco", "dark");
    c.add("fp", "theme-" + t);
    if (t === "negro") c.add("dark");
    document.documentElement.style.colorScheme = t === "negro" ? "dark" : "light";
  } catch (_) {}
})();`;
