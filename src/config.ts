// ---------------------------------------------------------------------------
// Config — adjust these to match your subgraph + chain
// ---------------------------------------------------------------------------

/** GraphQL subgraph endpoint for DFK pets */
export const SUBGRAPH_URL =
  process.env.SUBGRAPH_URL ??
  "https://api.thegraph.com/subgraphs/name/defikingdoms/pets-dfkchain";

/** pool value → rarity group */
export const POOL_GROUP: Record<number, "odd" | "veryOdd"> = {
  1: "odd",
  2: "veryOdd",
};

/** background value → colour type */
export const BACKGROUND_TYPE: Record<number, "blue" | "yellow" | "grey"> = {
  1: "blue",
  2: "yellow",
  3: "grey",
};

/** Appearance values considered "odd/very-odd" — used for reference queries */
export const ODD_APPEARANCES = [19, 60, 61, 62, 63, 88, 101, 126];

/** Max items per page (subgraph hard cap is usually 1000) */
export const PAGE_SIZE = 1000;

/** Number of retry attempts on network errors */
export const MAX_RETRIES = 3;
