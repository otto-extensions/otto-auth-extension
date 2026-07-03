import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createAuthCore } from "../src/auth-core.js";
import { loadAuthProviders } from "../src/provider-loader.js";

test("loadAuthProviders dynamically loads only payload-selected providers", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "otto-auth-load-"));

  try {
    const manifestsDir = path.join(tempRoot, "manifests");
    await mkdir(manifestsDir, { recursive: true });

    await writeFile(
      path.join(manifestsDir, "providers.json"),
      JSON.stringify(
        {
          schemaVersion: "1.0.0",
          providers: [
            { id: "jwt", name: "JWT", kind: "jwt", module: "src/jwt-provider.ts", description: "JWT" },
            { id: "google", name: "Google OAuth", kind: "google", module: "src/google-provider.ts", description: "Google" },
            { id: "apple", name: "Apple OAuth Placeholder", kind: "apple-placeholder", module: "src/apple-provider-placeholder.ts", description: "Apple", placeholder: true }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const loaded = await loadAuthProviders({
      repoRoot: tempRoot,
      payloadManifest: {
        auth: {
          providers: ["google", { id: "apple" }]
        }
      }
    });

    assert.deepEqual(loaded.selectedProviderIds, ["google", "apple"]);
    assert.deepEqual(
      loaded.providers.map((provider) => provider.id),
      ["google", "apple"]
    );
    assert.equal(loaded.warnings.length, 0);

    const core = await createAuthCore({
      repoRoot: tempRoot,
      payloadManifest: {
        auth: {
          providers: ["google"]
        }
      }
    });

    const session = await core.login(undefined, { email: "demo@example.com", name: "Demo" });
    assert.equal(session.providerId, "google");
    assert.equal(session.status, "authenticated");
    assert.equal(await core.getUser(), session.user);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});