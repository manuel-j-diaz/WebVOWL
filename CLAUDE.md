# WebVOWL — Claude Code Instructions

## Git

- All commits must be signed (`git commit -S`)
- Use `gh` CLI to check issues

## Build & Deploy

- **No dependency changes** — build and hot-swap into running container:
  ```
  ./node_modules/.bin/grunt release 2>&1 | tail -8 && docker cp deploy/. webvowl-server-1:/usr/share/nginx/html/
  ```
- **Dependency changes** (package.json modified) — full Docker rebuild:
  ```
  docker compose build --no-cache && docker compose up -d
  ```
