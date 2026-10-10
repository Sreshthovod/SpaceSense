# SpaceSense

AI-powered interior redesign (hackathon prototype). Upload a room photo, enter dimensions, pick a style, set an INR budget and optionally turn on Vastu preferences.

## How it works

SpaceSense is a **consult-first** design assistant. It only edits your photo after you approve.

1. **Upload and describe.** Photo, dimensions (ft), style, INR budget, optional Vastu.
2. **Get written advice.** `POST /analyze-room` returns recommendations (layout, keep, replace, colours, lighting, decor, budget tips). No image model is called.
3. **Ask follow-up questions.** The **Ask SpaceSense** chat (`POST /chat`) answers questions about the room, the recommendations and the budget, using the photo and your details. Text only.
4. **Approve.** The app asks *"Would you like me to apply these changes to your original room photo?"* with **Yes, edit my photo**, **Change recommendations** (pick which changes to apply and add notes; no API call) and **Not now** (nothing changes).
5. **Shop the look.** `POST /recommend-products` turns the advice into furniture and decor picks with shopping links and an in-budget plan you can adjust (see *Product recommendations*).
6. **Edit the original photo.** Only "Yes" calls `POST /generate-design`, which requires `approved=true` and sends your **original upload** plus the approved changes to an image-editing model. The result is shown as a before/after slider next to your untouched original.

| Part | Default (no key needed) | With Gemini |
| --- | --- | --- |
| Room analysis | Rule-based advice from your inputs; the photo is validated but not analysed | Gemini studies the photo and returns structured recommendations |
| Consultant chat | Says plainly that the AI consultant isn't switched on | Gemini answers follow-up questions (free tier works) |
| Photo editing | Mock: says no image was created, original unchanged | Gemini edits the original photo; no text-to-image fallback |
| Products | Curated catalog of real IKEA India listings (price, photo and link checked on the date shown) plus unpriced ideas with retailer search links | Same; optionally add live Google Shopping results via SerpAPI |

Image editing is instructed to keep the same room, camera angle, walls, doors and windows, and to change only the approved items. AI edits can still introduce inaccuracies, so check results visually.

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

## Try it yourself (manual test)

With Gemini switched on in `backend/.env` (see *Using Gemini*):

1. Start the backend and frontend (see *Run locally*), then open http://localhost:8000/health. It should show `"analysis": "gemini", "chat": "gemini", "design": "mock"`.
2. Open http://localhost:5173 and click **Design My Space**.
3. Upload a room photo (JPG/PNG/WebP, under 10 MB), choose a room type, enter dimensions (e.g. 14 × 12 × 9 ft), pick a style and a budget (e.g. ₹60,000), and click **Generate preview**.
4. Check the results page:
   - **Design recommendations** carries the badge *AI analysis of your photo* and its summary describes **your** photo (walls, windows, furniture you can see).
   - **Shop the look** shows product cards. *Verified listing* cards have a photo, price, "Price checked" date and a **View product on IKEA India** button that opens the real product page in a new tab. *Idea* cards have no price and offer retailer search links instead.
   - The bar above the cards shows the selected total, your budget and what's left. The pre-selected plan never exceeds your budget. Tick or untick **Include in my plan** and the total updates; going over shows **Over budget by**.
5. In **Ask SpaceSense**, click a suggested question or type your own, e.g. *"Is a 3-seater sofa too big for this room?"*, then a follow-up such as *"What would that cost within my budget?"*. The second answer should build on the first. Replies usually take a few seconds.
6. Click **Yes, edit my photo**. Image editing is the mock for now, so you should see *"No edited photo was created"*; your original photo stays in place.
7. Error check: stop the backend and send a chat message. You should see *"Can't reach the SpaceSense server"* and a **Retry** button.

Quick API check without the UI (from the repo root):

```bash
curl -s localhost:8000/chat \
  -F 'room={"room_type":"living room","length_ft":14,"width_ft":12,"height_ft":9,"style":"scandinavian","budget_inr":60000,"vastu":false}' \
  -F photo=@frontend/public/images/before.jpg \
  -F 'chat={"messages":[{"role":"user","content":"What wall colour would suit this room?"}]}'
```

If you see `"provider": "offline"`, Gemini isn't enabled. If you get a 502 mentioning credentials, see Troubleshooting.

## Tests and checks

```bash
# Backend (from backend/, with the venv active)
pip install -r requirements-dev.txt
pytest

# Frontend (from frontend/)
npm test          # Vitest: API service, approval flow, chat, product panel and budget totals
npm run lint      # oxlint
npm run build     # production build
npm run size      # after a build: fails if a chunk outgrows its gzipped budget
```

Tests use temporary data, a fake Gemini client and mocked `fetch`; they need no credentials or internet.

## Motion and theming

- **Light, dark or system theme.** Use the moon/sun button in the navbar, or Light / Dark / System in the footer. The choice is saved in this browser. "System" follows the operating system. Where the browser supports it, the new theme spreads out in a circle from the button.
- **Quick actions.** Press Cmd+K (Mac) or Ctrl+K (Windows) on any page, or use the search icon in the navbar, to jump to a section, open the 3D designer, change the theme or log in.
- **Animation rules.**
  - Timings and shared animations live in `frontend/src/index.css`: `--dur-*` and `--ease-*` for timings, `anim-*` classes for entrances, plus `stagger`, `lift`, `press`, `tilt` and `skeleton`.
  - Animations only move or fade elements (`transform` and `opacity`). Entrance animations don't hold their end state, so hover effects still work afterwards.
  - With the system's reduce-motion setting on, everything is instant. That includes the 3D designer's drop-in animation and the pointer effects, which are also off on touch screens.
  - JavaScript helpers live in `src/utils/motion.js`: `withViewTransition`, `tween` and `prefersReducedMotion`. Pointer effects live in `src/hooks/usePointerEffects.js`.
- **Pop-up notifications.** Call `useToast().toast('Saved')` in any component inside `ToastProvider`.
- **Colours.** Use theme colour names, not raw hex values: `bg-cream` for the page, `bg-white` for cards, `text-ink`, `border-line`, `bg-warn-bg` and `bg-accent-bg`. `src/theme.contrast.test.js` checks that text stays readable (at least 4.5:1) in both themes.
- **Bundle budgets** (gzipped, checked by `npm run size`):
  - 3D designer: up to 300 KB
  - main site: up to 130 KB
  - CSS: up to 25 KB

## Environment variables

None are required for the default (rule-based + mock) mode. Templates: `frontend/.env.example`, `backend/.env.example`. The backend loads `backend/.env` automatically (git-ignored), and its values **override** shell environment variables, so an old `export` in your shell profile can't shadow the project's settings.

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | `frontend/.env` | `http://localhost:8000` | Backend URL used by the browser. **Never put secrets in `VITE_` variables**; they are bundled into public JS. |
| `SPACESENSE_CORS_ORIGINS` | backend | unset = any `localhost` / `127.0.0.1` port | Comma-separated allowed origins; setting it replaces the localhost default. `*` is ignored. |
| `SPACESENSE_ANALYSIS_PROVIDER` | backend | `rule_based` | `rule_based` or `gemini`. Also controls the chat. |
| `SPACESENSE_DESIGN_PROVIDER` | backend | `mock` | `mock` or `gemini` |
| `GEMINI_API_KEY` | backend only | — | Required if either provider is `gemini` |
| `SPACESENSE_GEMINI_ANALYSIS_MODEL` | backend | `gemini-3.5-flash-lite` | Vision model for recommendations and chat |
| `SPACESENSE_GEMINI_IMAGE_MODEL` | backend | `gemini-3.1-flash-image` | Image-editing model (image in, image out) |
| `SPACESENSE_GEMINI_TIMEOUT_S` | backend | `90` | Per-request timeout for Gemini calls |
| `SPACESENSE_MAX_UPLOAD_MB` | backend | `10` | Maximum photo size |
| `SPACESENSE_PRODUCT_PROVIDER` | backend | `catalog` | `catalog`, or `serpapi` to add live shopping results before the catalog |
| `SERPAPI_API_KEY` | backend only | — | Required if the product provider is `serpapi` |

## Using Gemini

1. Get an API key from Google AI Studio.
2. Create `backend/.env` from `backend/.env.example` and set:
   ```
   GEMINI_API_KEY=your-key
   SPACESENSE_ANALYSIS_PROVIDER=gemini
   SPACESENSE_DESIGN_PROVIDER=gemini
   ```
3. Restart uvicorn and check http://localhost:8000/health shows `"analysis": "gemini", "design": "gemini"`. The server refuses to start if a Gemini provider is selected without a key.
4. Test in the app: upload a photo, review the recommendations, click **Yes, edit my photo** and compare before/after. Confirm walls, windows, doors and the camera angle match the original.

Notes:
- Model IDs change over time. If you get a "model not found" error in the backend log, set `SPACESENSE_GEMINI_*_MODEL` to a current model from Google's model list. The image model must support image input and image output.
- With Gemini enabled, photos are sent to Google for processing. Generated images carry Google's SynthID watermark.
- **Image editing needs quota for the image model.** On the free tier, `gemini-3.1-flash-image` requests can be rejected with HTTP 429 (shown in the app as "reached its usage limit"). Enable billing on the Google project, or wait for the quota to reset.
- Analysis with `gemini-3.5-flash-lite` takes a few seconds; larger models such as `gemini-3.8-flash` took around a minute in testing. Image edits take longer. Automated tests never call Gemini; they use fake clients.

## Accounts and login

Login is optional: the planner works without an account. Pages live at `#/login`, `#/signup`, `#/forgot-password`, `#/reset-password`, `#/verify-email` and `#/account`.

- **Storage:** SQLite at `backend/data/spacesense.db` (git-ignored, created on first start).
- **Passwords:** hashed with scrypt. Sessions are random tokens in an httpOnly, SameSite=Lax cookie; only a hash of each token is stored. Logging in is throttled per email and per IP.
- **CSRF:** every state-changing `/auth` route needs the header `X-Requested-With: SpaceSense`, and CORS only allows your frontend origin.
- **Email (verification and reset):** set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` in `backend/.env`. With `SMTP_HOST` empty (development), the links are printed in the backend log instead of being sent.
- **Google sign-in:** create a Web OAuth client in Google Cloud Console, add `http://localhost:8000/auth/google/callback` as an authorised redirect URI, and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The button only appears when both are set.
- **Production:** serve over HTTPS and set `SPACESENSE_COOKIE_SECURE=true`, `SPACESENSE_FRONTEND_URL` and `SPACESENSE_CORS_ORIGINS` to your real URLs.

## Product recommendations

**What you get:** one pick per category (seating, tables, beds, storage, lighting, rugs, curtains, decor) chosen for the room type and style, pre-selected so the planned total stays within the budget, plus unselected alternatives and ideas.

**How picks are made** (`backend/services/products.py`, all in code, no AI arithmetic):
- Categories follow the room type, reordered by the design advice: things the advice says to replace or add come first, and things it says to *keep* are dropped (keep the sofa → no sofa suggested).
- Products in your style rank first; colours that appear in the recommended palette are flagged as matches.
- Each category gets a share of the budget (anchor pieces such as sofas and beds get more than decor). The best match within its share is selected; leftover money then fills empty categories, cheapest first.
- If nothing fits, nothing is selected: the response says how far short the budget is (`shortfall_inr`) and lists the cheapest options first.
- Vastu on adds short placement notes to mirrors and heavy furniture.

**Product sources**

| Source | Status | What's verified |
| --- | --- | --- |
| Local catalog: 46 IKEA India listings (`backend/data/products.json`) | Works offline, always on | Product URL, name, listed INR price, photo, availability and size, read from each product page's public schema.org data on the `last_checked` date (10 Oct 2026). Category, style, room and "why" tags are curated by hand. |
| Local catalog: 10 "ideas" (e.g. sheesham coffee table, dhurrie rug) | Always on | Nothing about price or a specific product; these have **no price, photo or product URL**, only retailer search links. |
| Retailer search links | Amazon India, Flipkart, IKEA India, WoodenStreet | IKEA, Flipkart and WoodenStreet search URLs returned their search pages on 10 Oct 2026. Amazon blocks automated requests, so its standard `amazon.in/s?k=` format wasn't re-checked that way. The search results themselves are never checked. Pepperfry and Home Centre couldn't be confirmed, so they get no search link. |
| SerpAPI Google Shopping (optional) | Needs `SERPAPI_API_KEY`; tested only with recorded responses, not against the live API | A result is kept only if it links straight to a supported retailer and has a rupee price; it's labelled with the date it was fetched. |

**Honesty rules (enforced by `Product` in `schemas.py`, tested in `tests/test_products.py`):**
- A product is either *verified* (retailer product page + listed price + check date) or an *unpriced idea*. There are no estimated prices.
- Prices, photos and availability are only allowed on verified products. Product URLs must be https links on a supported retailer domain whose name matches the `retailer` field.
- Only verified prices count towards totals. Delivery, assembly and installation are excluded and the response says so. IKEA prices are what the product page listed on the check date; they can change.

**Keeping prices current:** run `cd backend && python -m tools.refresh_catalog` (or `--dry-run` first). It re-reads each verified product page one at a time with a pause between requests. A page that can't be read, or has no INR price, downgrades the item to an unpriced idea instead of keeping stale numbers.

**Adding a product**: add an entry to `backend/data/products.json` with `id`, `name`, `category`, `styles`, `room_types`, `colors`, `why`, `search_query`, plus `retailer` and `product_url` for a real listing, then run the refresh tool to fill the verified price, photo and date. Do not type prices in by hand.

**Adding a provider:**
1. Create a class with a `name` and `find(req: ProductRequest, categories: list[str]) -> list[Product]` (see `services/shopping.py`). Return only products you can back up; raise `ProductSourceError` on failure.
2. Register a factory in `LIVE_SOURCES` in `services/products.py` and read its credentials from backend environment variables only.
3. Add the variables to `backend/.env.example`, and tests with a fake client.
If a live source fails, the app shows a notice and carries on with the catalog.

**Limitations:** the catalog is one retailer (IKEA India) and a few dozen items; prices go stale until the refresh tool is run; dimensions come from the listing name and aren't checked against your room size; no live stock or delivery-pincode checks; other retailers appear only as search links unless SerpAPI is configured.

## 3D Room Designer

Open it from the results page (**Open 3D Room Designer**), or from the landing page (**Try the 3D designer**, or **3D Designer** in the navbar) without running an analysis. It loads only when opened (about 290 KB gzipped: `three` 0.182 and `@react-three/fiber` 9.8).

**Layout.** Top bar: undo/redo, your designs, budget, close. Left: the library (Furniture, Walls, Floor, Room tabs; a drawer on tablets and phones). Centre: the 3D view with mode, snap, 3D/Plan, camera and help controls. Right: the inspector for the selected piece or open wall (a bottom sheet on small screens).

**Getting around.**

| Input | 3D view | Plan view |
| --- | --- | --- |
| Left-drag on empty space | Orbit | Pan |
| Right-drag, Shift+drag, two-finger trackpad scroll | Pan | Pan |
| Scroll wheel, pinch | Zoom | Zoom |
| Double-click a piece, or `F` | Focus on it (nothing selected: fit the room) | Same |

Modes (`H` Navigate, `V` Select, `M` Move, `E` Rotate): Navigate never selects; Select selects with a click and drags always move the camera; Move drags a piece along the floor; Rotate turns it as you drag sideways. A press only becomes a drag after 4 px, the camera is switched off during an object drag, and `Esc` cancels a drag. Other keys: arrows nudge 3 in (Shift: 1 ft), `R`/`Shift+R` turn 15°, `Delete`/`Backspace` removes, `Ctrl/Cmd+D` duplicates, `Ctrl/Cmd+Z` undoes, `Ctrl/Cmd+Shift+Z` or `Ctrl+Y` redoes. If two-finger scrolling zooms instead of panning on your trackpad, choose **Help → Always pan**.

**What you can do.** Place 22 kinds of furniture (click a card, then the floor: the preview is green where it fits, red where it would collide or block a door) and decorate each wall in a front-on editor (art, mirrors, clocks, shelves, lamps, panels, curtains, doors, windows). Lamps, vases and small plants sit on table tops. Paint walls or wallpaper them (per wall), and choose one of six floor materials with direction, pattern size and finish. Snap to the grid, walls and other pieces (or turn snapping off). Rename, hide and lock pieces in **Room → In this room**.

**Prices.** Every item type maps only to verified catalog products that genuinely match it (`backend/data/studio_catalog.json`, tested against `products.json`). A placed piece is a *generic shape* with no price until you pick a product in the inspector. `POST /studio/price` computes all totals on the server from product ids; a price sent by the browser is rejected. Paint, wallpaper and flooring have no verified products, so they're listed as unpriced. A product with an unambiguous `W x D x H cm` listed size resizes the shape; other listed sizes are shown as text only.

**Saving.** Designs are saved in this browser only (localStorage): a draft autosaves 0.8 s after each change and is offered back next time; named versions can be saved, opened, renamed, duplicated and deleted. Every load is validated and migrated (`schemaVersion` 2). Photos aren't stored with designs. Undo/redo keeps 100 steps; camera moves, selection and panels never create steps.

**Performance** (30 mixed pieces, headless Chrome on a MacBook): a steady 60 fps while orbiting, about 160 draw calls, 5k triangles, 11 GPU geometries and 5 textures, with no growth across add/clear cycles. The scene renders only on change, shadows only re-render when the room changes, contact shadows are one instanced mesh, the pixel ratio is capped at 1.5, and textures are 512 px procedural canvases. Add `?perf` to the URL to see live numbers. Please re-check on the target Windows laptop (4 GB GPU).

**Colour accuracy.** Neutral tone mapping with calibrated lights keeps a front-lit wall within ΔE 5 of the chosen swatch (measured: warm white 1.2, sage 4.9, terracotta 4.8, charcoal 2.9).

**Limitations.** One photo can't give an accurate 3D room, so the room is built from the dimensions you enter (each marked *measured* or *estimated*) and the photo is a reference only. Doors and windows are drawn on the wall surface, not cut through it. Furniture shapes are simplified; overlapping pieces are allowed with a warning. Saved designs don't sync between devices.

### Arrange with AI (free Gemini tier)

The Room tab has an **Arrange with AI** panel. It asks a Gemini *text* model where to put the designer's existing pieces, so it works on the free tier. (Gemini's image models are not free, and no Gemini model produces 3D scenes.) The server sends the model a compact copy of the catalog and the room, constrains its answer to those piece ids, and the designer then re-checks every piece (inside the room, no overlaps, door not blocked, table-top pieces on a table) before placing it as one undoable change. Before placing, the designer tidies the layout with fixed rules (right angles, chairs facing their table, one rug fitted under the main group, walkways between big pieces, and a door and window if the model left them out). Collisions and outlines follow each piece's real shape: the L-shaped sofa is an L (a table fits in its corner) and round pieces are round. Products and prices are never chosen. Your photo is sent only if you tick the box; on the free tier Google may use content to improve its products. Settings: `GEMINI_API_KEY`, optional `SPACESENSE_GEMINI_LAYOUT_MODEL` and `SPACESENSE_LAYOUT_RATE_PER_MIN`. Endpoint: `POST /studio/ai-layout`.

## API

Room details are the same everywhere (feet and INR):

```json
{"room_type": "living room", "length_ft": 14, "width_ft": 12, "height_ft": 9,
 "style": "scandinavian", "budget_inr": 60000, "vastu": true}
```

- `room_type`: living room, bedroom, kitchen, dining room, home office, kids room (case-insensitive)
- `style`: modern-indian, minimalist, scandinavian, contemporary-luxury, boho, industrial
- Dimensions > 0 and ≤ 100 ft; budget ≥ 0. Unknown fields are rejected. The frontend form is stricter.
- Photos: JPG, PNG or WebP (checked by file content), up to `SPACESENSE_MAX_UPLOAD_MB`.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/health` | — | Status, version and active providers (`analysis`, `chat`, `design`, `products`) |
| POST | `/analyze-room` | multipart: `room` (JSON string), `photo` (file) | Metrics plus `recommendations` and `method` (`rule_based`/`gemini`), `photo_analyzed`. Never edits images. |
| POST | `/chat` | multipart: `room`, `photo`, `chat` (JSON `{"messages": [{"role": "user"\|"assistant", "content": "..."}], "recommendations": {...}}`; last message from the user, max 30 messages, 2000 chars each) | `{"reply", "provider", "is_ai_generated"}`. Text only. |
| POST | `/generate-design` | multipart: `room`, `photo` (the original), `instructions` (JSON `{"items": [...], "notes": ""}`), `approved=true` | `status: "edited"` with `image_url` (data URL of the edited photo), or `status: "mock"` with `image_url: null` |
| GET | `/studio/catalog` | — | Each 3D designer item type with the verified products it can stand for (`product_id`, `name`, `price_inr`, `last_checked`, `listed_size`, links) and its budget category |
| POST | `/studio/price` | JSON `{"budget_inr", "style", "items": [{"uid", "type", "product_id"?, "label"?}], "surfaces": [{"id": "walls"\|"floor", "label"}]}`. Prices are rejected. | `lines` (each `verified` with a price or `unavailable` with a `reason`), `categories` totals, `total_inr`, `remaining_inr`, `over_budget_inr`, `used_ratio`, `unpriced_count`, `suggestions` that fit the remaining budget |
| POST | `/recommend-products` | JSON room details, plus optional `recommendations` (the advice from `/analyze-room`) and `categories` filter | `items` (each with `kind` `verified_product`/`suggestion`, `selected`, `price_inr`, `quantity`, `line_total_inr`, `links`, `last_checked`, `why`, `notes`), `total_inr`, `remaining_inr`, `shortfall_inr`, `unpriced_count`, `excluded_costs`, `note`, `notices`, `sources` |

Errors share one shape, `{"error": "...", "details": [{"field", "message"}]}`:

| Status | `error` | When |
| --- | --- | --- |
| 422 | `validation_error` | Missing, invalid or malformed input (fields like `room.length_ft`) |
| 422 / 413 | `invalid_image` | Not a JPG/PNG/WebP, empty, or too large |
| 403 | `approval_required` | `/generate-design` without `approved=true` |
| 502 / 429 / 504 | `analysis_failed` | The analysis provider failed (429 = AI quota reached, 504 = timeout) |
| 502 / 429 / 504 | `chat_failed` | The chat provider failed, hit its quota or timed out |
| 502 / 429 / 504 | `edit_failed` | The image editor returned no edited image, hit its quota or timed out; nothing is fabricated and the original is unchanged |
| 422 | `invalid_design` | `/studio/price`: unknown item type, or a product that isn't allowed for that type |
| 503 | `catalog_unavailable` | Product catalog or designer catalog missing or malformed |
| 404 / 405 | `http_error` | Unknown route or wrong method |
| 500 | `internal_error` | Anything unexpected (no internal details exposed) |

Example:

```bash
curl -X POST localhost:8000/analyze-room \
  -F 'room={"room_type":"bedroom","length_ft":12,"width_ft":11,"height_ft":9,"style":"minimalist","budget_inr":50000,"vastu":false}' \
  -F photo=@room.jpg
```

## Project layout

```
backend/
  main.py               routes, CORS, error handlers, upload handling
  schemas.py            Pydantic request/response models
  config.py             settings (loads backend/.env), room types, styles, limits
  services/
    analysis.py         rule-based metrics and recommendations
    gemini.py           Gemini calls: analyze_with_gemini (text out), edit_with_gemini (image out)
    providers.py        provider interfaces, rule_based/mock/gemini implementations, env selection
    images.py           photo type and size validation
    products.py         product sources, relevance, in-budget plan
    shopping.py         optional SerpAPI Google Shopping source
    studio.py           3D designer pricing from catalog product ids
  data/products.json    curated catalog: verified IKEA India listings + unpriced ideas
  data/studio_catalog.json   designer item types → verified products they can stand for
  tools/refresh_catalog.py   re-checks catalog prices from retailer product pages
  tests/                pytest suite (fake Gemini client; no network)
frontend/
  src/services/api.js   all backend calls (+ api.test.js)
  src/components/results/DesignStudio.jsx   approval flow and before/after (+ test)
  src/components/results/ChatPanel.jsx      "Ask SpaceSense" consultant chat (+ test)
  src/components/results/FurniturePanel.jsx "Shop the look" product cards and budget bar (+ test)
  src/utils/productPlan.js                  selected-product totals (+ test)
  src/components/       landing/, form/, upload/, results/, layout/, ui/
  src/designer/         3D Room Designer (lazy-loaded)
    model/              pure logic + tests: design schema, reducer, history, storage, validation,
                        wall/floor placement, camera maths, catalog, finishes, pricing payload
    scene/              three.js scene: room, furniture, camera rig, plan overlay, textures
    wall/               front-facing wall editor (SVG)
    panels/ layout/ hooks/   inspector, catalog, budget, finishes, toolbar, sidebar, keyboard
```

The backend is stateless: it stores nothing. The original photo stays in the browser and is never replaced; the edited image is kept separately in page state.

## Troubleshooting

- **"Can't reach the SpaceSense server"** in the app: the backend isn't running, or it's on a different URL. Start it, or set `VITE_API_BASE_URL` and restart `npm run dev`.
- **CORS error / `OPTIONS ... 400` in the backend log**: open the app via `http://localhost:<port>`, not your network IP (e.g. `192.168.x.x`), which isn't allowed by default. If you must use another origin, list it in `SPACESENSE_CORS_ORIGINS`.
- **Several Vite servers running** (ports 5173, 5174, 5175…): each `npm run dev` starts a new one. Close the extra terminals, or run `lsof -ti :5174 | xargs kill`.
- **`address already in use` on port 8000**: another backend is running. Stop it, or use `--port 8001` and update `VITE_API_BASE_URL`.
- **Backend refuses to start with `ProviderConfigError`**: a `SPACESENSE_*_PROVIDER` value doesn't exist, or a Gemini provider is selected without `GEMINI_API_KEY`.
- **"The image editor did not return an edited photo"**: Gemini answered without an image (safety filter, unsupported model or a refusal). Check the backend log for the reason, try different changes, or set `SPACESENSE_GEMINI_IMAGE_MODEL`.
- **Analysis or edit times out**: raise `SPACESENSE_GEMINI_TIMEOUT_S`, or use a faster model.
- **"rejected the server's credentials" (401)**: the `GEMINI_API_KEY` in `backend/.env` is invalid or for the wrong project. Check it in Google AI Studio.
- **"reached its usage limit" (429)**: Gemini quota exhausted; see *Using Gemini* above.
- **Product shows "Photo unavailable" or the price differs on the retailer's site**: the listing changed since `last_checked`. Run `python -m tools.refresh_catalog` from `backend/`.
- **Notice "Live product search is unavailable"**: the SerpAPI request failed (bad key, quota, network). The catalog is used instead; see the backend log.
- **`ModuleNotFoundError` when running uvicorn or pytest**: run them from `backend/` with the venv activated.

## Not built yet

Live prices from more retailers (affiliate APIs), saving designs and shopping lists to an account (designs are saved in the browser only), multi-turn editing of an edited result, and automated checks that edits preserve room geometry. Optional 3D designer extras not built: PNG screenshot, design JSON export/import, day/night lighting, measurements between pieces, templates, material favourites, before/after with the photo, and moving several pieces together.
