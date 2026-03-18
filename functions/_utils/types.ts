export type RarityGroup = "odd" | "veryOdd";

export interface RawPet {
  id: string;
  pool: string | number;
  name?: string;
  eggType?: string | number;
  appearance?: string | number;
  background?: string | number;
  owner?: { id: string; name?: string };
}

export interface PetLite {
  id: string;
  name: string;
  iconUrl: string;
}

export interface LeaderboardEntry {
  address: string;
  profileName: string | null;
  ultraOdd: number;
  odd: number;
}
