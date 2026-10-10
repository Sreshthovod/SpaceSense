# SpaceSense

AI-powered interior redesign (hackathon prototype). Upload a room photo, enter dimensions, pick a style, set an INR budget and optionally turn on Vastu preferences.

## Current status

This is a working **non-AI MVP**. The React frontend and FastAPI backend are connected end to end:

| Feature | How it works today |
| --- | --- |
| Room analysis | **Rule-based** (area, size category, budget tier, style and Vastu notes). The photo is not analysed. |
| Redesign | **Mock.** The "Generate redesign" button calls the API, which returns `status: "mock"` and `image_url: null`. No image is generated. |
| Products | Picked from a small **sample catalog** (`backend/data/products.json`) by room type and style. The total never exceeds your budget. Items and prices are illustrative: no real products, links or availability. |
| Room photo | Validated (JPG/PNG/WebP, max 10 MB) and previewed **in the browser only**; it is never uploaded. |

## Prerequisites

- Node.js 20.19+ (or 22+) and npm
- Python 3.10+

## Run locally

Start the backend first, then the frontend, in two terminals.

### Backend: macOS / Linux

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Backend: Windows (PowerShell)

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

If PowerShell blocks the activation script, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or skip activation and call `.\.venv\Scripts\python -m uvicorn main:app --reload --port 8000`.

### Frontend (all platforms)

```bash
cd frontend
npm install
npm run dev
```

### URLs

- App: http://localhost:5173
- API: http://localhost:8000
- Interactive API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Tests and checks

```bash
# Backend (from backend/, with the venv active)
pip install -r requirements-dev.txt
pytest

# Frontend (from frontend/)
npm test          # Vitest: API service tests
npm run lint      # oxlint
npm run build     # production build
```

Tests use temporary data and mocked `fetch`; they need no credentials or internet.

## Environment variables

None are required for local development. Templates: `frontend/.env.example`, `backend/.env.example`.

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | frontend (`frontend/.env`) | `http://localhost:8000` | Backend URL used by the browser. **Never put secrets in `VITE_` variables**; they are bundled into public JS. |
| `SPACESENSE_CORS_ORIGINS` | backend (shell env) | Vite dev/preview origins on ports 5173 and 4173 | Comma-separated allowed origins. `*` is ignored. |
| `SPACESENSE_ANALYSIS_PROVIDER` | backend | `rule_based` | Room-analysis provider. Only `rule_based` exists. |
| `SPACESENSE_DESIGN_PROVIDER` | backend | `mock` | Design provider. Only `mock` exists. |

The backend reads these from the process environment (it does not auto-load `backend/.env`). Set them in your shell, for example `export SPACESENSE_CORS_ORIGINS=http://localhost:5174` or, in PowerShell, `$env:SPACESENSE_CORS_ORIGINS="http://localhost:5174"`.

## API

All `POST` endpoints take the same JSON body (feet and INR):

```json
{
  "room_type": "living room",
  "length_ft": 14, "width_ft": 12, "height_ft": 9,
  "style": "scandinavian",
  "budget_inr": 60000,
  "vastu": true
}
```

- `room_type`: living room, bedroom, kitchen, dining room, home office, kids room (case-insensitive)
- `style`: modern-indian, minimalist, scandinavian, contemporary-luxury, boho, industrial
- Dimensions must be greater than 0 and at most 100 ft; budget must be 0 or more. Unknown fields are rejected.
- The frontend form is stricter (length/width 4–60 ft, height 7–15 ft, budget ₹10,000–₹50,00,000).

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Status, version and active providers |
| POST | `/analyze-room` | Rule-based room summary |
| POST | `/generate-design` | **Mock**: `status: "mock"`, `is_ai_generated: false`, `image_url: null` |
| POST | `/recommend-products` | Sample-catalog picks, `total_inr`, `remaining_inr`, and a `note` when nothing fits |

Errors share one shape, `{"error": "...", "details": [{"field", "message"}]}`:

| Status | `error` | When |
| --- | --- | --- |
| 422 | `validation_error` | Missing, invalid or malformed input |
| 404 / 405 | `http_error` | Unknown route or wrong method |
| 503 | `catalog_unavailable` | Sample catalog missing or malformed |
| 503 | `provider_unavailable` | An analysis/design provider failed (for future AI providers) |
| 500 | `internal_error` | Anything unexpected (no internal details exposed) |

## Project layout

```
backend/
  main.py               app, CORS, error handlers, routes
  schemas.py            Pydantic request/response models
  config.py             CORS origins, room types, styles, limits
  services/
    analysis.py         rule-based room analysis
    products.py         catalog loading and budget-capped recommendations
    providers.py        analysis/design provider interfaces and env-based selection
  data/products.json    sample catalog (illustrative items and prices)
  tests/                pytest suite
frontend/
  src/services/api.js   all backend calls (+ api.test.js)
  src/components/       landing/, form/, upload/, results/, layout/, ui/
```

### Adding a real AI provider later

1. Add a class in `backend/services/providers.py` implementing `RoomAnalyzer.analyze()` or `DesignGenerator.generate()`.
2. Register it in `ANALYZERS` / `GENERATORS` and select it with the env variable.
3. Read credentials from backend environment variables only, and raise `ProviderError` on failures (returned as a safe 503).
4. A real design response must set a non-`mock` status and `image_url`; the frontend only displays an image in that case. `DesignResponse` will need its `status`/`image_url` types widened when that happens.

Sending the room photo to the backend will need a multipart upload endpoint with server-side type and size checks. That is intentionally not built yet.

## Troubleshooting

- **"Can't reach the SpaceSense server"** in the app: the backend isn't running, or it's on a different URL. Start it, or set `VITE_API_BASE_URL` and restart `npm run dev`.
- **CORS error in the browser console**: the frontend is on a port not in the allowed list (e.g. Vite picked 5174 because 5173 was busy). Set `SPACESENSE_CORS_ORIGINS` to include it, or free port 5173.
- **`address already in use` on port 8000**: another backend is running. Stop it, or use `--port 8001` and update `VITE_API_BASE_URL`.
- **Backend refuses to start with `ProviderConfigError`**: a `SPACESENSE_*_PROVIDER` variable names a provider that doesn't exist.
- **`ModuleNotFoundError` when running uvicorn or pytest**: run them from `backend/` with the venv activated.

## Not built yet

Real AI room analysis (e.g. Gemini), image generation/editing, photo upload to the backend, a real product catalogue with links and live prices, persistence (e.g. Supabase), and agent orchestration (e.g. LangGraph).
