import type { PagesFunction } from "@cloudflare/workers-types";
import { fetchPetsByOwner, fetchProfileName } from "../_utils/gql";
import { POOL_GROUP, petIconUrl } from "../_utils/config";
import { getUniqueTotals, resolveAppearance } from "../_utils/meta";

function unrevealedName(eggType: number) {
  const m: Record<number, string> = { 0: "Blue", 1: "Grey", 2: "Green", 3: "Yellow", 4: "Golden" };
  return `Unrevealed (${m[eggType] ?? "Unknown"} Egg)`;
}

function petName(p: any) {
  const appearanceId = Number(p.appearance ?? 0);
  if (!appearanceId) return unrevealedName(Number(p.eggType ?? 0));
  const meta = resolveAppearance(appearanceId);
  if (!meta) return `Pet #${p.id}`;
  const variant = (meta.variant ?? "").trim();
  return variant ? `${meta.displayName} (${variant})` : meta.displayName;
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const address = (url.searchParams.get("address") ?? "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }

  const [pets, displayName] = await Promise.all([
    fetchPetsByOwner(address),
    fetchProfileName(address),
  ]);

  const oddPets: any[] = [];
  const veryOddPets: any[] = [];
  const ownedOdd = new Set<number>();
  const ownedUltra = new Set<number>();

  for (const p of pets) {
    const group = POOL_GROUP[Number(p.pool)];
    if (!group) continue;
    const appearanceId = Number(p.appearance ?? 0);
    if (group === "odd") ownedOdd.add(appearanceId);
    if (group === "veryOdd") ownedUltra.add(appearanceId);

    const lite = { id: p.id, name: petName(p), iconUrl: petIconUrl(p.id) };
    if (group === "odd") oddPets.push(lite);
    if (group === "veryOdd") veryOddPets.push(lite);
  }

  const totals = getUniqueTotals();

  return Response.json({
    address: address.toLowerCase(),
    displayName,
    counts: { odd: oddPets.length, veryOdd: veryOddPets.length },
    oddUltraUniqueTotals: totals,
    ownedUniqueOdd: Math.min(ownedOdd.size, totals.odd),
    ownedUniqueVeryOdd: Math.min(ownedUltra.size, totals.ultraOdd),
    oddPets,
    veryOddPets,
  }, {
    headers: { "cache-control": "no-store" },
  });
};
