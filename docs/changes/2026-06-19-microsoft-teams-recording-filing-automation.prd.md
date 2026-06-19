# Summary

Build a local-first workflow for filing Microsoft Teams meeting recordings from OneDrive into the correct target folders, with a human approval step before copy and an automated transcript download step for missing `.vtt` files.

## Problem

Weekly Teams recordings accumulate in a raw OneDrive `Recordings` folder.

Without tooling, the maintainer must repeatedly:

- decide which target folder each recording belongs to
- rename copied MP4 files with a date prefix
- check whether the recording was already copied under a different name
- check whether a transcript `.vtt` already exists in the target folder
- open Microsoft Stream and manually download missing transcripts

This is repetitive, error-prone, and privacy-sensitive because recordings are private working files.

## Why Now

The filing flow is recurring weekly work, not one-off cleanup.

A lightweight approval workbench plus post-approval automation reduces repeated manual effort while keeping the last routing decision in human hands.

## Goals

- Generate a weekly review list from the source recording folder.
- Suggest target folders automatically from configurable local routing rules.
- Let the human review and approve in a simple table UI.
- Copy approved MP4 files with `yymmdd_` prefixes into the correct target folder.
- Detect and download missing `.vtt` files from Microsoft Stream into the same folder.
- Keep private local paths and routing logic out of the public repo.

## Non-Goals

- Transcript analysis
- Insight generation
- Meeting summarization
- Generic media-library organization
- Graph API integration

## Affected Users Or Maintainers

- The maintainer who reviews weekly Teams recordings
- Future maintainers who need to understand or reuse the filing workflow
- Anyone with the same Microsoft Teams + OneDrive + Stream pain pattern

## Success Criteria

- The weekly review can be reduced to opening the UI, checking folder decisions, and approving.
- Approved MP4 files land in the correct target folder with the required date prefix.
- Missing `.vtt` files can be downloaded into the matching target folder with browser automation.
- Public branch history contains no private local paths or personal routing rules.
- Generated approval files no longer export absolute local paths by default.

## Open Questions

- Whether future hosted versions of the review UI need browser-side hardening such as CSP.
- Whether the approval export should be reduced further to only `name`, `destinationId`, and review flags.
