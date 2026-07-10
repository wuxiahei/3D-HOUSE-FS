from __future__ import annotations

from fastapi import FastAPI

from backend.ai.service import draft_layout_from_text
from backend.fengshui.service import analyze_fengshui
from backend.models import HouseLayout, TextPromptRequest

app = FastAPI(title="3D HOUSE FS API", version="0.2.0")


def validate_layout(layout: HouseLayout) -> list[dict]:
    issues: list[dict] = []
    if len(layout.rooms) == 0:
        issues.append({"level": "error", "code": "NO_ROOMS", "message": "At least one room is required."})
    if len(layout.sensors) < 2:
        issues.append({"level": "warning", "code": "SENSOR_SPARSE", "message": "Temperature sensors are sparse."})
    if not layout.metadata.address:
        issues.append({"level": "warning", "code": "ADDRESS_MISSING", "message": "Address is missing."})
    return issues


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "schemaVersion": 2,
        "simulation": "browser-authoritative",
        "backend": "experimental"
    }


@app.post("/analyze/fengshui")
def analyze_fengshui_info(layout: HouseLayout) -> dict:
    return {
        "fengshui": analyze_fengshui(layout),
        "validation": validate_layout(layout),
        "simulation": "browser-authoritative"
    }


@app.post("/ai/layout-from-text")
def ai_layout_from_text(request: TextPromptRequest) -> dict:
    return draft_layout_from_text(request.prompt)
