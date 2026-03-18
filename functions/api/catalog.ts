import type { PagesFunction } from "@cloudflare/workers-types";
import { fetchPetsByOwner } from "../_utils/gql";
import { POOL_GROUP, petIconUrl } from "../_utils/config";
import { getOddUltraTypesUnique } from "../_utils/meta";

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const address = (url.searchParams.get("address") ?? "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }

  const [pets, types] = await Promise.all([
    fetchPetsByOwner(address),
    Promise.resolve(getOddUltraTypesUnique()),
  ]);

  const ownedOdd = new Set<number>();
  const ownedUltra = new Set<number>();
  const appearanceToPetId = new Map<number, string>();

  for (const p of pets) {
    const group = POOL_GROUP[Number(p.pool)];
    if (!group) continue;
    const appearanceId = Number(p.appearance ?? 0);
    if (!appearanceToPetId.has(appearanceId)) appearanceToPetId.set(appearanceId, p.id);
    if (group === "odd") ownedOdd.add(appearanceId);
    if (group === "veryOdd") ownedUltra.add(appearanceId);
  }

  const decorate = (t: any, ownedSet: Set<number>) => ({
    ...t,
    owned: ownedSet.has(t.appearanceId),
    iconUrl: appearanceToPetId.has(t.appearanceId) ? petIconUrl(appearanceToPetId.get(t.appearanceId)!) : null,
  });

  const odd = types.odd.map((t) => decorate(t, ownedOdd));
  const ultraOdd = types.ultraOdd.map((t) => decorate(t, ownedUltra));

  return Response.json({
    address: address.toLowerCase(),
    odd,
    ultraOdd,
    missingOdd: types.odd.filter((t) => !ownedOdd.has(t.appearanceId)),
    missingUltraOdd: types.ultraOdd.filter((t) => !ownedUltra.has(t.appearanceId)),
  }, {
    headers: { "cache-control": "no-store" },
  });
};
