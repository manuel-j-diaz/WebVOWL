# WebVOWL

Fork of [WebVOWL](https://github.com/VisualDataWeb/WebVOWL), an OWL ontology visualizer, with a modernized stack and additional capabilities. This fork adds Canvas rendering, ABox visualization, multiple graph layouts, and optional SPARQL endpoint support. OWL2VOWL (the OWL→VOWL converter) ships as a bundled submodule — no separate install required. Runs fully locally or via Docker.

## Quick Start

### Path A — Docker (recommended)

Docker gives you the full stack (nginx + OWL2VOWL sidecar) with no local Java or Node required at runtime. Fuseki integration is optional — you can load ontologies from URLs or files without it.

1. Initialize the submodule:
   ```
   git submodule update --init
   ```
2. Copy the env file (edit only if you're using Fuseki):
   ```
   cp .env.example .env
   ```
3. Build and start:
   ```
   docker compose up --build -d
   ```
4. Open [http://localhost:8080](http://localhost:8080)

### Path B — Local development

For working on the code. Requires Node.js 18+.

1. Install dependencies:
   ```
   npm install
   ```
2. Start the dev server with hot reloading:
   ```
   npm run dev
   ```
   Open [http://localhost:8080](http://localhost:8080)

Or build a static production bundle:
```
npm run release
serve deploy/
```

## Loading Ontologies

OWL2VOWL converts OWL/RDF into the VOWL JSON format that WebVOWL renders. Three ways to load an ontology:

- **By URL** — paste any publicly accessible OWL/RDF URL into the ontology menu
- **By file** — use the file picker in the ontology menu to load a local file
- **From Fuseki** — see [Fuseki Integration](#fuseki-integration-optional) below

## Fuseki Integration (Optional)

nginx sits in front of everything. When OWL2VOWL needs to fetch from Fuseki, it sends the request to `http://server/fuseki/...`. nginx intercepts that path, injects your `Authorization` header from `.env`, and forwards the request to Fuseki — so credentials never touch OWL2VOWL.

### Prerequisites

- An external `semantic-web` Docker network shared with your Fuseki stack:
  ```
  docker network create --internal semantic-web
  ```
  The `--internal` flag blocks internet access — containers communicate only within the network. Ensure your Fuseki stack also joins this network.
- Set `FUSEKI_AUTH_HEADER` in `.env`:
  ```
  # Basic auth:
  FUSEKI_AUTH_HEADER=Basic $(echo -n "user:password" | base64)
  # Bearer token:
  FUSEKI_AUTH_HEADER=Bearer <token>
  ```

### Loading from Fuseki

Enter this IRI pattern in the WebVOWL ontology menu:

```
http://server/fuseki/<dataset>/data?graph=<graph-uri>
```

For example, if Fuseki has a `bfo` dataset: `http://server/fuseki/bfo/data`

The `/fuseki/` prefix routes through nginx, which strips it and forwards to `${FUSEKI_URL}/<dataset>/data?graph=...` with the auth header attached.

> `server` is the nginx container's Docker-internal hostname — do not use `localhost`.

### Environment Variables

| Variable             | Default               | Description                                      |
|----------------------|-----------------------|--------------------------------------------------|
| `PORT`               | `8080`                | Host port WebVOWL is accessible on               |
| `FUSEKI_AUTH_HEADER` | *(required for Fuseki)* | Full `Authorization` header value sent to Fuseki |
| `DOCKER_NETWORK`     | `semantic-web`        | External Docker network name                     |
| `FUSEKI_URL`         | `http://fuseki:3030`  | Fuseki base URL (Docker-internal)                |

`DOCKER_NETWORK` and `FUSEKI_URL` rarely need to change. `FUSEKI_AUTH_HEADER` is the one you'll actually configure.

## Development Reference

### npm scripts

| Command           | Description                                    |
|-------------------|------------------------------------------------|
| `npm run dev`     | Live-reloading dev server                      |
| `npm run build`   | Production build into `deploy/`                |
| `npm run build:dev` | Development build                            |
| `npm run release` | Production build, removing benchmark data      |
| `npm run zip`     | Build and package into a zip file              |
| `npm test`        | Run unit tests (Vitest)                        |
| `npm run lint`    | Lint source with ESLint 9                      |

### Hot-swap deploy (no Docker rebuild)

For code-only changes, skip the full image rebuild:

```
npm run release && docker cp deploy/. webvowl-server-1:/usr/share/nginx/html/
```

If you modify `package.json` or `docker-compose.yml`, do a full rebuild instead:

```
docker compose build --no-cache && docker compose up -d
```

## Notes

**SVG export and CSS:** To export the VOWL visualization as SVG, all CSS styles must be inlined into the SVG. If you change `vowl.css`, update the inlined styles accordingly. The tool for this is in `util/VowlCssToD3RuleConverter/` — see its [README](util/VowlCssToD3RuleConverter/README.md).

**Submodule:** OWL2VOWL is pinned to a specific fork commit via a git submodule. Run `git submodule update --init` on fresh clones, and again after pulling if the submodule pointer has advanced.
