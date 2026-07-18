# API Access and Validation Plan

## Dependency policy

The competition MVP must have one proven primary path. Unverified models are optional adapters and cannot appear as required dependencies in the implementation schedule.

The prototype uses API keys only; it does not depend on OAuth.

## Gate 1: Typhoon reasoning

- Verify the existing key against the current Typhoon instruction model.
- Test Thai coding prompts and machine-readable tool-call output.
- Measure invalid JSON, invalid tool names, argument errors, latency, and retry behavior.
- Keep the key server-side and out of the downloadable CLI.

## Gate 2: Image plumbing

- Test whether the existing Typhoon account can access `typhoon-ocr`.
- Use it only to build the attachment, upload, normalization, and caching pipeline while AI for Thai access is pending.
- Hash image bytes and cache derived evidence so an unchanged file is processed once.

## Gate 3: AI for Thai

- Register as a service user and obtain an API key.
- Select one competition-relevant vision endpoint rather than requesting every service.
- Run one documented request against a safe test image.
- Record supported formats, payload limits, response schema, latency, quota, error behavior, and data terms.
- Ask the organizer whether finalists receive a quota above the public trial allowance.
- Verify whether an onboarded service is called with the same developer API key format as existing services.
- Verify whether a caller's AI for Thai key may authorize downstream AI for Thai service composition or whether the onboarded service must use separate service credentials.

Official registration: https://aiforthai.in.th/register/

## Gate 4: Optional adapters

- Evaluate Pathumma Vision only after access and licensing are resolved.
- Evaluate THaLLE only after an inference route is available.
- Do not delay the primary Typhoon plus AI for Thai integration for these adapters.

## Exit criterion

The access risk is closed when one Thai reasoning call can request one AI for Thai vision operation, consume its normalized result, request a safe local repository action, and finish with an auditable response.
