# WebVOWL — Claude Code Instructions

## Git

- All commits must be signed (`git commit -S`)
- Use `gh` CLI to check issues

## Build & Deploy

- **No dependency changes** — build and hot-swap into running container:
  ```
  npm run release && docker cp deploy/. webvowl-server-1:/usr/share/nginx/html/
  ```
- **Dependency changes** (package.json modified) — full Docker rebuild:
  ```
  docker compose build --no-cache && docker compose up -d
  ```

## Testing Before Commit/Push

- **Always rebuild the Docker container and manually verify the app before committing or pushing:**
  ```
  docker compose build --no-cache && docker compose up -d
  ```
  Then open the app in the browser and confirm it loads and works correctly.

## Committing

Commit messages:
- should be succinct. 
- don't need to explicitly mention what was modified in every file.
- should explain the nature of the changes or feature without mentioning the "Phase X" from plans we develop. No one knows what "Phase 3.B." and I won't remember what that meant a week later, either.

## Code Intelligence

- Prefer LSP tools (goToDefinition, findReferences, documentSymbol, workspaceSymbol, hover) over grep/search for navigating and understanding code
