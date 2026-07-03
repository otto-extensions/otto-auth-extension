import type { AuthLoginInput, AuthProvider, AuthSession, AuthToken, AuthUser } from "./provider-loader.js";

interface GoogleProviderConfig {
  clientId?: string;
  issuer?: string;
  defaultEmail?: string;
  defaultName?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createUser(input: AuthLoginInput, config: GoogleProviderConfig): AuthUser {
  const email = typeof input.email === "string" ? input.email : config.defaultEmail ?? "user@google.example";
  const name = typeof input.name === "string" ? input.name : config.defaultName ?? "Google User";

  return {
    id: email,
    name,
    email,
    providerId: "google",
    claims: {
      ...input,
      issuer: config.issuer ?? "https://accounts.google.com"
    }
  };
}

function createToken(user: AuthUser, config: GoogleProviderConfig): AuthToken {
  return {
    value: `google.${Buffer.from(`${user.id}:${config.clientId ?? "local"}`, "utf8").toString("base64url")}`,
    providerId: "google",
    issuedAt: nowIso(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  };
}

export function createGoogleProvider(config: GoogleProviderConfig = {}): AuthProvider {
  let session: AuthSession = {
    providerId: "google",
    status: "logged-out",
    user: null,
    token: null
  };

  return {
    id: "google",
    name: "Google OAuth",
    kind: "google",
    async login(input: AuthLoginInput = {}): Promise<AuthSession> {
      const user = createUser(input, config);
      session = {
        providerId: "google",
        status: "authenticated",
        user,
        token: createToken(user, config)
      };
      return session;
    },
    async logout(): Promise<AuthSession> {
      session = {
        providerId: "google",
        status: "logged-out",
        user: null,
        token: null
      };
      return session;
    },
    async refresh(): Promise<AuthSession> {
      if (!session.user) {
        return session;
      }

      session = {
        ...session,
        status: "authenticated",
        token: createToken(session.user, config)
      };
      return session;
    },
    async getUser(): Promise<AuthUser | null> {
      return session.user;
    },
    async getToken(): Promise<AuthToken | null> {
      return session.token;
    }
  };
}