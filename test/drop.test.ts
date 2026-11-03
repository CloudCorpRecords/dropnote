import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { dropText, resolveBinary } from "../src/drop.js";
import type { DropExecutor } from "../src/types.js";

/**
 * Tests run against a fake executor that records the
 * binary, the argv, and the temp file's contents at
 * spawn time — plus one real-executor test that spawns
 * a stand-in executable shell script via NOGLOW_BIN.
 * No real noglow app is involved. The tool must never
 * delete the temp file (the app does that), and the
 * text must travel only as the file, never on argv.
 */

interface Captured {
  binary: string;
  args: string[];
  contentsAtSpawn: string;
}

function fakeExecutor(captured: Captured[]): DropExecutor {
  return async (binary, args) => {
    captured.push({
      binary,
      args: [...args],
      contentsAtSpawn: readFileSync(args[1], "utf8"),
    });
  };
}

const failingExecutor: DropExecutor = async () => {
  const err = new Error("spawn /fake/noglow ENOENT") as NodeJS.ErrnoException;
  err.code = "ENOENT";
  throw err;
};

describe("dropText — success path (fake executor)", () => {
  it("spawns the resolved binary with argv [--drop-file, <temp file>] only", async () => {
    const captured: Captured[] = [];
    const out = await dropText(
      { text: "hello scratchpad" },
      { executor: fakeExecutor(captured), env: {}, platform: "linux" },
    );
    assert.equal(captured.length, 1);
    assert.equal(captured[0].binary, "noglow");
    assert.deepEqual(captured[0].args, ["--drop-file", out.tempFile]);
    assert.equal(out.binary, "noglow");
  });

  it("the text itself never appears on argv", async () => {
    const captured: Captured[] = [];
    const secret = "do not put me on argv";
    await dropText(
      { text: secret },
      { executor: fakeExecutor(captured), env: {}, platform: "linux" },
    );
    assert.ok(!captured[0].args.join(" ").includes(secret));
    assert.equal(captured[0].args.length, 2);
  });

  it("returns the pinned success shape with keys in the pinned order", async () => {
    const out = await dropText(
      { text: "abc" },
      { executor: fakeExecutor([]), env: {}, platform: "linux" },
    );
    assert.equal(out.dropped, true);
    assert.equal(out.characters, 3);
    assert.equal(typeof out.tempFile, "string");
    assert.equal(out.binary, "noglow");
    assert.deepEqual(Object.keys(out), [
      "dropped",
      "characters",
      "tempFile",
      "binary",
    ]);
  });

  it("writes the text byte-for-byte, including newlines, quotes, $ and backticks", async () => {
    const text =
      "line one\nline \"two\" with 'quotes'\n$HOME and `whoami` and $$ \n\ttabbed end";
    const captured: Captured[] = [];
    const out = await dropText(
      { text },
      { executor: fakeExecutor(captured), env: {}, platform: "linux" },
    );
    assert.equal(captured[0].contentsAtSpawn, text);
    const onDisk = readFileSync(out.tempFile);
    assert.ok(onDisk.equals(Buffer.from(text, "utf8")));
    assert.equal(out.characters, text.length);
  });

  it("the temp file uses the noglow-drop-<unique>.txt pattern in the temp dir", async () => {
    const out = await dropText(
      { text: "pattern" },
      { executor: fakeExecutor([]), env: {}, platform: "linux" },
    );
    assert.match(basename(out.tempFile), /^noglow-drop-.+\.txt$/);
    assert.equal(dirname(out.tempFile), tmpdir());
  });

  it("temp file names are unique across concurrent drops", async () => {
    const executor = fakeExecutor([]);
    const [a, b] = await Promise.all([
      dropText({ text: "one" }, { executor, env: {}, platform: "linux" }),
      dropText({ text: "two" }, { executor, env: {}, platform: "linux" }),
    ]);
    assert.notEqual(a.tempFile, b.tempFile);
    assert.equal(readFileSync(a.tempFile, "utf8"), "one");
    assert.equal(readFileSync(b.tempFile, "utf8"), "two");
  });

  it("does NOT delete the temp file after a drop (the app deletes it)", async () => {
    const captured: Captured[] = [];
    const out = await dropText(
      { text: "still here" },
      { executor: fakeExecutor(captured), env: {}, platform: "linux" },
    );
    assert.ok(existsSync(out.tempFile));
    assert.equal(readFileSync(out.tempFile, "utf8"), "still here");
    assert.equal(captured[0].args[1], out.tempFile);
  });
});

describe("dropText — validation (pinned error strings)", () => {
  const opts = () => ({
    executor: fakeExecutor([]),
    env: {},
    platform: "linux" as const,
  });

  it("missing text is 'text is required'", async () => {
    await assert.rejects(() => dropText({}, opts()), {
      message: "text is required",
    });
    await assert.rejects(() => dropText(null, opts()), {
      message: "text is required",
    });
    await assert.rejects(() => dropText(undefined, opts()), {
      message: "text is required",
    });
  });

  it("non-string text is 'text is required'", async () => {
    for (const bad of [42, true, [], {}, null]) {
      await assert.rejects(() => dropText({ text: bad }, opts()), {
        message: "text is required",
      });
    }
  });

  it("empty text is 'text must not be empty'", async () => {
    await assert.rejects(() => dropText({ text: "" }, opts()), {
      message: "text must not be empty",
    });
  });

  it("exactly 1500 characters is accepted", async () => {
    const text = "x".repeat(1500);
    const out = await dropText({ text }, opts());
    assert.equal(out.characters, 1500);
    assert.equal(readFileSync(out.tempFile, "utf8"), text);
  });

  it("1501 characters fails with the exact pinned message", async () => {
    await assert.rejects(
      () => dropText({ text: "x".repeat(1501) }, opts()),
      { message: "text exceeds the 1500-character limit (got 1501)" },
    );
  });

  it("a much longer text reports its actual length in the message", async () => {
    await assert.rejects(
      () => dropText({ text: "y".repeat(4321) }, opts()),
      { message: "text exceeds the 1500-character limit (got 4321)" },
    );
  });

  it("validation happens before any spawn", async () => {
    const captured: Captured[] = [];
    await assert.rejects(() =>
      dropText(
        { text: "" },
        { executor: fakeExecutor(captured), env: {}, platform: "linux" },
      ),
    );
    assert.equal(captured.length, 0);
  });
});

describe("dropText — binary resolution", () => {
  it("NOGLOW_BIN override is honoured", async () => {
    const captured: Captured[] = [];
    const out = await dropText(
      { text: "override" },
      {
        executor: fakeExecutor(captured),
        env: { NOGLOW_BIN: "/custom/bin/noglow-custom" },
        platform: "linux",
      },
    );
    assert.equal(captured[0].binary, "/custom/bin/noglow-custom");
    assert.equal(out.binary, "/custom/bin/noglow-custom");
  });

  it("an empty NOGLOW_BIN is ignored and the platform default applies", async () => {
    const out = await dropText(
      { text: "fallback" },
      {
        executor: fakeExecutor([]),
        env: { NOGLOW_BIN: "" },
        platform: "linux",
      },
    );
    assert.equal(out.binary, "noglow");
  });

  it("platform defaults: macOS app bundle, Windows LOCALAPPDATA, Linux bare name", () => {
    assert.equal(
      resolveBinary({}, "darwin"),
      "/Applications/noglow.app/Contents/MacOS/noglow",
    );
    assert.equal(
      resolveBinary({ LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" }, "win32"),
      join("C:\\Users\\test\\AppData\\Local", "noglow", "noglow.exe"),
    );
    assert.equal(resolveBinary({}, "linux"), "noglow");
  });

  it("NOGLOW_BIN wins on every platform", () => {
    for (const platform of ["darwin", "win32", "linux"] as const) {
      assert.equal(
        resolveBinary({ NOGLOW_BIN: "/anywhere/noglow" }, platform),
        "/anywhere/noglow",
      );
    }
  });
});

describe("dropText — failure paths", () => {
  it("spawn failure carries the pinned error string", async () => {
    await assert.rejects(
      () =>
        dropText(
          { text: "boom" },
          {
            executor: failingExecutor,
            env: { NOGLOW_BIN: "/fake/noglow" },
            platform: "linux",
          },
        ),
      {
        message:
          "failed to launch noglow binary at /fake/noglow: " +
          "spawn /fake/noglow ENOENT " +
          "(set NOGLOW_BIN to override the binary path)",
      },
    );
  });

  it("temp-file write failure carries the pinned prefix and never spawns", async () => {
    const captured: Captured[] = [];
    const badDir = join(tmpdir(), "dropnote-no-such-dir-xyz", "nested");
    await assert.rejects(
      () =>
        dropText(
          { text: "unwritable" },
          {
            executor: fakeExecutor(captured),
            env: {},
            platform: "linux",
            tmpDir: badDir,
          },
        ),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.startsWith("failed to write drop file: "),
          `unexpected message: ${err.message}`,
        );
        return true;
      },
    );
    assert.equal(captured.length, 0);
  });
});

describe("dropText — real executor with a stand-in executable", () => {
  it("spawns the NOGLOW_BIN script, which receives --drop-file and the temp path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "dropnote-test-"));
    const record = join(dir, "argv.txt");
    const script = join(dir, "fake-noglow");
    await writeFile(
      script,
      `#!/bin/sh\nprintf '%s\\n' "$@" > '${record}'\n`,
      "utf8",
    );
    await chmod(script, 0o755);

    const text = "real spawn, with\nnewlines and $vars";
    // No executor injected: the production executor runs.
    const out = await dropText(
      { text },
      { env: { NOGLOW_BIN: script }, platform: "linux" },
    );
    assert.equal(out.binary, script);
    assert.equal(out.dropped, true);

    // Fire-and-forget: poll briefly for the script to record its argv.
    let recorded = "";
    for (let i = 0; i < 50; i++) {
      if (existsSync(record)) {
        recorded = await readFile(record, "utf8");
        if (recorded.length > 0) break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.deepEqual(recorded.trimEnd().split("\n"), [
      "--drop-file",
      out.tempFile,
    ]);
    assert.equal(readFileSync(out.tempFile, "utf8"), text);
    assert.ok(existsSync(out.tempFile));
  });
});
