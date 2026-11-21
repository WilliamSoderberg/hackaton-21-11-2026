# hackaton-21-11-2026

Health improvement

## Running

With Docker (frontend + backend on a shared network):

```sh
ANTHROPIC_API_KEY=sk-... docker compose up --build   # key optional; omit for offline keyword models
```

Open http://localhost:3000. The frontend calls the backend at `http://backend:8080` server-side, from a Server Action.

## Demo: two people on one call

Each person opens the app on their own device and picks **Responder** or **Caller** in the header (or adds `?role=caller` / `?role=responder` to the URL). Everyone shares one call: the responder presses **Answer call**, the caller taps the mic button, and both see the same live transcript. Only the caller's words are sent to the triage backend.

Browsers only allow the microphone on `localhost` or over HTTPS, so for other devices run the frontend with:

```sh
cd frontend && npm run dev:demo   # needs openssl
```

It prints the `https://<your-ip>:3000/?role=caller` address to open on the other device. The certificate is self-signed, so accept the browser warning once. Use headphones or separate rooms, otherwise each mic also picks up the other person.

Locally without Docker: run `cargo run` in `backend/` (port 8080) and `npm run dev` in `frontend/` (port 3000). The frontend defaults to `BACKEND_URL=http://localhost:8080`.

## Ongoing calls page

`/calls` (**Ongoing calls** in the nav) lists every call in a table that refreshes every 3 s. Click the **Urgency**, **Ambulance** or **Started** header to sort (click again to flip), switch between **Ongoing** and **All calls**, and click a row to see its transcript.

Calls are stored by the backend in SQLite (`backend/calls.db` locally, override with `CALLS_DB`; a `calls-db` volume in Docker). The frontend's call store records each call as it is answered, assessed and ended:

| Method | Path | Body / query |
|---|---|---|
| `GET` | `/api/calls` | `?status=active\|ended` (optional), newest first |
| `POST` | `/api/calls` | `{ sourceId, label, location, startedAt }` |
| `PATCH` | `/api/calls/{id}` | any of `{ status, endedAt, assessment, transcript }` |
| `POST` | `/api/calls/end-active` | marks every active call ended (sent when the frontend restarts) |
