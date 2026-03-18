import type { PagesFunction } from "@cloudflare/workers-types";
import { buildLeaderboard } from "../_utils/gql";

// Cache in the Cloudflare edge for 24h
const TTL = 60 * 60 * 24;

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const force = url.searchParams.get("refresh") === "1";

  // If not forcing, let CF cache handle it
  if (!force) {
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const data = await buildLeaderboard();
    const res = Response.json({ ...data, ageSeconds: 0 }, {
      headers: {
        "cache-control": `public, max-age=${TTL}`,
      },
    });
    await cache.put(cacheKey, res.clone());
    return res;
  }

  const data = await buildLeaderboard();
  return Response.json({ ...data, ageSeconds: 0 }, {
    headers: { "cache-control": "no-store" },
  });
};
