// Reviewed NER fixture for Story 4.13. Provides deterministic Thai/mixed-language
// text containing known names, organizations, and locations, expected entities
// (text+label+offset), and a helper to build the defined AI-for-Thai NER response
// JSON for tests. No network, no Math.random, no Date.now.

// ---------------------------------------------------------------------------
// Deterministic Thai/mixed-language input text
// ---------------------------------------------------------------------------

/** Deterministic Thai/mixed-language text for the NER fixture. Contains known
 * names, organizations, and locations for entity extraction. */
export const FIXTURE_NER_TEXT =
  'นายสมชาย ใจดี ทำงานที่บริษัท ไทยเทค จำกัด ในกรุงเทพมหานคร ' +
  'เมื่อวันที่ 15 มกราคม 2024 เขาได้พบกับ คุณสมหญิง รักเรียน ที่สนามบินสุวรรณภูมิ';

// ---------------------------------------------------------------------------
// Expected entities
// ---------------------------------------------------------------------------

/** Expected entity: person name (สมชาย ใจดี). */
export const EXPECTED_ENTITY_PERSON = {
  text: 'สมชาย ใจดี',
  label: 'PERSON',
  offset: 3,
} as const;

/** Expected entity: organization (ไทยเทค จำกัด). */
export const EXPECTED_ENTITY_ORG = {
  text: 'ไทยเทค จำกัด',
  label: 'ORGANIZATION',
  offset: 28,
} as const;

/** Expected entity: location (กรุงเทพมหานคร). */
export const EXPECTED_ENTITY_LOC = {
  text: 'กรุงเทพมหานคร',
  label: 'LOCATION',
  offset: 47,
} as const;

/** Expected entity: person name (สมหญิง รักเรียน). */
export const EXPECTED_ENTITY_PERSON2 = {
  text: 'สมหญิง รักเรียน',
  label: 'PERSON',
  offset: 88,
} as const;

/** Expected entity: location (สนามบินสุวรรณภูมิ). */
export const EXPECTED_ENTITY_LOC2 = {
  text: 'สนามบินสุวรรณภูมิ',
  label: 'LOCATION',
  offset: 107,
} as const;

/** Expected confidence from the NER fixture. */
export const EXPECTED_CONFIDENCE = 0.92;

/** All expected entities for the NER fixture. */
export const EXPECTED_ENTITIES: readonly {
  readonly text: string;
  readonly label: string;
  readonly offset: number;
}[] = [
  EXPECTED_ENTITY_PERSON,
  EXPECTED_ENTITY_ORG,
  EXPECTED_ENTITY_LOC,
  EXPECTED_ENTITY_PERSON2,
  EXPECTED_ENTITY_LOC2,
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single entity in the NER response. */
export interface NerEntity {
  readonly text: string;
  readonly label: string;
  readonly offset?: number;
}

/**
 * NER response shape. All fields are optional to allow tests to omit keys
 * (simulating a missing field from the service).
 */
export interface NerResponse {
  readonly entities?: readonly NerEntity[] | null;
  readonly confidence?: number | null;
}

// ---------------------------------------------------------------------------
// Response builder
// ---------------------------------------------------------------------------

/**
 * Build an NER response object for tests. Overrides any field by passing a
 * value; pass `undefined` to omit a key from the response (simulating a missing
 * field from the service). Returns a plain object suitable for JSON.stringify
 * and InMemorySpecialistTransport.
 */
export function buildNerResponse(
  overrides?: Partial<NerResponse>,
): Record<string, unknown> {
  const response: Record<string, unknown> = {};

  if (overrides != null) {
    if ('entities' in overrides) {
      response.entities = overrides.entities;
    } else {
      response.entities = EXPECTED_ENTITIES.map(e => ({ ...e }));
    }
    if ('confidence' in overrides) {
      response.confidence = overrides.confidence;
    } else {
      response.confidence = EXPECTED_CONFIDENCE;
    }
  } else {
    response.entities = EXPECTED_ENTITIES.map(e => ({ ...e }));
    response.confidence = EXPECTED_CONFIDENCE;
  }

  return response;
}
