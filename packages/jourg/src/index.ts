#!/usr/bin/env node

const [, , command, ...args] = process.argv;

function main() {
  if (!command || command === "help") {
    console.log("jourg - your CLI tool");
    console.log("");
    console.log("Usage: jourg <command> [options]");
    console.log("");
    console.log("Commands:");
    console.log("  help    Show this help message");
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

main();
