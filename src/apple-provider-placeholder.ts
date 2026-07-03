import type { AuthLoginInput, AuthProvider, AuthSession, AuthToken, AuthUser } from "./provider-loader.js";

function placeholderSession(message: string): AuthSession {
  return {
    providerId: "apple",
    status: "placeholder",
    user: null,
    token: null,
    message
  };
}

export function createApplePlaceholderProvider(): AuthProvider {
  const message = "Apple OAuth is a placeholder in the Otto Auth Extension.";
  let session = placeholderSession(message);

  return {
    id: "apple",
    name: "Apple OAuth Placeholder",
    kind: "apple-placeholder",
    async login(_input: AuthLoginInput = {}): Promise<AuthSession> {
      session = placeholderSession(message);
      return session;
    },
    async logout(): Promise<AuthSession> {
      session = placeholderSession(message);
      return session;
    },
    async refresh(): Promise<AuthSession> {
      return session;
    },
    async getUser(): Promise<AuthUser | null> {
      return null;
    },
    async getToken(): Promise<AuthToken | null> {
      return null;
    }
  };
}