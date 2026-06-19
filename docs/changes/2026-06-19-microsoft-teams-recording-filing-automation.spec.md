# Scope

This change set defines the operating rules for the Microsoft Teams recording filing workflow in this repo.

## Inputs

- Source Microsoft Teams recordings from a local OneDrive `Recordings` folder
- Local config from `config.local.json`
- Configured target folders
- Human approval decisions from `approvals.json`
- Microsoft Stream page access for transcript download

## Required Behavior

- Generate a reviewable list of recordings from the source folder.
- Compute duration, date metadata, and short-clip detection.
- Suggest a destination from local `routingRules`.
- Detect whether matching MP4 or VTT files already exist in configured target folders.
- Show review decisions in the UI with approval enabled by default.
- Export approval data without absolute local source or destination paths by default.
- Copy approved MP4 files into the chosen target folder with `yymmdd_` prefix naming.
- Free OneDrive local space after copy.
- Download missing `.vtt` files into the matching target folder through Playwright + Microsoft Stream UI.
- Restrict MP4 and VTT writes to configured destination roots only.

## File And Folder Rules

- Public config examples belong in `config.example.json`.
- Private machine-specific values belong only in `config.local.json`.
- Review UI files stay under `outputs/recording-approval-ui/`.
- Operational scripts stay under `work/recording-approval-ui/`.
- Generated local working data under `outputs/recording-approval-ui/data/` should remain gitignored.
- Change records belong under `docs/changes/`.

## Validation Rules

- Suggested target filenames must be treated as leaf filenames only.
- Target paths must resolve within configured destination roots.
- Approval payloads must not include absolute local source paths by default.
- Public branch scans for full filesystem paths must pass before publication.

## Failure Handling

- Missing or malformed config should stop script execution clearly.
- Missing destination mappings should return explicit status instead of silent fallback.
- Unsafe target filenames or target paths should be rejected with explicit status.
- Stream sign-in may pause the browser automation once, then continue after login.

## Out Of Scope

- Transcript analysis
- Post-filing insight generation
- Generic document classification outside this Teams/OneDrive/Stream filing flow
- Hosted multi-user product behavior
