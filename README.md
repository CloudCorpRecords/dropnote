# dropnote

Sometimes you just need a fragment of text to land in a
scratchpad — a line you copied out of a terminal, a
half-formed thought, a snippet you do not want to lose
while you switch windows. dropnote performs that one
small hand-off: it takes a short plaintext fragment and
drops it into the noglow desktop scratchpad's target
slot (the slot is chosen in the app's own settings) by
launching the local noglow app.

The text never travels as a command-line string.
dropnote writes it, byte-for-byte as UTF-8, to a
uniquely-named temporary file
(`noglow-drop-<unique>.txt` in the OS temp directory)
and spawns the app with a single argument,
`--drop-file <path>`. Because only the path sits on
argv, newlines, quotes, `$` and backticks all survive
exactly as written, and the fragment itself stays out
of the process list. The spawn is fire-and-forget:
dropnote reports success as soon as the app process has
been launched, and it leaves the temp file in place —
the app reads it and deletes it.

Fragments are capped at 1500 characters. A missing or
non-string `text`, an empty fragment, and an over-long
fragment are all errors with fixed messages, as are a
temp file that cannot be written and a binary that
cannot be launched.

Which binary gets launched is resolved in a fixed
order: the `NOGLOW_BIN` environment variable when it
is set and non-empty, otherwise the platform default —
`/Applications/noglow.app/Contents/MacOS/noglow` on
macOS and `%LOCALAPPDATA%\noglow\noglow.exe` on
Windows. On Linux the bare name `noglow` is used and
resolved through `PATH`. The noglow desktop app must
be installed for a drop to work; without it, the launch
error names the path that was tried and points at
`NOGLOW_BIN`.

On success a drop reports `dropped` (true),
`characters` (the fragment's length), `tempFile` (the
temp file's path), and `binary` (the resolved binary
that was spawned), in that order.

## CLI

```bash
npx @reneturcios/dropnote drop '{"text":"a fragment to keep"}'
npx @reneturcios/dropnote --version
```

The `drop` command takes the full arguments object as
one JSON string and prints the result as JSON:

```json
{
  "dropped": true,
  "characters": 18,
  "tempFile": "/tmp/noglow-drop-3f2a1c9e-4b7d-8e5a-9c0d-1a2b3c4d5e6f.txt",
  "binary": "noglow"
}
```

Exit codes: `0` on success, `1` on a runtime error
(including an unparseable JSON argument or a failed
drop), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/dropnote mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "dropnote": {
      "command": "npx",
      "args": ["-y", "@reneturcios/dropnote", "mcp"]
    }
  }
}
```

### Tools

- `drop` — Drop a short text fragment (up to 1500
  characters) into the noglow scratchpad's target slot
  via the local noglow app. Fires only on an explicit
  user request.
  - `text` (string, required) — the fragment to drop;
    newlines and formatting are preserved

  Returns `{dropped, characters, tempFile, binary}`.
  Errors are returned as error results carrying one of
  the fixed messages: `text is required`, `text must
  not be empty`, `text exceeds the 1500-character limit
  (got N)`, `failed to write drop file: <message>`, or
  `failed to launch noglow binary at <path>: <message>
  (set NOGLOW_BIN to override the binary path)`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/dropnote
docker run --rm ghcr.io/cloudcorprecords/dropnote drop '{"text":"a fragment to keep"}'
```

Note that a containerised drop launches a noglow
binary inside the container; point `NOGLOW_BIN` at a
binary available there, or prefer the local install.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (fake executor plus a stand-in script; no real app)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
