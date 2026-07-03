import type { AuthLoginInput, AuthProvider, AuthSession, AuthToken, AuthUser } from "./provider-loader.js";

interface JwtProviderConfig {
  issuer?: string;
  audience?: string;
  secret?: string;
  defaultSubject?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createUser(providerId: string, input: AuthLoginInput, defaultSubject: string): AuthUser {
  const subject = typeof input.sub === "string" ? input.sub : defaultSubject;
  const name = typeof input.name === "string" ? input.name : subject;
  const email = typeof input.email === "string" ? input.email : undefined;

  return {
    id: subject,
    name,
    email,
    providerId,
    claims: {
      ...input,
      provider: providerId
    }
  };
}

function createToken(providerId: string, subject: string, config: JwtProviderConfig): AuthToken {
  const tokenSeed = [providerId, config.issuer ?? "otto-local", config.audience ?? "default", subject].join(":");

  return {
    value: `jwt.${Buffer.from(tokenSeed, "utf8").toString("base64url")}`,
    providerId,
    issuedAt: nowIso()
  };
}

export function createJwtProvider(config: JwtProviderConfig = {}): AuthProvider {
  let session: AuthSession = {
    providerId: "jwt",
    status: "logged-out",
    user: null,
    token: null
  };

  return {
    id: "jwt",
    name: "JWT",
    kind: "jwt",
    async login(input: AuthLoginInput = {}): Promise<AuthSession> {
      const user = createUser("jwt", input, config.defaultSubject ?? "local-user");
      const token = createToken("jwt", user.id, config);
      session = {
        providerId: "jwt",
        status: "authenticated",
        user,
        token
      };
      return session;
    },
    async logout(): Promise<AuthSession> {
      session = {
        providerId: "jwt",
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
        token: createToken("jwt", session.user.id, config)
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