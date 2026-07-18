# ADR 0011: Registry-Driven AI for Thai Tool Catalog

- Status: Accepted
- Date: 12 July 2026
- Decision owner: Applicant
- Amends: ADR 0010

## Context

The applicant wants thcode to support the complete AI for Thai service catalog rather than only OCR. The catalog currently spans language, vision, conversation, and other services, with different input and output modalities. Treating every endpoint as an identical MCP call would hide incompatible payloads, privacy risks, quotas, and result formats. Exposing every tool schema to the reasoning model on every turn would also consume context and reduce tool-selection reliability.

The public catalog reviewed on 12 July 2026 displayed 49 active service entries: 20 language, 20 vision, 7 conversation, and 2 other services. Catalog presence does not by itself prove API entitlement, documentation completeness, endpoint health, or thcode compatibility.

## Decision

thcode will target the complete AI for Thai catalog through a versioned capability registry and adapter families.

### Support levels

Every service has an explicit support level:

1. **Catalogued:** visible in `/tools` with metadata, but not claimed to be callable.
2. **Integrated:** has an implemented endpoint mapping and credential policy.
3. **Verified:** passes a repeatable contract test against the live service with representative input.
4. **Demo-certified:** verified end to end through the Typhoon agent loop and approved for the competition demonstration.

The CLI must display the level and must not describe a catalogued-only service as supported or available.

### Capability registry

Each registry entry records:

- stable thcode tool identifier and upstream service name;
- upstream catalog identifier, source URL, and observation date;
- category, description, and search terms in Thai and English;
- input modality, size constraints, and accepted media types;
- normalized input and output schemas;
- endpoint, HTTP transport, timeout, retry, and quota behavior;
- credential scope and entitlement status;
- privacy and sensitivity classification;
- confirmation policy;
- support level, adapter version, and last contract-test result.

### Catalog source

- Phase 1 ships a versioned Catalog Manifest checked into the thcode release.
- The manifest is derived from a reviewed snapshot of the official AI for Thai catalog rather than scraping the website when the CLI starts.
- `/tools` displays the manifest version and observation date so catalog discovery is not confused with live availability.
- Adding, removing, or renaming a service requires a reviewed manifest update.
- Runtime catalog synchronization is deferred until AI for Thai provides a documented discovery contract or thcode operates a trusted, versioned catalog feed.

### Adapter families

Prefer reusable transport and normalization families over 49 unrelated implementations:

- text and JSON;
- image or document upload;
- audio or video upload/streaming;
- binary or media output;
- asynchronous job and polling;
- model/chat streaming;
- service-specific custom adapters where a common family is insufficient.

### Model-facing tool discovery

- `/tools` lets the user browse, search, inspect, enable, disable, and diagnose the entire registry.
- The reasoning model receives only a small, task-relevant subset of schemas selected by the tool router.
- The model never receives API keys.
- Missing entitlement, exhausted quota, unsupported media, or failed health checks produce explicit unavailable states rather than silent fallback.
- Identity, biometric, medical, or other sensitive tools require stricter consent and data-handling policies.

## Phase implications

### Phase 1

- Typhoon remains the required reasoning provider.
- The local CLI holds the user's separate AI for Thai developer key.
- All current AI for Thai services are catalogued and discoverable in `/tools`.
- A service is advertised as callable only after its adapter is integrated.
- The Verification Quartet must pass repeatable live contract tests: Named Entity Recognition for Language, T-OCR for Vision, Speech-to-Text for Conversation, and Extract Address for Other.
- The Demo Portfolio is T-OCR, Speech-to-Text, and Extract Address. Each must pass a complete Typhoon-driven coding scenario.
- The portfolio uses three short, independent Demo Scenarios rather than one compound workflow, so each integration can be evaluated and diagnosed separately.
- Named Entity Recognition is verified coverage but is not required in a public demonstration.

### Phase 2

- The onboarded thcode service exposes the same normalized registry contract.
- The exact AI for Thai gateway and downstream credential behavior remains subject to organizer confirmation.
- Broader verification proceeds category by category until the full accessible catalog has passing contract tests.

## Proposal language

Use:

> thcode is designed to connect the complete AI for Thai catalog through a registry-driven tool layer, dynamically selecting only the services relevant to each task.

Do not use until proven:

> thcode fully supports every AI for Thai service.

## Consequences

- New or changed services can be added without changing the agent loop.
- Users and judges can see exactly which integrations are merely listed versus working and tested.
- Phase 1 discovery is deterministic and works offline, but a newly published AI for Thai service will not appear until the Catalog Manifest is updated.
- Full verification depends on API documentation, entitlement, quotas, fixtures, and service availability.
- The prototype must prioritize representative end-to-end paths while preserving the complete-catalog architecture.
