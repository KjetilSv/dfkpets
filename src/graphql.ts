import fetch from "cross-fetch";
import { SUBGRAPH_URL, PAGE_SIZE, MAX_RETRIES } from "./config.js";
import { RawPet } from "./types.js";

const PETS_QUERY = /* graphql */ `
  query PetsByOwner($owner: String!, $lastId: ID!) {
    pets(
      first: ${PAGE_SIZE}
      orderBy: id
      orderDirection: asc
      where: {
        owner: $owner
        id_gt: $lastId
      }
    ) {
      id
      pool
      name
      background
      appearance
      rarity
      salePrice
      owner {
        id
        name
      }
    }
  }
`;

const PROFILE_QUERY = /* graphql */ `
  query ProfileById($id: ID!) {
    profile(id: $id) {
      id
      name
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

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as { data?: T; errors?: unknown[] };

    if (json.errors?.length) {
      throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
    }

    if (!json.data) throw new Error("Empty response from subgraph");

    return json.data;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const delay = 500 * attempt;
      await new Promise((r) => setTimeout(r, delay));
      return gqlRequest(query, variables, attempt + 1);
    }
    throw err;
  }
}

/** Fetch all pets owned by an address, with pagination */
export async function fetchPetsByOwner(address: string): Promise<RawPet[]> {
  const owner = address.toLowerCase();
  const pets: RawPet[] = [];
  // pet ids are numeric strings starting at 0; subgraph expects ID type
  let lastId = "0";

  while (true) {
    const data = await gqlRequest<{ pets: RawPet[] }>(PETS_QUERY, {
      owner,
      lastId,
    });

    const page = data.pets ?? [];
    pets.push(...page);

    if (page.length < PAGE_SIZE) break; // last page
    lastId = page[page.length - 1].id;
  }

  return pets;
}

/** Fetch display/profile name for an address (if present in the subgraph) */
export async function fetchProfileName(address: string): Promise<string | null> {
  const id = address.toLowerCase();
  const data = await gqlRequest<{ profile: { id: string; name: string } | null }>(
    PROFILE_QUERY,
    { id }
  );
  const name = data.profile?.name?.trim();
  return name ? name : null;
}
