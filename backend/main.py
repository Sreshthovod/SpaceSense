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
from schemas import ChatReply, ChatRequest, DesignResponse, EditInstructions, ProductRecommendations, RoomAnalysis, RoomRequest
from services.images import ImageValidationError, RoomImage, max_upload_bytes, validate_image
from services import vision
from services.products import CATALOG_PATH, CatalogError, load_catalog, recommend
from services.providers import ProviderError, get_design_editor, get_room_analyzer, get_room_chat

logger = logging.getLogger("spacesense")

M = TypeVar("M", bound=BaseModel)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Fail fast on a malformed catalog, an unknown provider name or missing provider credentials.
    load_catalog(CATALOG_PATH)
    get_room_analyzer()
    get_room_chat()
    get_design_editor()
    yield


app = FastAPI(title="SpaceSense API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=get_allowed_origin_regex(),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


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
        "providers": {"analysis": get_room_analyzer().name, "chat": get_room_chat().name, "design": get_design_editor().name},
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
    room: str = Form(...),
    photo: UploadFile = File(...),
    instructions: str = Form(...),
    approved: str = Form(""),
):
    """Edits the user's original photo. Runs only with explicit approval (`approved=true`)."""
    if approved.strip().lower() != "true":
        return error(403, "approval_required", "Approve the recommendations before editing your photo.", field="approved")
    req = parse_json_field(RoomRequest, room, "room")
    edits = parse_json_field(EditInstructions, instructions, "instructions")
    image = await read_photo(photo)
    editor = get_design_editor()
    try:
        result = await run_in_threadpool(editor.edit, req, image, edits)
    except ProviderError as exc:
        logger.error("Design provider error (%s): %s", exc.reason, exc)
        return provider_failure(exc, "edit_failed", "The image editor did not return an edited photo.", UNCHANGED)
    if result.image_url:
        result.preservation = await run_in_threadpool(vision.compare_structure, image, result.image_url)
    return result


@app.post("/recommend-products", response_model=ProductRecommendations)
def recommend_products(req: RoomRequest):
    return recommend(req)
