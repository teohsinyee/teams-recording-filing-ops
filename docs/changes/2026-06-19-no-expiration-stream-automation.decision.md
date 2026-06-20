# Decision Summary

Use a dedicated local Playwright script to enforce `No expiration` on Stream recordings, instead of adding expiry management into the review UI or requiring manual spot checks.

## Context

The maintainer's actual need is binary: every recording should end in a non-expiring state.

A reporting-first approach would add another review surface without removing the manual burden. The repo already has a proven local browser-automation pattern, so expiry enforcement fits naturally beside transcript download automation.

## Options Considered

1. Manual page-by-page expiry cleanup
2. Expiry reporting only
3. Local batch automation that removes expiration directly
4. Graph API or deeper Microsoft platform integration

## Chosen Approach

Choose option 3.

Key decisions:

- Reuse the local Playwright profile already used for Stream transcript automation.
- Treat `No expiration` as the terminal safe state.
- Treat `Expires in ...` as actionable and click `Remove expiration` directly.
- Persist local result JSON files under ignored working-data paths.
- Keep the flow CLI-first instead of adding another UI surface.
- Restrict opened recording URLs to expected SharePoint Stream URLs only.

## Rejected Alternatives

### Manual cleanup

Rejected because it keeps another repetitive Stream task on the human.

### Reporting only

Rejected because the user explicitly does not care about an expiry dashboard. The need is enforcement, not visibility.

### Graph API integration

Rejected because the repo already avoids that path and the browser workflow is sufficient.

## Consequences

- The repo gains another Stream-specific Playwright automation path.
- The automation remains local and tied to the signed-in browser profile.
- Result artifacts stay transient and should remain gitignored.
- Some recordings may still need future interpretation if Stream changes its expiry UI wording.

## Follow-Up Decisions

- Decide later whether `ensure-no-expiration` should run automatically after weekly approval flow.
- Decide later whether to classify retention-controlled recordings separately from regular `No expiration`.
