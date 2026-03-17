import { fetchPetsByOwner } from "./graphql.js";
import { POOL_GROUP, BACKGROUND_TYPE } from "./config.js";
import {
  PetCounts,
  LeaderboardEntry,
  RarityGroup,
  PetColour,
} from "./types.js";

function emptyByType(): Record<PetColour, number> {
  return { blue: 0, yellow: 0, grey: 0 };
}

function emptyCounts(): PetCounts {
  return {
    odd: 0,
    veryOdd: 0,
    byType: {
      odd: emptyByType(),
      veryOdd: emptyByType(),
    },
  };
}

/** Return odd / veryOdd counts + per-colour breakdown for one address */
export async function getCountsByOwner(address: string): Promise<PetCounts> {
  const pets = await fetchPetsByOwner(address);
  const counts = emptyCounts();

  for (const pet of pets) {
    const poolNum = Number(pet.pool);
    const bgNum = Number(pet.background);

    const group: RarityGroup | undefined = POOL_GROUP[poolNum];
    if (!group) continue; // skip non-odd pets

    counts[group]++;

    const colour: PetColour | undefined = BACKGROUND_TYPE[bgNum];
    if (colour) {
      counts.byType[group][colour]++;
    }
  }

  return counts;
}

/** Build a sorted leaderboard for multiple addresses */
export async function buildLeaderboard(
  addresses: string[]
): Promise<LeaderboardEntry[]> {
  const results = await Promise.allSettled(
    addresses.map(async (addr) => ({
      address: addr.toLowerCase(),
      counts: await getCountsByOwner(addr),
    }))
  );

  const entries: LeaderboardEntry[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      entries.push(r.value);
    } else {
      console.error("Failed for entry:", r.reason);
    }
  }

  return entries.sort((a, b) => {
    if (b.counts.veryOdd !== a.counts.veryOdd)
      return b.counts.veryOdd - a.counts.veryOdd;
    return b.counts.odd - a.counts.odd;
  });
}
