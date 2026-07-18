// Reviewed Extract Address fixture for Story 4.12. Provides deterministic Thai
// address text, expected address components, and a helper to build the defined
// AI-for-Thai Extract Address response JSON for tests. No network, no
// Math.random, no Date.now.

// ---------------------------------------------------------------------------
// Deterministic Thai address input text
// ---------------------------------------------------------------------------

/** Deterministic Thai address text for the Extract Address fixture. */
export const FIXTURE_ADDRESS_TEXT =
  '123/45 หมู่ 6 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110';

// ---------------------------------------------------------------------------
// Expected address components
// ---------------------------------------------------------------------------

/** Expected house number from the Extract Address fixture. */
export const EXPECTED_HOUSE_NUMBER = '123/45';

/** Expected street from the Extract Address fixture. */
export const EXPECTED_STREET = 'สุขุมวิท';

/** Expected subdistrict from the Extract Address fixture. */
export const EXPECTED_SUBDISTRICT = 'คลองเตย';

/** Expected district from the Extract Address fixture. */
export const EXPECTED_DISTRICT = 'คลองเตย';

/** Expected province from the Extract Address fixture. */
export const EXPECTED_PROVINCE = 'กรุงเทพมหานคร';

/** Expected postal code from the Extract Address fixture. */
export const EXPECTED_POSTAL_CODE = '10110';

/** Expected confidence from the Extract Address fixture. */
export const EXPECTED_CONFIDENCE = 0.95;

/** Expected source spans from the Extract Address fixture. */
export const EXPECTED_SOURCE_SPANS: readonly AddressSourceSpan[] = [
  { field: 'houseNumber', offset: 0, length: 6 },
  { field: 'street', offset: 16, length: 10 },
  { field: 'subdistrict', offset: 27, length: 10 },
  { field: 'district', offset: 38, length: 10 },
  { field: 'province', offset: 49, length: 15 },
  { field: 'postalCode', offset: 65, length: 5 },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single source span in the Extract Address response. */
export interface AddressSourceSpan {
  readonly field: string;
  readonly offset: number;
  readonly length: number;
}

/**
 * Extract Address response shape. All fields are optional to allow tests to
 * omit keys (simulating a missing field from the service).
 */
export interface AddressResponse {
  readonly address?: {
    readonly houseNumber?: string | null;
    readonly street?: string | null;
    readonly subdistrict?: string | null;
    readonly district?: string | null;
    readonly province?: string | null;
    readonly postalCode?: string | null;
  } | null;
  readonly confidence?: number | null;
  readonly sourceSpans?: readonly AddressSourceSpan[] | null;
}

// ---------------------------------------------------------------------------
// Response builder
// ---------------------------------------------------------------------------

/**
 * Build an Extract Address response object for tests. Overrides any field by
 * passing a value; pass `undefined` to omit a key from the response (simulating
 * a missing field from the service). Returns a plain object suitable for
 * JSON.stringify and InMemorySpecialistTransport.
 */
export function buildAddressResponse(
  overrides?: Partial<AddressResponse>,
): Record<string, unknown> {
  const response: Record<string, unknown> = {};

  if (overrides != null) {
    if ('address' in overrides) {
      response.address = overrides.address;
    } else {
      response.address = {
        houseNumber: EXPECTED_HOUSE_NUMBER,
        street: EXPECTED_STREET,
        subdistrict: EXPECTED_SUBDISTRICT,
        district: EXPECTED_DISTRICT,
        province: EXPECTED_PROVINCE,
        postalCode: EXPECTED_POSTAL_CODE,
      };
    }
    if ('confidence' in overrides) {
      response.confidence = overrides.confidence;
    } else {
      response.confidence = EXPECTED_CONFIDENCE;
    }
    if ('sourceSpans' in overrides) {
      response.sourceSpans = overrides.sourceSpans;
    } else {
      response.sourceSpans = EXPECTED_SOURCE_SPANS.map(s => ({ ...s }));
    }
  } else {
    response.address = {
      houseNumber: EXPECTED_HOUSE_NUMBER,
      street: EXPECTED_STREET,
      subdistrict: EXPECTED_SUBDISTRICT,
      district: EXPECTED_DISTRICT,
      province: EXPECTED_PROVINCE,
      postalCode: EXPECTED_POSTAL_CODE,
    };
    response.confidence = EXPECTED_CONFIDENCE;
    response.sourceSpans = EXPECTED_SOURCE_SPANS.map(s => ({ ...s }));
  }

  return response;
}
