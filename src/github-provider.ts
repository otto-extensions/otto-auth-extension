import type { AuthLoginInput, AuthProvider, AuthSession, AuthToken, AuthUser } from "./provider-loader.js";

interface GithubProviderConfig {
  organization?: string;
  defaultEmail?: string;
  defaultName?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createUser(input: AuthLoginInput, config: GithubProviderConfig): AuthUser {
  const email = typeof input.email === "string" ? input.email : config.defaultEmail ?? "user@github.example";
  const name = typeof input.name === "string" ? input.name : config.defaultName ?? "GitHub User";

  return {
    id: email,
    name,
    email,
    providerId: "github",
    claims: {
      ...input,
      organization: config.organization ?? "otto"
    }
  };
}

function createToken(user: AuthUser, config: GithubProviderConfig): AuthToken {
  return {
    value: `github.${Buffer.from(`${user.id}:${config.organization ?? "otto"}`, "utf8").toString("base64url")}`,
    providerId: "github",
    issuedAt: nowIso(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  };
}

export function createGithubProvider(config: GithubProviderConfig = {}): AuthProvider {
  let session: AuthSession = {
    providerId: "github",
    status: "logged-out",
    user: null,
    token: null
  };

  return {
    id: "github",
    name: "GitHub OAuth",
    kind: "github",
    async login(input: AuthLoginInput = {}): Promise<AuthSession> {
      const user = createUser(input, config);
      session = {
        providerId: "github",
        status: "authenticated",
        user,
        token: createToken(user, config)
      };
      return session;
    },
    async logout(): Promise<AuthSession> {
      session = {
        providerId: "github",
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