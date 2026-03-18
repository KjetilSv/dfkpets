// Local copies of DFK pet appearance tables (downloaded from DFK docs)
import blue from "../../data/blueEggData.json";
import green from "../../data/greenEggData.json";
import grey from "../../data/greyEggData.json";

export interface AppearanceEntry {
  season: number;
  appearanceId: number;
  family: string;
  displayName: string;
  variant: string;
  rarity: number;
  pool: "Normal" | "Odd" | "Ultra Odd";
  credits?: string;
  path?: string;
}

const tables = [blue, green, grey] as unknown as AppearanceEntry[][];

export function getUniqueTotals() {
  const odd = new Set<number>();
  const ultraOdd = new Set<number>();
  for (const t of tables) {
    for (const e of t) {
      if (e.pool === "Odd") odd.add(e.appearanceId);
      if (e.pool === "Ultra Odd") ultraOdd.add(e.appearanceId);
    }
  }
  return { odd: odd.size, ultraOdd: ultraOdd.size };
}

export function resolveAppearance(appearanceId: number): AppearanceEntry | null {
  if (!appearanceId) return null;
  for (const t of tables) {
    const found = t.find((e) => e.appearanceId === appearanceId);
    if (found) return found;
  }
  return null;
}

export function getOddUltraTypesUnique() {
  // Unike appearanceId per pool, alfabetisk
  const oddMap = new Map<number, AppearanceEntry>();
  const ultraMap = new Map<number, AppearanceEntry>();

  for (const t of tables) {
    for (const e of t) {
      if (e.pool === "Odd" && !oddMap.has(e.appearanceId)) oddMap.set(e.appearanceId, e);
      if (e.pool === "Ultra Odd" && !ultraMap.has(e.appearanceId)) ultraMap.set(e.appearanceId, e);
    }
  }

  const byName = (a: AppearanceEntry, b: AppearanceEntry) => {
    const ak = `${a.displayName} ${a.variant}`.toLowerCase();
    const bk = `${b.displayName} ${b.variant}`.toLowerCase();
    if (ak < bk) return -1;
    if (ak > bk) return 1;
    return a.appearanceId - b.appearanceId;
  };

  return {
    odd: [...oddMap.values()].sort(byName),
    ultraOdd: [...ultraMap.values()].sort(byName),
  };
}
