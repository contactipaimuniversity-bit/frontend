export const COLOR_PRESETS = [
  {
    id: "ipa",
    label: "IPAIM · Bleu & or",
    colors: ["#0c1b43", "#14285c", "#c8941b", "#1b9ee6"],
    variables: {
      deep: "#0c1b43",
      navy: "#14285c",
      gold: "#c8941b",
      blue: "#1b9ee6",
      paper: "#edf2f9",
      surface: "#f8faff",
      surfaceBlue: "#e8eef8",
      line: "#d8e1ef",
      muted: "#5c6c89",
    },
  },
  {
    id: "ocean",
    label: "Océan · Pétrole & turquoise",
    colors: ["#123746", "#176b68", "#36b5a0", "#5ba7cf"],
    variables: {
      deep: "#123746",
      navy: "#176b68",
      gold: "#36b5a0",
      blue: "#5ba7cf",
      paper: "#edf5f5",
      surface: "#f8fcfb",
      surfaceBlue: "#e2f0ef",
      line: "#cfe2e0",
      muted: "#557674",
    },
  },
  {
    id: "forest",
    label: "Forêt · Sapin & sauge",
    colors: ["#1b352d", "#35624c", "#a9ba72", "#c8941b"],
    variables: {
      deep: "#1b352d",
      navy: "#35624c",
      gold: "#a9ba72",
      blue: "#c8941b",
      paper: "#f0f3ed",
      surface: "#fbfcf8",
      surfaceBlue: "#e7eee4",
      line: "#d8e1d3",
      muted: "#68796d",
    },
  },
  {
    id: "burgundy",
    label: "Bordeaux · Prune & cuivre",
    colors: ["#351e32", "#65354e", "#cb8c68", "#9b738c"],
    variables: {
      deep: "#351e32",
      navy: "#65354e",
      gold: "#cb8c68",
      blue: "#9b738c",
      paper: "#f5eff2",
      surface: "#fdf9fb",
      surfaceBlue: "#eee4eb",
      line: "#e2d4df",
      muted: "#796579",
    },
  },
] as const;

export type ColorPresetId = (typeof COLOR_PRESETS)[number]["id"];

const storageKey = "ipaim-color-preset";
const changeEvent = "ipaim-color-preset-change";
const defaultPreset: ColorPresetId = "ipa";
const modeStorageKey = "ipaim-color-mode";
const modeChangeEvent = "ipaim-color-mode-change";

export type ColorMode = "light" | "dark";

export function readColorPreset(): ColorPresetId {
  if (typeof window === "undefined") return defaultPreset;
  const saved = window.localStorage.getItem(storageKey);
  return COLOR_PRESETS.find((preset) => preset.id === saved)?.id ?? defaultPreset;
}

export function applyColorPreset(id: ColorPresetId, persist = true) {
  if (typeof window === "undefined") return;
  const preset = COLOR_PRESETS.find((item) => item.id === id) ?? COLOR_PRESETS[0];
  document.documentElement.dataset.colorPreset = preset.id;
  if (persist) {
    window.localStorage.setItem(storageKey, preset.id);
    window.dispatchEvent(new Event(changeEvent));
  }
}

export function subscribeToColorPreset(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function readColorMode(): ColorMode {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem(modeStorageKey) === "dark" ? "dark" : "light";
}

export function applyColorMode(mode: ColorMode, persist = true) {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.colorMode = mode;
  if (persist) {
    window.localStorage.setItem(modeStorageKey, mode);
    window.dispatchEvent(new Event(modeChangeEvent));
  }
}

export function subscribeToColorMode(onChange: () => void) {
  window.addEventListener(modeChangeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(modeChangeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// ---------- Police et taille du texte (préférences de l'appareil) ----------

export const FONTS = [
  { id: "geist", label: "Geist", hint: "Moderne et nette · par défaut", family: "var(--font-geist-sans)" },
  { id: "inter", label: "Inter", hint: "Très lisible à l'écran", family: "var(--font-inter)" },
  { id: "poppins", label: "Poppins", hint: "Ronde et géométrique", family: "var(--font-poppins)" },
  { id: "nunito", label: "Nunito", hint: "Douce et arrondie", family: "var(--font-nunito)" },
  { id: "source", label: "Source Sans", hint: "Sobre, à l'aise dans les tableaux", family: "var(--font-source)" },
  { id: "lora", label: "Lora", hint: "Avec empattements, style imprimé", family: "var(--font-lora)" },
  { id: "system", label: "Police du système", hint: "Celle de votre ordinateur", family: 'system-ui, "Segoe UI", Roboto, Arial, sans-serif' },
] as const;
export type FontId = (typeof FONTS)[number]["id"];

export const TEXT_SIZES = [
  { id: "small", label: "Petite" },
  { id: "normal", label: "Normale" },
  { id: "large", label: "Grande" },
  { id: "xlarge", label: "Très grande" },
] as const;
export type TextSizeId = (typeof TEXT_SIZES)[number]["id"];

const fontStorageKey = "ipaim-font";
const textSizeStorageKey = "ipaim-text-size";
const typographyChangeEvent = "ipaim-typography-change";

export function readFont(): FontId {
  if (typeof window === "undefined") return "geist";
  const saved = window.localStorage.getItem(fontStorageKey);
  return FONTS.find((font) => font.id === saved)?.id ?? "geist";
}

export function readTextSize(): TextSizeId {
  if (typeof window === "undefined") return "normal";
  const saved = window.localStorage.getItem(textSizeStorageKey);
  return TEXT_SIZES.find((size) => size.id === saved)?.id ?? "normal";
}

export function applyFont(id: FontId, persist = true) {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.font = id;
  if (persist) {
    window.localStorage.setItem(fontStorageKey, id);
    window.dispatchEvent(new Event(typographyChangeEvent));
  }
}

export function applyTextSize(id: TextSizeId, persist = true) {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.textSize = id;
  if (persist) {
    window.localStorage.setItem(textSizeStorageKey, id);
    window.dispatchEvent(new Event(typographyChangeEvent));
  }
}

export function subscribeToTypography(onChange: () => void) {
  window.addEventListener(typographyChangeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(typographyChangeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}
