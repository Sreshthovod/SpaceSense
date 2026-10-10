import json
import logging
from contextlib import asynccontextmanager
from typing import TypeVar

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from config import get_allowed_origin_regex, get_allowed_origins
from routes_auth import router as auth_router
from schemas import (
    ChatReply,
    ChatRequest,
    DesignResponse,
    EditInstructions,
    ProductRecommendations,
    ProductRequest,
    RoomAnalysis,
    RoomRequest,
    LayoutOptions,
    StudioCatalog,
    StudioLayout,
    StudioPrice,
    StudioPriceRequest,
)
from services.images import ImageValidationError, RoomImage, max_upload_bytes, validate_image
from services import auth as auth_service
from services import imagegen
from services import vision
from services.products import CATALOG_PATH, CatalogError, get_product_sources, load_catalog, recommend
from services import providers as providers_module
from services.providers import ProviderConfigError, ProviderError, get_design_editor, get_room_analyzer, get_room_chat
from services.studio import (
    STUDIO_CATALOG_PATH,
    StudioDesignError,
    layout_rate_limited,
    load_mapping,
    price_design,
    studio_catalog,
)

logger = logging.getLogger("spacesense")

M = TypeVar("M", bound=BaseModel)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Fail fast on a malformed catalog, an unknown provider name or missing provider credentials.
    auth_service.init_db()
    load_catalog(CATALOG_PATH)
    load_mapping(STUDIO_CATALOG_PATH)
    get_product_sources()
    get_room_analyzer()
    get_room_chat()
    get_design_editor()
    yield


app = FastAPI(title="SpaceSense API", version="0.4.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=get_allowed_origin_regex(),
    allow_credentials=True,  # the session cookie; origins are never "*"
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Requested-With"],
)
app.include_router(auth_router)


def error(status: int, code: str, message: str | None = None, field: str = "body") -> JSONResponse:
    details = [{"field": field, "message": message}] if message else []
    return JSONResponse(status_code=status, content={"error": code, "details": details})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    details = [
        {"field": ".".join(p for p in e["loc"][1:] if isinstance(p, str)) or "body", "message": e["msg"]}
        for e in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"error": "validation_error", "details": details})


@app.exception_handler(auth_service.AuthError)
async def auth_error_handler(_: Request, exc: auth_service.AuthError):
    response = error(exc.status, "auth_error", str(exc), field=exc.field)
    if exc.retry_after:
        response.headers["Retry-After"] = str(exc.retry_after)
    return response


@app.exception_handler(ImageValidationError)
async def image_error_handler(_: Request, exc: ImageValidationError):
    return error(413 if exc.too_large else 422, "invalid_image", str(exc), field="photo")


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(_: Request, exc: StarletteHTTPException):
    return error(exc.status_code, "http_error", str(exc.detail))


@app.exception_handler(CatalogError)
async def catalog_error_handler(_: Request, exc: CatalogError):
    logger.error("Catalog error: %s", exc)
    return error(503, "catalog_unavailable")


@app.exception_handler(StudioDesignError)
async def studio_design_error_handler(_: Request, exc: StudioDesignError):
    return error(422, "invalid_design", str(exc), field=exc.field)


@app.exception_handler(Exception)
async def unhandled_error_handler(_: Request, exc: Exception):
    logger.exception("Unhandled error", exc_info=exc)
    return error(500, "internal_error")


UNCHANGED = " Your original photo is unchanged."
PROVIDER_FAILURES = {
    # reason: (status, user message)
    "quota": (429, "The AI service has reached its usage limit. Please try again later."),
    "auth": (502, "The AI service rejected the server's credentials. Check GEMINI_API_KEY on the backend."),
    "timeout": (504, "The AI service took too long to respond. Please try again."),
}


def provider_failure(exc: ProviderError, code: str, default: str, suffix: str = "") -> JSONResponse:
    status, message = PROVIDER_FAILURES.get(exc.reason, (502, default))
    return error(status, code, message + suffix)


def parse_json_field(model: type[M], raw: str, field: str) -> M:
    """Validate a JSON-encoded multipart form field, reporting errors as `<field>.<name>`."""
    try:
        return model.model_validate(json.loads(raw))
    except json.JSONDecodeError:
        raise RequestValidationError([{"loc": ("body", field), "msg": "must be valid JSON", "type": "json_invalid"}])
    except ValidationError as exc:
        raise RequestValidationError(
            [{**e, "loc": ("body", field, *e["loc"])} for e in exc.errors(include_url=False, include_context=False)]
        )


async def read_photo(photo: UploadFile) -> RoomImage:
    data = await photo.read(max_upload_bytes() + 1)  # read at most one byte over the limit
    return validate_image(data)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "spacesense-api",
        "version": app.version,
        "providers": {
            "analysis": get_room_analyzer().name,
            "chat": get_room_chat().name,
            "design": get_design_editor().name,
            "products": [s.name for s in get_product_sources()],
        },
    }


@app.post("/analyze-room", response_model=RoomAnalysis)
async def analyze_room_endpoint(room: str = Form(...), photo: UploadFile = File(...)):
    """Written recommendations only. This route has no access to the image editor."""
    req = parse_json_field(RoomRequest, room, "room")
    image = await read_photo(photo)
    analyzer = get_room_analyzer()
    try:
        analysis = await run_in_threadpool(analyzer.analyze, req, image)
    except ProviderError as exc:
        logger.error("Analysis provider error (%s): %s", exc.reason, exc)
        return provider_failure(exc, "analysis_failed", "The room analysis service failed. Please try again.")
    analysis.photo_insights = await run_in_threadpool(vision.assess_photo, image)
    return analysis


@app.post("/chat", response_model=ChatReply)
async def chat_endpoint(room: str = Form(...), photo: UploadFile = File(...), chat: str = Form(...)):
    """Follow-up questions about the room. Text only; this route has no access to the image editor."""
    req = parse_json_field(RoomRequest, room, "room")
    conversation = parse_json_field(ChatRequest, chat, "chat")
    image = await read_photo(photo)
    provider = get_room_chat()
    try:
        return await run_in_threadpool(provider.reply, req, image, conversation)
    except ProviderError as exc:
        logger.error("Chat provider error (%s): %s", exc.reason, exc)
        return provider_failure(exc, "chat_failed", "The design consultant couldn't answer right now. Please try again.")


@app.post("/generate-design", response_model=DesignResponse)
async def generate_design(
    request: Request,
    room: str = Form(...),
    photo: UploadFile = File(...),
    instructions: str = Form(...),
    approved: str = Form(""),
    provider: str = Form(""),
):
    """Edits the user's original photo. Runs only with explicit approval (`approved=true`).

    `provider` picks the image editor: "gemini" or "cloudflare". Empty uses the server's configured editor.
    """
    if approved.strip().lower() != "true":
        return error(403, "approval_required", "Approve the recommendations before editing your photo.", field="approved")
    req = parse_json_field(RoomRequest, room, "room")
    edits = parse_json_field(EditInstructions, instructions, "instructions")
    provider = imagegen.validate_provider(provider) if provider.strip() else ""
    image = await read_photo(photo)
    if provider == "cloudflare":
        return await edit_with_cloudflare(request, req, image, edits)
    try:
        editor = providers_module.EDITORS["gemini"]() if provider == "gemini" else get_design_editor()
    except ProviderConfigError:
        return error(503, "edit_failed", "Gemini image editing isn't set up on this server (GEMINI_API_KEY)." + UNCHANGED)
    try:
        result = await run_in_threadpool(editor.edit, req, image, edits)
    except ProviderError as exc:
        logger.error("Design provider error (%s): %s", exc.reason, exc)
        return provider_failure(exc, "edit_failed", "The image editor did not return an edited photo.", UNCHANGED)
    if result.image_url:
        result.preservation = await run_in_threadpool(vision.compare_structure, image, result.image_url)
    return result


async def edit_with_cloudflare(request: Request, req: RoomRequest, image: RoomImage, edits: EditInstructions):
    if limited := imagegen_rate_limited(request):
        return limited
    try:
        source = await run_in_threadpool(
            imagegen.prepare_edit_image, image.data, imagegen.REDESIGN_OUTPUT_SIDE, False
        )
        image_url = await run_in_threadpool(imagegen.edit_image, imagegen.redesign_prompt(req, edits), source)
    except imagegen.ImageGenError as exc:
        logger.error("Cloudflare design edit failed (%s): %s", exc.reason, exc)
        return imagegen_failure(exc, "cloudflare", "edit_failed", UNCHANGED)
    result = DesignResponse(
        status="edited",
        provider="cloudflare",
        is_ai_generated=True,
        image_url=image_url,
        message="AI-edited version of your original photo, made with Cloudflare FLUX. It is regenerated from a "
        "small copy of your photo, so details can differ more than with Gemini.",
        instructions_used=edits.items,
    )
    result.preservation = await run_in_threadpool(vision.compare_structure, image, image_url)
    return result


@app.post("/recommend-products", response_model=ProductRecommendations)
def recommend_products(req: ProductRequest):
    """Products for the room and the advice the user received. Totals use verified prices only."""
    return recommend(req)


@app.get("/studio/catalog", response_model=StudioCatalog)
def studio_catalog_endpoint():
    """Verified products each 3D designer item type can stand for, with listed prices."""
    return studio_catalog()


@app.post("/studio/price", response_model=StudioPrice)
def studio_price(req: StudioPriceRequest):
    """Price a 3D design. Only types and product ids are accepted; all prices come from the catalog."""
    return price_design(req)


@app.post("/studio/ai-layout", response_model=StudioLayout)
async def studio_ai_layout(
    request: Request,
    room: str = Form(...),
    layout: str = Form(...),
    photo: UploadFile | None = File(None),
):
    """Propose where designer pieces go, from the room brief and optionally a photo.

    Text out only (no image generation), so it runs on a free Gemini key. The answer is a proposal:
    the designer re-checks every piece before placing it.
    """
    wait = layout_rate_limited(request.client.host if request.client else "unknown")
    if wait:
        response = error(429, "rate_limited", f"Too many layout requests. Try again in {int(wait) + 1} seconds.")
        response.headers["Retry-After"] = str(int(wait) + 1)
        return response
    req = parse_json_field(RoomRequest, room, "room")
    options = parse_json_field(LayoutOptions, layout, "layout")
    image = await read_photo(photo) if photo is not None else None
    try:
        arranger = providers_module.GeminiLayout()
    except ProviderConfigError:
        return error(503, "layout_unavailable", "AI arrange needs a Gemini API key on the server (GEMINI_API_KEY).")
    try:
        return await run_in_threadpool(arranger.arrange, req, image, options)
    except ProviderError as exc:
        logger.error("Layout provider error (%s): %s", exc.reason, exc)
        return provider_failure(exc, "layout_failed", "The layout service failed. Please try again.")


IMAGEGEN_KEYS = {"cloudflare": "CF_API_TOKEN and CF_ACCOUNT_ID", "gemini": "GEMINI_API_KEY"}
IMAGEGEN_FAILURES = {
    # reason: (status, user message); {provider} and {keys} are filled in per request
    "not_configured": (503, "{provider} image generation isn't set up on this server yet."),
    "quota": (429, "The {provider} allowance has been used up for now. Please try again later, or pick the other provider."),
    "auth": (502, "{provider} rejected the server's credentials. Check {keys} on the backend."),
    "timeout": (504, "The image service took too long to respond. Please try again."),
    "rejected": (502, "The image service couldn't process that request. Try a different prompt or image."),
}


def imagegen_failure(exc: imagegen.ImageGenError, provider: str, code: str = "image_generation_failed", suffix: str = "") -> JSONResponse:
    status, message = IMAGEGEN_FAILURES.get(exc.reason, (502, "The image service failed. Please try again."))
    return error(status, code, message.format(provider=provider.capitalize(), keys=IMAGEGEN_KEYS[provider]) + suffix)


def imagegen_rate_limited(request: Request) -> JSONResponse | None:
    # The socket address, not X-Forwarded-For: that header is client-controlled unless a trusted proxy sets it.
    wait = imagegen.get_rate_limiter().check(request.client.host if request.client else "unknown")
    if not wait:
        return None
    response = error(429, "rate_limited", f"Too many image requests. Try again in {int(wait) + 1} seconds.")
    response.headers["Retry-After"] = str(int(wait) + 1)
    return response


@app.exception_handler(imagegen.ImageGenValidationError)
async def imagegen_validation_handler(_: Request, exc: imagegen.ImageGenValidationError):
    return error(413 if exc.too_large else 400, "invalid_request", str(exc), field=exc.field)


@app.get("/api/image-providers")
def image_providers_endpoint():
    """Which image providers have credentials on this server, so the UI can disable the others."""
    return imagegen.provider_status()


@app.post("/api/generate-image")
async def generate_image_endpoint(request: Request):
    """Text to image. `provider` is "cloudflare" (FLUX.1 schnell, the default) or "gemini".
    Returns {"image": "data:image/...;base64,...", "provider": ...}."""
    if limited := imagegen_rate_limited(request):
        return limited
    try:
        body = await request.json()
    except ValueError:
        return error(400, "invalid_request", "The request body must be JSON.")
    if not isinstance(body, dict):
        return error(400, "invalid_request", "The request body must be a JSON object.")
    prompt = imagegen.validate_prompt(body.get("prompt"))
    steps = imagegen.validate_steps(body.get("steps"))
    provider = imagegen.validate_provider(body.get("provider"))
    try:
        if provider == "gemini":
            image = await run_in_threadpool(imagegen.gemini_generate, prompt)
        else:
            image = await run_in_threadpool(imagegen.generate_image, prompt, steps)
    except imagegen.ImageGenError as exc:
        logger.error("Image generation failed (%s, %s): %s", provider, exc.reason, exc)
        return imagegen_failure(exc, provider)
    return {"image": image, "provider": provider}


@app.post("/api/edit-image")
async def edit_image_endpoint(
    request: Request, prompt: str = Form(""), image: UploadFile = File(...), provider: str = Form("")
):
    """Generate on top of an uploaded PNG, JPEG or WebP (5 MB max) with FLUX.2 klein (cloudflare, the default) or Gemini."""
    if limited := imagegen_rate_limited(request):
        return limited
    prompt = imagegen.validate_prompt(prompt)
    provider = imagegen.validate_provider(provider)
    data = await image.read(imagegen.MAX_EDIT_UPLOAD_BYTES + 1)
    try:
        if provider == "gemini":
            mime = imagegen.validate_upload(data)
            result = await run_in_threadpool(imagegen.gemini_generate, prompt, data, mime)
        else:
            source = await run_in_threadpool(imagegen.prepare_edit_image, data)
            result = await run_in_threadpool(imagegen.edit_image, prompt, source)
    except imagegen.ImageGenError as exc:
        logger.error("Image edit failed (%s, %s): %s", provider, exc.reason, exc)
        return imagegen_failure(exc, provider)
    return {"image": result, "provider": provider}
