from __future__ import annotations

from fastapi import FastAPI

from backend.ai.service import draft_layout_from_text
from backend.cfd.service import generate_heatmap
from backend.fengshui.service import analyze_fengshui
from backend.models import AnalysisResponse, HouseLayout, TextPromptRequest

app = FastAPI(title="3D HOUSE FS API", version="0.1.0")


def validate_layout(layout: HouseLayout) -> list[dict]:
    issues: list[dict] = []
    if len(layout.rooms) == 0:
        issues.append({"level": "error", "code": "NO_ROOMS", "message": "至少需要一个房间。"})
    if len(layout.sensors) < 2:
        issues.append({"level": "warning", "code": "SENSOR_SPARSE", "message": "温度点位偏少，热力图更偏估算。"})
    if not layout.metadata.address:
        issues.append({"level": "warning", "code": "ADDRESS_MISSING", "message": "地址缺失会影响天气联动。"})
    return issues


def generate_airflow(layout: HouseLayout) -> list[dict]:
    incoming = layout.orientation.facingLabel
    output: list[dict] = []
    for room in layout.rooms:
        opening_count = len([opening for opening in layout.openings if opening.wallId.startswith(room.id)])
        strength = min(1.0, round(0.25 + opening_count * 0.18 + layout.weather.windSpeed / 8, 2))
        output.append(
            {
                "id": f"flow-{room.id}",
                "roomId": room.id,
                "fromDirection": incoming,
                "toDirection": "S" if incoming == "N" else "N",
                "strength": strength,
                "explanation": f"{room.name} 当前基于 {opening_count} 个门窗开口和室外 {layout.weather.windSpeed}m/s 风速做简化估算。",
            }
        )
    return output


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/analyze/complete", response_model=AnalysisResponse)
def analyze_complete(layout: HouseLayout) -> AnalysisResponse:
    return AnalysisResponse(
        heatmap=generate_heatmap(layout),
        airflow=generate_airflow(layout),
        fengshui=analyze_fengshui(layout),
        validation=validate_layout(layout),
    )


@app.post("/analyze/heatmap")
def analyze_heatmap(layout: HouseLayout) -> dict:
    return {"heatmap": generate_heatmap(layout)}


@app.post("/analyze/airflow")
def analyze_airflow(layout: HouseLayout) -> dict:
    return {"airflow": generate_airflow(layout)}


@app.post("/analyze/fengshui")
def analyze_fengshui_info(layout: HouseLayout) -> dict:
    return {"fengshui": analyze_fengshui(layout)}


@app.post("/ai/layout-from-text")
def ai_layout_from_text(request: TextPromptRequest) -> dict:
    return draft_layout_from_text(request.prompt)

