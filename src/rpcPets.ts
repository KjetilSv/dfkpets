import { JsonRpcProvider, Contract } from "ethers";

// DFK Chain PetCore diamond (mainnet) from docs:
// https://devs.defikingdoms.com/nfts/pets
const PETCORE_DFKCHAIN =
  process.env.PETCORE_ADDRESS ?? "0x1990F87d6BC9D9385917E3EDa0A7674411C3Cd7F";

// Public RPC (can be overridden)
const DFK_RPC_URL =
  process.env.DFK_RPC_URL ??
  "https://subnets.avax.network/defi-kingdoms/dfk-chain/rpc";

const ABI = [
  "function getPetV2(uint256 _id) view returns (tuple(uint256 id, uint8 originId, string name, uint8 season, uint8 eggType, uint8 rarity, uint8 element, uint8 bonusCount, uint8 profBonus, uint8 profBonusScalar, uint8 craftBonus, uint8 craftBonusScalar, uint8 combatBonus, uint8 combatBonusScalar, uint16 appearance, uint8 background, uint8 shiny, uint64 hungryAt, uint64 equippableAt, uint256 equippedTo, address fedBy, uint8 foodType))",
];

const provider = new JsonRpcProvider(DFK_RPC_URL);
const petCore = new Contract(PETCORE_DFKCHAIN, ABI, provider);

const nameCache = new Map<string, string>();

function normalizeName(s: unknown, id: string) {
  const name = typeof s === "string" ? s.trim() : "";
  return name.length ? name : `Pet #${id}`;
}

/** Best-effort: resolves pet display name from chain (cached). */
export async function getPetDisplayName(petId: string): Promise<string> {
  if (nameCache.has(petId)) return nameCache.get(petId)!;

  // If RPC is down or rate-limited, we still return a fallback.
  try {
    const pet = await petCore.getPetV2(BigInt(petId));
    const name = normalizeName(pet?.name, petId);
    nameCache.set(petId, name);
    return name;
  } catch {
    const fallback = `Pet #${petId}`;
    nameCache.set(petId, fallback);
    return fallback;
  }
}

/** Simple concurrency-limited mapper */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}
