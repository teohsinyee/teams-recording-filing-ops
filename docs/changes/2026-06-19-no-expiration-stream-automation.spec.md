# Scope

This change set defines the operating rules for a local “ensure no expiration” Stream automation flow.

## Inputs

- `outputs/recording-approval-ui/data/recordings.json`
- Microsoft Stream page URLs from each recording's `sourceUrl`
- Existing local Playwright profile under `work/recording-approval-ui/playwright-profile`

## Required Behavior

- Open each candidate recording with a real browser session.
- Allow only `https://...sharepoint.com/.../_layouts/15/stream.aspx` source URLs.
- Detect `No expiration` from the current page and mark the item safe without changes.
- Detect `Expires in ...` from the current page and open the expiry control.
- Click `Remove expiration` when that option is available.
- Re-check the page state after the action and confirm the recording now shows `No expiration`.
- Save a local JSON result file describing each item's status.

## File And Folder Rules

- The Node automation lives in `work/recording-approval-ui/ensure-no-expiration.mjs`.
- The PowerShell wrapper lives in `work/recording-approval-ui/ensure-no-expiration.ps1`.
- The npm script entry belongs in `package.json`.
- Generated result files under `outputs/recording-approval-ui/data/expiration-results-*.json` must remain gitignored.
- Temporary test subsets and debug screenshots must remain gitignored.

## Validation Rules

- JSON inputs must be read with UTF-8 BOM tolerance.
- Opened URLs must pass the SharePoint Stream allowlist check before navigation.
- Only visible Stream states should drive behavior: `No expiration`, `Expires in ...`, or explicit unknown.
- Unknown expiry state should not trigger destructive fallback actions.

## Failure Handling

- If the recording URL is not an allowed Stream URL, return `invalid-source-url`.
- If no expiry state can be detected, return `unknown`.
- If `Remove expiration` is clicked but the page does not settle to `No expiration`, return `failed`.
- If Microsoft sign-in is required, wait for the existing local login flow instead of failing immediately.

## Out Of Scope

- Retention-policy administration
- Expiry dashboards in the approval UI
- Server-side or cloud-hosted execution
- Graph API integrations
