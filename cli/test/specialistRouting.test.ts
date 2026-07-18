// Specialist routing tests (Story 4.5).
// Covers every I/O matrix row + every AC: propose, clarify, refused, blocked,
// none, Thai/mixed parity, direct-id precedence, headless, determinism,
// user-bytes preserved, schema-only-one-service, no-silent-substitution.

import { describe, expect, it } from 'vitest';
import { CapabilityRegistry } from '../src/core/specialists/registry/index.js';
import type { CapabilityRegistryEntry, CapabilityRegistryManifest } from '../src/core/specialists/registry/types.js';
import type { HealthMap, DisabledSet } from '../src/core/specialists/catalog/projection.js';
import {
  matchPromptToServices,
  MATCHER_VERSION,
  AMBIGUITY_DELTA,
  routeSpecialistPrompt,
  buildTaskRelevantSchema,
  type RoutingDecision,
  type RoutingOptions,
} from '../src/core/specialists/routing/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fixedClock = () => '2026-07-17T12:00:00.000Z';

const BASE_ENTRY: Omit<CapabilityRegistryEntry, 'id' | 'upstreamId' | 'nameThai' | 'nameEnglish' | 'searchTerms' | 'capabilities' | 'supportedInputs' | 'inputLimits' | 'invokable' | 'invokableStateReason'> = {
  entitlement: 'AI-for-Thai API key required',
  evidenceLevel: 'deterministic',
  observationDate: '2026-07-17',
  endpoint: 'https://api.aiforthai.in.th/ocr',
  transportRules: {
    allowedProtocols: ['https'],
    requiresTls: true,
    allowedMethods: ['POST'],
  },
  privacyClassification: {
    category: 'standard',
    dataClasses: ['image'],
    requiresConsent: false,
  },
  retentionClassification: {
    policy: 'delete-after-30-days',
    providerDeletionSupported: true,
    defaultRetentionDays: 30,
  },
  confirmationPolicy: {
    requiresExplicitConsent: false,
    scope: 'none',
  },
  manifestVersion: 1,
  contractVersion: '1.0.0',
  adapterVersion: '1.0.0',
  latestContractTestResult: {
    passed: true,
    testedAt: '2026-07-17T08:00:00.000Z',
    summary: 'Contract test passed',
  },
};

/** t-ocr: Thai OCR service */
const T_OCR: CapabilityRegistryEntry = {
  ...BASE_ENTRY,
  id: 't-ocr',
  upstreamId: 'ocr',
  nameThai: 'ที-โอซีอาร์',
  nameEnglish: 'T-OCR',
  searchTerms: ['ocr', 'thai-ocr', 'optical character recognition', 'ทีโอซีอาร์', 'อ่านข้อความ'],
  capabilities: ['thai-ocr', 'image-to-text'],
  supportedInputs: ['image/png', 'image/jpeg', 'image/tiff'],
  inputLimits: { maxFileSize: '20MB', maxPages: '10' },
  invokable: true,
  invokableStateReason: null,
};

/** speech-to-text: Thai speech recognition */
const SPEECH_TO_TEXT: CapabilityRegistryEntry = {
  ...BASE_ENTRY,
  id: 'speech-to-text',
  upstreamId: 'speech',
  nameThai: 'แปลงเสียงเป็นข้อความ',
  nameEnglish: 'Speech-to-Text',
  searchTerms: ['speech', 'speech-to-text', 'voice', 'stt', 'คำพูด', 'เสียง', 'ถอดเสียง'],
  capabilities: ['thai-speech', 'audio-transcription'],
  supportedInputs: ['audio/wav', 'audio/mp3', 'audio/ogg'],
  inputLimits: { maxFileSize: '50MB', maxDuration: '60m' },
  invokable: true,
  invokableStateReason: null,
};

/** extract-address: Thai address extraction */
const EXTRACT_ADDRESS: CapabilityRegistryEntry = {
  ...BASE_ENTRY,
  id: 'extract-address',
  upstreamId: 'address',
  nameThai: 'ดึงข้อมูลที่อยู่',
  nameEnglish: 'Extract Address',
  searchTerms: ['address', 'extract-address', 'ที่อยู่', 'ดึงที่อยู่', 'location'],
  capabilities: ['thai-address-extraction', 'ner-address'],
  supportedInputs: ['text/plain', 'text/html'],
  inputLimits: { maxTextLength: '10000' },
  invokable: true,
  invokableStateReason: null,
};

/** named-entity-recognition: Thai NER */
const NER: CapabilityRegistryEntry = {
  ...BASE_ENTRY,
  id: 'named-entity-recognition',
  upstreamId: 'ner',
  nameThai: 'การรู้จำเอนทิตี',
  nameEnglish: 'Named Entity Recognition',
  searchTerms: ['ner', 'named-entity', 'entity recognition', 'เอนทิตี', 'ชื่อเฉพาะ'],
  capabilities: ['thai-ner', 'entity-extraction'],
  supportedInputs: ['text/plain'],
  inputLimits: { maxTextLength: '50000' },
  invokable: true,
  invokableStateReason: null,
};

/** Non-invokable entry with overlapping search terms (catalogued but not available). */
const CATALOGUED_TRANSLATE: CapabilityRegistryEntry = {
  ...BASE_ENTRY,
  id: 'typhoon-translate',
  upstreamId: 'translate',
  nameThai: 'แปลภาษา',
  nameEnglish: 'Typhoon Translate',
  searchTerms: ['translate', 'translation', 'แปล', 'ภาษา', 'thai-translate'],
  capabilities: ['thai-translation', 'language-translate'],
  supportedInputs: ['text/plain'],
  inputLimits: { maxTextLength: '10000' },
  invokable: false,
  invokableStateReason: 'Catalogued — Not available yet',
};

const ALL_ENTRIES: readonly CapabilityRegistryEntry[] = [
  T_OCR,
  SPEECH_TO_TEXT,
  EXTRACT_ADDRESS,
  NER,
  CATALOGUED_TRANSLATE,
];

function buildManifest(entries: readonly CapabilityRegistryEntry[] = ALL_ENTRIES): CapabilityRegistryManifest {
  return {
    manifestVersion: 1,
    observationDate: '2026-07-17',
    freshnessDays: 7,
    revoked: false,
    revocationReason: null,
    source: 'test-fixture',
    entries,
  };
}

function buildRegistry(entries?: readonly CapabilityRegistryEntry[]): CapabilityRegistry {
  return CapabilityRegistry.fromManifest(buildManifest(entries));
}

function buildOptions(overrides: Partial<RoutingOptions> & { healthMap?: HealthMap; disabledSet?: DisabledSet } = {}): RoutingOptions {
  return {
    isTTY: true,
    healthMap: {},
    disabledSet: new Set<string>(),
    ...overrides,
  };
}

function fullHealthMap(state: string = 'available'): HealthMap {
  const map: HealthMap = {};
  for (const e of ALL_ENTRIES) {
    // Only set health for invokable entries — non-invokable entries should not
    // have a health state (the router checks invokable before consulting health).
    if (e.invokable) {
      map[e.id] = state as HealthMap[string];
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// matcher.ts — matchPromptToServices
// ---------------------------------------------------------------------------

describe('matchPromptToServices', () => {
  it('returns empty for a prompt with no Specialist signal', () => {
    const result = matchPromptToServices('create a new file', ALL_ENTRIES);
    expect(result).toHaveLength(0);
  });

  it('matches direct id mention with highest score', () => {
    const result = matchPromptToServices('use t-ocr to read this image', ALL_ENTRIES);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const ocr = result.find((m) => m.serviceId === 't-ocr');
    expect(ocr).toBeDefined();
    expect(ocr!.score).toBeGreaterThanOrEqual(100);
    expect(ocr!.matchedTerms).toContain('id:t-ocr');
  });

  it('matches search terms with medium score', () => {
    const result = matchPromptToServices('I need OCR for this document', ALL_ENTRIES);
    const ocr = result.find((m) => m.serviceId === 't-ocr');
    expect(ocr).toBeDefined();
    expect(ocr!.score).toBeGreaterThanOrEqual(50);
  });

  it('matches capabilities with medium score', () => {
    // "entity-extraction" is a capability of NER
    const result = matchPromptToServices('entity-extraction', ALL_ENTRIES);
    const ner = result.find((m) => m.serviceId === 'named-entity-recognition');
    expect(ner).toBeDefined();
    expect(ner!.score).toBeGreaterThanOrEqual(50);
  });

  it('matches supportedInputs with medium-low score', () => {
    const result = matchPromptToServices('process this image/png file', ALL_ENTRIES);
    const ocr = result.find((m) => m.serviceId === 't-ocr');
    expect(ocr).toBeDefined();
    expect(ocr!.score).toBeGreaterThanOrEqual(30);
  });

  it('matches name substring with low score', () => {
    const result = matchPromptToServices('T-OCR service', ALL_ENTRIES);
    const ocr = result.find((m) => m.serviceId === 't-ocr');
    expect(ocr).toBeDefined();
    expect(ocr!.score).toBeGreaterThanOrEqual(10);
  });

  it('scores are summed across categories', () => {
    // This prompt should hit id + searchTerm + name
    const result = matchPromptToServices('use t-ocr for OCR', ALL_ENTRIES);
    const ocr = result.find((m) => m.serviceId === 't-ocr');
    expect(ocr).toBeDefined();
    // id(100) + searchTerm(50) = 150
    expect(ocr!.score).toBeGreaterThanOrEqual(150);
  });

  it('stable tie-break by registry entry order', () => {
    // "text/plain" matches both extract-address and NER via supportedInputs
    const result = matchPromptToServices('text/plain', ALL_ENTRIES);
    const textPlainMatches = result.filter((m) => m.score > 0);
    if (textPlainMatches.length >= 2) {
      // Check they're in registry order for equal scores
      for (let i = 1; i < textPlainMatches.length; i++) {
        if (textPlainMatches[i].score === textPlainMatches[i - 1].score) {
          const idxA = ALL_ENTRIES.findIndex((e) => e.id === textPlainMatches[i - 1].serviceId);
          const idxB = ALL_ENTRIES.findIndex((e) => e.id === textPlainMatches[i].serviceId);
          expect(idxA).toBeLessThan(idxB);
        }
      }
    }
  });

  it('deterministic: same prompt returns same result', () => {
    const a = matchPromptToServices('I need OCR for Thai text', ALL_ENTRIES);
    const b = matchPromptToServices('I need OCR for Thai text', ALL_ENTRIES);
    expect(a).toEqual(b);
  });

  it('user bytes are preserved (matching uses a lowercased copy)', () => {
    // Thai characters should not be altered
    const thaiPrompt = 'ฉันต้องการ OCR สำหรับรูปภาพ';
    const result = matchPromptToServices(thaiPrompt, ALL_ENTRIES);
    // The prompt itself is not modified by the function
    expect(thaiPrompt).toBe('ฉันต้องการ OCR สำหรับรูปภาพ');
    // Should still match OCR
    const ocr = result.find((m) => m.serviceId === 't-ocr');
    expect(ocr).toBeDefined();
  });

  it('matches Thai search terms', () => {
    const result = matchPromptToServices('อ่านข้อความจากรูป', ALL_ENTRIES);
    const ocr = result.find((m) => m.serviceId === 't-ocr');
    expect(ocr).toBeDefined();
    expect(ocr!.score).toBeGreaterThanOrEqual(50);
  });

  it('matches Thai name', () => {
    const result = matchPromptToServices('ที-โอซีอาร์', ALL_ENTRIES);
    const ocr = result.find((m) => m.serviceId === 't-ocr');
    expect(ocr).toBeDefined();
    expect(ocr!.score).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// schema.ts — buildTaskRelevantSchema
// ---------------------------------------------------------------------------

describe('buildTaskRelevantSchema', () => {
  it('returns schema for exactly one service', () => {
    const schema = buildTaskRelevantSchema(T_OCR);
    expect(schema.serviceId).toBe('t-ocr');
    expect(schema.supportedInputs).toEqual(['image/png', 'image/jpeg', 'image/tiff']);
    expect(schema.inputLimits).toEqual({ maxFileSize: '20MB', maxPages: '10' });
    expect(schema.transportPolicy.allowedProtocols).toEqual(['https']);
    expect(schema.transportPolicy.requiresTls).toBe(true);
    expect(schema.transportPolicy.allowedMethods).toEqual(['POST']);
  });

  it('never includes other service ids in the schema', () => {
    const schema = buildTaskRelevantSchema(T_OCR);
    // The schema should only reference t-ocr
    expect(schema.serviceId).toBe('t-ocr');
    // No other service ids should appear
    const serialized = JSON.stringify(schema);
    expect(serialized).not.toContain('speech-to-text');
    expect(serialized).not.toContain('extract-address');
    expect(serialized).not.toContain('named-entity-recognition');
    expect(serialized).not.toContain('typhoon-translate');
  });

  it('never includes credentials or endpoint URLs', () => {
    const schema = buildTaskRelevantSchema(T_OCR);
    const serialized = JSON.stringify(schema);
    expect(serialized).not.toContain('credential');
    expect(serialized).not.toContain('apiKey');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('endpoint');
    expect(serialized).not.toContain('api.aiforthai');
  });
});

// ---------------------------------------------------------------------------
// router.ts — routeSpecialistPrompt
// ---------------------------------------------------------------------------

describe('routeSpecialistPrompt', () => {
  // --- propose: clear single service match ---

  it('propose: clear single service match (English)', () => {
    const decision = routeSpecialistPrompt(
      'I need OCR for this image',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('propose');
    if (decision.kind === 'propose') {
      expect(decision.serviceId).toBe('t-ocr');
      expect(decision.serviceName).toBe('T-OCR');
      expect(decision.rationale).toContain('T-OCR');
      expect(decision.schema.serviceId).toBe('t-ocr');
      // Schema is one service only
      expect(JSON.stringify(decision.schema)).not.toContain('speech-to-text');
      expect(decision.provenance.matcherVersion).toBe(MATCHER_VERSION);
      expect(decision.provenance.createdAt).toBe('2026-07-17T12:00:00.000Z');
      expect(decision.provenance.promptHash).toBeTruthy();
    }
  });

  it('propose: clear single service match (Thai)', () => {
    // "อ่านข้อความ" is a Thai search term for t-ocr
    const decision = routeSpecialistPrompt(
      'ต้องการอ่านข้อความจากรูปภาพ',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('propose');
    if (decision.kind === 'propose') {
      expect(decision.serviceId).toBe('t-ocr');
      // Rationale should be in Thai
      expect(decision.rationale).toContain('ที-โอซีอาร์');
    }
  });

  it('propose: clear single service match (mixed Thai+English)', () => {
    const decision = routeSpecialistPrompt(
      'ฉันต้องการ OCR สำหรับรูป image',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('propose');
    if (decision.kind === 'propose') {
      expect(decision.serviceId).toBe('t-ocr');
      // Mixed-language rationale shows BOTH names (Thai first, English in parens)
      // — never a duplicated name.
      expect(decision.rationale).toContain('ที-โอซีอาร์');
      expect(decision.rationale).toContain('T-OCR');
    }
  });

  it('propose: schema is one service only (no other service ids)', () => {
    const decision = routeSpecialistPrompt(
      'I need OCR for this image',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('propose');
    if (decision.kind === 'propose') {
      const schemaStr = JSON.stringify(decision.schema);
      expect(schemaStr).not.toContain('speech-to-text');
      expect(schemaStr).not.toContain('extract-address');
      expect(schemaStr).not.toContain('named-entity-recognition');
      expect(schemaStr).not.toContain('typhoon-translate');
    }
  });

  // --- clarify: ambiguous match ---

  it('clarify: two services tie within AMBIGUITY_DELTA', () => {
    // "text/plain" is a supportedInput for both extract-address and NER
    const decision = routeSpecialistPrompt(
      'text/plain',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('clarify');
    if (decision.kind === 'clarify') {
      expect(decision.candidates.length).toBeGreaterThanOrEqual(2);
      expect(decision.question).toBeTruthy();
    }
  });

  it('clarify: material intent ambiguity with Specialist signal', () => {
    const decision = routeSpecialistPrompt(
      'OCR',
      buildRegistry(),
      buildOptions({
        healthMap: fullHealthMap('available'),
        intentAmbiguity: 'material',
      }),
      fixedClock,
    );
    expect(decision.kind).toBe('clarify');
    if (decision.kind === 'clarify') {
      expect(decision.candidates.length).toBeGreaterThanOrEqual(1);
    }
  });

  // --- refused: unsupported ---

  it('refused: signal only on non-invokable entry (Catalogued — Not available yet)', () => {
    const decision = routeSpecialistPrompt(
      'translate this to Thai',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('refused');
    if (decision.kind === 'refused') {
      expect(decision.reason).toBe('Catalogued — Not available yet');
    }
  });

  // --- none: no Specialist signal ---

  it('none: no Specialist signal (normal coding task)', () => {
    const decision = routeSpecialistPrompt(
      'create a new TypeScript file',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('none');
  });

  it('none: empty prompt', () => {
    const decision = routeSpecialistPrompt(
      '',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('none');
  });

  // --- blocked: service not available ---

  it('blocked: service unavailable (unconfigured)', () => {
    const decision = routeSpecialistPrompt(
      'I need OCR for this image',
      buildRegistry(),
      buildOptions({ healthMap: { 't-ocr': 'unconfigured' } }),
      fixedClock,
    );
    expect(decision.kind).toBe('blocked');
    if (decision.kind === 'blocked') {
      expect(decision.cause).toBe('service-unavailable');
      expect(decision.stateToken).toBe('unconfigured');
      expect(decision.nextAction).toBeTruthy();
    }
  });

  it('blocked: service unavailable (unavailable)', () => {
    const decision = routeSpecialistPrompt(
      'I need OCR for this image',
      buildRegistry(),
      buildOptions({ healthMap: { 't-ocr': 'unavailable' } }),
      fixedClock,
    );
    expect(decision.kind).toBe('blocked');
    if (decision.kind === 'blocked') {
      expect(decision.cause).toBe('service-unavailable');
      expect(decision.stateToken).toBe('unavailable');
      expect(decision.nextAction).toBe('retest');
    }
  });

  it('blocked: service unhealthy', () => {
    const decision = routeSpecialistPrompt(
      'I need OCR for this image',
      buildRegistry(),
      buildOptions({ healthMap: { 't-ocr': 'unhealthy' } }),
      fixedClock,
    );
    expect(decision.kind).toBe('blocked');
    if (decision.kind === 'blocked') {
      expect(decision.cause).toBe('service-unavailable');
      expect(decision.stateToken).toBe('unhealthy');
    }
  });

  it('blocked: service quarantined', () => {
    const decision = routeSpecialistPrompt(
      'I need OCR for this image',
      buildRegistry(),
      buildOptions({ healthMap: { 't-ocr': 'quarantined' } }),
      fixedClock,
    );
    expect(decision.kind).toBe('blocked');
    if (decision.kind === 'blocked') {
      expect(decision.cause).toBe('service-unavailable');
      expect(decision.stateToken).toBe('quarantined');
      expect(decision.nextAction).toBe('retest');
    }
  });

  it('blocked: service disabled', () => {
    const decision = routeSpecialistPrompt(
      'I need OCR for this image',
      buildRegistry(),
      buildOptions({
        healthMap: fullHealthMap('available'),
        disabledSet: new Set(['t-ocr']),
      }),
      fixedClock,
    );
    expect(decision.kind).toBe('blocked');
    if (decision.kind === 'blocked') {
      expect(decision.cause).toBe('service-unavailable');
      expect(decision.stateToken).toBe('disabled');
      expect(decision.nextAction).toBe('enable');
    }
  });

  // --- blocked: headless ---

  it('blocked: headless (non-interactive) with Specialist signal', () => {
    const decision = routeSpecialistPrompt(
      'I need OCR for this image',
      buildRegistry(),
      buildOptions({
        isTTY: false,
        healthMap: fullHealthMap('available'),
      }),
      fixedClock,
    );
    expect(decision.kind).toBe('blocked');
    if (decision.kind === 'blocked') {
      expect(decision.cause).toBe('headless-blocked');
      expect(decision.nextAction).toBe('rerun interactively');
    }
  });

  it('headless: no Specialist signal passes through (none)', () => {
    const decision = routeSpecialistPrompt(
      'create a new file',
      buildRegistry(),
      buildOptions({ isTTY: false }),
      fixedClock,
    );
    expect(decision.kind).toBe('none');
  });

  // --- blocked: registry not loaded ---

  it('blocked: registry not loaded (fail-closed)', () => {
    const failRegistry = CapabilityRegistry.fromLoadResult({
      ok: false,
      evidence: {
        manifestVersion: 0,
        cause: 'malformed',
        detail: 'cannot read manifest file: ENOENT',
        timestamp: '2026-07-17T12:00:00.000Z',
      },
    });
    const decision = routeSpecialistPrompt(
      'I need OCR',
      failRegistry,
      buildOptions(),
      fixedClock,
    );
    expect(decision.kind).toBe('blocked');
    if (decision.kind === 'blocked') {
      expect(decision.cause).toBe('registry-unavailable');
      // No service health state applies; stateToken is omitted (canonical
      // tokens only — never a non-canonical 'fail-closed' token).
      expect(decision.stateToken).toBeUndefined();
    }
  });

  // --- direct id mention precedence ---

  it('direct id mention: propose when available', () => {
    const decision = routeSpecialistPrompt(
      'use t-ocr',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('propose');
    if (decision.kind === 'propose') {
      expect(decision.serviceId).toBe('t-ocr');
    }
  });

  it('direct id mention: blocked when unavailable', () => {
    const decision = routeSpecialistPrompt(
      'use t-ocr',
      buildRegistry(),
      buildOptions({ healthMap: { 't-ocr': 'unavailable' } }),
      fixedClock,
    );
    expect(decision.kind).toBe('blocked');
    if (decision.kind === 'blocked') {
      expect(decision.cause).toBe('service-unavailable');
      expect(decision.stateToken).toBe('unavailable');
    }
  });

  it('direct id mention: blocked when disabled', () => {
    const decision = routeSpecialistPrompt(
      'use t-ocr',
      buildRegistry(),
      buildOptions({
        healthMap: fullHealthMap('available'),
        disabledSet: new Set(['t-ocr']),
      }),
      fixedClock,
    );
    expect(decision.kind).toBe('blocked');
    if (decision.kind === 'blocked') {
      expect(decision.cause).toBe('service-unavailable');
      expect(decision.stateToken).toBe('disabled');
    }
  });

  // --- determinism ---

  it('deterministic: same inputs produce identical decision', () => {
    const opts = buildOptions({ healthMap: fullHealthMap('available') });
    const a = routeSpecialistPrompt('I need OCR for this image', buildRegistry(), opts, fixedClock);
    const b = routeSpecialistPrompt('I need OCR for this image', buildRegistry(), opts, fixedClock);
    expect(a).toEqual(b);
  });

  // --- user bytes preserved ---

  it('user bytes preserved: prompt is not modified', () => {
    const prompt = 'ฉันต้องการ OCR';
    const decision = routeSpecialistPrompt(
      prompt,
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(prompt).toBe('ฉันต้องการ OCR');
    // The provenance should contain the hash of the original prompt
    if (decision.kind === 'propose' || decision.kind === 'clarify' || decision.kind === 'refused' || decision.kind === 'blocked' || decision.kind === 'none') {
      expect(decision.provenance.promptHash).toBeTruthy();
    }
  });

  // --- no silent substitution ---

  it('no silent substitution: ambiguous -> clarify, never auto-pick', () => {
    // "text/plain" matches both extract-address and NER via supportedInputs
    const decision = routeSpecialistPrompt(
      'text/plain',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    // Must be clarify, not propose
    expect(decision.kind).toBe('clarify');
  });

  it('no silent substitution: refused never proposes a different service', () => {
    // "translate" only matches the non-invokable typhoon-translate
    const decision = routeSpecialistPrompt(
      'translate this to Thai',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('refused');
    // Should not silently propose a different service
    expect(decision.kind).not.toBe('propose');
  });

  // --- canonical state tokens ---

  it('canonical state tokens are emitted unchanged', () => {
    const decision = routeSpecialistPrompt(
      'I need OCR for this image',
      buildRegistry(),
      buildOptions({ healthMap: { 't-ocr': 'unavailable' } }),
      fixedClock,
    );
    expect(decision.kind).toBe('blocked');
    if (decision.kind === 'blocked') {
      expect(decision.stateToken).toBe('unavailable');
    }
  });

  // --- speech-to-text match ---

  it('propose: speech-to-text match', () => {
    // "speech" is a search term for speech-to-text
    const decision = routeSpecialistPrompt(
      'speech recognition',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('propose');
    if (decision.kind === 'propose') {
      expect(decision.serviceId).toBe('speech-to-text');
    }
  });

  // --- NER match ---

  it('propose: named entity recognition match', () => {
    // "ner" is a search term for named-entity-recognition
    const decision = routeSpecialistPrompt(
      'ner extraction',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('propose');
    if (decision.kind === 'propose') {
      expect(decision.serviceId).toBe('named-entity-recognition');
    }
  });

  // --- extract-address match ---

  it('propose: extract address match', () => {
    // "location" is a search term for extract-address
    const decision = routeSpecialistPrompt(
      'extract location from this text',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('propose');
    if (decision.kind === 'propose') {
      expect(decision.serviceId).toBe('extract-address');
    }
  });

  // --- edge cases ---

  it('handles prompt with only whitespace', () => {
    const decision = routeSpecialistPrompt(
      '   ',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('none');
  });

  it('handles prompt with special characters', () => {
    const decision = routeSpecialistPrompt(
      '!!! OCR ???',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('propose');
    if (decision.kind === 'propose') {
      expect(decision.serviceId).toBe('t-ocr');
    }
  });

  it('propose decision includes provenance with promptHash', () => {
    const decision = routeSpecialistPrompt(
      'I need OCR for this image',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('propose');
    if (decision.kind === 'propose') {
      expect(decision.provenance.promptHash).toMatch(/^[0-9a-f]{64}$/);
      expect(decision.provenance.matchedTerms).toBeDefined();
      expect(decision.provenance.matchedTerms['t-ocr']).toBeDefined();
    }
  });

  it('refused with Catalogued reason when signal matches non-invokable entry', () => {
    // "translate" matches the non-invokable typhoon-translate, so it should be refused with Catalogued reason
    const decision = routeSpecialistPrompt(
      'translate this to Thai',
      buildRegistry(),
      buildOptions({ healthMap: fullHealthMap('available') }),
      fixedClock,
    );
    expect(decision.kind).toBe('refused');
    if (decision.kind === 'refused') {
      expect(decision.reason).toBe('Catalogued — Not available yet');
    }
  });

  it('AMBIGUITY_DELTA is exported and is a number', () => {
    expect(typeof AMBIGUITY_DELTA).toBe('number');
    expect(AMBIGUITY_DELTA).toBeGreaterThan(0);
  });

  it('MATCHER_VERSION is exported and is a number', () => {
    expect(MATCHER_VERSION).toBe(1);
  });
});
