# Weekly Runbook

This is the shortest weekly operating guide for the recording review flow.

## When to run

- Every Friday at 6:00 PM

## Step 1: Refresh the review list

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\work\recording-approval-ui\generate-recordings-json.ps1
```

Expected result:

- the local review UI shows the latest pending recordings
- target folders are auto-populated
- rows already matched as copied should drop out of the pending MP4 view

## Step 2: Review in the UI

Open:

- `outputs/recording-approval-ui/index.html`

What to do:

- sort by target folder if needed
- filter `No VTT` if you want transcript follow-up focus
- leave rows as approved by default
- only change target folder when auto-routing is wrong
- mark skip only when you do not want that MP4 copied this week

Expected result:

- the table reflects your final weekly decision

## Step 3: Save approvals

In the UI:

- click `Save`

Expected result:

- `outputs/recording-approval-ui/data/approvals.json` is updated

## Step 4: Run the post-approval flow

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\work\recording-approval-ui\run-approved-flow.ps1
```

What it does:

- copies approved MP4 files
- prefixes copied filenames with `yymmdd_`
- frees OneDrive local space after copy
- downloads missing VTT files into the matching target folder
- refreshes review data so the UI reflects the latest state

## Fast checks after the run

Check in the UI:

- copied MP4 rows should no longer appear in the pending MP4 view
- VTT status should move from `No VTT` to `VTT in target` after successful transcript download

Check in PowerShell output:

- `already-exists` is normal
- `copied` means new MP4 was copied this run
- `downloaded` means new VTT was fetched this run
- `copy-failed` means the file needs manual follow-up
- `failed` in VTT download means Stream UI automation needs attention

## If something fails

- Re-run refresh:
  `powershell -ExecutionPolicy Bypass -File .\work\recording-approval-ui\generate-recordings-json.ps1`
- Re-run only post-approval work:
  `powershell -ExecutionPolicy Bypass -File .\work\recording-approval-ui\run-approved-flow.ps1`
- Re-run only VTT download:
  `powershell -ExecutionPolicy Bypass -File .\work\recording-approval-ui\download-missing-vtt.ps1`
- Limit VTT testing to one recording:
  `powershell -ExecutionPolicy Bypass -File .\work\recording-approval-ui\download-missing-vtt.ps1 -Limit 1`

## Main files

- `work/recording-approval-ui/generate-recordings-json.ps1`
- `work/recording-approval-ui/run-approved-flow.ps1`
- `work/recording-approval-ui/copy-approved-recordings.ps1`
- `work/recording-approval-ui/download-missing-vtt.ps1`
- `outputs/recording-approval-ui/index.html`
