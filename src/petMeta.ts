import fetch from "cross-fetch";

export interface AppearanceEntry {
  appearanceId: number;
  family: string;
  displayName: string;
  variant: string;
  rarity: number;
  pool: string;
  path: string;
  season?: number;
}

// From https://devs.defikingdoms.com/nfts/pets (Appearance / Family / Variant tables)
const URLS: Partial<Record<number, string>> = {
  // eggType mapping per docs: 0 blue, 1 grey, 2 green, 3 yellow, 4 golden
  0: "https://2908426948-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FlZLlRJsOJCqm10zUsKr6%2Fuploads%2FHBf7sxE8YJShSf896YiH%2FblueEggData.json?alt=media&token=e75ee43e-8f70-434a-a328-a158feebf979",
  2: "https://2908426948-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FlZLlRJsOJCqm10zUsKr6%2Fuploads%2FreuWW6M1cOFY11xksPzB%2FgreenEggData.json?alt=media&token=fff2a6be-40d7-464b-bbe4-0f37c16123b7",
  1: "https://2908426948-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FlZLlRJsOJCqm10zUsKr6%2Fuploads%2FUuGm12hHfZSJsx48Enlo%2FgreyEggData.json?alt=media&token=cfae70f4-1e70-485b-b276-b7666318c89a",
};

let cache: Map<number, Map<number, AppearanceEntry>> | null = null;

async function fetchJson(url: string): Promise<AppearanceEntry[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch pet meta: HTTP ${res.status}`);
  return (await res.json()) as AppearanceEntry[];
}

export async function loadPetMeta(): Promise<Map<number, Map<number, AppearanceEntry>>> {
  if (cache) return cache;

  const entriesByEggType = new Map<number, Map<number, AppearanceEntry>>();

  for (const [eggTypeStr, url] of Object.entries(URLS)) {
    if (!url) continue;
    const eggType = Number(eggTypeStr);
    const arr = await fetchJson(url);

    const m = new Map<number, AppearanceEntry>();
    for (const e of arr) {
      if (typeof e.appearanceId !== "number") continue;
      m.set(e.appearanceId, e);
    }
    entriesByEggType.set(eggType, m);
  }

  cache = entriesByEggType;
  return entriesByEggType;
}

export async function resolveAppearanceDisplay(
  eggType: number,
  appearanceId: number
): Promise<AppearanceEntry | null> {
  const meta = await loadPetMeta();
  const m = meta.get(eggType);
  if (!m) return null;
  return m.get(appearanceId) ?? null;
}
