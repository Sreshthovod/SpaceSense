import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from config import get_allowed_origins
from schemas import DesignResponse, ProductRecommendations, RoomAnalysis, RoomRequest
from services.products import CATALOG_PATH, CatalogError, load_catalog, recommend
from services.providers import ProviderError, get_design_generator, get_room_analyzer

logger = logging.getLogger("spacesense")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Fail fast on a malformed catalog or an unknown provider name.
    load_catalog(CATALOG_PATH)
    get_room_analyzer()
    get_design_generator()
    yield


app = FastAPI(title="SpaceSense API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    details = [
        {"field": ".".join(p for p in e["loc"][1:] if isinstance(p, str)) or "body", "message": e["msg"]}
        for e in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"error": "validation_error", "details": details})


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(_: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": "http_error", "details": [{"field": "body", "message": str(exc.detail)}]})


@app.exception_handler(CatalogError)
async def catalog_error_handler(_: Request, exc: CatalogError):
    logger.error("Catalog error: %s", exc)
    return JSONResponse(status_code=503, content={"error": "catalog_unavailable", "details": []})


@app.exception_handler(ProviderError)
async def provider_error_handler(_: Request, exc: ProviderError):
    logger.error("Provider error: %s", exc)
    return JSONResponse(status_code=503, content={"error": "provider_unavailable", "details": []})


@app.exception_handler(Exception)
async def unhandled_error_handler(_: Request, exc: Exception):
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(status_code=500, content={"error": "internal_error", "details": []})


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "spacesense-api",
        "version": app.version,
        "providers": {"analysis": get_room_analyzer().name, "design": get_design_generator().name},
    }


@app.post("/analyze-room", response_model=RoomAnalysis)
def analyze_room_endpoint(req: RoomRequest):
    return get_room_analyzer().analyze(req)


@app.post("/generate-design", response_model=DesignResponse)
def generate_design(req: RoomRequest):
    """Currently a mock: no model is called and no image is produced."""
    return get_design_generator().generate(req)


@app.post("/recommend-products", response_model=ProductRecommendations)
def recommend_products(req: RoomRequest):
    return recommend(req)

