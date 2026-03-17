export interface RawPet {
  id: string;
  pool: string | number;
  name?: string;
  background: string | number;
  appearance?: string | number;
  rarity?: string | number;
  salePrice?: string;
  owner?: { name?: string; id?: string };
}

export interface PetLite {
  id: string;
  name: string;
  iconUrl: string;
}

export type RarityGroup = "odd" | "veryOdd";
export type PetColour = "blue" | "yellow" | "grey";

export interface PetCounts {
  odd: number;
  veryOdd: number;
  byType: {
    odd: Record<PetColour, number>;
    veryOdd: Record<PetColour, number>;
  };
}

export interface LeaderboardEntry {
  address: string;
  counts: PetCounts;
}
