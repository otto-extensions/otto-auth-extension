import type { AuthLoginInput, AuthProvider, AuthSession, AuthToken, AuthUser } from "./provider-loader.js";

interface MicrosoftProviderConfig {
  tenantId?: string;
  issuer?: string;
  defaultEmail?: string;
  defaultName?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createUser(input: AuthLoginInput, config: MicrosoftProviderConfig): AuthUser {
  const email = typeof input.email === "string" ? input.email : config.defaultEmail ?? "user@microsoft.example";
  const name = typeof input.name === "string" ? input.name : config.defaultName ?? "Microsoft User";

  return {
    id: email,
    name,
    email,
    providerId: "microsoft",
    claims: {
      ...input,
      tenantId: config.tenantId ?? "common",
      issuer: config.issuer ?? "https://login.microsoftonline.com"
    }
  };
}

function createToken(user: AuthUser, config: MicrosoftProviderConfig): AuthToken {
  return {
    value: `microsoft.${Buffer.from(`${user.id}:${config.tenantId ?? "common"}`, "utf8").toString("base64url")}`,
    providerId: "microsoft",
    issuedAt: nowIso(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  };
}

export function createMicrosoftProvider(config: MicrosoftProviderConfig = {}): AuthProvider {
  let session: AuthSession = {
    providerId: "microsoft",
    status: "logged-out",
    user: null,
    token: null
  };

  return {
    id: "microsoft",
    name: "Microsoft OAuth",
    kind: "microsoft",
    async login(input: AuthLoginInput = {}): Promise<AuthSession> {
      const user = createUser(input, config);
      session = {
        providerId: "microsoft",
        status: "authenticated",
        user,
        token: createToken(user, config)
      };
      return session;
    },
    async logout(): Promise<AuthSession> {
      session = {
        providerId: "microsoft",
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