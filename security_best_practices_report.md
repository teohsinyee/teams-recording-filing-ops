# Security Best Practices Report

## Executive Summary

This branch is much safer than the earlier privacy-leaking versions, but it still has two meaningful local-security issues and one privacy-by-default issue.

The highest-risk theme is that the automation trusts locally generated JSON too much. If `approvals.json` or `recordings.json` is tampered with, the scripts can write files outside the intended filing locations.

## High Severity

### 1. Arbitrary local file write via trusted JSON paths in VTT download flow

- Severity: High
- Location:
  - [work/recording-approval-ui/download-missing-vtt.mjs](C:/Users/sinyee/Documents/Codex/2026-06-18/c-users-sinyee-onedrive-avnet-recordings/work/recording-approval-ui/download-missing-vtt.mjs:57)
  - [work/recording-approval-ui/download-missing-vtt.mjs](C:/Users/sinyee/Documents/Codex/2026-06-18/c-users-sinyee-onedrive-avnet-recordings/work/recording-approval-ui/download-missing-vtt.mjs:85)
  - [work/recording-approval-ui/download-missing-vtt.mjs](C:/Users/sinyee/Documents/Codex/2026-06-18/c-users-sinyee-onedrive-avnet-recordings/work/recording-approval-ui/download-missing-vtt.mjs:112)
- Evidence:
  - `const targetVttPath = resolveTargetVttPath(item);`
  - `await download.saveAs(targetVttPath);`
  - `return path.join(destinationDir, replaceFileExtension(item.suggestedNewName, ".vtt"));`
- Impact:
  - If a malicious or corrupted `recordings.json` / `approvals.json` injects a crafted destination or filename, the script can save downloaded files to unintended local paths.
- Why this matters:
  - This repo is local-first, but it still processes JSON as if it were trusted control-plane input. A poisoned approval/data file becomes a file-write primitive.
- Fix:
  - Before `saveAs`, resolve the final path and verify it stays under an approved destination root from config.
  - Reject any filename containing path separators or traversal patterns.

## Medium Severity

### 2. Arbitrary local file write risk in MP4 copy flow

- Severity: Medium
- Location:
  - [work/recording-approval-ui/copy-approved-recordings.ps1](C:/Users/sinyee/Documents/Codex/2026-06-18/c-users-sinyee-onedrive-avnet-recordings/work/recording-approval-ui/copy-approved-recordings.ps1:128)
  - [work/recording-approval-ui/copy-approved-recordings.ps1](C:/Users/sinyee/Documents/Codex/2026-06-18/c-users-sinyee-onedrive-avnet-recordings/work/recording-approval-ui/copy-approved-recordings.ps1:154)
  - [work/recording-approval-ui/copy-approved-recordings.ps1](C:/Users/sinyee/Documents/Codex/2026-06-18/c-users-sinyee-onedrive-avnet-recordings/work/recording-approval-ui/copy-approved-recordings.ps1:159)
- Evidence:
  - `$destDir = $destMap[$item.destinationId]`
  - `$target = Join-Path -Path $destDir -ChildPath $item.suggestedNewName`
  - `if (Copy-FileRobust -SourcePath $sourcePath -TargetPath $target) {`
- Impact:
  - A malicious approval payload can steer copies to unexpected filenames and potentially unexpected paths if `suggestedNewName` is not validated strictly enough.
- Why this matters:
  - The destination root is constrained by `destinationId`, which helps, but the filename itself is still trusted from JSON input.
- Fix:
  - Normalize and validate `suggestedNewName` before use.
  - Enforce a basename-only policy and reject names containing `\`, `/`, `..`, or drive-prefix patterns.
  - After building `$target`, resolve it and confirm it is still under `$destDir`.

### 3. Approval export includes local workstation paths by default

- Severity: Medium
- Location:
  - [outputs/recording-approval-ui/app.js](C:/Users/sinyee/Documents/Codex/2026-06-18/c-users-sinyee-onedrive-avnet-recordings/outputs/recording-approval-ui/app.js:369)
  - [outputs/recording-approval-ui/app.js](C:/Users/sinyee/Documents/Codex/2026-06-18/c-users-sinyee-onedrive-avnet-recordings/outputs/recording-approval-ui/app.js:371)
  - [outputs/recording-approval-ui/app.js](C:/Users/sinyee/Documents/Codex/2026-06-18/c-users-sinyee-onedrive-avnet-recordings/outputs/recording-approval-ui/app.js:377)
- Evidence:
  - `sourceDir: state.data.sourceDir,`
  - `destinations: state.data.destinations,`
  - `sourcePath: recording.sourcePath,`
- Impact:
  - `approvals.json` contains absolute local source paths and destination folder paths, which are easy to accidentally commit, share, or attach elsewhere.
- Why this matters:
  - This is a privacy-by-default weakness rather than remote code execution, but it is especially relevant because this repo has already had path/privacy concerns.
- Fix:
  - Save only stable identifiers in the approval file by default:
    - `name`
    - `destinationId`
    - approval flags
    - note
  - Rehydrate sensitive path fields later from `recordings.json` during execution.

## Low Severity

### 4. No visible browser-side CSP or other client hardening in the local review UI

- Severity: Low
- Location:
  - [outputs/recording-approval-ui/index.html](C:/Users/sinyee/Documents/Codex/2026-06-18/c-users-sinyee-onedrive-avnet-recordings/outputs/recording-approval-ui/index.html:3)
  - [outputs/recording-approval-ui/index.html](C:/Users/sinyee/Documents/Codex/2026-06-18/c-users-sinyee-onedrive-avnet-recordings/outputs/recording-approval-ui/index.html:98)
- Evidence:
  - No CSP meta tag is present.
  - The page executes `data/recordings.js` directly as a script.
- Impact:
  - If local working files are tampered with, malicious JavaScript would execute when the UI is opened.
- False positive notes:
  - This is a local `file://` style tool, so full web hardening may not be practical, and runtime headers may not exist in this deployment model.
- Fix:
  - Treat this as defense-in-depth only.
  - If you keep using a script payload, at least avoid committing generated data files and keep the repo local-trust only.
  - If you ever host the UI, add CSP immediately and stop executing generated data as script.

## Suggested Fix Order

1. Lock file writes to approved destination roots in both MP4 and VTT flows.
2. Remove absolute local paths from `approvals.json`.
3. Only then consider browser hardening for any future hosted version.
