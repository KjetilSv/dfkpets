#!/usr/bin/env node
import { readFileSync } from "fs";
import { getCountsByOwner, buildLeaderboard } from "./leaderboard.js";

const [, , command, arg] = process.argv;

function printCounts(address: string, c: Awaited<ReturnType<typeof getCountsByOwner>>) {
  console.log(`\n📍 ${address}`);
  console.log(`  Odd pets     : ${c.odd}`);
  console.log(`    └ blue ${c.byType.odd.blue}  yellow ${c.byType.odd.yellow}  grey ${c.byType.odd.grey}`);
  console.log(`  Very Odd pets: ${c.veryOdd}`);
  console.log(`    └ blue ${c.byType.veryOdd.blue}  yellow ${c.byType.veryOdd.yellow}  grey ${c.byType.veryOdd.grey}`);
}

async function main() {
  if (command === "owner") {
    if (!arg) {
      console.error("Usage: npx tsx src/cli.ts owner <0xAddress>");
      process.exit(1);
    }
    const counts = await getCountsByOwner(arg);
    printCounts(arg, counts);
    return;
  }

  if (command === "leaderboard") {
    if (!arg) {
      console.error("Usage: npx tsx src/cli.ts leaderboard <addresses.txt>");
      process.exit(1);
    }
    const addresses = readFileSync(arg, "utf-8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^0x[0-9a-fA-F]{40}$/.test(l));

    if (!addresses.length) {
      console.error("No valid 0x addresses found in file.");
      process.exit(1);
    }

    console.log(`\nFetching pets for ${addresses.length} address(es)…`);
    const board = await buildLeaderboard(addresses);

    console.log("\n🏆 DFK Pet Leaderboard\n");
    console.log(`Rank  Address                                    VeryOdd  Odd`);
    console.log(`----  -----------------------------------------  -------  ---`);
    board.forEach((e, i) => {
      console.log(
        `${String(i + 1).padStart(4)}  ${e.address.padEnd(43)}  ${String(e.counts.veryOdd).padStart(7)}  ${e.counts.odd}`
      );
    });
    return;
  }

  console.error("Commands: owner <0xAddress>  |  leaderboard <file.txt>");
  process.exit(1);
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
