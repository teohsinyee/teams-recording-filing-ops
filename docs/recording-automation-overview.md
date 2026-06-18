# Recording Automation Overview

This repo automates a weekly recording operations flow for OneDrive-hosted meeting recordings.

## What it does

1. Refreshes a weekly review list from the source `Recordings` folder.
2. Lets a human review target-folder decisions in a local approval workbench.
3. After approval, copies MP4 files to the chosen target folders with a `yymmdd_` prefix.
4. Frees local disk space in OneDrive target folders after copy.
5. Detects whether matching VTT files already exist in target folders.
6. Can batch-open Stream links and download missing VTT files into the matching target folders.

## Weekly flow

```mermaid
flowchart TD
    A["⏰ Weekly trigger (Friday 6pm)"] --> B["⚙️ Generate review data"]
    B --> C["🗂️ Build approval workbench list"]
    C --> D["👤 Human reviews folder targets / skip / approve"]
    D --> E{"Approved?"}
    E -->|No| F["📝 Leave for later review"]
    E -->|Yes| G["📦 Copy MP4 to target folder"]
    G --> H["☁️ Free up OneDrive space"]
    H --> I["🎞️ Check VTT status"]
    I --> J{"Missing VTT?"}
    J -->|No| K["✅ Done"]
    J -->|Yes| L["🌐 Open Stream link"]
    L --> M["📄 Transcript → Download as .vtt"]
    M --> N["💾 Save VTT into matching target folder"]
    N --> K

    classDef step fill:#90EE90,stroke:#333,stroke-width:2px,color:darkgreen
    classDef decision fill:#FFD700,stroke:#333,stroke-width:2px,color:black
    class A,B,C,D,F,G,H,I,K,L,M,N step
    class E,J decision
```

## Main parts

```mermaid
flowchart LR
    Source["📁 OneDrive Recordings"] --> Generator["generate-recordings-json.ps1"]
    Generator --> UI["recording approval UI"]
    UI --> Approvals["approvals.json"]
    Approvals --> Copier["copy-approved-recordings.ps1"]
    Approvals --> VttBot["download-missing-vtt.ps1 / .mjs"]
    Copier --> Targets["🗂️ Target folders"]
    VttBot --> Targets

    classDef primary fill:#87CEEB,stroke:#333,stroke-width:2px,color:darkblue
    classDef storage fill:#E6E6FA,stroke:#333,stroke-width:2px,color:darkblue
    class Source,Targets,Approvals storage
    class Generator,UI,Copier,VttBot primary
```

## Human approval boundary

```mermaid
sequenceDiagram
    participant T as "⏰ Weekly Automation"
    participant U as "👤 User"
    participant UI as "🗂️ Approval UI"
    participant C as "📦 Copy Script"
    participant S as "🌐 Stream/VTT Script"

    T->>UI: Refresh weekly review data
    U->>UI: Review folders / approve / skip
    U->>C: Approve copy
    C->>C: Copy MP4 + free up space
    C->>S: Check missing VTT
    S->>S: Open Stream links + download .vtt
    S->>UI: Next refresh shows updated VTT status
```

## Files

- `outputs/recording-approval-ui/index.html`
- `outputs/recording-approval-ui/app.js`
- `work/recording-approval-ui/generate-recordings-json.ps1`
- `work/recording-approval-ui/copy-approved-recordings.ps1`
- `work/recording-approval-ui/download-missing-vtt.ps1`
- `work/recording-approval-ui/download-missing-vtt.mjs`

## Current assumptions

- Source recordings live in OneDrive `Recordings`.
- Target folders are OneDrive folders maintained by the user.
- MP4 copied-state matching is heuristic.
- VTT download uses browser automation against Stream UI, not Graph API.
- Microsoft login may be required once in the automation browser profile.
