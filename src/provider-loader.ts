import { promises as fs } from "node:fs";
import path from "node:path";

export type AuthProviderKind = "jwt" | "google" | "microsoft" | "github" | "apple-placeholder";

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  providerId: string;
  claims: Record<string, unknown>;
}

export interface AuthToken {
  value: string;
  providerId: string;
  issuedAt: string;
  expiresAt?: string;
}

export interface AuthSession {
  providerId: string;
  status: "idle" | "authenticated" | "logged-out" | "placeholder";
  user: AuthUser | null;
  token: AuthToken | null;
  message?: string;
}

export interface AuthProviderDescriptor {
  id: string;
  name: string;
  kind: AuthProviderKind;
  module: string;
  description: string;
  placeholder?: boolean;
}

export interface AuthProviderSelection {
  id: string;
  config?: Record<string, unknown>;
}

export interface OttoAuthPayloadManifest {
  auth?: {
    providers?: Array<string | AuthProviderSelection>;
  };
}

export type AuthLoginInput = Record<string, unknown>;

export interface AuthProvider {
  id: string;
  name: string;
  kind: AuthProviderKind;
  login(input?: AuthLoginInput): Promise<AuthSession>;
  logout(): Promise<AuthSession>;
  refresh(): Promise<AuthSession>;
  getUser(): Promise<AuthUser | null>;
  getToken(): Promise<AuthToken | null>;
}

export interface LoadedAuthProvider extends AuthProvider {
  descriptor: AuthProviderDescriptor;
  selection: AuthProviderSelection | null;
}

export interface AuthProviderLoadResult {
  manifestPath: string;
  payloadManifestPath: string | null;
  availableProviders: AuthProviderDescriptor[];
  selectedProviderIds: string[];
  providers: LoadedAuthProvider[];
  warnings: string[];
}

export interface AuthProviderLoadOptions {
  repoRoot?: string;
  providersManifestPath?: string;
  payloadManifestPath?: string;
  payloadManifest?: OttoAuthPayloadManifest;
}

interface ProvidersManifestFile {
  schemaVersion?: string;
  generatedAt?: string;
  providers?: AuthProviderDescriptor[];
}

function pathExists(targetPath: string): Promise<boolean> {
  return fs.access(targetPath).then(() => true).catch(() => false);
}

export function resolveProvidersManifestPath(repoRoot = process.cwd(), explicitPath?: string): string {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  return path.resolve(repoRoot, "manifests/providers.json");
}

export function resolveMemPalacePath(repoRoot = process.cwd(), explicitPath?: string): string {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  if (process.env.OTTO_MEMPALACE_PATH) {
    return path.resolve(process.env.OTTO_MEMPALACE_PATH);
  }

  return path.resolve(repoRoot, "../otto-extensions/mempalace");
}

async function readJson<T>(targetPath: string): Promise<T | null> {
  if (!(await pathExists(targetPath))) {
    return null;
  }

  const content = await fs.readFile(targetPath, "utf8");
  return JSON.parse(content) as T;
}

function normalizeSelection(selection: string | AuthProviderSelection): AuthProviderSelection {
  return typeof selection === "string" ? { id: selection } : selection;
}

function resolveSelectedProviderIds(
  manifest: OttoAuthPayloadManifest | null,
  availableProviderIds: string[]
): string[] {
  const selections = manifest?.auth?.providers;
  if (selections === undefined) {
    return [...availableProviderIds];
  }

  return selections.map(normalizeSelection).map((selection) => selection.id);
}

async function loadProviderFactory(providerId: string): Promise<((config?: Record<string, unknown>) => AuthProvider) | null> {
  switch (providerId) {
    case "jwt": {
      const module = await import("./jwt-provider.js");
      return module.createJwtProvider;
    }
    case "google": {
      const module = await import("./google-provider.js");
      return module.createGoogleProvider;
    }
    case "microsoft": {
      const module = await import("./microsoft-provider.js");
      return module.createMicrosoftProvider;
    }
    case "github": {
      const module = await import("./github-provider.js");
      return module.createGithubProvider;
    }
    case "apple": {
      const module = await import("./apple-provider-placeholder.js");
      return module.createApplePlaceholderProvider;
    }
    default:
      return null;
  }
}

export async function loadAuthProviders(options: AuthProviderLoadOptions = {}): Promise<AuthProviderLoadResult> {
  const repoRoot = options.repoRoot ?? process.cwd();
  const manifestPath = resolveProvidersManifestPath(repoRoot, options.providersManifestPath);
  const payloadManifestPath = options.payloadManifestPath ? path.resolve(options.payloadManifestPath) : null;
  const warnings: string[] = [];

  const manifest = await readJson<ProvidersManifestFile>(manifestPath);
  const availableProviders = manifest?.providers ?? [];
  if (availableProviders.length === 0) {
    warnings.push(`No auth providers were declared in ${manifestPath}.`);
  }

  const payloadManifest = options.payloadManifest ?? (payloadManifestPath ? await readJson<OttoAuthPayloadManifest>(payloadManifestPath) : null);
  const selectedProviderIds = resolveSelectedProviderIds(payloadManifest, availableProviders.map((provider) => provider.id));
  if (selectedProviderIds.length === 0) {
    warnings.push("No auth providers were selected in the Otto payload manifest.");
  }

  const selectedSelections = new Map<string, AuthProviderSelection>();
  for (const selection of payloadManifest?.auth?.providers ?? []) {
    const normalized = normalizeSelection(selection);
    selectedSelections.set(normalized.id, normalized);
  }

  const providers: LoadedAuthProvider[] = [];
  for (const providerId of selectedProviderIds) {
    const descriptor = availableProviders.find((entry) => entry.id === providerId);
    if (!descriptor) {
      warnings.push(`Auth provider '${providerId}' is not declared in ${manifestPath}.`);
      continue;
    }

    const factory = await loadProviderFactory(providerId);
    if (!factory) {
      warnings.push(`No provider factory is available for '${providerId}'.`);
      continue;
    }

    const selection = selectedSelections.get(providerId) ?? null;
    const provider = factory(selection?.config);
    providers.push({ ...provider, descriptor, selection });
  }

  return {
    manifestPath,
    payloadManifestPath,
    availableProviders,
    selectedProviderIds,
    providers,
    warnings
  };
}