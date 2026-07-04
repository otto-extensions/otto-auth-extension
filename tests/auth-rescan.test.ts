import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { executeAuthRescanCommand, rescanAuth } from "../src/auth-rescan.js";

test("rescanAuth persists auth metadata for manual and automatic command execution", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "otto-auth-rescan-"));

  try {
    const manifestsDir = path.join(tempRoot, "manifests");
    const memPalaceDir = path.join(tempRoot, "mempalace");
    await mkdir(manifestsDir, { recursive: true });
    await mkdir(memPalaceDir, { recursive: true });

    await writeFile(
      path.join(manifestsDir, "providers.json"),
      JSON.stringify(
        {
          schemaVersion: "1.0.0",
          providers: [
            { id: "jwt", name: "JWT", kind: "jwt", module: "src/jwt-provider.ts", description: "JWT" }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await rescanAuth({
      repoRoot: tempRoot,
      memPalaceRoot: memPalaceDir,
      payloadManifest: {
        auth: {
          providers: ["jwt"]
        }
      },
      trigger: "automatic",
      source: "OttoUpdateAgent"
    });

    assert.equal(result.providers.length, 1);

    const index = JSON.parse(await readFile(path.join(memPalaceDir, "auth-provider-index.json"), "utf8")) as {
      selectedProviderIds: string[];
      loadedProviders: Array<{ id: string }>;
    };
    assert.deepEqual(index.selectedProviderIds, ["jwt"]);
    assert.deepEqual(index.loadedProviders.map((provider) => provider.id), ["jwt"]);

    const history = JSON.parse(await readFile(path.join(memPalaceDir, "auth-generation-history.json"), "utf8")) as Array<{ snapshot: { selectedProviderIds: string[] } }>;
    assert.equal(history.length, 1);
    assert.deepEqual(history[0]?.snapshot.selectedProviderIds, ["jwt"]);

    const parsed = await executeAuthRescanCommand({
      repoRoot: tempRoot,
      memPalaceRoot: memPalaceDir,
      payloadManifest: {
        auth: {
          providers: ["jwt"]
        }
      },
      trigger: "manual",
      source: "user"
    });

    assert.equal(parsed.providers.length, 1);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});