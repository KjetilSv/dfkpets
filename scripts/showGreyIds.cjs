const fs = require('fs');
const grey = JSON.parse(fs.readFileSync('data/greyEggData.json','utf8'));
const ids = new Set([35,66]);
console.log(grey.filter(e => ids.has(e.appearanceId)));
