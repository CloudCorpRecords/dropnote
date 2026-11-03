#!/usr/bin/env node
/**
 * dropnote CLI.
 *
 *   dropnote drop '<json>'
 *   dropnote mcp
 *   dropnote --version
 *
 * The drop argument is the full arguments object as one
 * JSON string: {"text": "..."}. The drop spawns the local
 * noglow app with the text written to a temp file.
 * Exit codes: 0 success, 1 runtime error (including an
 * unparseable JSON argument or a failed drop), 2 usage
 * error.
 */
import { dropText, formatPayload, VERSION } from "./drop.js";

function usage(): never {
  console.error(`Usage:
  dropnote drop '<json>'
  dropnote mcp
  dropnote --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (cmd !== "drop") usage();
  if (rest.length !== 1) usage();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rest[0]);
  } catch (err) {
    console.error(
      `error: cannot parse JSON argument: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  try {
    const out = await dropText(parsed);
    console.log(formatPayload(out));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
