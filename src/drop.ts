/**
 * dropnote core: drop a short text fragment into the
 * noglow desktop scratchpad's target slot via the local
 * noglow app.
 *
 *   dropText(args, options?) -> { dropped, characters,
 *                                 tempFile, binary }
 *
 * Mechanism (pinned):
 *
 *   1. Validate `text`: required, a string, non-empty,
 *      and at most 1500 characters (JavaScript string
 *      length).
 *   2. Write the text, byte-for-byte (UTF-8), to a
 *      uniquely-named temp file in the OS temp
 *      directory: `noglow-drop-<unique>.txt`.
 *   3. Spawn the noglow binary with arguments
 *      ["--drop-file", "<temp file path>"] — the path
 *      is the only thing on argv; the text never is.
 *   4. The spawn is fire-and-forget: the drop resolves
 *      once the process has been spawned successfully;
 *      it does not wait for the app to exit. The temp
 *      file is NOT deleted here: the app reads and
 *      deletes it.
 *
 * Binary resolution (pinned): the `NOGLOW_BIN` env var
 * when set and non-empty; otherwise platform defaults —
 * macOS `/Applications/noglow.app/Contents/MacOS/noglow`,
 * Windows `%LOCALAPPDATA%\noglow\noglow.exe`. On Linux
 * (the original README is silent) the documented local
 * choice is the bare name `noglow`, resolved via PATH.
 *
 * The production executor uses node:child_process
 * `spawn` with `{ detached: false, stdio: "ignore" }`
 * and resolves on the `spawn` event, rejecting on the
 * `error` event.
 *
 * Errors (pinned strings):
 *   - text missing or not a string: `text is required`
 *   - text empty: `text must not be empty`
 *   - over the cap:
 *     `text exceeds the 1500-character limit (got N)`
 *   - temp-file write failure:
 *     `failed to write drop file: <system message>`
 *   - spawn failure:
 *     `failed to launch noglow binary at <path>: <system
 *      message> (set NOGLOW_BIN to override the binary
 *      path)`
 *
 * A non-object top-level argument is treated as {}.
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DropExecutor, DropOptions, DropResult } from "./types.js";

export const VERSION = "0.1.0";

/** Maximum text length, in characters (pinned). */
export const MAX_TEXT_LENGTH = 1500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Resolve the noglow binary path for one drop. */
export function resolveBinary(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  const override = env.NOGLOW_BIN;
  if (typeof override === "string" && override.length > 0) return override;
  if (platform === "darwin") {
    return "/Applications/noglow.app/Contents/MacOS/noglow";
  }
  if (platform === "win32") {
    return join(env.LOCALAPPDATA ?? "", "noglow", "noglow.exe");
  }
  return "noglow";
}

/**
 * Production executor: spawn via node:child_process,
 * stdio ignored, resolving on the `spawn` event and
 * rejecting on the `error` event (fire-and-forget).
 */
export const productionExecutor: DropExecutor = (binary, args) =>
  new Promise<void>((resolve, reject) => {
    let child;
    try {
      child = spawn(binary, args, { detached: false, stdio: "ignore" });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    child.once("spawn", () => resolve());
    child.once("error", (err) => reject(err));
  });

/** Drop a text fragment into the noglow scratchpad. */
export async function dropText(
  args: unknown,
  options: DropOptions = {},
): Promise<DropResult> {
  const raw: Record<string, unknown> = isRecord(args) ? args : {};

  if (typeof raw.text !== "string") throw new Error("text is required");
  const text = raw.text;
  if (text.length === 0) throw new Error("text must not be empty");
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(
      `text exceeds the 1500-character limit (got ${text.length})`,
    );
  }

  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const binary = resolveBinary(env, platform);
  const dir = options.tmpDir ?? tmpdir();
  const tempFile = join(dir, `noglow-drop-${randomUUID()}.txt`);

  try {
    await writeFile(tempFile, text, "utf8");
  } catch (err) {
    throw new Error(`failed to write drop file: ${errMessage(err)}`);
  }

  const executor = options.executor ?? productionExecutor;
  try {
    await executor(binary, ["--drop-file", tempFile]);
  } catch (err) {
    throw new Error(
      `failed to launch noglow binary at ${binary}: ${errMessage(err)} ` +
        `(set NOGLOW_BIN to override the binary path)`,
    );
  }

  return {
    dropped: true,
    characters: text.length,
    tempFile,
    binary,
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
