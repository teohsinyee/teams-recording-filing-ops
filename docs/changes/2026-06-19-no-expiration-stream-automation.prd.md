# Summary

Add a local Playwright automation that ensures Microsoft Stream recordings do not expire by checking each recording page and removing expiration when needed.

## Problem

Some recordings in Stream still show an expiry badge such as `Expires in 12 days`, while others already show `No expiration`.

The maintainer does not want to manually inspect and fix these one by one. The goal is not reporting. The goal is simply to ensure that every recording is safe from expiry without extra human review.

## Why Now

The repo already has a browser-automation path for Stream transcript work, so expiry removal can reuse the same local profile and access model.

This is recurring maintenance on private Microsoft Teams recordings, and it is small enough to automate directly instead of leaving it as another weekly manual task.

## Goals

- Check each recording's Stream page for its current expiry state.
- Detect recordings that already show `No expiration` and skip them.
- Detect recordings that still show `Expires in ...` and remove expiration automatically.
- Save a local result file for the run.
- Keep the automation local-first and consistent with the existing Stream automation approach.

## Non-Goals

- Building an expiry dashboard
- Adding expiry columns into the review UI
- Managing retention labels or Microsoft compliance policy behavior
- Replacing existing recording copy or transcript workflows

## Affected Users Or Maintainers

- The maintainer who owns weekly Microsoft Teams recording filing
- Future maintainers who want one-command “make everything not expire” behavior

## Success Criteria

- The maintainer can run one command and not manually open each Stream page.
- Recordings that already show `No expiration` are skipped without churn.
- Recordings that still show `Expires in ...` are updated to `No expiration` when Stream allows it.
- Run results are saved locally without being committed.

## Open Questions

- Whether some recordings with compliance or retention behavior should be surfaced differently from ordinary `No expiration`.
- Whether this should later be chained into the weekly post-review flow automatically.
