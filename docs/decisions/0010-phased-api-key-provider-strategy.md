# ADR 0010: Phase API-Key and Provider Strategy

- Status: Accepted
- Date: 12 July 2026
- Decision owner: Applicant

## Context

thcode will not initially be available as an onboarded AI for Thai service. The applicant already has Typhoon API access and expects to obtain an AI for Thai developer API key. The product should eventually use AI for Thai as its primary service platform, but the first prototype must work before onboarding.

The product uses API keys rather than OAuth. AI for Thai's public flow currently instructs developers to register, select services, and copy an API key for testing. This does not establish a Claude-style subscription login or delegated OAuth identity.

## Decision

thcode will use two delivery phases.

## Phase 1: pre-onboarding prototype

### Required

- Typhoon is the default reasoning provider.
- The user enters a Typhoon API key during first-run setup.
- The key is stored in Windows Credential Manager through the local credential adapter.
- The CLI calls the official Typhoon endpoint directly.

### Optional but competition-relevant

- The user connects an AI for Thai developer API key separately.
- The key is stored in Windows Credential Manager.
- The CLI calls only configured official AI for Thai tool endpoints. ADR 0011 defines a registry for the complete catalog, explicit support levels, and representative services verified category by category.
- AI for Thai tools enrich the context returned to Typhoon; they are not the Phase 1 reasoning provider.

### Not included

- OAuth
- A thcode subscription account
- Hosted proxying of user provider keys
- Assuming that thcode is already available in the AI for Thai catalog

## Phase 2: onboarded service

After thcode is accepted and deployed on AI for Thai:

- an AI for Thai API key becomes the primary platform credential;
- the CLI uses that key to access the onboarded thcode service and permitted AI for Thai models/tools;
- Typhoon remains an optional external reasoning provider when the user configures a separate local key;
- the CLI preserves local repository tools, permissions, and execution even if remote orchestration expands.

## Unverified Phase 2 assumptions

Before implementation, obtain authoritative answers from AI for Thai:

1. Will the onboarded thcode service be invoked through the standard AI for Thai API-key gateway?
2. What header, endpoint, quota, and error contract will apply?
3. Can one caller key authorize composition with other AI for Thai services?
4. Must the onboarded service use separate internal credentials for downstream services?
5. Does the gateway pass, transform, or strip the caller's API key before the request reaches the service container?

The proposal must not promise a Claude-style account experience until these behaviors are confirmed.

## Credential isolation

- Store Typhoon and AI for Thai keys as separate credential entries.
- Bind each credential to an exact provider hostname and adapter identifier.
- Never include either key in project configuration, logs, prompts, tool results, or telemetry.
- Never use an AI for Thai key against Typhoon or a Typhoon key against AI for Thai.
- Show connection and quota status without displaying secret values.

## Phase 1 onboarding example

```text
$ thcode

Required reasoning provider
  Typhoon API key: ************
  Connected: typhoon-v2.5

Optional Thai service tools
  AI for Thai API key: ************
  Catalogued tools: <registry count>
  Verified tools: <passing contract-test count>

Mode: Plan
Workspace: C:\code\thcode
```

## Phase 2 onboarding target

```text
$ thcode

AI for Thai API key: ************
Connected: thcode service
Available models: <reported by verified platform API>
Available tools: <reported by verified platform API>
```
