PROMPT 1 — Project Scaffold & Docker Compose
Create a monorepo project called "brimble-pipeline" with this exact folder structure:

brimble-pipeline/
├── docker-compose.yml
├── Caddyfile
├── .env.example
├── README.md
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   ├── pipeline/
│   │   ├── db/
│   │   └── types.ts
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/
│   │   ├── components/
│   │   └── api/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── sample-app/
    ├── index.js
    └── package.json

Rules:
- Do NOT write any application logic yet. Only create the files with placeholder comments.
- docker-compose.yml should define 4 services: caddy, backend, frontend, postgres
- Postgres uses image postgres:16-alpine, volume-mounted for persistence
- Backend container mounts /var/run/docker.sock from host
- Caddy exposes port 80 and 2019 (admin API)
- All services share a custom bridge network called "brimble-net"
- Backend depends_on postgres
- Frontend depends_on backend
- Include an .env.example with: POSTGRES_URL, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, PORT (backend), RAILPACK_BIN
- Caddyfile should set up:
  1. A route for localhost handling /api/* → backend:3000
  2. A route for localhost handling /* → frontend:5173
  3. Enable Caddy Admin API on :2019
- Write a clear README scaffold with sections: Overview, Prerequisites, Running locally, Environment variables, Architecture

PROMPT 2 — Database Schema & Migrations
In the backend/src/db/ folder, implement the full database layer using PostgreSQL with the "pg" npm package (not an ORM).

Create these files:

1. backend/src/db/client.ts
- Export a pg Pool instance configured from process.env.POSTGRES_URL
- Export a query() helper function that wraps pool.query with error logging

2. backend/src/db/migrations/001_initial.sql
- Create a "deployments" table with columns:
  id (UUID primary key, default gen_random_uuid()),
  name (text, not null),
  status (text, not null, default 'pending') — values will be: pending, building, deploying, running, failed,
  source_type (text) — 'git' or 'upload',
  source_url (text), -- git URL if source_type is git
  image_tag (text),
  container_id (text),
  container_port (integer),
  url (text),
  error_message (text),
  created_at (timestamptz default now()),
  updated_at (timestamptz default now())

- Create a "logs" table with columns:
  id (bigserial primary key),
  deployment_id (UUID references deployments(id) on delete cascade),
  line_number (integer not null),
  content (text not null),
  created_at (timestamptz default now())

- Add index on logs(deployment_id, line_number)

3. backend/src/db/migrate.ts
- A script that reads and executes 001_initial.sql on startup
- Should be idempotent (use IF NOT EXISTS)
- Export a runMigrations() function

4. backend/src/types.ts
- Export TypeScript interfaces: Deployment, Log, CreateDeploymentInput, DeploymentStatus (enum)
- These should match the DB schema exactly

Install required packages: pg, @types/pg, uuid, @types/uuid

PROMPT 3 — Backend API Routes
Build the full Fastify REST API in the backend. Install: fastify, @fastify/cors, @fastify/multipart, @fastify/static, dotenv

Create backend/src/routes/deployments.ts with these endpoints:

POST /api/deployments
- Body: { name: string, sourceType: 'git' | 'upload', sourceUrl?: string }
- For 'upload', handle multipart file upload (zip file) saved to /tmp/uploads/{id}/
- For 'git', just store the URL
- Insert a new deployment row with status 'pending'
- Immediately trigger the pipeline in the background (do not await — fire and forget)
- Return the created deployment object with 201

GET /api/deployments
- Return all deployments ordered by created_at DESC
- Include id, name, status, image_tag, url, source_type, source_url, created_at, updated_at

GET /api/deployments/:id
- Return a single deployment by id
- 404 if not found

DELETE /api/deployments/:id
- Stop and remove the Docker container if running (call docker stop + docker rm)
- Delete deployment row
- Return 204

Create backend/src/routes/logs.ts with:

GET /api/deployments/:id/logs
- SSE endpoint (Server-Sent Events)
- Set headers: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive
- On connect: immediately replay all existing logs from DB for this deployment_id ordered by line_number
- Then subscribe to new log lines emitted by an in-memory EventEmitter (export a global logEmitter from a shared file)
- Each event should be formatted as: data: {"line": 42, "content": "Building...", "deploymentId": "..."}\n\n
- When deployment reaches terminal state (running or failed), send a special event: data: {"done": true}\n\n and close the stream
- Handle client disconnect (req.raw.on('close')) — remove listener

Create backend/src/routes/index.ts
- Register both route files with Fastify

Create backend/src/index.ts
- Initialize Fastify with logger: true
- Register @fastify/cors allowing all origins
- Register @fastify/multipart
- Run migrations on startup
- Register all routes with /api prefix
- Listen on 0.0.0.0:3000

PROMPT 4 — Pipeline: Builder (Railpack)
Create backend/src/pipeline/builder.ts

This file handles building a Docker image from source code using Railpack.

Requirements:

1. Export async function buildImage(deploymentId: string, sourcePath: string): Promise<string>
   - sourcePath is the local directory containing the app code
   - imageTag format: "brimble-deploy-{deploymentId}" (lowercase, no special chars)
   - Run railpack build as a child process using Node's spawn() from the 'child_process' module
   - Command: `railpack build {sourcePath} --tag {imageTag}`
   - The RAILPACK_BIN env var should be the path to railpack binary (default: 'railpack')
   - Stream stdout and stderr line by line in real time
   - For each line: 
     a) call appendLog(deploymentId, lineContent) to save to DB
     b) emit on the global logEmitter: logEmitter.emit(deploymentId, { line, content })
   - Keep an internal line counter per build starting from 1
   - If the process exits with code 0: return the imageTag
   - If the process exits with non-zero: throw an Error with the last 5 log lines as message

2. Create backend/src/pipeline/logStore.ts
   - Export a Node.js EventEmitter instance called logEmitter (singleton)
   - Export async function appendLog(deploymentId: string, content: string): Promise<void>
     that inserts into the logs table and increments line_number (use a per-deployment counter stored in memory)
   - Export async function getLogsForDeployment(deploymentId: string): Promise<Log[]>
     that queries all logs ordered by line_number

3. Create backend/src/pipeline/gitClone.ts
   - Export async function cloneRepo(gitUrl: string, targetDir: string): Promise<void>
   - Run: git clone --depth 1 {gitUrl} {targetDir} as a child process
   - Stream output to logEmitter using appendLog
   - Throw if exit code is non-zero

PROMPT 5 — Pipeline: Runner (Docker) & Caddy
Create backend/src/pipeline/runner.ts

This handles running a built Docker image as a container.

1. Export async function runContainer(deploymentId: string, imageTag: string): Promise<{ containerId: string, port: number }>
   - Find a free port between 4000-5000 (scan by trying to bind a TCP socket)
   - Create a function getFreePort(): Promise<number> that does this
   - Run: docker run -d --name {containerName} --network brimble-net -p {port}:3000 {imageTag}
     where containerName = "deploy-{deploymentId}"
   - Note: the container's internal port should be detected — try 3000 first, fallback to 8080
   - Capture the container ID from stdout (trim whitespace)
   - Return { containerId, port }

2. Export async function stopContainer(containerName: string): Promise<void>
   - Run: docker stop {containerName} then docker rm {containerName}
   - Ignore errors if container doesn't exist

3. Export async function getContainerStatus(containerName: string): Promise<'running' | 'stopped' | 'notfound'>
   - Run: docker inspect --format='{{.State.Status}}' {containerName}
   - Parse output and return the appropriate status string

---

Create backend/src/pipeline/caddy.ts

This handles dynamic routing via Caddy's Admin API.

1. CADDY_ADMIN_URL = process.env.CADDY_ADMIN_URL || 'http://caddy:2019'

2. Export async function addRoute(deploymentId: string, port: number): Promise<string>
   - The URL pattern will be: http://localhost/{deploymentId}/*
   - Use Caddy Admin API: POST to {CADDY_ADMIN_URL}/config/apps/http/servers/srv0/routes
   - Body should be a Caddy route JSON object:
     {
       "match": [{ "path": ["/{deploymentId}/*"] }],
       "handle": [{
         "handler": "reverse_proxy",
         "upstreams": [{ "dial": "host.docker.internal:{port}" }]
       }]
     }
   - Return the public URL: http://localhost/{deploymentId}
   - Use fetch() (Node 18+)

3. Export async function removeRoute(deploymentId: string): Promise<void>
   - DELETE to {CADDY_ADMIN_URL}/config/apps/http/servers/srv0/routes matching the deploymentId path

PROMPT 6 — Pipeline Orchestrator
Create backend/src/pipeline/orchestrator.ts

This is the main pipeline runner that ties everything together.

Export async function runPipeline(deploymentId: string): Promise<void>

The function should:

1. Fetch the deployment from DB by id

2. Create a working directory: /tmp/brimble/{deploymentId}/

3. If source_type === 'git':
   - Update deployment status to 'building' in DB
   - Call cloneRepo(sourceUrl, workDir)
   - Call buildImage(deploymentId, workDir)
   
4. If source_type === 'upload':
   - The zip is already at /tmp/uploads/{deploymentId}/upload.zip
   - Unzip it to /tmp/brimble/{deploymentId}/ using the 'unzipper' npm package
   - Update status to 'building'
   - Call buildImage(deploymentId, workDir)

5. After successful build:
   - Update deployment: status → 'deploying', image_tag → imageTag

6. Call runContainer(deploymentId, imageTag)
   - Update deployment: container_id, container_port

7. Call addRoute(deploymentId, port)
   - Update deployment: status → 'running', url → returned URL

8. On ANY error at any step:
   - Catch the error
   - Update deployment: status → 'failed', error_message → error.message
   - Emit a final log line: "[Pipeline failed]: {error.message}"
   - Re-throw

9. After terminal state (success or fail), emit on logEmitter:
   logEmitter.emit(`done:${deploymentId}`, { done: true })

Helper: create a updateDeployment(id, fields) function in db/client.ts that does a partial UPDATE

Install: unzipper, @types/unzipper

PROMPT 7 — Frontend Setup
Set up the frontend with Vite + React + TanStack Router + TanStack Query.

In frontend/, install:
- @tanstack/react-router
- @tanstack/react-query
- @tanstack/react-router-devtools
- @tanstack/react-query-devtools

Configure vite.config.ts:
- server.proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } }
- port: 5173

Create frontend/src/main.tsx:
- Set up TanStack Router with a single root route
- Wrap with QueryClientProvider (staleTime: 10000, refetchInterval on deployments: 5000)
- Mount to #root

Create frontend/src/api/queries.ts:
- Base URL: '/api'
- Export these TanStack Query hooks:
  1. useDeployments() — GET /api/deployments, refetch every 4 seconds
  2. useDeployment(id) — GET /api/deployments/:id, refetch every 3 seconds
  3. useCreateDeployment() — useMutation POST /api/deployments, invalidates deployments list on success
  4. useDeleteDeployment() — useMutation DELETE /api/deployments/:id, invalidates on success

Create frontend/src/routes/index.tsx as the single page route (leave rendering as TODO for now)

Create frontend/src/App.tsx as the root layout (just renders <Outlet /> from TanStack Router)

PROMPT 8 — Frontend Components
Build all frontend UI components. Use plain CSS modules or inline styles — no design system needed, just functional. Dark background preferred (#0f0f0f, white text).

1. Create frontend/src/components/DeployForm.tsx
   - A form with:
     - Text input: "Deployment name"
     - Radio/toggle: "Source type" → Git URL | Upload ZIP
     - If Git: text input for Git URL (placeholder: https://github.com/user/repo)
     - If Upload: file input accepting .zip only
     - Submit button: "Deploy"
   - On submit: call useCreateDeployment() mutation
   - Show loading state on button while submitting ("Deploying...")
   - Clear form on success
   - Show error message if mutation fails
   - Use React state for form fields (no form library)

2. Create frontend/src/components/DeploymentCard.tsx
   - Props: deployment object
   - Show: name, status badge (color-coded: pending=gray, building=yellow, deploying=blue, running=green, failed=red), image_tag, url (clickable link), created_at (formatted)
   - Status badge should be a small pill/tag element
   - Clicking on the card should expand to show LogViewer for that deployment
   - "Delete" button in top right corner, calls useDeleteDeployment

3. Create frontend/src/components/DeploymentList.tsx
   - Uses useDeployments() hook
   - Shows loading skeleton (3 placeholder cards) while loading
   - Shows "No deployments yet" empty state
   - Maps deployments to DeploymentCard components
   - Shows total count: "X deployments"

4. Create frontend/src/components/LogViewer.tsx
   - Props: deploymentId: string, isActive: boolean
   - Opens an SSE connection to /api/deployments/{deploymentId}/logs using the browser's EventSource API
   - Only open the connection when isActive === true
   - Renders logs in a <pre> or <div> with monospace font, dark background (#111), green text (#00ff88)
   - Auto-scrolls to bottom on new lines
   - Shows "Connecting..." before first event
   - Shows "Stream ended" when done:true event received
   - Closes EventSource on component unmount
   - Has a copy-to-clipboard button for all log content

5. Update frontend/src/routes/index.tsx
   - Layout: full-width single column, max-width 900px, centered
   - Header: "Brimble Pipeline" title + subtitle
   - DeployForm at top
   - Horizontal divider
   - DeploymentList below

PROMPT 9 — Sample App & Dockerfiles
1. Create sample-app/ — a minimal Node.js HTTP server:
   - sample-app/index.js: 
     const http = require('http')
     http.createServer((req, res) => {
       res.writeHead(200, {'Content-Type': 'text/html'})
       res.end('<h1>Hello from Brimble Deploy!</h1><p>Deployment working.</p>')
     }).listen(process.env.PORT || 3000)
   - sample-app/package.json with name "sample-app", start script "node index.js"
   - No Dockerfile — Railpack will detect it as a Node app and build it

2. Create backend/Dockerfile:
   - Base: node:20-alpine
   - Install: git, docker CLI (apk add docker-cli), curl
   - Install railpack binary:
     RUN curl -fsSL https://railpack.io/install.sh | sh
     (or download from GitHub releases if that URL doesn't work — use: 
      https://github.com/railwayapp/railpack/releases/latest)
   - WORKDIR /app
   - Copy package.json, run npm install
   - Copy src/, run npm run build (tsc)
   - CMD ["node", "dist/index.js"]

3. Create frontend/Dockerfile:
   - Multi-stage:
     Stage 1 (build): node:20-alpine, npm install, npm run build (vite build)
     Stage 2 (serve): use Caddy or nginx:alpine to serve /dist
     Actually: just use node:20-alpine and run vite preview --host 0.0.0.0 --port 5173 for simplicity
   - Expose 5173

4. Update docker-compose.yml with proper build contexts, env vars from .env, and volume mounts:
   - postgres: volume pgdata:/var/lib/postgresql/data
   - backend: 
     volumes: ["/var/run/docker.sock:/var/run/docker.sock", "./backend:/app"]
     environment: all env vars
   - caddy:
     volumes: ["./Caddyfile:/etc/caddy/Caddyfile", "caddy_data:/data"]
   - Add named volumes: pgdata, caddy_data

5. Update Caddyfile to be a proper working config:
{
  admin 0.0.0.0:2019
}

localhost {
  handle /api/* {
    reverse_proxy backend:3000
  }
  handle {
    reverse_proxy frontend:5173
  }
}

PROMPT 10 — Wiring, Testing & README
Do a full wiring pass to make sure everything connects:

1. In backend/src/index.ts:
   - Import and call runMigrations() before starting the server
   - Make sure logEmitter is imported from pipeline/logStore and used in both the SSE route and the builder
   - Add a GET /health endpoint returning { status: 'ok', timestamp: new Date() }

2. In backend/src/routes/logs.ts:
   - Double-check the SSE stream:
     a) On connect, query existing logs and send each as: "data: {...}\n\n"
     b) Subscribe to logEmitter for this deploymentId
     c) Subscribe to logEmitter for "done:{deploymentId}" 
     d) On done event: send "data: {\"done\":true}\n\n" then res.raw.end()
     e) On client disconnect: remove both listeners

3. Verify the pipeline flow end-to-end by adding console.log statements at each step in orchestrator.ts:
   - "Starting pipeline for {deploymentId}"
   - "Cloning repo..." or "Extracting zip..."
   - "Building image with Railpack..."
   - "Image built: {imageTag}"
   - "Starting container..."
   - "Container running on port {port}"
   - "Configuring Caddy route..."
   - "Deployment complete: {url}"

4. Write the README.md with:
   - Overview (2 paragraphs explaining what it does)
   - Architecture diagram (ASCII art showing: Browser → Caddy → Backend/Frontend, Backend → Docker daemon, Backend → Postgres)
   - Prerequisites: Docker, Docker Compose, Git
   - Running locally: 
     1. git clone ...
     2. cp .env.example .env
     3. docker compose up --build
     4. Open http://localhost
   - Environment variables table
   - How the pipeline works (step by step)
   - Known limitations / what you'd improve with more time
   - Rough time spent

5. Add a backend/src/pipeline/portManager.ts:
   - Maintain a Set of used ports in memory
   - Export getAvailablePort(): scans 4000-5000, skips used ones, returns first free port
   - Export releasePort(port): removes from used set
   - Call releasePort in stopContainer

FINAL PROMPT — Debug Pass
Review the entire codebase for these specific issues and fix them:

1. CORS: make sure @fastify/cors is registered before routes and allows origin '*' with methods GET, POST, DELETE

2. SSE headers: the logs endpoint must set these exact headers before writing any data:
   res.raw.setHeader('Content-Type', 'text/event-stream')
   res.raw.setHeader('Cache-Control', 'no-cache')
   res.raw.setHeader('Connection', 'keep-alive')
   res.raw.flushHeaders()

3. Docker socket permissions: in docker-compose.yml, add this to backend service:
   user: root
   (needed to access /var/run/docker.sock on Linux)

4. Railpack install: verify the install command in backend/Dockerfile works. If the curl install script 
   doesn't exist, use this instead:
   RUN wget https://github.com/railwayapp/railpack/releases/latest/download/railpack-linux-amd64 -O /usr/local/bin/railpack && chmod +x /usr/local/bin/railpack

5. Caddy Admin API route format: when POSTing to Caddy's admin API to add a route, the correct endpoint is:
   POST http://caddy:2019/config/apps/http/servers/srv0/routes/...
   Make sure you're appending routes, not replacing. Use the array append pattern:
   POST /config/apps/http/servers/srv0/routes with the route object

6. EventSource in frontend: make sure the LogViewer creates EventSource with the correct URL and 
   parses event.data with JSON.parse(). Add error handling: eventSource.onerror = () => setStatus('error')

7. TypeScript: run tsc --noEmit in the backend and fix any type errors. 
   Common issues to look for:
   - Missing return types on async functions
   - pg query result typing (use generics: pool.query<Deployment>(...))
   - process.env values may be undefined — add fallbacks

8. Make sure the frontend vite.config.ts proxy correctly forwards /api/* to http://backend:3000 
   (use backend hostname, not localhost, since they're in the same Docker network)
   But also allow localhost:3000 for local dev outside Docker.
   Solution: use environment variable API_URL with fallback.

