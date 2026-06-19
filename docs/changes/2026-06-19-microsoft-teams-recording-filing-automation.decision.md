# Decision Summary

Use a local review-first workflow for Microsoft Teams recordings: Codex automation prepares the weekly review set, the human approves routing decisions in a table UI, local scripts copy approved MP4 files, and Playwright downloads missing `.vtt` transcripts from Microsoft Stream.

## Context

The recording titles are often good enough for suggestions but not good enough for blind auto-filing.

The repo also needed to be safe for public visibility, which ruled out keeping private local paths, personal routing keywords, and accidental machine-specific links in committed code and docs.

## Options Considered

1. Full auto-filing with no approval step
2. Manual-only workflow with a helper list
3. Review-first local automation with post-approval copy and transcript download
4. Graph API or deeper Microsoft integration

## Chosen Approach

Choose option 3.

Key decisions:

- Use a table-based review UI instead of a JSON-editing workflow.
- Keep approval as the only required human step after the weekly trigger.
- Keep routing suggestions configurable via local `routingRules` in `config.local.json`.
- Use Playwright against the Stream UI for transcript download instead of Graph API.
- Keep the repo scope narrow: filing MP4 and VTT files into the correct folders.
- Rewrite public branch history when privacy-leaking commits appeared.

## Rejected Alternatives

### Full auto-filing with no approval

Rejected because recording names can be ambiguous, mis-recorded, or too short to keep, and blind filing is too risky for private working files.

### Manual-only workflow

Rejected because it keeps all repetitive work on the human and does not solve the weekly burden.

### Graph API integration

Rejected because the desired workflow explicitly avoided it, and the Stream UI path was sufficient.

## Consequences

- The workflow is intentionally local and Microsoft-specific.
- The UI and scripts stay simple because they optimize for one recurring job.
- The repo needs stronger privacy hygiene than a typical demo tool because local approvals and paths can leak easily.
- Safety checks around target paths and exported approval data are required, not optional.

## Follow-Up Decisions

- Decide later whether to harden any future hosted UI variant.
- Decide later whether to shrink approval payload fields further.
