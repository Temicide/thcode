import { createHash } from 'node:crypto';
import { sanitizer } from '../security/sanitizer.js';
import type { NormalizedMessage } from '../providers/types.js';
import { contextUtilizationPercentOrUnavailable, utilizationBand, type ContextBuildResult, type ContextBuilderInput, type ContextItem, type ContextSource } from './types.js';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const estimate = (s: string) => Math.max(1, Math.ceil(Buffer.byteLength(s) / 4));
const source = (role: NormalizedMessage['role'], raw: string): ContextSource => role === 'system' ? { sourceClass: 'application', trust: 'trusted-instruction', provenance: 'application instruction', digest: hash(raw) } : role === 'user' ? { sourceClass: 'user', trust: 'untrusted-data', provenance: 'user transcript', digest: hash(raw) } : role === 'tool' ? { sourceClass: 'tool-result', trust: 'instruction-inert', provenance: 'tool result', digest: hash(raw) } : { sourceClass: 'remote-provider', trust: 'instruction-inert', provenance: 'provider transcript', digest: hash(raw) };
export function delimitUntrusted(content: string, s: ContextSource): string { const esc = (v: string) => v.replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c); return `<context source="${esc(s.sourceClass)}" trust="${esc(s.trust)}" provenance="${esc(s.provenance)}">\n${content.replace(/<\/context>/gi, '&lt;/context&gt;')}\n</context>`; }
export class DeterministicContextBuilder {
  constructor(private readonly opts: { maxRecentTurns?: number; estimateTokens?: (s: string) => number } = {}) {}
  build(input: ContextBuilderInput): ContextBuildResult {
    const now = input.now ?? new Date().toISOString();
    const all = [...input.history, { role: 'user' as const, content: input.newInput }];
    const start = Math.max(0, all.length - (this.opts.maxRecentTurns ?? all.length));
    const pins = new Set((input.pins ?? []).filter((p) => p.status === 'active').flatMap((p) => [p.target.itemId, p.target.transcriptIdentity]));
    const items: ContextItem[] = all.map((m, i) => {
      const id = hash(`${input.sessionId ?? 'transient'}:${i}:${m.role}:${m.content}`);
      const src = source(m.role, m.content);
      const pinned = pins.has(id) || pins.has(`turn-${i}`);
      const protectedItem = m.role === 'system' || pinned;
      const inclusion = m.role === 'system' ? 'protected' : pinned ? 'pinned' : i >= start ? 'recent' : 'omitted';
      const safe = m.role === 'system' ? m.content : sanitizer.sanitizeOrBlock(m.content, 'user-content', '[redacted]');
      const content = m.role === 'system' ? safe : delimitUntrusted(safe, src);
      return Object.freeze({ id, role: m.role, content, source: src, inclusion, protected: protectedItem, estimatedTokens: (this.opts.estimateTokens ?? estimate)(content), measuredBytes: Buffer.byteLength(content), measurementQuality: 'estimated', ...(inclusion === 'omitted' ? { omissionReason: 'not-selected' as const } : {}), transformations: [{ kind: inclusion === 'omitted' ? 'omitted' as const : 'selected' as const, at: now }], ...(pinned ? { pinId: id } : {}) });
    });
    const cap = input.capacity ?? { rawLimit: null, effective: 'percentage unavailable' as const, responseReserve: 'percentage unavailable' as const, safetyMargin: 'percentage unavailable' as const, configuredMaxOutput: 0, measurementQuality: 'percentage unavailable' as const };
    const ordered = items.filter((i) => i.protected || i.inclusion !== 'omitted');
    const selected: ContextItem[] = [];
    const capacity = cap.effective;
    let selectedTokens = 0;
    const append = (item: ContextItem): void => {
      if (capacity === 'percentage unavailable' || selectedTokens + item.estimatedTokens <= capacity || item.protected) {
        selected.push(item);
        selectedTokens += item.estimatedTokens;
      }
    };
    // Preserve transcript order. Ranking may decide which optional items fit,
    // but it must never reorder the serialized conversation or instructions.
    ordered.filter((i) => i.protected).forEach(append);
    [...ordered].reverse().filter((i) => !i.protected).forEach(append);
    selected.sort((a, b) => items.indexOf(a) - items.indexOf(b));
    const selectedIds = new Set(selected.map((i) => i.id));
    const finalItems = items.map((i) => selectedIds.has(i.id) ? i : Object.freeze({ ...i, inclusion: 'omitted' as const, omissionReason: capacity === 'percentage unavailable' ? 'capacity' as const : 'capacity' as const, transformations: [...i.transformations, { kind: 'omitted' as const, at: now, reason: 'capacity' }] }));
    const tokens = selected.reduce((n, i) => n + i.estimatedTokens, 0);
    const percent = contextUtilizationPercentOrUnavailable(tokens, cap.effective);
    return Object.freeze({ messages: selected.map((i) => ({ role: i.role, content: i.content })), items: finalItems, estimatedTokens: tokens, capacity: cap, utilization: { tokens, capacity: cap.effective, percent, band: utilizationBand(percent) }, omissions: finalItems.filter((i) => !selectedIds.has(i.id)), transformations: finalItems.flatMap((i) => i.transformations), decisions: finalItems.map((i) => ({ itemId: i.id, included: selectedIds.has(i.id), mode: i.inclusion, ...(i.omissionReason ? { reason: i.omissionReason } : {}), provenance: i.source.provenance })) });
  }
}
export function contextCapacity(raw: number | null, output = 0) { if (raw === null || !Number.isFinite(raw) || raw <= 0) return { rawLimit: raw, effective: 'percentage unavailable' as const, responseReserve: 'percentage unavailable' as const, safetyMargin: 'percentage unavailable' as const, configuredMaxOutput: output, measurementQuality: 'percentage unavailable' as const }; const reserve = Math.max(output, Math.ceil(raw * .08)); const safety = Math.max(2048, Math.ceil(raw * .02)); return { rawLimit: raw, effective: Math.max(0, raw - reserve - safety), responseReserve: reserve, safetyMargin: safety, configuredMaxOutput: output, measurementQuality: 'provider-reported' as const }; }
