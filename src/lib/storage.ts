/** Small typed localStorage helpers; every read tolerates a blocked store. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export const STORAGE_KEYS = {
  favorites: "cell-studio-favorites",
  viewedCells: "cell-studio-viewed-cells",
  viewedOrganelles: "cell-studio-viewed-organelles",
  notes: "cell-studio-notes",
  settings: "cell-studio-settings",
};
