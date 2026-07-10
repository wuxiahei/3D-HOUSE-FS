export type TemplateId = "blank" | "compact-two-room" | "family-three-room";

export type CompassDirection =
  | "N"
  | "NE"
  | "E"
  | "SE"
  | "S"
  | "SW"
  | "W"
  | "NW";

export type WallSource = "room" | "custom";

export type BaguaPalace =
  | "north"
  | "northeast"
  | "east"
  | "southeast"
  | "south"
  | "southwest"
  | "west"
  | "northwest"
  | "center";

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutBounds {
  width: number;
  depth: number;
  height: number;
}

export interface Opening {
  id: string;
  type: "door" | "window";
  wallId: string;
  width: number;
  height: number;
  offset: number;
  sillHeight?: number;
  notes?: string;
}

export interface WallSegment {
  id: string;
  label: string;
  start: LayoutPoint;
  end: LayoutPoint;
  thickness: number;
  exterior: boolean;
  source: WallSource;
  roomId?: string;
}

export interface Room {
  id: string;
  name: string;
  purpose:
    | "living"
    | "bedroom"
    | "kitchen"
    | "bathroom"
    | "study"
    | "balcony"
    | "entry"
    | "other";
  origin: LayoutPoint;
  width: number;
  depth: number;
  level: number;
  notes?: string;
}

export interface WeatherInput {
  windDirection: number;
  windSpeed: number;
  outdoorTemperature: number;
}

export interface SensorPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  temperature: number;
}

export interface ClimateDevice {
  id: string;
  type: "ac" | "kitchen-heat";
  roomId: string;
  label: string;
  x: number;
  y: number;
  directionDegrees: number;
  strength: number;
  temperatureDelta: number;
}

export interface HouseOrientation {
  facingDegrees: number;
  facingLabel: CompassDirection;
  frontDoorDegrees: number;
  frontDoorLabel: CompassDirection;
}

export interface HouseMetadata {
  projectName: string;
  address: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  buildYear: number;
  renovationYear: number;
}

export interface HouseLayout {
  schemaVersion: 2;
  id: string;
  templateId: TemplateId;
  metadata: HouseMetadata;
  bounds: LayoutBounds;
  orientation: HouseOrientation;
  rooms: Room[];
  walls: WallSegment[];
  openings: Opening[];
  sensors: SensorPoint[];
  devices: ClimateDevice[];
  weather: WeatherInput;
}

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface HeatmapCell {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  temperature: number;
  roomId?: string;
  intensity: number;
}

export interface AirflowVector {
  id: string;
  roomId: string;
  fromDirection: CompassDirection;
  toDirection: CompassDirection;
  strength: number;
  explanation: string;
}

export interface BaguaSector {
  palace: BaguaPalace;
  label: string;
  gridX: number;
  gridY: number;
  roomIds: string[];
  reference: string;
  annualStar: number;
  annualStarLabel: string;
  annualStarMeaning: string;
  compassDirection: CompassDirection | "CENTER";
}

export interface FengshuiFinding {
  id: string;
  title: string;
  basis: string;
  relatedRooms: string[];
  tone: "neutral" | "attention" | "supportive";
  reference: string;
  relatedPalace?: BaguaPalace;
}

export interface CompassSector {
  id: string;
  label: CompassDirection;
  startAngle: number;
  endAngle: number;
  active: boolean;
}

export interface RoomPalaceMapping {
  roomId: string;
  roomName: string;
  palace: BaguaPalace;
  palaceLabel: string;
  annualStar: number;
}

export interface FengshuiAnalysis {
  summary: string[];
  compass: CompassSector[];
  bagua: BaguaSector[];
  findings: FengshuiFinding[];
  roomPalaceMap: RoomPalaceMapping[];
}
