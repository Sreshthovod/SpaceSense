# SpaceSense

AI-powered interior redesign (hackathon prototype). Upload a room, set dimensions, style, INR budget and optional Vastu preferences.

**Status:** the React frontend calls the FastAPI backend (`/analyze-room`, `/generate-design`, `/recommend-products`). The backend uses rule-based logic and a small sample catalog. There is no AI image generation, no real product data and no live prices.

## Frontend (`frontend/`)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The app talks to the backend at `http://localhost:8000` by default. To change it, copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_BASE_URL`. Start the backend first (below), or the form will show a "can't reach the server" message.

## Backend (`backend/`)

Requires Python 3.10+.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs.

CORS allows the local Vite dev and preview origins (ports 5173 and 4173) by default. Override with a comma-separated `SPACESENSE_CORS_ORIGINS` environment variable; `*` is ignored.

### Tests

```bash
pip install -r requirements-dev.txt
pytest
```

Tests use temporary catalog files and need no credentials or internet.

### Endpoints

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
- Dimensions must be greater than 0; budget must be 0 or more.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Health check |
| POST | `/analyze-room` | Rule-based room summary (area, size, budget tier, style and Vastu notes). Does not analyse photos. |
| POST | `/generate-design` | **Mock.** Returns a placeholder with `status: "mock"`, `is_ai_generated: false`, `image_url: null`. |
| POST | `/recommend-products` | Picks items from the sample catalog `backend/data/products.json` for the room and style; total never exceeds `budget_inr`. |

Errors share one shape, `{"error": ..., "details": [{"field", "message"}]}`: `422` for invalid input, `503` if the sample catalog is missing or malformed, `500` (no internals exposed) for anything unexpected.

Example:

```bash
curl -X POST localhost:8000/recommend-products -H 'Content-Type: application/json' \
  -d '{"room_type":"bedroom","length_ft":12,"width_ft":11,"height_ft":9,"style":"minimalist","budget_inr":50000,"vastu":false}'
```

### Layout

```
backend/
  main.py            app, CORS, error handlers, routes
  schemas.py         Pydantic request/response models
  config.py          allowed origins, room types, styles, limits
  services/          analysis.py, products.py (business logic)
  data/products.json sample catalog (illustrative items and prices)
```

## Not built yet

Photo upload to the backend (photos stay in the browser), Gemini analysis, image-editing model, Supabase, LangGraph, a real product catalogue.
