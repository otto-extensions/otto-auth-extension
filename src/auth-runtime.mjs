const sessions = new Map();

function nowIso() {
  return new Date().toISOString();
}

function normalizeProviderId(providerId) {
  if (typeof providerId !== "string") {
    return null;
  }

  const trimmed = providerId.trim().toLowerCase();
  return ["google", "microsoft", "github", "jwt"].includes(trimmed) ? trimmed : null;
}

function createDefaultUser(providerId) {
  const userId = `${providerId}-local-user`;
  return {
    id: userId,
    name: `${providerId[0].toUpperCase()}${providerId.slice(1)} User`,
    email: `${providerId}-user@local.otto`,
    providerId,
    claims: {
      provider: providerId,
      source: "bootstrap-session"
    }
  };
}

function createDefaultToken(providerId) {
  const issuedAt = nowIso();
  return {
    value: `${providerId}.local-session.${Buffer.from(`${providerId}:${issuedAt}`, "utf8").toString("base64url")}`,
    providerId,
    issuedAt,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  };
}

function cloneSession(providerId, user, token, status = "authenticated") {
  return {
    providerId,
    status,
    user,
    token,
    message: status === "authenticated" ? `Session active for ${providerId}.` : "No active auth session."
  };
}

function ensureSession(providerId) {
  const existing = sessions.get(providerId);
  if (existing && existing.user && existing.token) {
    return existing;
  }

  const user = createDefaultUser(providerId);
  const token = createDefaultToken(providerId);
  const session = cloneSession(providerId, user, token, "authenticated");
  sessions.set(providerId, session);
  return session;
}

export async function executeAuthCommand(commandName, input = {}) {
  const providerId = normalizeProviderId(input?.providerId);

  switch (commandName) {
    case "auth.get.token": {
      if (!providerId) {
        return null;
      }
      const session = ensureSession(providerId);
      return session.token;
    }
    case "auth.get.user": {
      if (!providerId) {
        return null;
      }
      const session = ensureSession(providerId);
      return session.user;
    }
    case "auth.refresh": {
      if (!providerId) {
        return {
          providerId: null,
          status: "idle",
          user: null,
          token: null,
          message: "No provider selected."
        };
      }

      const existing = ensureSession(providerId);
      const refreshedToken = {
        ...existing.token,
        issuedAt: nowIso(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      };
      const refreshed = cloneSession(providerId, existing.user, refreshedToken, "authenticated");
      sessions.set(providerId, refreshed);
      return refreshed;
    }
    default:
      throw new Error(`Unknown auth command: ${commandName}`);
  }
}
