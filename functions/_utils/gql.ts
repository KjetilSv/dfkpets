import { PAGE_SIZE, SUBGRAPH_URL } from "./config";
import type { RawPet } from "./types";

async function gqlRequest<T>(query: string, variables: Record<string, unknown>) {
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`DFK GraphQL HTTP ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors?.length) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  if (!json.data) throw new Error("Empty GraphQL response");
  return json.data;
}

const PETS_BY_OWNER = /* graphql */ `
  query PetsByOwner($owner: String!, $lastId: ID!) {
    pets(first: ${PAGE_SIZE}, orderBy: id, orderDirection: asc, where: { owner: $owner, id_gt: $lastId }) {
      id
      pool
      name
      eggType
      appearance
      owner { id name }
    }
  }
`;

export async function fetchPetsByOwner(address: string): Promise<RawPet[]> {
  const owner = address.toLowerCase();
  const out: RawPet[] = [];
  let lastId = "0";
  while (true) {
    const data = await gqlRequest<{ pets: RawPet[] }>(PETS_BY_OWNER, { owner, lastId });
    const page = data.pets ?? [];
    out.push(...page);
    if (page.length < PAGE_SIZE) break;
    lastId = page[page.length - 1].id;
  }
  return out;
}

const PROFILE_QUERY = /* graphql */ `
  query ProfileById($id: ID!) {
    profile(id: $id) { id name }
  }
`;

export async function fetchProfileName(address: string): Promise<string | null> {
  const id = address.toLowerCase();
  const data = await gqlRequest<{ profile: { id: string; name: string } | null }>(PROFILE_QUERY, { id });
  const name = data.profile?.name?.trim();
  return name ? name : null;
}

const ULTRA_PAGE = /* graphql */ `
  query($lastId: ID!) {
    pets(first: ${PAGE_SIZE}, orderBy: id, orderDirection: asc, where: { pool: 2, id_gt: $lastId }) {
      id
      owner { id name }
    }
  }
`;

const ODD_PAGE = /* graphql */ `
  query($owners: [String!]!, $lastId: ID!) {
    pets(first: ${PAGE_SIZE}, orderBy: id, orderDirection: asc, where: { pool: 1, owner_in: $owners, id_gt: $lastId }) {
      id
      owner { id }
    }
  }
`;

export async function buildLeaderboard(): Promise<{ entries: any[] }>{
  const ultraCount = new Map<string, { name: string | null; count: number }>();
  let lastId = "0";
  while (true) {
    const data = await gqlRequest<{ pets: { id: string; owner: { id: string; name?: string } }[] }>(ULTRA_PAGE, { lastId });
    const page = data.pets ?? [];
    for (const p of page) {
      const addr = p.owner.id.toLowerCase();
      const existing = ultraCount.get(addr);
      if (existing) existing.count++;
      else ultraCount.set(addr, { name: p.owner.name || null, count: 1 });
    }
    if (page.length < PAGE_SIZE) break;
    lastId = page[page.length - 1].id;
  }

  const owners = [...ultraCount.keys()];
  const oddCount = new Map<string, number>();
  const BATCH = 100;

  for (let i = 0; i < owners.length; i += BATCH) {
    const batch = owners.slice(i, i + BATCH);
    let oddLast = "0";
    while (true) {
      const data = await gqlRequest<{ pets: { id: string; owner: { id: string } }[] }>(ODD_PAGE, { owners: batch, lastId: oddLast });
      const page = data.pets ?? [];
      for (const p of page) {
        const addr = p.owner.id.toLowerCase();
        oddCount.set(addr, (oddCount.get(addr) ?? 0) + 1);
      }
      if (page.length < PAGE_SIZE) break;
      oddLast = page[page.length - 1].id;
    }
  }

  const entries = owners.map((addr) => ({
    address: addr,
    profileName: ultraCount.get(addr)?.name ?? null,
    ultraOdd: ultraCount.get(addr)?.count ?? 0,
    odd: oddCount.get(addr) ?? 0,
  }))
  .sort((a,b) => (b.ultraOdd - a.ultraOdd) || (b.odd - a.odd));

  return { entries };
}
