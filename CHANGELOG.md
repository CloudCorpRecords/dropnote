# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `drop` MCP tool and `dropnote drop
  '<json>'` CLI command that drop a short text fragment
  into the noglow desktop scratchpad's target slot via
  the local noglow app.
- Pinned mechanism: the text (at most 1500 characters)
  is written byte-for-byte as UTF-8 to a uniquely-named
  temp file (`noglow-drop-<unique>.txt` in the OS temp
  directory) and the binary is spawned with argv
  `["--drop-file", "<temp file path>"]` — the text
  itself never appears on argv. The spawn is
  fire-and-forget and the temp file is left for the app
  to read and delete.
- Binary resolution: `NOGLOW_BIN` when set and
  non-empty, otherwise the macOS app-bundle path or
  the Windows `%LOCALAPPDATA%` path; on Linux the bare
  name `noglow` resolved via PATH.
- Pinned success JSON `{dropped, characters, tempFile,
  binary}` in that key order, and pinned error strings
  for a missing, empty, or over-long `text`, a failed
  temp-file write, and a failed launch.
