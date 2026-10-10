"""Pluggable providers for room analysis and design generation.

Routes depend only on the two interfaces below, so a real AI provider can be added by
writing one class and registering it, without touching routes, schemas or the frontend.
Providers are chosen with SPACESENSE_ANALYSIS_PROVIDER and SPACESENSE_DESIGN_PROVIDER.
Credentials for future providers must come from backend environment variables only.
"""
import os
from functools import lru_cache
from typing import Protocol

from schemas import DesignResponse, RoomAnalysis, RoomRequest
from services.analysis import analyze_room


class ProviderError(Exception):
    """An external provider failed or is unavailable (timeouts, quota, bad credentials)."""


class ProviderConfigError(Exception):
    """The configured provider name is unknown or missing required settings."""


class RoomAnalyzer(Protocol):
    name: str

    def analyze(self, req: RoomRequest) -> RoomAnalysis: ...


class DesignGenerator(Protocol):
    name: str

    def generate(self, req: RoomRequest) -> DesignResponse: ...


class RuleBasedAnalyzer:
    name = "rule_based"

    def analyze(self, req: RoomRequest) -> RoomAnalysis:
        return analyze_room(req)


class MockDesignGenerator:
    """Never produces an image; the response says so explicitly."""

    name = "mock"

    def generate(self, req: RoomRequest) -> DesignResponse:
        return DesignResponse(
            message="Mock response. AI design generation is not integrated yet; no image was generated.",
            request_summary=req,
        )


ANALYZERS: dict[str, type] = {RuleBasedAnalyzer.name: RuleBasedAnalyzer}
GENERATORS: dict[str, type] = {MockDesignGenerator.name: MockDesignGenerator}


def _select(registry: dict[str, type], env_var: str, default: str):
    name = os.getenv(env_var, default).strip().lower()
    if name not in registry:
        raise ProviderConfigError(f"{env_var}={name!r} is not one of: {', '.join(registry)}")
    return registry[name]()


@lru_cache
def get_room_analyzer() -> RoomAnalyzer:
    return _select(ANALYZERS, "SPACESENSE_ANALYSIS_PROVIDER", RuleBasedAnalyzer.name)


@lru_cache
def get_design_generator() -> DesignGenerator:
    return _select(GENERATORS, "SPACESENSE_DESIGN_PROVIDER", MockDesignGenerator.name)
