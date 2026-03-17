import http from "node:http";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { getCountsByOwner } from "./leaderboard.js";
import { fetchPetsByOwner, fetchProfileName } from "./graphql.js";
import { POOL_GROUP } from "./config.js";
import { PetLite, RawPet } from "./types.js";
import { getGlobalTotals } from "./totals.js";
import { getPetDisplayName, getPetInfo, mapLimit } from "./rpcPets.js";
import { getOddUltraIndex, getOddUltraTypesUnique } from "./petMeta.js";

function petIconUrl(id: string) {
  // preferred public image host
  return `https://pets.defikingdoms.com/image/${id}`;
}

function toPetLite(p: RawPet): PetLite {
  return {
    id: p.id,
    // GraphQL pet.name seems often empty; we replace it later via on-chain lookup.
    name: (p.name ?? "").trim() || `Pet #${p.id}`,
    iconUrl: petIconUrl(p.id),
  };
}

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "0.0.0.0"; // LAN

const indexHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

// NOTE: totals cache disabled while iterating; totals are recomputed per request.
async function getTotalsCached() {
  return getGlobalTotals();
}

function send(res: http.ServerResponse, code: number, body: string, type = "text/plain") {
  res.statusCode = code;
  res.setHeader("content-type", `${type}; charset=utf-8`);
  res.setHeader("cache-control", "no-store");
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/") {
      // read on each request to avoid cache while iterating
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

      // build appearance → petId map for owned pets (for catalog images)
      const ownedAppearanceToPetId = new Map<number, string>();
      const relevantOwned = pets.filter(p => POOL_GROUP[Number(p.pool)] === "odd" || POOL_GROUP[Number(p.pool)] === "veryOdd");
      const ownedInfos = await mapLimit(relevantOwned, 6, async (p) => ({ id: p.id, ...(await getPetInfo(p.id)) }));
      for (const info of ownedInfos) {
        if (!ownedAppearanceToPetId.has(info.appearance)) {
          ownedAppearanceToPetId.set(info.appearance, info.id);
        }
      }

      let oddPets: PetLite[] = [];
      let veryOddPets: PetLite[] = [];

      for (const p of pets) {
        const group = POOL_GROUP[Number(p.pool)];
        if (group === "odd") oddPets.push(toPetLite(p));
        if (group === "veryOdd") veryOddPets.push(toPetLite(p));
      }

      // Replace placeholder names with derived display names (cached)
      oddPets = await mapLimit(oddPets, 6, async (pet) => ({
        ...pet,
        name: await getPetDisplayName(pet.id),
      }));
      veryOddPets = await mapLimit(veryOddPets, 6, async (pet) => ({
        ...pet,
        name: await getPetDisplayName(pet.id),
      }));

      return send(
        res,
        200,
        JSON.stringify({
          address: address.toLowerCase(),
          displayName: profileName,
          counts,
          totals,
          oddUltraUniqueTotals: oddUltra.uniqueAppearanceIds,
          oddPets,
          veryOddPets,
          ownedUniqueOdd: [...new Set(ownedInfos.filter(i => POOL_GROUP[Number(pets.find(p=>p.id===i.id)?.pool)] === "odd").map(i => i.appearance))].length,
          ownedUniqueVeryOdd: [...new Set(ownedInfos.filter(i => POOL_GROUP[Number(pets.find(p=>p.id===i.id)?.pool)] === "veryOdd").map(i => i.appearance))].length,
        }),
        "application/json"
      );
    }

    if (url.pathname === "/api/catalog") {
      const address = (url.searchParams.get("address") ?? "").trim();
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return send(res, 400, JSON.stringify({ error: "Invalid address" }), "application/json");
      }

      const [pets, types] = await Promise.all([
        fetchPetsByOwner(address),
        getOddUltraTypesUnique(),
      ]);

      // owned appearanceIds by pool group
      const ownedOdd = new Set<number>();
      const ownedUltra = new Set<number>();

      // only check pets that are pool 1/2 (odd/veryOdd)
      const relevant = pets.filter((p) => {
        const g = POOL_GROUP[Number(p.pool)];
        return g === "odd" || g === "veryOdd";
      });

      const infos = await mapLimit(relevant, 6, async (p) => ({
        pool: Number(p.pool),
        ...(await getPetInfo(p.id)),
      }));

      for (const info of infos) {
        const group = POOL_GROUP[Number(info.pool)];
        if (group === "odd") ownedOdd.add(info.appearance);
        if (group === "veryOdd") ownedUltra.add(info.appearance);
      }

      // build appearance → petId map for catalog images
      const appearanceToPetId = new Map<number, string>();
      for (const info of infos) {
        if (!appearanceToPetId.has(info.appearance)) {
          appearanceToPetId.set(info.appearance, relevant[infos.indexOf(info)].id);
        }
      }

      const odd = types.odd.map((t) => ({
        ...t,
        owned: ownedOdd.has(t.appearanceId),
        iconUrl: appearanceToPetId.has(t.appearanceId)
          ? petIconUrl(appearanceToPetId.get(t.appearanceId)!)
          : null,
      }));
      const ultraOdd = types.ultraOdd.map((t) => ({
        ...t,
        owned: ownedUltra.has(t.appearanceId),
        iconUrl: appearanceToPetId.has(t.appearanceId)
          ? petIconUrl(appearanceToPetId.get(t.appearanceId)!)
          : null,
      }));

      return send(
        res,
        200,
        JSON.stringify({
          address: address.toLowerCase(),
          odd,
          ultraOdd,
        }),
        "application/json"
      );
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
