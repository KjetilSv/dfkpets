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

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// From https://devs.defikingdoms.com/nfts/pets (Appearance / Family / Variant tables)
// eggType mapping per docs: 0 blue, 1 grey, 2 green, 3 yellow, 4 golden
const SOURCES: Partial<Record<number, { local: string; remote: string }>> = {
  0: {
    local: "../data/blueEggData.json",
    remote:
      "https://2908426948-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FlZLlRJsOJCqm10zUsKr6%2Fuploads%2FHBf7sxE8YJShSf896YiH%2FblueEggData.json?alt=media&token=e75ee43e-8f70-434a-a328-a158feebf979",
  },
  2: {
    local: "../data/greenEggData.json",
    remote:
      "https://2908426948-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FlZLlRJsOJCqm10zUsKr6%2Fuploads%2FreuWW6M1cOFY11xksPzB%2FgreenEggData.json?alt=media&token=fff2a6be-40d7-464b-bbe4-0f37c16123b7",
  },
  1: {
    local: "../data/greyEggData.json",
    remote:
      "https://2908426948-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FlZLlRJsOJCqm10zUsKr6%2Fuploads%2FUuGm12hHfZSJsx48Enlo%2FgreyEggData.json?alt=media&token=cfae70f4-1e70-485b-b276-b7666318c89a",
  },
};

function resolveLocal(rel: string) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, rel);
}

let cache: Map<number, Map<number, AppearanceEntry>> | null = null;

async function fetchJson(url: string): Promise<AppearanceEntry[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch pet meta: HTTP ${res.status}`);
  return (await res.json()) as AppearanceEntry[];
}

function readLocalJson(filePath: string): AppearanceEntry[] {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw) as AppearanceEntry[];
}

export async function loadPetMeta(): Promise<Map<number, Map<number, AppearanceEntry>>> {
  if (cache) return cache;

  const entriesByEggType = new Map<number, Map<number, AppearanceEntry>>();

  for (const [eggTypeStr, src] of Object.entries(SOURCES)) {
    if (!src) continue;
    const eggType = Number(eggTypeStr);

    const localPath = resolveLocal(src.local);
    const arr = existsSync(localPath)
      ? readLocalJson(localPath)
      : await fetchJson(src.remote);

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

/** Lookup appearance by ID only — searches all egg types */
export async function resolveAppearanceByIdOnly(
  appearanceId: number
): Promise<AppearanceEntry | null> {
  if (!appearanceId) return null;
  const meta = await loadPetMeta();
  for (const m of meta.values()) {
    const e = m.get(appearanceId);
    if (e) return e;
  }
  return null;
}

export type OddPool = "Odd" | "Ultra Odd";

export interface OddUltraIndex {
  odd: AppearanceEntry[];
  ultraOdd: AppearanceEntry[];
  uniqueAppearanceIds: {
    odd: number;
    ultraOdd: number;
  };
}

export interface AppearanceType {
  appearanceId: number;
  displayName: string;
  variant: string;
  family: string;
  eggType: number;
  pool: "Odd" | "Ultra Odd";
}

/**
 * Builds lists of Odd / Ultra Odd appearances from the local JSON tables.
 * Also computes UNIQUE counts based on appearanceId (across all egg types).
 */
export async function getOddUltraIndex(): Promise<OddUltraIndex> {
  const meta = await loadPetMeta();

  const odd: AppearanceEntry[] = [];
  const ultraOdd: AppearanceEntry[] = [];

  const oddIds = new Set<number>();
  const ultraIds = new Set<number>();

  for (const m of meta.values()) {
    for (const e of m.values()) {
      if (e.pool === "Odd") {
        odd.push(e);
        oddIds.add(e.appearanceId);
      }
      if (e.pool === "Ultra Odd") {
        ultraOdd.push(e);
        ultraIds.add(e.appearanceId);
      }
    }
  }

  // stable order
  odd.sort((a, b) => a.appearanceId - b.appearanceId);
  ultraOdd.sort((a, b) => a.appearanceId - b.appearanceId);

  return {
    odd,
    ultraOdd,
    uniqueAppearanceIds: {
      odd: oddIds.size,
      ultraOdd: ultraIds.size,
    },
  };
}

/**
 * Unique list of Odd/Ultra Odd types (one entry per appearanceId).
 * If multiple egg types share the same appearanceId, first seen wins.
 */
export async function getOddUltraTypesUnique(): Promise<{ odd: AppearanceType[]; ultraOdd: AppearanceType[] }> {
  const meta = await loadPetMeta();

  const oddMap = new Map<number, AppearanceType>();
  const ultraMap = new Map<number, AppearanceType>();

  for (const [eggType, m] of meta.entries()) {
    for (const e of m.values()) {
      if (e.pool === "Odd") {
        if (!oddMap.has(e.appearanceId)) {
          oddMap.set(e.appearanceId, {
            appearanceId: e.appearanceId,
            displayName: e.displayName,
            variant: e.variant,
            family: e.family,
            eggType,
            pool: "Odd",
          });
        }
      }
      if (e.pool === "Ultra Odd") {
        if (!ultraMap.has(e.appearanceId)) {
          ultraMap.set(e.appearanceId, {
            appearanceId: e.appearanceId,
            displayName: e.displayName,
            variant: e.variant,
            family: e.family,
            eggType,
            pool: "Ultra Odd",
          });
        }
      }
    }
  }

  const byName = (a: AppearanceType, b: AppearanceType) => {
    const ak = `${a.displayName} ${a.variant}`.toLowerCase();
    const bk = `${b.displayName} ${b.variant}`.toLowerCase();
    if (ak < bk) return -1;
    if (ak > bk) return 1;
    return a.appearanceId - b.appearanceId;
  };

  const odd = [...oddMap.values()].sort(byName);
  const ultraOdd = [...ultraMap.values()].sort(byName);
  return { odd, ultraOdd };
}
