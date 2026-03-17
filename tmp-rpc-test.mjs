import { JsonRpcProvider, Contract } from 'ethers';
const RPC='https://subnets.avax.network/defi-kingdoms/dfk-chain/rpc';
const addr='0x1990F87d6BC9D9385917E3EDa0A7674411C3Cd7F';
const abi=['function getPetV2(uint256) view returns (tuple(uint256 id, uint8 originId, string name, uint8 season, uint8 eggType, uint8 rarity, uint8 element, uint8 bonusCount, uint8 profBonus, uint8 profBonusScalar, uint8 craftBonus, uint8 craftBonusScalar, uint8 combatBonus, uint8 combatBonusScalar, uint16 appearance, uint8 background, uint8 shiny, uint64 hungryAt, uint64 equippableAt, uint256 equippedTo, address fedBy, uint8 foodType))'];
const provider=new JsonRpcProvider(RPC);
const c=new Contract(addr,abi,provider);
const id=1000000061389n;
try{
  const pet=await c.getPetV2(id);
  console.log('ok');
  console.log('name=',pet.name);
}catch(e){
  console.error('ERR');
  console.error(e);
}
