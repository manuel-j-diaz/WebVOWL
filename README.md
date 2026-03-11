# WebVOWL 

This repository forks and rehabilitates https://github.com/VisualDataWeb/WebVOWL to have modern dependencies and build systems, use Canvas, show ABox, include different layouts, come with OWL2VOWL, and read data from a SPARQL endpoint (optional).


## Run Using Docker

Make sure you have Docker installed and run the following commands from the project root.

The WebVOWL image is built from source using a multi-stage Docker build (Node 22 + Webpack) and served as static files via Nginx. OWL2VOWL is also built from source via a git submodule (user's fork). No pre-built binaries are downloaded.

### Prerequisites

1. **Initialize the submodule** (required on fresh clones):
   ```
   git submodule update --init
   ```

2. **Create the external Docker network** shared with other stacks (e.g. Fuseki).
   The `--internal` flag blocks internet access — containers communicate only within the network:
   ```
   docker network create --internal semantic-web
   ```
   Ensure your Fuseki stack also joins this network.

3. **Copy and configure environment variables**:
   ```
   cp .env.example .env
   ```
   Edit `.env` — at minimum set `FUSEKI_AUTH_HEADER` for your Fuseki credentials.

### Environment Variables

| Variable              | Default                  | Description                                             |
|-----------------------|--------------------------|---------------------------------------------------------|
| `PORT`                | `8080`                   | Host port that WebVOWL is accessible on                 |
| `DOCKER_NETWORK`      | `semantic-web`           | External Docker network shared with other stacks        |
| `FUSEKI_URL`          | `http://fuseki:3030`     | Fuseki base URL (Docker-internal hostname)              |
| `FUSEKI_AUTH_HEADER`  | *(required)*             | Full `Authorization` header value sent to Fuseki        |

For `FUSEKI_AUTH_HEADER`:
- Basic auth: `Basic $(echo -n "user:password" | base64)`
- Bearer token: `Bearer <token>`
- API key: `ApiKey <key>` (or whatever scheme your Fuseki expects)

### Build and Start

```
docker compose up --build -d
```

Visit [http://localhost:8080](http://localhost:8080) to use WebVOWL (or your configured port).

### Loading Ontologies from Fuseki

Fuseki runs in a separate stack behind authentication. nginx acts as an authenticating proxy — it injects the `Authorization` header so OWL2VOWL never handles credentials directly.

Enter this IRI pattern in the WebVOWL ontology menu:

```
http://server/fuseki/<dataset>/data?graph=<your-graph-uri>
# e.g. if Fuseki has a bfo/ dataset with a default named graph, http://server/fuseki/bfo/data
```

The `/fuseki/` prefix routes through nginx, which strips it and forwards to
`${FUSEKI_URL}/<dataset>/data?graph=...` with the auth header attached.

> **Note:** `server` is the nginx container's Docker-internal hostname. OWL2VOWL resolves it
> via the shared `default` compose network. Do not use `localhost` — that refers to the
> container itself, not the host machine.

OWL2VOWL runs as a sidecar container (not exposed to the host) and is proxied by nginx on
the `/convert`, `/read`, `/directInput`, `/serverTimeStamp`, `/loadingStatus`, and
`/conversionDone` endpoints.

## Requirements
------------

Node.js 18+ for installing the development tools and dependencies.


## Development setup
-----------------

1. Download and install Node.js from http://nodejs.org/download/
2. Open the terminal in the root directory
3. Run `npm install` to install dependencies
4. Edit the code
5. Run `npm run release` to build into the `deploy/` directory
6. Run `serve deploy/` to serve locally (`npm install serve -g` if needed)

Visit [http://localhost:3000](http://localhost:3000) to use WebVOWL.

### npm scripts ###

| Command | Description |
|---|---|
| `npm run build` | Production build into `deploy/` |
| `npm run build:dev` | Development build |
| `npm run release` | Production build, removing benchmark data |
| `npm run dev` | Live-reloading dev server |
| `npm test` | Run unit tests (Vitest) |
| `npm run lint` | Lint source with ESLint 9 |
| `npm run zip` | Build and package into a zip file |


## Additional information
----------------------

To export the VOWL visualization to an SVG image, all css styles have to be included into the SVG code. This means that if you change the CSS code in the `vowl.css` file, you also have to update the code that inlines the styles - otherwise the exported SVG will not look the same as the displayed graph.

The tool which creates the code that inlines the styles can be found in the util directory. Please follow the instructions in its [README](util/VowlCssToD3RuleConverter/README.md) file.
