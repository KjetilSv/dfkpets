const fs = require('fs');
const files = ['blueEggData','greenEggData','greyEggData'];
const odd = new Set();
const ultra = new Set();
for (const f of files) {
  const a = JSON.parse(fs.readFileSync(`data/${f}.json`, 'utf8'));
  for (const e of a) {
    if (e.pool === 'Odd') odd.add(e.appearanceId);
    if (e.pool === 'Ultra Odd') ultra.add(e.appearanceId);
  }
}
console.log('unique odd', odd.size, 'unique ultra', ultra.size);
