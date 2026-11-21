# Triage backend (Rust)

All call categorisation happens here; the dashboard only displays the result.

`POST /api/classify` with the current transcript:

```json
{ "lines": [{ "speaker": "Caller", "text": "He collapsed and isn't breathing" }] }
```

runs two models in parallel and returns:

```json
{
  "urgency": "Critical", "urgencyScore": 80, "ambulance": true,
  "physical": 100, "mental": 0,
  "indicators": ["Not breathing", "Unresponsive"],
  "sources": { "triage": "claude", "indicators": "claude" }
}
```

- **Triage model**: urgency, urgency score, ambulance yes/no, physical/mental split.
- **Indicator model**: the detected indicators.

With `ANTHROPIC_API_KEY` set, both are Claude calls (`claude-opus-5-5` by default, override
with `CLAUDE_MODEL`). Without a key, or if a Claude call fails, offline keyword models answer
instead; `sources` says which one was used.

## Run

```sh
cd backend
ANTHROPIC_API_KEY=sk-ant-... cargo run   # listens on :8080 (set PORT to change)
cargo test
```

The frontend calls the backend from a Server Action (`frontend/app/lib/classify.ts`), which uses `http://localhost:8080` server-side by default; set `BACKEND_URL` (runtime, server-only) on the frontend to point it elsewhere. The backend does not need to be reachable from the browser.
