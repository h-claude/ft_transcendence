# ft_transcendence

> Real-time multiplayer Pong platform: authoritative WebSocket game server, OAuth2/TOTP authentication, tournament orchestration, and on-chain score notarization — served behind an Nginx TLS reverse proxy, with an independent C++ terminal client.

---

## 📌 Problem Overview & Classification

- **Domain / Problem Category:** Distributed Real-Time Web Systems / Network Programming & State Synchronization
- **Theoretical Problems:**
  - **Authoritative Server / Client-State Synchronization** — the server owns physics (ball, paddles) and pushes state at a fixed tick rate; clients render only.
  - **Finite State Machine** — match lifecycle (`pending → countdown → ongoing → gameOver`), tournament bracket progression, and the login → 2FA-challenge → session flow.
  - **Producer–Consumer Queue** — the matchmaker (`backend/MatchMaker.js`) polls a FIFO queue of waiting players every 100 ms and pairs them.
  - **Reverse Proxy / TLS Termination** — Nginx terminates HTTPS/WSS and forwards `/api` and `/api/ws` to the Node backend over plain HTTP.
- **Core Objective:** Keep N independently-connected clients (browser SPA or native C++ CLI) consistent with one server-side simulation over an unreliable WebSocket transport, while gating access behind stateless JWT auth and optional TOTP 2FA, and producing tamper-evident match results.
- **Key Constraints & Challenges:**
  - Fixed 60 Hz server tick (`SERVER_TICK_HZ = 60` in [wsGameLogic.js](backend/routes/wsGameLogic.js)) independent of per-client frame rate or jitter.
  - Reconnection tolerance: a dropped socket has a 7 s grace period (`RECONNECT_GRACE_MS`) before the match is forfeited.
  - Idempotent score persistence on-chain: `ScoreStorage.sol` derives a deterministic `gameId` from `keccak256(userIds, time)` and reverts (`AlreadyExists`) on replay.
  - Stateless JWT verification on every request via a single global `preHandler` hook, with an explicit allowlist for public routes (login, OAuth callback, registration).

---

## ⚙️ Architecture & Implementation Details

```
ft_transcendence/
├── backend/            # Fastify API + WebSocket game/chat server (Node.js, ESM)
│   ├── routes/         # REST + WS route handlers (login, twofa, tournament, ws, blockchain...)
│   ├── models/         # better-sqlite3 data-access layer (Users, Game, Tournament, Ws...)
│   ├── controllers/    # Request-handling logic split out from routes
│   ├── game/           # Physics-free legacy Game.js stub + game/ai/PongBotController.js (AI opponent)
│   ├── services/       # blockchainService.js (ethers.js), blockchainQueue.js
│   ├── blockchain_form/ # Hardhat project: ScoreStorage.sol source, compiled artifacts, deploy scripts
│   ├── User.js          # In-memory UserManager (online sockets, presence, matchmaking flags)
│   ├── MatchMaker.js     # 100 ms polling matchmaker over an in-memory queue
│   └── database.js       # SQLite schema (14 tables: users, matches, tournaments, messages, ...)
├── frontend/dist/       # TypeScript SPA (no framework), Tailwind CSS, built with tsc + tailwindcss CLI
├── nginx/               # Nginx image: self-signed TLS cert generated at build time, reverse proxy config
├── cli/                 # Standalone C++20 terminal client (transcendence_cli), CMake-built
└── docker-compose.yml   # backend / frontend / nginx services on a shared bridge network
```

- **Modular Design:** The backend follows a route → controller/model split; each domain (auth, friends, chat, tournaments, game) owns its own route file and SQLite-backed model. The real-time game engine is a single 1400+ line module, [wsGameLogic.js](backend/routes/wsGameLogic.js), that owns a `Map<matchId, match>` of in-flight matches, each with its own tick timer, countdown timer, and input buffer. `backend/game/Game.js` is dead/unused code (a placeholder `lol()` that resolves matches with `Math.random()`) superseded by `wsGameLogic.js`.
- **Key Primitives & Mechanisms:**
  - `setInterval(loop, 1000/60)`: fixed-timestep authoritative simulation loop; each tick advances ball/paddle positions (normalized 0..1 coordinate space, see `N_BASE_BALL_SPEED_X` etc.) and broadcasts deltas to every connection in the match.
  - `@fastify/websocket` / `ws`: transport for both the game loop and chat/presence; `UserManager` (`backend/User.js`) maps `userId → { socket, status, freeToGame, freeToChat }` as the single source of truth for who is online.
  - `better-sqlite3`: synchronous, prepared-statement access to SQLite — no async driver overhead, used across all models (`fastify.db.prepare(...).all()/.get()/.run()`).
  - `@fastify/jwt` + `@fastify/cookie`: JWT stored in an httpOnly `token` cookie; `fastify.decorate('authenticate', ...)` verifies it in a global `preHandler` hook, short-circuited by a `PUBLIC_ROUTES` allowlist (login, OAuth callback, registration, `/api/me`).
  - `otplib` (`authenticator.generateSecret` / `.verify`): TOTP-based 2FA (RFC 6238), enrolled via QR code (`qrcode` package).
  - `ethers.Contract` over a Fuji (Avalanche testnet) JSON-RPC provider: `BlockchainService.saveScore()` calls `ScoreStorage.setScore()`, packs up to 7 players' scores into a single `uint256` (8-bit count + 32-bit score slots), and parses the `ScoreSaved` event log to recover the on-chain `gameId`.
  - `createPongBotController()` / `updatePongBot()`: a reaction-delayed AI opponent that predicts ball impact via straight-line/bounce extrapolation (`predictImpactY`) rather than reading true game state instantaneously, to keep it beatable.
  - **CLI client** (`cli/src`): `SocketManager` wraps an `ixwebsocket::IXWebSocket` (TLS-capable client, OpenSSL/`zlib` linked), `ApiClient` wraps `cpp-httplib` for REST calls, and the UI is a set of `ftxui::Component` screens (`UiLogin`, `UiMatchmaking`, `UiNetworkGame`, ...) driven by a single blocking `Ui::run()` event loop.
- **Lifecycle & Resource Management:**
  - On backend boot, `sanitizeAllUsers` / `sanitizeAllMatches` / `sanitizeAllTournaments` reconcile SQLite state against the in-memory `UserManager` (handles unclean restarts — e.g. matches older than 1 h are force-closed and their participants freed).
  - Two recurring sweeps run for the process lifetime: a 60 s stale-session monitor and a 1 h stale-match sweep (both un-cleared `setInterval`s — they run until the process exits).
  - No explicit `SIGINT`/`SIGTERM` handlers are registered in `server.js`; shutdown is delegated to the container runtime (`docker compose down`), and `better-sqlite3`'s synchronous handle is closed by process exit rather than an explicit hook.
  - The CLI client releases its WebSocket explicitly on exit (`if (g_store.isConnected) g_store.socketManager->stop();` in [main.cpp](cli/src/main.cpp)) even when `Ui::run()` throws, via a try/catch around the UI loop.

---

## 🛠️ Stack & Tooling

| Category | Backend | Frontend | CLI Client |
| :--- | :--- | :--- | :--- |
| **Language / Runtime** | Node.js 20 (ESM, `"type": "module"`) | TypeScript 5.8 (no framework) | C++20 |
| **Web / Network** | Fastify 5, `@fastify/websocket`, `ws` | `WebSocketManager.ts` over native `WebSocket` | IXWebSocket (TLS WS client), cpp-httplib (REST) |
| **Persistence** | `better-sqlite3` / `sqlite3` (single `database.db` file) | — | — |
| **Auth** | `@fastify/jwt`, `@fastify/cookie`, `bcryptjs`, `otplib` (TOTP), OAuth 2.0 (42 intranet API) | — | Session token obtained via `ApiClient` |
| **Blockchain** | `ethers` v6 against Avalanche Fuji testnet; Hardhat for contract compile/deploy | — | — |
| **UI Toolkit** | — | Tailwind CSS 3 | FTXUI (terminal UI components) |
| **Build Tooling** | `npm ci` inside `node:20-bookworm-slim` | `tsc`, `tailwindcss` CLI, `esbuild` (dev dep) | CMake ≥ 3.14, vendored FTXUI/IXWebSocket via `add_subdirectory` / `find_package` |
| **Infrastructure** | Docker Compose (3 services: backend, frontend, nginx) | | |
| **Reverse Proxy** | Nginx (Debian bullseye image), self-signed TLS cert generated at image build time (`openssl req -x509 ...`) | | |

---

## 🚀 Getting Started

### Prerequisites — Web platform
- Docker & Docker Compose
- A `backend/.env` file (see below)

### Prerequisites — CLI client
- A C++20 compiler, CMake ≥ 3.14
- OpenSSL, zlib, pthreads, X11 development headers (linked by `cli/CMakeLists.txt`)
- Vendored dependencies already present under `cli/` (FTXUI, IXWebSocket, cpp-httplib, nlohmann-json, event-emitter-cpp)

### Compilation & run — Web platform
```bash
make            # alias for `make up`: refreshes MACHINE_HOST / OAUTH_REDIRECT_URI in backend/.env, then `docker compose up -d`
```
The app is served at **https://<MACHINE_HOST>:8443** (Nginx terminates TLS with the self-signed cert baked into its image).

### Build Targets (top-level `Makefile`)
- `make` / `make up`: rewrites `MACHINE_HOST` and `OAUTH_REDIRECT_URI` in `backend/.env` from the current hostname, then `docker compose up -d`.
- `make down`: `docker compose down`.
- `make ups` / `make downs`: same as above via `sudo docker compose`.
- `make clean`: stops containers and deletes `backend/database.db` and `frontend/dist/supervisord.log`.
- `make reclean`: same as `clean`, then brings the stack back up.
- `make fclean`: stops containers, deletes the database, `node_modules` in both backend and frontend, `frontend/build`, and runs `docker system prune -a --volumes -f`.

### Environment variables (`backend/.env`)
```env
OAUTH42_UID=...                 # 42 API OAuth client id
OAUTH42_USECRET=...             # 42 API OAuth client secret
OAUTH_REDIRECT_URI=https://<hostname>:8443/api/oauth/42/callback

JWT_SECRET=...
TWOFA_SECRET_KEY=...
CHALLENGE_SECRET=...

FUJI_RPC_URL=...                # Avalanche Fuji JSON-RPC endpoint
BACKEND_WALLET_PRIVATE_KEY=...  # signer for ScoreStorage.setScore()

MACHINE_HOST=<hostname>         # rewritten automatically by `make up`
```

### Compilation & run — CLI client
```bash
cd cli
make            # mkdir build; cd build && cmake .. && make
make run        # cd build && ./transcendence_cli
make debug      # CMAKE_BUILD_TYPE=Debug build
make re         # clean && all
```
*Usage:*
```bash
./transcendence_cli <hostname> <port>
```
Exits immediately with a usage message if not given exactly two arguments (`argc != 3` check in [main.cpp](cli/src/main.cpp:22)).

---

## 🧪 Testing & Reliability Verification

There is no automated test suite in this repository (`backend/routes/testroute.js` and `stuff/testGame.html` are manual debug scaffolding, not a CI-run test harness). Reliability is currently established by manual verification:

- **Match/session sanitization on boot:** verified by killing the backend mid-match and confirming `sanitizeAllMatches` / `sanitizeAllUsers` reset `match_status`, `searching_for_match`, and free-to-game/chat flags on the next `docker compose up`.
- **On-chain replay protection:** calling `ScoreStorage.setScore()` twice with the same `userIds`/`time` reverts with `AlreadyExists`, verifiable via Hardhat scripts under `backend/blockchain_form/compil_deploy/script/`.
- **CLI client:** built with a C++20 toolchain; recommended manual checks before merging changes:
  ```bash
  valgrind --leak-check=full --show-leak-kinds=all ./cli/build/transcendence_cli <hostname> <port>
  ```
  No ThreadSanitizer/AddressSanitizer build target is currently wired into `cli/CMakeLists.txt`.

**Known gaps** (surfaced rather than hidden, per the codebase as inspected):
- No `SIGINT`/`SIGTERM` handler in the backend — an unclean `docker compose down` mid-match relies entirely on the boot-time sanitizer to recover state on the next start.
- `backend/game/Game.js` is unused dead code; do not confuse it with the real engine in `backend/routes/wsGameLogic.js`.

---

## 👤 Author

- Group project — 42 Mulhouse.
