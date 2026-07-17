// CoreProtocolV1 version (AD-2, AD-3). A major-version mismatch fails startup
// (AD-2 "major-version mismatch fails startup"). The version is the single
// compatibility gate between UI, persistence, and adapters.

export const PROTOCOL_MAJOR = 1 as const;
export const PROTOCOL_MINOR = 0 as const;

export function protocolVersion(): string {
  return `${PROTOCOL_MAJOR}.${PROTOCOL_MINOR}`;
}