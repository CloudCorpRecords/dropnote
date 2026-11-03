/**
 * dropnote types.
 *
 * dropnote drops a short plaintext fragment into the
 * noglow desktop scratchpad's target slot. For one drop
 * the caller supplies only the text; dropnote reports:
 *
 *   - whether the drop was launched (always true on a
 *     successful return — failures throw instead)
 *   - how many characters the text held
 *   - the temp file the text was written to
 *   - the noglow binary that was spawned
 *
 * The text itself travels as a file, never as an argv
 * string, so newlines, quotes, `$` and backticks survive
 * losslessly and the text stays out of `ps`. The spawn
 * goes through an injectable executor so tests can
 * substitute a fake that records the binary, the argv,
 * and the temp file's contents; the app reads and
 * deletes the temp file, so dropnote never deletes it.
 */

/** The result of one successful drop. */
export interface DropResult {
  /** Always true on success; failures throw instead. */
  dropped: boolean;
  /** Length of the dropped text, in characters. */
  characters: number;
  /** Path of the temp file the text was written to. */
  tempFile: string;
  /** Resolved noglow binary path that was spawned. */
  binary: string;
}

/**
 * Injectable process executor: spawn `binary` with
 * `args` and resolve once the process has been spawned
 * successfully (fire-and-forget — it does not wait for
 * the process to exit), rejecting when the spawn fails.
 */
export type DropExecutor = (binary: string, args: string[]) => Promise<void>;

/** Options for one drop, all optional. */
export interface DropOptions {
  /** Executor to spawn through; defaults to the real one. */
  executor?: DropExecutor;
  /** Environment to resolve the binary from; defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  /** Platform to resolve the binary for; defaults to process.platform. */
  platform?: NodeJS.Platform;
  /** Directory for the temp file; defaults to os.tmpdir(). */
  tmpDir?: string;
}
