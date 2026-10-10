import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import ALLOWED_ORIGINS
from schemas import DesignResponse, ProductRecommendations, RoomAnalysis, RoomRequest
from services.analysis import analyze_room
from services.products import load_catalog, recommend

logger = logging.getLogger("spacesense")

@asynccontextmanager
async def lifespan(_: FastAPI):
    load_catalog()  # fail fast if the sample catalog is missing or malformed
    yield


app = FastAPI(title="SpaceSense API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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


@app.exception_handler(Exception)
async def unhandled_error_handler(_: Request, exc: Exception):
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(status_code=500, content={"error": "internal_error", "details": []})


@app.get("/health")
def health():
    return {"status": "ok", "service": "spacesense-api", "version": app.version}


@app.post("/analyze-room", response_model=RoomAnalysis)
def analyze_room_endpoint(req: RoomRequest):
    return analyze_room(req)


@app.post("/generate-design", response_model=DesignResponse)
def generate_design(req: RoomRequest):
    """MOCK: no model is called and no image is produced."""
    return DesignResponse(
        message="Mock response. AI design generation is not integrated yet; no image was generated.",
        request_summary=req.model_dump(),
    )


@app.post("/recommend-products", response_model=ProductRecommendations)
def recommend_products(req: RoomRequest):
    return recommend(req)

