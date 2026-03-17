import http from "node:http";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { getCountsByOwner } from "./leaderboard.js";
import { fetchPetsByOwner, fetchProfileName } from "./graphql.js";
import { POOL_GROUP } from "./config.js";
import { PetLite, RawPet } from "./types.js";
import { getGlobalTotals } from "./totals.js";
import { getPetDisplayName, mapLimit } from "./rpcPets.js";

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

      const [counts, pets, totals, profileName] = await Promise.all([
        getCountsByOwner(address),
        fetchPetsByOwner(address),
        getTotalsCached(),
        fetchProfileName(address),
      ]);

      let oddPets: PetLite[] = [];
      let veryOddPets: PetLite[] = [];

      for (const p of pets) {
        const group = POOL_GROUP[Number(p.pool)];
        if (group === "odd") oddPets.push(toPetLite(p));
        if (group === "veryOdd") veryOddPets.push(toPetLite(p));
      }

      // Replace placeholder names with on-chain display names (best-effort, cached)
      // Concurrency limited to avoid hammering the RPC.
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
          oddPets,
          veryOddPets,
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
