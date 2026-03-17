const fs = require('fs');
const files = ['blueEggData','greenEggData','greyEggData'];
for (const f of files) {
  const a = JSON.parse(fs.readFileSync(`data/${f}.json`, 'utf8'));
  const pools = [...new Set(a.map(x => x.pool))];
  console.log(f, 'entries', a.length, 'pools', pools);
}
