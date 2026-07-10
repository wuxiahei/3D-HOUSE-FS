from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LayoutPoint(StrictModel):
    x: float
    y: float


class LayoutBounds(StrictModel):
    width: float = Field(gt=0)
    depth: float = Field(gt=0)
    height: float = Field(gt=0)


class Opening(StrictModel):
    id: str
    type: Literal["door", "window"]
    wallId: str
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    offset: float = Field(ge=0)
    sillHeight: float | None = Field(default=None, ge=0)
    notes: str | None = None


class WallSegment(StrictModel):
    id: str
    label: str
    start: LayoutPoint
    end: LayoutPoint
    thickness: float = Field(gt=0)
    exterior: bool
    source: Literal["room", "custom"]
    roomId: str | None = None


class Room(StrictModel):
    id: str
    name: str
    purpose: Literal["living", "bedroom", "kitchen", "bathroom", "study", "balcony", "entry", "other"]
    origin: LayoutPoint
    width: float = Field(gt=0)
    depth: float = Field(gt=0)
    level: int = Field(default=1, ge=0)
    notes: str | None = None


class WeatherInput(StrictModel):
    windDirection: float = Field(ge=0, le=360)
    windSpeed: float = Field(ge=0)
    outdoorTemperature: float


class SensorPoint(StrictModel):
    id: str
    label: str
    x: float
    y: float
    temperature: float


class ClimateDevice(StrictModel):
    id: str
    type: Literal["ac", "kitchen-heat"]
    roomId: str
    label: str
    x: float
    y: float
    directionDegrees: float = Field(ge=0, le=360)
    strength: float = Field(gt=0, le=1)
    temperatureDelta: float


class HouseOrientation(StrictModel):
    facingDegrees: float = Field(ge=0, le=360)
    facingLabel: str
    frontDoorDegrees: float = Field(ge=0, le=360)
    frontDoorLabel: str


class HouseMetadata(StrictModel):
    projectName: str
    address: str
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    timezone: str | None = None
    buildYear: int
    renovationYear: int


class HouseLayout(StrictModel):
    schemaVersion: Literal[2]
    id: str
    templateId: Literal["blank", "compact-two-room", "family-three-room"]
    metadata: HouseMetadata
    bounds: LayoutBounds
    orientation: HouseOrientation
    rooms: list[Room]
    walls: list[WallSegment]
    openings: list[Opening]
    sensors: list[SensorPoint]
    devices: list[ClimateDevice] = Field(default_factory=list)
    weather: WeatherInput


class TextPromptRequest(StrictModel):
    prompt: str
