# DFK Pet Leaderboard

Track **Odd** and **Very Odd** (Ultra Odd) DeFi Kingdoms pets on DFK Chain.

## Setup

```bash
npm install
```

Set your subgraph URL (required):

```bash
# Windows PowerShell
$env:SUBGRAPH_URL = "https://api.thegraph.com/subgraphs/name/defikingdoms/pets-dfkchain"

# or .env file (not loaded automatically — export manually or use dotenv)
```

## Usage

### Check one address

```bash
npx tsx src/cli.ts owner 0xYourAddressHere
```

Output:
```
📍 0x...
  Odd pets     : 3
    └ blue 1  yellow 1  grey 1
  Very Odd pets: 1
    └ blue 0  yellow 1  grey 0
```

### Leaderboard for multiple addresses

Create a file `addresses.txt` (one address per line):
```
0xAbc...
0xDef...
```

```bash
npx tsx src/cli.ts leaderboard addresses.txt
```

## How it works

- **Rarity group** is determined by the `pool` field:
  - `pool = 1` → **Odd**
  - `pool = 2` → **Very Odd** (Ultra Odd)

- **Type / colour** is determined by the `background` field:
  - `background = 1` → blue
  - `background = 2` → yellow
  - `background = 3` → grey

- Pagination uses `id_gt` cursor to get all pets past the 1000-item subgraph limit.

## Example GraphQL query

To explore odd/very-odd pets on a specific background directly:

```graphql
{
  pets(
    orderBy: salePrice
    where: {
      eggType: 0
      appearance_in: [19, 60, 61, 62, 63, 88, 101, 126]
      background: 3
    }
  ) {
    id
    salePrice
    rarity
    appearance
    pool
    owner {
      name
    }
  }
}
```

`pool = 1` = Odd, `pool = 2` = Very Odd.

## Config

Edit `src/config.ts` to adjust:
- `SUBGRAPH_URL` default
- `POOL_GROUP` mapping
- `BACKGROUND_TYPE` colour mapping
- `ODD_APPEARANCES` list
