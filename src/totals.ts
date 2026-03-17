import fetch from "cross-fetch";
import { SUBGRAPH_URL, PAGE_SIZE, MAX_RETRIES } from "./config.js";

const COUNT_QUERY = /* graphql */ `
  query CountByPool($pool: Int!, $lastId: ID!) {
    pets(
      first: ${PAGE_SIZE}
      orderBy: id
      orderDirection: asc
      where: { pool: $pool, id_gt: $lastId }
    ) {
      id
    }
  }
`;

async function gqlRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  attempt = 1
): Promise<T> {
  try {
    const res = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

    const json = (await res.json()) as { data?: T; errors?: unknown[] };
    if (json.errors?.length) {
      throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
    }
    if (!json.data) throw new Error("Empty response from subgraph");
    return json.data;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
      return gqlRequest(query, variables, attempt + 1);
    }
    throw err;
  }
}

export async function countPetsByPool(pool: 1 | 2): Promise<number> {
  let lastId: string = "0";
  let total = 0;

  while (true) {
    const data = await gqlRequest<{ pets: { id: string }[] }>(COUNT_QUERY, {
      pool,
      lastId,
    });
    const page = data.pets ?? [];
    total += page.length;

    if (page.length < PAGE_SIZE) break;
    lastId = page[page.length - 1].id;
  }

  return total;
}

export async function getGlobalTotals(): Promise<{ oddTotal: number; veryOddTotal: number }> {
  const [oddTotal, veryOddTotal] = await Promise.all([
    countPetsByPool(1),
    countPetsByPool(2),
  ]);
  return { oddTotal, veryOddTotal };
}
