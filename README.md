# ft_transcendence

Online **Pong game** platform with real-time multiplayer, tournament system, social features and blockchain integration.

Group project — **42 Mulhouse**.

---

## Features

- **Pong game** — real-time multiplayer via WebSocket, solo mode against an AI
- **Tournaments** — creation, management and bracket tracking
- **Social system** — friends, direct messaging, online status
- **Authentication** — OAuth 42, 2FA (TOTP/QR code), JWT
- **Blockchain** — match results recorded on-chain via Ethers.js
- **Leaderboard** — match history, statistics, rankings

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend | Fastify (Node.js), SQLite, WebSocket |
| Frontend | TypeScript, Tailwind CSS |
| Infrastructure | Docker Compose, Nginx (HTTPS) |
| Auth | OAuth 2.0 (42 api), JWT, OTP |
| Blockchain | Ethers.js |

---

## Getting started

### Prerequisites

- Docker & Docker Compose
- `backend/.env` file configured (see below)

### Commands

```bash
make          # Start containers (alias for make up)
make down     # Stop containers
make clean    # Stop and delete the database
make fclean   # Full cleanup (node_modules, Docker images)
```

The app is available at **https://localhost:8443**

### Environment variables

Create a `backend/.env` file with the following variables:

```env
# OAuth 42
OAUTH_CLIENT_ID=...
OAUTH_CLIENT_SECRET=...
OAUTH_REDIRECT_URI=https://<hostname>:8443/api/oauth/42/callback

# JWT
JWT_SECRET=...

# 2FA
TOTP_SECRET=...

# Machine
MACHINE_HOST=<hostname>
```

> The `Makefile` automatically updates `MACHINE_HOST` and `OAUTH_REDIRECT_URI` on startup.

---

## Architecture

```
my_transcendence/
├── backend/          # Fastify API + WebSocket game logic
│   ├── routes/       # REST and WS endpoints
│   ├── models/       # Database access
│   ├── game/         # Game engine + AI
│   └── services/     # Blockchain integration
├── frontend/         # Compiled TypeScript SPA
├── nginx/            # HTTPS reverse proxy
└── docker-compose.yml
```

---

## Authors

Group project — 42 Mulhouse.
