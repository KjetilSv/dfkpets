import { JsonRpcProvider, Contract } from 'ethers';
const RPC=process.env.DFK_RPC_URL ?? 'https://subnets.avax.network/defi-kingdoms/dfk-chain/rpc';
const addr=process.env.PETCORE_ADDRESS ?? '0x1990F87d6BC9D9385917E3EDa0A7674411C3Cd7F';
const abi=['function getPetV2(uint256 _id) view returns (tuple(uint256 id, uint8 originId, string name, uint8 season, uint8 eggType, uint8 rarity, uint8 element, uint8 bonusCount, uint8 profBonus, uint8 profBonusScalar, uint8 craftBonus, uint8 craftBonusScalar, uint8 combatBonus, uint8 combatBonusScalar, uint16 appearance, uint8 background, uint8 shiny, uint64 hungryAt, uint64 equippableAt, uint256 equippedTo, address fedBy, uint8 foodType))'];
const provider=new JsonRpcProvider(RPC);
const c=new Contract(addr,abi,provider);

const ids = process.argv.slice(2);
for (const s of ids) {
  const id = BigInt(s);
  const p = await c.getPetV2(id);
  console.log(String(s), { eggType: Number(p.eggType), appearance: Number(p.appearance), season: Number(p.season), rarity: Number(p.rarity) });
}
