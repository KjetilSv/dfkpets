import fetch from "cross-fetch";
import { SUBGRAPH_URL, PAGE_SIZE, MAX_RETRIES } from "./config.js";

export interface LeaderboardEntry {
  address: string;
  profileName: string | null;
  ultraOdd: number;
  odd: number;
}

const QUERY = /* graphql */ `
  query($lastId: ID!) {
    pets(
      first: ${PAGE_SIZE}
      orderBy: id
      orderDirection: asc
      where: { pool: 2, id_gt: $lastId }
    ) {
      id
      pool
      owner {
        id
        name
      }
    }
  }
`;

const ODD_QUERY = /* graphql */ `
  query($owners: [String!]!, $lastId: ID!) {
    pets(
      first: ${PAGE_SIZE}
      orderBy: id
      orderDirection: asc
      where: { pool: 1, owner_in: $owners, id_gt: $lastId }
    ) {
      id
      owner { id }
    }
  }
`;

async function gql<T>(query: string, variables: Record<string, unknown>, attempt = 1): Promise<T> {
  try {
    const res = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { data?: T; errors?: unknown[] };
    if (json.errors?.length) throw new Error(JSON.stringify(json.errors));
    if (!json.data) throw new Error("Empty response");
    return json.data;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 500 * attempt));
      return gql(query, variables, attempt + 1);
    }
    throw err;
  }
}

export async function buildLeaderboard(): Promise<LeaderboardEntry[]> {
  console.log("[leaderboard] Building — fetching all ultra odd pets…");

  // Step 1: collect all ultra odd pet owners
  const ultraCountByOwner = new Map<string, { name: string | null; count: number }>();
  let lastId = "0";

  while (true) {
    const data = await gql<{ pets: { id: string; owner: { id: string; name?: string } }[] }>(
      QUERY, { lastId }
    );
    const page = data.pets ?? [];
    for (const p of page) {
      const addr = p.owner.id.toLowerCase();
      const existing = ultraCountByOwner.get(addr);
      if (existing) {
        existing.count++;
      } else {
        ultraCountByOwner.set(addr, { name: p.owner.name || null, count: 1 });
      }
    }
    if (page.length < PAGE_SIZE) break;
    lastId = page[page.length - 1].id;
  }

  const ultraOwners = [...ultraCountByOwner.keys()];
  console.log(`[leaderboard] ${ultraOwners.length} unique ultra odd owners found`);

  // Step 2: count odd pets for these owners (in batches of 100 to stay within query limits)
  const oddCountByOwner = new Map<string, number>();
  const BATCH = 100;

  for (let i = 0; i < ultraOwners.length; i += BATCH) {
    const batch = ultraOwners.slice(i, i + BATCH);
    let oddLastId = "0";
    while (true) {
      const data = await gql<{ pets: { id: string; owner: { id: string } }[] }>(
        ODD_QUERY, { owners: batch, lastId: oddLastId }
      );
      const page = data.pets ?? [];
      for (const p of page) {
        const addr = p.owner.id.toLowerCase();
        oddCountByOwner.set(addr, (oddCountByOwner.get(addr) ?? 0) + 1);
      }
      if (page.length < PAGE_SIZE) break;
      oddLastId = page[page.length - 1].id;
    }
  }

  // Step 3: combine and sort
  const entries: LeaderboardEntry[] = ultraOwners.map(addr => ({
    address: addr,
    profileName: ultraCountByOwner.get(addr)?.name ?? null,
    ultraOdd: ultraCountByOwner.get(addr)?.count ?? 0,
    odd: oddCountByOwner.get(addr) ?? 0,
  }));

  entries.sort((a, b) => {
    if (b.ultraOdd !== a.ultraOdd) return b.ultraOdd - a.ultraOdd;
    return b.odd - a.odd;
  });

  console.log(`[leaderboard] Done — ${entries.length} entries`);
  return entries;
}

// In-memory cache
let cache: { entries: LeaderboardEntry[]; builtAt: number } | null = null;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getLeaderboard(force = false): Promise<LeaderboardEntry[]> {
  if (!force && cache && Date.now() - cache.builtAt < TTL_MS) {
    return cache.entries;
  }
  const entries = await buildLeaderboard();
  cache = { entries, builtAt: Date.now() };
  return entries;
}

export function getLeaderboardCacheAge(): number | null {
  return cache ? Math.floor((Date.now() - cache.builtAt) / 1000) : null;
}
