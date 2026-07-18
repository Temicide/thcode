// CapabilityRegistry: load, look up, filter, and render the versioned
// Capability Registry (Story 4.1, AD-15). The manifest is a checked-in,
// reviewed offline snapshot — never live discovery. External overrides
// (model/installer/URL/user-supplied) are always rejected.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  type CapabilityRegistryEntry,
  type CapabilityRegistryManifest,
  type RegistryFailClosedEvidence,
  type RegistryLoadResult,
} from './types.js';
import { parseManifest } from './manifest.js';

/** Result of a registry lookup or invocation check. */
export type InvocationCheckResult =
  | { readonly ok: true; readonly entry: CapabilityRegistryEntry }
  | { readonly ok: false; readonly evidence: RegistryFailClosedEvidence };

/** Default checked-in manifest path (repo root: cli/specialists-manifest.json). */
export function defaultManifestPath(): string {
  // registry.js lives at dist/core/specialists/registry/registry.js -> up 4 to package root.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', '..', '..', 'specialists-manifest.json');
}

/** Load the checked-in manifest (or a supplied path). */
export function loadRegistryManifest(
  manifestPath: string = defaultManifestPath(),
  now: string,
): RegistryLoadResult {
  let json: string;
  try {
    json = readFileSync(manifestPath, 'utf8');
  } catch (e) {
    return {
      ok: false,
      evidence: {
        manifestVersion: 0,
        cause: 'malformed',
        detail: `cannot read manifest file: ${(e as Error).message}`,
        timestamp: now,
      },
    };
  }
  return parseManifest(json, now);
}

/** The Capability Registry — loaded from the checked-in manifest. */
export class CapabilityRegistry {
  private readonly loadResult: RegistryLoadResult;
  /** Reference timestamp captured at load time, used to timestamp any
   * invocation-gating Evidence produced for a successfully-loaded registry. */
  private readonly now: string;

  private constructor(loadResult: RegistryLoadResult, now: string) {
    this.loadResult = loadResult;
    this.now = now;
  }

  /** Load the registry from the default checked-in manifest path. */
  static load(now: string, manifestPath?: string): CapabilityRegistry {
    return new CapabilityRegistry(loadRegistryManifest(manifestPath, now), now);
  }

  /** Load from an already-parsed manifest (for testing). */
  static fromManifest(manifest: CapabilityRegistryManifest, now = ''): CapabilityRegistry {
    return new CapabilityRegistry({ ok: true, manifest }, now);
  }

  /** Load from a load result (for testing). */
  static fromLoadResult(result: RegistryLoadResult, now = ''): CapabilityRegistry {
    return new CapabilityRegistry(result, now);
  }

  /** Whether the registry loaded successfully. */
  get ok(): boolean {
    return this.loadResult.ok;
  }

  /** The loaded manifest (only valid when ok is true). */
  get manifest(): CapabilityRegistryManifest {
    if (!this.loadResult.ok) {
      throw new Error('Registry is not loaded (fail-closed)');
    }
    return this.loadResult.manifest;
  }

  /** Fail-closed evidence when the registry did not load. */
  get evidence(): RegistryFailClosedEvidence | null {
    return this.loadResult.ok ? null : this.loadResult.evidence;
  }

  /** All entries (only valid when ok is true). */
  all(): readonly CapabilityRegistryEntry[] {
    return this.manifest.entries;
  }

  /** Look up an entry by stable thcode identity. */
  byId(id: string): CapabilityRegistryEntry | undefined {
    return this.manifest.entries.find((e) => e.id === id);
  }

  /** Entries that are invokable. */
  invokable(): CapabilityRegistryEntry[] {
    return this.manifest.entries.filter((e) => e.invokable);
  }

  /** Entries that are NOT invokable. */
  nonInvokable(): CapabilityRegistryEntry[] {
    return this.manifest.entries.filter((e) => !e.invokable);
  }

  /**
   * Check whether a service can be invoked. Fails closed if the registry
   * itself is not loaded, or if the service is not invokable.
   */
  checkInvocation(id: string): InvocationCheckResult {
    if (!this.loadResult.ok) {
      return { ok: false, evidence: this.loadResult.evidence };
    }
    const entry = this.byId(id);
    if (!entry) {
      return {
        ok: false,
        evidence: {
          manifestVersion: this.manifest.manifestVersion,
          cause: 'not-found',
          detail: `service "${id}" not found in registry`,
          timestamp: this.now,
        },
      };
    }
    if (!entry.invokable) {
      return {
        ok: false,
        evidence: {
          manifestVersion: this.manifest.manifestVersion,
          cause: 'not-invokable',
          detail: `service "${id}" is not invokable: ${entry.invokableStateReason ?? 'unknown reason'}`,
          timestamp: this.now,
        },
      };
    }
    return { ok: true, entry };
  }

  /**
   * Reject any external registry override attempt. Always returns false
   * (the override is never accepted).
   */
  rejectOverride(_source: 'model' | 'installer' | 'url' | 'user'): boolean {
    return false;
  }

  /**
   * Render a registry entry identity for display. Canonical tokens and exact
   * service identifiers remain unchanged across Thai/mixed/narrow/redirected/
   * headless output. Explanatory Thai may accompany them.
   */
  renderIdentity(entry: CapabilityRegistryEntry, _mode?: 'narrow' | 'headless' | 'redirected'): string {
    const state = entry.invokable
      ? 'working'
      : entry.invokableStateReason ?? 'Catalogued — Not available yet';
    return `${entry.id} (${entry.nameEnglish} / ${entry.nameThai}) — ${state}`;
  }

  /**
   * Render a compact identity line for narrow/headless output.
   * Canonical tokens and exact service identifiers are unchanged.
   */
  renderCompact(entry: CapabilityRegistryEntry): string {
    const state = entry.invokable ? 'working' : 'not-available';
    return `${entry.id}|${state}`;
  }
}
