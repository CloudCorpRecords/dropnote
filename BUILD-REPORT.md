# dropnote — Build Report

MCP Rebuild 1000, Batch 20. Rebuild of `noglow-mcp`
(npm registry record `app.devglow/noglow`, version
0.2.1), built from the firsthand spec in
`~/workspace/mcp-rebuild-100/specs-batch20/dropnote.md`
(read first; the spec was pinned from the npm registry
README, coordinator-read 2026-10-27 — GitHub read route
degraded, Batch 20 harvest-2 source). Local build
only — nothing pushed or published.

Identity: repo `dropnote`, npm `@reneturcios/dropnote`,
MCP name `io.github.CloudCorpRecords/dropnote`, version
`0.1.0`, bin `dropnote` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Drop a
  short text fragment into the noglow desktop
  scratchpad's target slot via the local app." — 94
  chars, verified by count; npm entry carries
  `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/dropnote:0.1.0` carries
  **no** `version` field), `Dockerfile` (node:20-alpine
  two-stage, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/dropnote"`),
  `tsconfig.json` (byte-identical to the codescout
  reference, diff-verified), `.gitignore`, `LICENSE`
  (MIT, Copyright (c) 2026 Rene Turcios), `README.md`
  (fresh text), `CHANGELOG.md` (single 0.1.0 entry,
  2026-10-27), `package-lock.json` (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`drop '<json>'` where
  the argument is the full arguments object as one JSON
  string, `mcp`, `--version`; exit 2 usage / 1 runtime
  error), `src/mcp.ts`, `src/types.ts`, `src/drop.ts`
  (core, `VERSION = "0.1.0"`, `formatPayload`,
  `resolveBinary`, `productionExecutor`)
- `test/drop.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (ci, publish, and registry-publish byte-identical to
  the codescout reference, diff-verified for ci;
  publish-container `IMAGE =
  ghcr.io/cloudcorprecords/dropnote`, smoke-test
  server-name assertion `dropnote`)

Plus the parity fixture at
`harness/fixtures/noglow-mcp-tools-original.json`,
with its `_source` labelling it as the firsthand spec
from the npm registry README for noglow-mcp.

## Tools implemented (1)

- `drop` — argument: `text` (string, required).
  Description (exact): "Drop a short text fragment (up
  to 1500 characters) into the noglow scratchpad's
  target slot via the local noglow app. Fires only on
  an explicit user request."

  Mechanism (pinned): validate `text` (required,
  non-empty, at most 1500 characters); write it
  byte-for-byte as UTF-8 to a uniquely-named temp file
  `noglow-drop-<unique>.txt` in the OS temp directory
  (uniqueness via a random UUID suffix); spawn the
  resolved binary with argv `["--drop-file", "<temp
  file path>"]` — the path only, never the text;
  fire-and-forget (resolve on spawn success); never
  delete the temp file (the app reads and deletes it).

  Binary resolution (pinned): `NOGLOW_BIN` env var
  when set and non-empty; otherwise macOS
  `/Applications/noglow.app/Contents/MacOS/noglow` or
  Windows `%LOCALAPPDATA%\noglow\noglow.exe`; on Linux
  the bare name `noglow` resolved via PATH.

  Returns `{dropped, characters, tempFile, binary}`
  with keys in that order. Pinned errors: `text is
  required` (missing or non-string), `text must not be
  empty`, `text exceeds the 1500-character limit (got
  N)`, `failed to write drop file: <message>`, and
  `failed to launch noglow binary at <path>: <message>
  (set NOGLOW_BIN to override the binary path)`.

  The fixture literal
  (`harness/fixtures/noglow-mcp-tools-original.json`)
  and the `src/mcp.ts` literal are identical, with no
  `$schema` and no `additionalProperties` — confirmed
  by the parity run below.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server`
  (`sdk/server/index.js` + `StdioServerTransport`)
  with an explicit JSON-schema literal exactly
  matching the fixture, per the brief (no
  McpServer/zod). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  implementation.
- The spawn goes through an injectable executor
  (`DropExecutor` in `src/types.ts`); the production
  executor uses `node:child_process` `spawn` with
  `{ detached: false, stdio: "ignore" }`, resolving on
  the `spawn` event and rejecting on the `error`
  event.
- A non-object top-level arguments value is treated
  as {}, so it fails as `text is required`.

## Verification (foreground, this session)

- `npm test` (`tsx --test test/*.test.ts`): **21
  tests, 21 pass, 0 fail** — success path through a
  fake executor capturing binary/argv and the temp
  file's contents at spawn time (argv is exactly
  `["--drop-file", <path>]`; the text never appears on
  argv); pinned success shape and key order; temp-file
  contents byte-identical including newlines, double
  and single quotes, `$`, backticks, `$$`, and a tab;
  the `noglow-drop-<unique>.txt` name pattern in
  `os.tmpdir()`; unique names across concurrent drops;
  the temp file NOT deleted after a drop (existence
  and contents asserted); validation (missing /
  non-string `text` → `text is required`, empty →
  `text must not be empty`, validation before any
  spawn); the 1500-character boundary (1500 accepted
  with contents verified, 1501 rejected with the exact
  message, a 4321-char text reporting its real length);
  binary resolution (`NOGLOW_BIN` honoured, empty
  `NOGLOW_BIN` ignored, macOS / Windows / Linux
  defaults, override winning on every platform); spawn
  failure with a fake executor rejecting ENOENT
  carrying the exact pinned string; temp-file write
  failure carrying the pinned prefix with no spawn;
  PLUS one real-executor test spawning a stand-in
  executable shell script (in a temp dir, set as
  `NOGLOW_BIN`) that records its argv to a file —
  the recorded argv is exactly `--drop-file` and the
  result's temp path, and the temp file's contents
  match the dropped text.
- `npx tsc --noEmit` → exit 0; `npm run build`
  produced `dist/` with all 15 outputs.
- `dist/cli.js --version` → `0.1.0`; unknown command
  exits 2 with usage; `drop '{"text":""}'` exits 1
  with `error: text must not be empty`; `drop
  '{"text":"cli hello"}'` with `NOGLOW_BIN` pointed at
  a stand-in script exits 0, prints the pinned JSON
  (`characters: 9`), and the script recorded argv
  `--drop-file` + the temp path.
- Parity: `harness/parity.py` vs
  `harness/fixtures/noglow-mcp-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1** (run
  with the rebuild path as an absolute path; the
  harness does not expand a `~` inside the quoted
  stdio command string). Report saved under
  `parity-out/`.

## Lockfile status

`package-lock.json` generated clean via Route 3 only
(temp dir holding `package.json` alone, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/dropnote`, **128 package entries**. The
subsequent offline `npm install --ignore-scripts
--offline`, build, tests, and parity all ran against
this lockfile's tree. No symlink fallback was needed.

## Gaps / honest notes

- Requires the noglow desktop app at runtime; without
  it the tool errors honestly with the pinned
  launch-failure string. No live drop was performed in
  this environment (no app, no binary) — behaviour is
  proven against the fake executor and a stand-in
  executable script in tests.
- Linux binary resolution (bare `noglow` via PATH) is
  a documented local choice: the original README
  documents macOS and Windows defaults only.
- The temp-file unique suffix uses a random UUID
  (`noglow-drop-<uuid>.txt`), satisfying the spec's
  "equivalent unique name" allowance for the
  `noglow-drop-<random suffix>.txt` pattern.
- The empty-text error (`text must not be empty`) is
  the spec's documented local choice; the README pins
  only the 1500-character cap.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build
  only.

## Deviations

- None from the brief. All files were written under
  `/home/hatch/workspace/mcp-rebuild-100/builds/dropnote/`
  (the session's `~/workspace` resolves there); no
  files were written outside the build dir except the
  Route-3 lockfile scratch dir under `/tmp` and the
  parity fixture at
  `harness/fixtures/noglow-mcp-tools-original.json`,
  both as briefed.
