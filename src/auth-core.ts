import { loadAuthProviders, type AuthLoginInput, type AuthProvider, type AuthProviderLoadOptions, type AuthSession, type AuthToken, type AuthUser } from "./provider-loader.js";

export interface AuthCoreOptions extends AuthProviderLoadOptions {}

export interface AuthCore {
  manifestPath: string;
  payloadManifestPath: string | null;
  warnings: string[];
  providers: AuthProvider[];
  providerIds: string[];
  login(providerId?: string, input?: AuthLoginInput): Promise<AuthSession>;
  logout(providerId?: string): Promise<AuthSession>;
  refresh(providerId?: string): Promise<AuthSession>;
  getUser(providerId?: string): Promise<AuthUser | null>;
  getToken(providerId?: string): Promise<AuthToken | null>;
}

function selectProvider(providers: AuthProvider[], providerId?: string): AuthProvider {
  if (providers.length === 0) {
    throw new Error("No auth providers were loaded from the Otto payload manifest.");
  }

  if (providerId) {
    const provider = providers.find((entry) => entry.id === providerId);
    if (!provider) {
      const available = providers.map((entry) => entry.id).join(", ");
      throw new Error(`Unknown auth provider '${providerId}'. Available providers: ${available}.`);
    }

    return provider;
  }

  return providers[0];
}

export async function createAuthCore(options: AuthCoreOptions = {}): Promise<AuthCore> {
  const loaded = await loadAuthProviders(options);

  return {
    manifestPath: loaded.manifestPath,
    payloadManifestPath: loaded.payloadManifestPath,
    warnings: loaded.warnings,
    providers: loaded.providers,
    providerIds: loaded.providers.map((provider) => provider.id),
    login: async (providerId, input) => selectProvider(loaded.providers, providerId).login(input),
    logout: async (providerId) => selectProvider(loaded.providers, providerId).logout(),
    refresh: async (providerId) => selectProvider(loaded.providers, providerId).refresh(),
    getUser: async (providerId) => selectProvider(loaded.providers, providerId).getUser(),
    getToken: async (providerId) => selectProvider(loaded.providers, providerId).getToken()
  };
}