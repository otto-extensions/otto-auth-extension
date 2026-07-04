# Otto Auth Extension

This repository provides a tracer-bullet Otto Auth extension that loads payload-selected authentication providers, exposes a unified auth API, and persists metadata to MemPalace.

## Responsibilities
- Load auth providers dynamically from the Otto payload manifest.
- Support local JWT auth plus Google, Microsoft, GitHub, and Apple OAuth placeholders.
- Support manual rescans through command-service execution of `otto.auth.rescan`.
- Support automatic rescans triggered by `OttoUpdateAgent`.
- Persist generation metadata to MemPalace.

## Runtime Assumptions
- `OTTO_MEMPALACE_PATH` can override the MemPalace root.
- The payload manifest can select any subset of the declared providers.

## Validation
- `npm test`
- `npm run typecheck`