import test from "node:test";
import assert from "node:assert/strict";

import { createJwtProvider } from "../src/jwt-provider.js";

test("JWT provider logs in, refreshes, and clears state", async () => {
  const provider = createJwtProvider({ defaultSubject: "otto-local" });

  const loggedIn = await provider.login({ sub: "alice", email: "alice@example.com", name: "Alice" });
  assert.equal(loggedIn.status, "authenticated");
  assert.equal(loggedIn.user?.id, "alice");
  assert.match(loggedIn.token?.value ?? "", /^jwt\./);

  const refreshed = await provider.refresh();
  assert.equal(refreshed.status, "authenticated");
  assert.equal(refreshed.user?.email, "alice@example.com");

  const token = await provider.getToken();
  assert.match(token?.value ?? "", /^jwt\./);

  const loggedOut = await provider.logout();
  assert.equal(loggedOut.status, "logged-out");
  assert.equal(await provider.getUser(), null);
  assert.equal(await provider.getToken(), null);
});