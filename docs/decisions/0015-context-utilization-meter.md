# ADR 0015: Context Donut Measures Safe Usable Input Capacity

- Status: Accepted
- Date: 12 July 2026
- Decision owner: Applicant delegated the percentage definition to thcode

The Context Donut at the lower-right of the Prompt Composer reports Active Context Utilization, not Cumulative Token Usage. Its 100% denominator is the selected model's Effective Context Capacity: the verified context limit minus reserved response space and a safety margin. This makes 100% mean that thcode cannot safely add more input while preserving room for a useful response.

When provider metadata does not define stricter values, thcode reserves the greater of the configured maximum output or 8% of the raw context limit for the response, plus the greater of 2,048 tokens or 2% for safety. For a 128,000-token model with no larger configured output reserve, the fallback Effective Context Capacity is 115,200 tokens. Provider-specific limits always override this fallback.

The compact indicator combines a segmented Unicode ring, a numeric percentage, and severity styling so color is not the only signal. Suggested states are green below 70%, amber from 70% through 84%, orange from 85% through 94%, and red from 95% through 100%. If preflight predicts that the next request would exceed 100%, thcode runs Automatic Compaction before the provider call and targets at most 70% utilization. It never knowingly sends the oversized request first.

Cumulative Token Usage remains visible as input, output, and cached-token totals in `/context`, but it has no percentage until the developer configures a separate session budget.

## Consequences

- Switching models recalculates the denominator and may change the displayed percentage immediately.
- The UI must label estimated counts and verified provider counts differently.
- Narrow terminals require a textual fallback such as `Ctx 72%`.
- The donut may briefly display a projected `>100%` preflight state during compaction, but completed outbound requests remain within Effective Context Capacity.
