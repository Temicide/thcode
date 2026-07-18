# Model and Service Capability Matrix

This matrix records only capabilities supported by reviewed primary sources. Deployment access, quota, license, and competition-platform availability must be verified separately.

## Candidate Thai models

| Candidate | Confirmed modality | Relevant strength | Current caution |
| --- | --- | --- | --- |
| Pathumma LLM Vision 2.0.0 preview | Image + text to text | Visual question answering and image captioning in Thai | Preview model; model card contains an unresolved license placeholder; coding and structured tool-use performance are unverified |
| THaLLE 0.2 ThaiLLM 8B | Text to text | Thai and finance-oriented text generation; Apache-2.0 model card | No reviewed evidence of raw-image input; coding and tool-use performance are unverified |
| Typhoon 2.5 30B A3B Instruct API | Text to text | Official documentation names instruction following, tool use, Thai NLP, and a 128K context window | The reviewed API table calls it a text model; OCR is documented as a separate API; AI for Thai deployment access is unverified |

## Applicant access status

| Dependency | Access | MVP role |
| --- | --- | --- |
| Typhoon API | Confirmed by applicant | Primary reasoning and structured tool-call experiments |
| Typhoon OCR | Entitlement not yet tested; documented under Typhoon API | Temporary vision/document fallback during development, not a substitute for required AI for Thai integration |
| AI for Thai API key | Pending | Required Thai-platform tool integration and competition demonstration |
| Pathumma Vision | Unknown | Optional native vision adapter after access and license validation |
| THaLLE inference | Unknown | Optional text-model adapter after access and capability validation |

## CLI exposure

The CLI `/models` command should display only configured, reachable reasoning adapters and should include capability and status metadata:

```text
Reasoning models
* typhoon-v2.5   default   text, tools, 128k   available
  pathumma       optional  text                unavailable: no endpoint
  thalle         optional  text                unavailable: no endpoint
```

AI for Thai OCR, captioning, and other specialist APIs belong in a separate tool registry. They should be inspectable through `/tools`, not mixed into `/models`.

Primary references:

- Pathumma Vision model card: https://huggingface.co/nectec/Pathumma-llm-vision-2.0.0-preview
- THaLLE model card: https://huggingface.co/KBTG-Labs/THaLLE-0.2-ThaiLLM-8B-fa
- Typhoon documentation: https://docs.opentyphoon.ai/en/

## AI for Thai vision building blocks

The current platform catalog includes or references:

- character recognition and OCR;
- object recognition;
- caption generation;
- image-text correlation or search;
- specialized recognition services.

Catalog references:

- https://aiforthai.in.th/
- https://demo-service.aiforthai.in.th/

## Routing policy

### Native vision route

Use only when the selected endpoint explicitly accepts image input.

```text
explicit image mention
  -> local validation and consent
  -> verified vision-language endpoint
  -> visual answer/evidence
  -> reasoning and local tool plan
```

### Tool-assisted vision route

Use for a text-only reasoning model or when specialist extraction is preferable.

```text
explicit image mention
  -> local validation and consent
  -> AI for Thai OCR/caption/object tools
  -> normalized visual evidence
  -> text-only Thai reasoning model
  -> local tool plan
```

### Optional ensemble route

For evaluation, compare or combine native VLM output with specialist AI for Thai extraction. Conflicts must remain visible rather than being silently merged.

## Required validation before proposal claims

- Confirm which candidate endpoints are accessible through AI for Thai during the competition.
- Confirm accepted image formats, limits, latency, rate limits, and retention terms.
- Resolve model and dataset licenses for Docker deployment.
- Evaluate Thai coding tasks, structured tool-call reliability, and image understanding separately.
- Do not claim that a model family is multimodal when the chosen endpoint is text-only.
- Confirm whether the public AI for Thai trial limit of 10 calls per day applies to the selected service and whether finalists receive a development quota.
- Cache vision extraction by file hash so repeated reasoning turns do not consume another vision request for an unchanged artifact.
