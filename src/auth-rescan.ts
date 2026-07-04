import { promises as fs } from "node:fs";
import path from "node:path";

import { commandService } from "./command-service.js";
import { loadAuthProviders, type AuthProviderLoadOptions, type AuthProviderLoadResult } from "./provider-loader.js";

export type RescanTrigger = "manual" | "automatic";
export type RescanSource = "user" | "OttoUpdateAgent";

export interface AuthGenerationResult extends AuthProviderLoadResult {
  generatedAt: string;
}

export interface AuthRescanOptions extends AuthProviderLoadOptions {
  memPalaceRoot?: string;
  trigger: RescanTrigger;
  source: RescanSource;
}

export interface AuthRescanCommandInput extends Omit<AuthRescanOptions, "trigger" | "source"> {
  trigger?: RescanTrigger;
  source?: RescanSource;
}

const AUTH_RESCAN_COMMAND_ID = "otto.auth.rescan";

function resolveMemPalacePath(repoRoot = process.cwd(), explicitPath?: string): string {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  if (process.env.OTTO_MEMPALACE_PATH) {
    return path.resolve(process.env.OTTO_MEMPALACE_PATH);
  }

  return path.resolve(repoRoot, "../otto-extensions/mempalace");
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJsonArray(targetPath: string): Promise<unknown[]> {
  if (!(await pathExists(targetPath))) {
    return [];
  }

  const content = await fs.readFile(targetPath, "utf8");
  const parsed = JSON.parse(content) as unknown;
  return Array.isArray(parsed) ? parsed : [];
}

export async function generateAuthArtifacts(options: AuthProviderLoadOptions = {}): Promise<AuthGenerationResult> {
  const loaded = await loadAuthProviders(options);
  return {
    ...loaded,
    generatedAt: new Date().toISOString()
  };
}

export async function persistAuthMetadata(result: AuthGenerationResult, options: AuthRescanOptions): Promise<void> {
  const memPalaceRoot = resolveMemPalacePath(process.cwd(), options.memPalaceRoot);
  const snapshot = {
    updatedAt: result.generatedAt,
    manifestPath: result.manifestPath,
    payloadManifestPath: result.payloadManifestPath,
    availableProviderIds: result.availableProviders.map((provider) => provider.id),
    selectedProviderIds: result.selectedProviderIds,
    loadedProviders: result.providers.map((provider) => provider.descriptor),
    warnings: result.warnings
  };
  const event = {
    at: result.generatedAt,
    trigger: options.trigger,
    source: options.source,
    providerCount: result.providers.length,
    warnings: result.warnings
  };

  await writeJson(path.join(memPalaceRoot, "auth-provider-index.json"), snapshot);

  const generationHistoryPath = path.join(memPalaceRoot, "auth-generation-history.json");
  const generationHistory = await readJsonArray(generationHistoryPath);
  generationHistory.push({ ...event, snapshot });
  await writeJson(generationHistoryPath, generationHistory);

  const rescanEventsPath = path.join(memPalaceRoot, "auth-rescan-events.json");
  const rescanEvents = await readJsonArray(rescanEventsPath);
  rescanEvents.push(event);
  await writeJson(rescanEventsPath, rescanEvents);
}

export async function rescanAuth(options: AuthRescanOptions): Promise<AuthGenerationResult> {
  const result = await generateAuthArtifacts(options);
  await persistAuthMetadata(result, options);
  return result;
}

commandService.register<AuthRescanCommandInput, AuthGenerationResult>(AUTH_RESCAN_COMMAND_ID, async (input) =>
  rescanAuth({
    ...input,
    trigger: input.trigger ?? "manual",
    source: input.source ?? "user"
  })
);

export async function executeAuthRescanCommand(input: AuthRescanCommandInput): Promise<AuthGenerationResult> {
  return commandService.run<AuthRescanCommandInput, AuthGenerationResult>(AUTH_RESCAN_COMMAND_ID, input);
}