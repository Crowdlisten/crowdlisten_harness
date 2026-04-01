/**
 * UserState — Persistent state for progressive skill pack disclosure.
 *
 * Stored at ~/.crowdlisten/state.json
 *
 * Auto-migration:
 *  - Existing users (have auth.json or context.json): all packs active
 *  - New users: core pack only
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

const BASE_DIR = path.join(os.homedir(), ".crowdlisten");
const STATE_FILE = path.join(BASE_DIR, "state.json");
const AUTH_FILE = path.join(BASE_DIR, "auth.json");
const CONTEXT_FILE = path.join(BASE_DIR, "context.json");

// ─── Types ──────────────────────────────────────────────────────────────────

export type TelemetryLevel = "off" | "anonymous" | "community";

export interface UserState {
  version: 2;
  activePacks: string[];
  contextBlockCount: number;
  preferences: {
    maxActivePacks: number;
    autoActivate: string[];
    telemetry: TelemetryLevel;
    proactiveSuggestions: boolean;
    crossProjectLearnings: boolean;
  };
  installationId: string;
  onboardingCompleted: string[];
}

/** V1 shape for migration */
interface UserStateV1 {
  version: 1;
  activePacks: string[];
  contextBlockCount: number;
  preferences: {
    maxActivePacks: number;
    autoActivate: string[];
  };
}

// All tool packs (excluding core which is always on, and legacy which is hidden)
const ALL_PACKS = [
  "planning",
  "knowledge",
  "social-listening",
  "audience-analysis",
  "sessions",
  "setup",
];

function defaultNewUserState(): UserState {
  return {
    version: 2,
    activePacks: [],
    contextBlockCount: 0,
    preferences: {
      maxActivePacks: 10,
      autoActivate: [],
      telemetry: "off",
      proactiveSuggestions: true,
      crossProjectLearnings: false,
    },
    installationId: crypto.randomUUID(),
    onboardingCompleted: [],
  };
}

function defaultExistingUserState(): UserState {
  return {
    version: 2,
    activePacks: [...ALL_PACKS, "legacy"],
    contextBlockCount: 0,
    preferences: {
      maxActivePacks: 10,
      autoActivate: [...ALL_PACKS],
      telemetry: "off",
      proactiveSuggestions: true,
      crossProjectLearnings: false,
    },
    installationId: crypto.randomUUID(),
    onboardingCompleted: [],
  };
}

/**
 * Migrate v1 state to v2 in-place.
 */
function migrateV1toV2(v1: UserStateV1): UserState {
  return {
    version: 2,
    activePacks: v1.activePacks,
    contextBlockCount: v1.contextBlockCount,
    preferences: {
      ...v1.preferences,
      telemetry: "off",
      proactiveSuggestions: true,
      crossProjectLearnings: false,
    },
    installationId: crypto.randomUUID(),
    onboardingCompleted: [],
  };
}

function ensureDir(): void {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  }
}

/**
 * Check if this is an existing user (has auth or context data).
 */
function isExistingUser(): boolean {
  return fs.existsSync(AUTH_FILE) || fs.existsSync(CONTEXT_FILE);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Load user state. Auto-creates with migration logic if not found.
 */
export function loadUserState(): UserState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      const parsed = JSON.parse(raw);

      // v2 — current version
      if (parsed.version === 2) return parsed as UserState;

      // v1 → v2 migration
      if (parsed.version === 1) {
        const migrated = migrateV1toV2(parsed as UserStateV1);
        saveUserState(migrated);
        return migrated;
      }
    }
  } catch {
    // Corrupted file — will recreate
  }

  // Auto-migration: create initial state
  const state = isExistingUser()
    ? defaultExistingUserState()
    : defaultNewUserState();

  saveUserState(state);
  return state;
}

/**
 * Save user state to disk.
 */
export function saveUserState(state: UserState): void {
  ensureDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Activate a skill pack.
 */
export function activatePack(packId: string): UserState {
  const state = loadUserState();
  if (!state.activePacks.includes(packId)) {
    state.activePacks.push(packId);
    saveUserState(state);
  }
  return state;
}

/**
 * Deactivate a skill pack.
 */
export function deactivatePack(packId: string): UserState {
  const state = loadUserState();
  state.activePacks = state.activePacks.filter(id => id !== packId);
  saveUserState(state);
  return state;
}
