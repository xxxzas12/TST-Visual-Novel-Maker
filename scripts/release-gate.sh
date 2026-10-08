#!/usr/bin/env bash
# Full check for a version: installer build, lint, unit tests, all E2E (incl. the packaged app).
set -e
cd "$(dirname "$0")/.."
unset ELECTRON_RUN_AS_NODE
npm run dist
npm run lint
npm test
npx playwright test
