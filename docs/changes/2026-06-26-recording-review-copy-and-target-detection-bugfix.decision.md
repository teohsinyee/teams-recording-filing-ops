# Decision Summary

Fix the bugs at the shared data and detection points instead of patching individual symptoms in the UI.

## Context

The failures came from missing approval payload fields and from MP4 detection being less exact than VTT detection.

## Chosen Approach

- Save `sourceDir` and `destinations` in the approval payload.
- Let the copy script fall back to configured destinations when older payloads do not include them.
- Reuse a found VTT match to check for the exact renamed MP4 in the same destination before falling back to duration-based heuristics.

## Rejected Alternatives

### UI-only patching

Rejected because the copy failure was not a display-only problem.

### Heuristic-only MP4 matching

Rejected because the exact renamed file already existed in some target folders and the heuristic still missed it.

## Consequences

- New approval files are more complete.
- Older approval files remain usable.
- MP4 and VTT destination checks now behave consistently for renamed copies.
