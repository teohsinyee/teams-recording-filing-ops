# Summary

Fix three weekly recording-review bugs that caused false copy failures or incorrect target-folder status in the approval UI.

## Problem

The weekly flow had three reliability gaps:

- the approval payload could omit `sourceDir` and `destinations`
- the copy step assumed those fields always existed
- target detection could find a renamed VTT in the destination but still miss the matching renamed MP4

This created confusing outcomes such as `missing-destination` during copy or `VTT in target` plus `Not in target` for the same recording.

## Goals

- Keep saved approval payloads self-contained enough for downstream scripts.
- Let the copy step fall back safely when older approval files are missing fields.
- Make target detection treat an exact renamed MP4 beside an exact renamed VTT as already copied.

## Non-Goals

- Changing the weekly review UX
- Redesigning naming heuristics broadly
- Adding new reporting surfaces

## Success Criteria

- The copy step no longer fails with `missing-destination` for valid reviewed items.
- Recordings already copied with the expected renamed MP4 are shown as already in target.
- The UI no longer shows the inconsistent pair `VTT in target` and `Not in target` for the same copied recording.
