from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class LayoutPoint(BaseModel):
    x: float
    y: float


class LayoutBounds(BaseModel):
    width: float
    depth: float
    height: float


class Opening(BaseModel):
    id: str
    type: Literal["door", "window"]
    wallId: str
    width: float
    height: float
    offset: float
    sillHeight: float | None = None
    notes: str | None = None


class WallSegment(BaseModel):
    id: str
    label: str
    start: LayoutPoint
    end: LayoutPoint
    thickness: float
    exterior: bool
    source: Literal["room", "custom"]
    roomId: str | None = None


class Room(BaseModel):
    id: str
    name: str
    purpose: Literal["living", "bedroom", "kitchen", "bathroom", "study", "balcony", "entry", "other"]
    origin: LayoutPoint
    width: float
    depth: float
    level: int = 1
    notes: str | None = None


class WeatherInput(BaseModel):
    windDirection: float = Field(ge=0, lt=360)
    windSpeed: float = Field(ge=0)
    outdoorTemperature: float


class SensorPoint(BaseModel):
    id: str
    label: str
    x: float
    y: float
    temperature: float


class HouseOrientation(BaseModel):
    facingDegrees: float
    facingLabel: str
    frontDoorDegrees: float
    frontDoorLabel: str


class HouseMetadata(BaseModel):
    projectName: str
    address: str
    latitude: float | None = None
    longitude: float | None = None
    timezone: str | None = None
    buildYear: int
    renovationYear: int


class HouseLayout(BaseModel):
    id: str
    templateId: str
    metadata: HouseMetadata
    bounds: LayoutBounds
    orientation: HouseOrientation
    rooms: list[Room]
    walls: list[WallSegment]
    openings: list[Opening]
    sensors: list[SensorPoint]
    weather: WeatherInput


class AnalysisResponse(BaseModel):
    heatmap: list[dict]
    airflow: list[dict]
    fengshui: dict
    validation: list[dict]


class TextPromptRequest(BaseModel):
    prompt: str
