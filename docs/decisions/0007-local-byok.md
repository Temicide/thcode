# ADR 0007: Keep Reasoning-Provider Keys Local

- Status: Amended by ADR 0010
- Date: 12 July 2026
- Decision owner: Applicant

## Context

The first-run CLI experience asks the user to select a reasoning provider and supply an API key. Sending that provider key to the hosted thcode service would require users to trust thcode with credentials for third-party model accounts and would expand the security and compliance scope.

The local CLI already owns the agent loop, provider selection, repository context, local tools, permissions, and session history. It can call the selected provider directly.

## Decision

thcode will use local bring-your-own-key authentication for reasoning providers.

- The CLI stores provider keys in the operating system credential store.
- The local provider adapter sends reasoning requests directly to the selected provider.
- The hosted thcode service never receives a reasoning-provider key.
- In Phase 1, the local AI for Thai adapter may use a separate locally stored user API key to call specialist services directly. Phase 2 credential behavior depends on the AI for Thai onboarding gateway and is defined in ADR 0010.
- Project configuration stores provider and model identifiers, never secret values.

## Required onboarding behavior

1. User selects a provider.
2. CLI explains where the credential will be stored and which host it will contact.
3. User pastes the key through a masked, non-echoing input.
4. CLI writes it to the OS credential store.
5. CLI performs a minimal provider health check.
6. CLI displays the connected account/provider status without exposing the key.

## Security invariants

- Never persist a provider key in the repository, `.env`, thcode config, logs, telemetry, crash reports, prompts, or session transcripts.
- Never send a provider key to the hosted thcode service or another provider. Send each key only to its configured official provider endpoint; an AI for Thai key may be sent only to verified AI for Thai endpoints.
- Redact recognized credential patterns from tool output before they enter a reasoning turn.
- Support explicit credential removal and rotation.
- Do not silently reuse a key for a different provider hostname.

## Consequences

- Users retain direct control of model-provider credentials and billing.
- thcode's hosted breach surface excludes third-party provider keys.
- Provider calls originate from the developer's machine, so local network access is required.
- Cross-platform credential storage requires operating-system-specific adapters.
- The Windows-first prototype must use a Windows credential-store adapter; macOS Keychain and Linux secret-store adapters are deferred.
- The hosted competition service focuses on AI for Thai artifact and specialist-tool orchestration rather than proxying reasoning models.

## CLI implications

```text
/connect        Add or replace a locally stored provider credential
/models         Show models available through configured local providers
/disconnect     Remove a provider credential from the OS credential store
/status         Show provider hostname and connection status without secrets
```
