# CIEL UI

CIEL's orbital frontend: an animated Core, six navigation rings, responsive destination pages, and a Conversation preview.

## Run on your PC or laptop

Install Node.js 24 LTS and Git, then open this repository folder in VS Code. Run:

```powershell
npm ci
npm run dev
```

Open http://localhost:8443. Stop the server with Ctrl+C in its terminal. If port 8443 is already occupied, stop the previous server first. The UI uses the configured port by default.

## Project layout

- src/main.tsx: application entry.
- src/App.tsx: forwards to the main app.
- src/app/: Core artwork and motion, navigation, destination pages, local workspace persistence, and the future runtime contract.
- src/index.css and src/styles/: interface styling and fonts.
- public/: browser-served static files.
- src/assets/ and src/imports/: retained design reference media; the Core itself is drawn in SVG.
- tests/: local preference and runtime-contract checks.
- docs/: voice preferences and runtime connection notes.
- plans/: historical design proposal, not the current feature specification.
- .figma/: retained Figma export tooling and site metadata; vite.config.ts depends on its site configuration.
- .vscode/: shared development task.
- AGENTS.md and CLAUDE.md: guidance for coding assistants.

Use npm with package-lock.json for the setup above. pnpm-lock.yaml and .mise.toml are retained for the original Figma tooling; do not alternate package managers for local dependency updates.

## Checks

```powershell
npx tsc --noEmit
node --test tests/*.test.mjs
npm run build
```

## What is functional

Core interactions and animations, navigation, local drafts/settings, backup/restore, and preview-message recovery are functional. Assistant replies, microphone input, speech playback, agents, and integrations are not connected. Preview activity is not evidence of a live service.

Connection and voice delivery contracts are documented in [Runtime contract](docs/RUNTIME_CONTRACT.md) and [Voice preferences](docs/VOICE_PREFERENCES.md).

## Move saved data to another device

Settings → Download local backup exports browser data. Restore it through Settings on the laptop. Cloning this repository transfers source files, not browser messages, drafts, or preferences. Keep personal backups outside the repository.

## GitHub

Publish as a private repository. Generated dependencies, builds, local environment files, logs, and browser-test snapshots are ignored. Review staged files before each commit. .gitignore does not remove files from existing commits.
