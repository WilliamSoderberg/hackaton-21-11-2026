# hackaton-21-11-2026

Health improvement

## Running

With Docker (frontend + backend on a shared network):

```sh
ANTHROPIC_API_KEY=sk-... docker compose up --build   # key optional; omit for offline keyword models
```

Open http://localhost:3000. The frontend calls the backend at `http://backend:8080` server-side, from a Server Action.

Locally without Docker: run `cargo run` in `backend/` (port 8080) and `npm run dev` in `frontend/` (port 3000). The frontend defaults to `BACKEND_URL=http://localhost:8080`.
