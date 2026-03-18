import fs from 'node:fs/promises';
import path from 'node:path';

const SUBGRAPH = 'https://api.defikingdoms.com/graphql';
const OUT_DIR = path.resolve('public', 'type-icons');

// Load local appearance tables
const blue = JSON.parse(await fs.readFile('data/blueEggData.json', 'utf8'));
const green = JSON.parse(await fs.readFile('data/greenEggData.json', 'utf8'));
const grey = JSON.parse(await fs.readFile('data/greyEggData.json', 'utf8'));
const tables = [blue, green, grey];

const appearanceIds = [...new Set(
  tables.flatMap(t => t
    .filter(e => e.pool === 'Odd' || e.pool === 'Ultra Odd')
    .map(e => Number(e.appearanceId))
  )
)].sort((a,b)=>a-b);

console.log('appearanceIds', appearanceIds.length);

async function gql(query, variables) {
  const res = await fetch(SUBGRAPH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error('GraphQL HTTP ' + res.status);
  const json = await res.json();
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const SAMPLE_QUERY = `
  query($appearanceIds: [Int!]!) {
    pets(first: 1000, where: { appearance_in: $appearanceIds }) {
      id
      appearance
    }
  }
`;

const SINGLE_QUERY = `
  query($appearance: Int!) {
    pets(first: 1, where: { appearance: $appearance }) {
      id
      appearance
    }
  }
`;

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Download HTTP ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

await fs.mkdir(OUT_DIR, { recursive: true });

// Fetch samples in chunks (fast path)
const sample = new Map();
const CHUNK = 80;
for (let i=0; i<appearanceIds.length; i+=CHUNK) {
  const chunk = appearanceIds.slice(i, i+CHUNK);
  const data = await gql(SAMPLE_QUERY, { appearanceIds: chunk });
  for (const p of data.pets || []) {
    const app = Number(p.appearance);
    if (!sample.has(app)) sample.set(app, p.id);
  }
}

// Retry per appearanceId for any missing (covers cases where first:1000 misses some)
for (const appId of appearanceIds) {
  if (sample.has(appId)) continue;
  const data = await gql(SINGLE_QUERY, { appearance: appId });
  const p = (data.pets || [])[0];
  if (p?.id) sample.set(appId, p.id);
}

let ok = 0, missing = 0, skipped = 0;
for (const appId of appearanceIds) {
  const petId = sample.get(appId);
  if (!petId) {
    missing++;
    continue;
  }
  const out = path.join(OUT_DIR, `${appId}.png`);
  try {
    await fs.access(out);
    skipped++;
    continue;
  } catch {}

  const url = `https://pets.defikingdoms.com/image/${petId}`;
  const buf = await download(url);
  await fs.writeFile(out, buf);
  ok++;
}

console.log(JSON.stringify({ downloaded: ok, skipped, missing }));
