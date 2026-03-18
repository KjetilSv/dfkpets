const fs = require('fs');
const blue = JSON.parse(fs.readFileSync('data/blueEggData.json', 'utf8'));
const grey = JSON.parse(fs.readFileSync('data/greyEggData.json', 'utf8'));

function find(arr) {
  return arr.filter(e => (e.displayName || '').toLowerCase() === 'blub' && (e.variant || '').toLowerCase() === 'violet');
}

const b = find(blue);
const g = find(grey);

console.log('blue matches', b.length);
console.log(b.map(x => ({ appearanceId: x.appearanceId, season: x.season, pool: x.pool, path: x.path })));
console.log('grey matches', g.length);
console.log(g.map(x => ({ appearanceId: x.appearanceId, season: x.season, pool: x.pool, path: x.path })));
