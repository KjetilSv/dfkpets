import type { PagesFunction } from "@cloudflare/workers-types";
import { buildLeaderboard } from "../_utils/gql";

export const onRequestGet: PagesFunction = async () => {
  const { entries } = await buildLeaderboard();
  return Response.json({
    totalCollectors: entries.length,
    totalUltraOdd: entries.reduce((s, e) => s + e.ultraOdd, 0),
    totalOdd: entries.reduce((s, e) => s + e.odd, 0),
    topCollector: entries[0] ?? null,
  }, {
    headers: { "cache-control": "no-store" },
  });
};
