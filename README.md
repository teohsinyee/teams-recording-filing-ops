# recording-review-ops

Weekly recording review workflow for:

- preparing a reviewable approval table for recordings
- assigning target folders
- copying approved MP4 files with `yymmdd_` prefixes
- freeing up OneDrive space after copy
- checking whether matching VTT files exist in target folders

## Main files

- `outputs/recording-approval-ui/index.html`
- `outputs/recording-approval-ui/app.js`
- `outputs/recording-approval-ui/styles.css`
- `work/recording-approval-ui/generate-recordings-json.ps1`
- `work/recording-approval-ui/copy-approved-recordings.ps1`

## Weekly flow

1. Run `work/recording-approval-ui/generate-recordings-json.ps1`
2. Review in `outputs/recording-approval-ui/index.html`
3. Save approvals
4. Run `work/recording-approval-ui/copy-approved-recordings.ps1`

## Notes

- Source recordings live outside this repo in OneDrive.
- Generated `recordings.json` and `recordings.js` are local working data and should not be committed.
- Saved approval files may contain private file metadata and should not be committed by default.
