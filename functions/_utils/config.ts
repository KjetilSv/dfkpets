export const SUBGRAPH_URL = "https://api.defikingdoms.com/graphql";

export const PAGE_SIZE = 1000;

export const POOL_GROUP: Record<number, "odd" | "veryOdd"> = {
  1: "odd",
  2: "veryOdd",
};

export function petIconUrl(id: string) {
  return `https://pets.defikingdoms.com/image/${id}`;
}
