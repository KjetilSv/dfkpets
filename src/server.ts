import http from "node:http";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { getCountsByOwner } from "./leaderboard.js";
import { fetchPetsByOwner, fetchProfileName } from "./graphql.js";
import { POOL_GROUP } from "./config.js";
import { PetLite, RawPet } from "./types.js";
import { getGlobalTotals } from "./totals.js";
import { mapLimit } from "./rpcPets.js";
import { getOddUltraIndex, getOddUltraTypesUnique, resolveAppearanceByIdOnly } from "./petMeta.js";
import { getLeaderboard, getLeaderboardCacheAge } from "./leaderboardCache.js";

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "0.0.0.0";

function petIconUrl(id: string) {
  return `https://pets.defikingdoms.com/image/${id}`;
}

function toPetLite(p: RawPet): PetLite {
  return {
    id: p.id,
    name: (p.name ?? "").trim() || `Pet #${p.id}`,
    iconUrl: petIconUrl(p.id),
  };
}

// NOTE: totals cache disabled while iterating
async function getTotalsCached() {
  return getGlobalTotals();
}

function send(res: http.ServerResponse, code: number, body: string, type = "text/plain") {
  res.statusCode = code;
  res.setHeader("content-type", `${type}; charset=utf-8`);
  res.setHeader("cache-control", "no-store");
  res.end(body);
}

/** Resolve display name from GraphQL appearance + eggType (no RPC needed) */
async function resolvePetName(p: RawPet): Promise<string> {
  const appearanceId = Number(p.appearance ?? 0);
  if (!appearanceId) {
    const eggLabels: Record<number, string> = { 0: "Blue", 1: "Grey", 2: "Green", 3: "Yellow", 4: "Golden" };
    const label = eggLabels[Number(p.eggType ?? 0)] ?? "Unknown";
    return `Unrevealed (${label} Egg)`;
  }
  const meta = await resolveAppearanceByIdOnly(appearanceId);
  if (!meta) return `Pet #${p.id}`;
  const variant = (meta.variant ?? "").trim();
  return variant ? `${meta.displayName} (${variant})` : meta.displayName;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/") {
      const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
      return send(res, 200, html, "text/html");
    }

    if (url.pathname === "/api/owner") {
      const address = (url.searchParams.get("address") ?? "").trim();
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return send(res, 400, JSON.stringify({ error: "Invalid address" }), "application/json");
      }

      const [counts, pets, totals, profileName, oddUltra] = await Promise.all([
        getCountsByOwner(address),
        fetchPetsByOwner(address),
        getTotalsCached(),
        fetchProfileName(address),
        getOddUltraIndex(),
      ]);

      const relevantPets = pets.filter(p => {
        const g = POOL_GROUP[Number(p.pool)];
        return g === "odd" || g === "veryOdd";
      });

      // Use appearance directly from GraphQL — no RPC needed
      const appearanceToPetId = new Map<number, string>();
      const ownedOddAppearances = new Set<number>();
      const ownedUltraAppearances = new Set<number>();

      for (const p of relevantPets) {
        const app = Number(p.appearance ?? 0);
        const group = POOL_GROUP[Number(p.pool)];
        if (!appearanceToPetId.has(app)) appearanceToPetId.set(app, p.id);
        if (group === "odd") ownedOddAppearances.add(app);
        if (group === "veryOdd") ownedUltraAppearances.add(app);
      }

      // Resolve names in parallel (uses local JSON, no RPC)
      let oddPets: PetLite[] = [];
      let veryOddPets: PetLite[] = [];

      for (const p of pets) {
        const group = POOL_GROUP[Number(p.pool)];
        if (group === "odd") oddPets.push(toPetLite(p));
        if (group === "veryOdd") veryOddPets.push(toPetLite(p));
      }

      oddPets = await mapLimit(oddPets, 12, async (pet) => {
        const raw = pets.find(p => p.id === pet.id)!;
        return { ...pet, name: await resolvePetName(raw) };
      });
      veryOddPets = await mapLimit(veryOddPets, 12, async (pet) => {
        const raw = pets.find(p => p.id === pet.id)!;
        return { ...pet, name: await resolvePetName(raw) };
      });

      return send(res, 200, JSON.stringify({
        address: address.toLowerCase(),
        displayName: profileName,
        counts,
        totals,
        oddUltraUniqueTotals: oddUltra.uniqueAppearanceIds,
        oddPets,
        veryOddPets,
        ownedUniqueOdd: Math.min(ownedOddAppearances.size, oddUltra.uniqueAppearanceIds.odd),
        ownedUniqueVeryOdd: Math.min(ownedUltraAppearances.size, oddUltra.uniqueAppearanceIds.ultraOdd),
      }), "application/json");
    }

    if (url.pathname === "/api/catalog") {
      const address = (url.searchParams.get("address") ?? "").trim();
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return send(res, 400, JSON.stringify({ error: "Invalid address" }), "application/json");
      }

      const [pets, types] = await Promise.all([fetchPetsByOwner(address), getOddUltraTypesUnique()]);

      const ownedOdd = new Set<number>();
      const ownedUltra = new Set<number>();
      const appearanceToPetId = new Map<number, string>();

      for (const p of pets) {
        const app = Number(p.appearance ?? 0);
        const group = POOL_GROUP[Number(p.pool)];
        if (!appearanceToPetId.has(app)) appearanceToPetId.set(app, p.id);
        if (group === "odd") ownedOdd.add(app);
        if (group === "veryOdd") ownedUltra.add(app);
      }

      const toEntry = (t: typeof types.odd[0], ownedSet: Set<number>) => ({
        ...t,
        owned: ownedSet.has(t.appearanceId),
        iconUrl: appearanceToPetId.has(t.appearanceId) ? petIconUrl(appearanceToPetId.get(t.appearanceId)!) : null,
      });

      return send(res, 200, JSON.stringify({
        address: address.toLowerCase(),
        odd: types.odd.map(t => toEntry(t, ownedOdd)),
        ultraOdd: types.ultraOdd.map(t => toEntry(t, ownedUltra)),
        missingOdd: types.odd.filter(t => !ownedOdd.has(t.appearanceId)),
        missingUltraOdd: types.ultraOdd.filter(t => !ownedUltra.has(t.appearanceId)),
      }), "application/json");
    }

    if (url.pathname === "/api/leaderboard") {
      const force = url.searchParams.get("refresh") === "1";
      const entries = await getLeaderboard(force);
      const ageSeconds = getLeaderboardCacheAge();
      return send(res, 200, JSON.stringify({ entries, ageSeconds }), "application/json");
    }

    if (url.pathname === "/api/stats") {
      // Rarity heatmap: count owners per appearance type from leaderboard data
      // First seen: lowest pet IDs among ultra odd
      const entries = await getLeaderboard();
      // Use leaderboard owner counts as proxy for rarity (future: per-appearance breakdown)
      return send(res, 200, JSON.stringify({
        totalCollectors: entries.length,
        totalUltraOdd: entries.reduce((s, e) => s + e.ultraOdd, 0),
        totalOdd: entries.reduce((s, e) => s + e.odd, 0),
        topCollector: entries[0] ?? null,
      }), "application/json");
    }

    return send(res, 404, "Not found");
  } catch (err: any) {
    return send(res, 500, JSON.stringify({ error: err?.message ?? String(err) }), "application/json");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`DFK pet leaderboard web: http://${HOST}:${PORT}`);
  console.log(`(Use your PC LAN IP on mobile, e.g. http://192.168.x.x:${PORT})`);
});
