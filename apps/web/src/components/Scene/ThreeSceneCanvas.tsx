"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import type {
  AirflowVector,
  BaguaPalace,
  FengshuiAnalysis,
  HeatmapCell,
  HouseLayout,
  SensorPoint
} from "@fengshui/core";
import { wallCenter, wallLength, wallRotationRadians } from "@fengshui/core";
import type { AnalysisControls, SceneLayers } from "../AppShell";
import type { FlowField, HeatField } from "@fengshui/simulation";
import { formatDirectionLabel } from "../../lib/editor";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

function sceneX(layout: HouseLayout, x: number) {
  return x - layout.bounds.width / 2;
}

function sceneZ(layout: HouseLayout, y: number) {
  return y - layout.bounds.depth / 2;
}

function heatColor(intensity: number) {
  const color = new THREE.Color();
  color.setHSL((205 - intensity * 175) / 360, 0.82, 0.58);
  return color;
}

const heatStops = [
  { at: 0, color: new THREE.Color("#1537c9") },
  { at: 0.2, color: new THREE.Color("#00a6ff") },
  { at: 0.42, color: new THREE.Color("#20d6a3") },
  { at: 0.64, color: new THREE.Color("#f4e64a") },
  { at: 0.82, color: new THREE.Color("#ff8b22") },
  { at: 1, color: new THREE.Color("#e8202a") }
];

function colorFromRamp(intensity: number) {
  const value = THREE.MathUtils.clamp(intensity, 0, 1);
  const upperIndex = heatStops.findIndex((stop) => stop.at >= value);
  const upper = heatStops[Math.max(upperIndex, 1)];
  const lower = heatStops[Math.max(0, heatStops.indexOf(upper) - 1)];
  const span = Math.max(0.001, upper.at - lower.at);
  return lower.color.clone().lerp(upper.color, (value - lower.at) / span);
}

function makeScalarTexture(data: Float32Array, width: number, height: number) {
  const texture = new THREE.DataTexture(data, width, height, THREE.RedFormat, THREE.FloatType);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function makeMaskTexture(data: Uint8Array, width: number, height: number) {
  const texture = new THREE.DataTexture(data, width, height, THREE.RedFormat, THREE.UnsignedByteType);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function cellAt(field: FlowField, x: number, y: number) {
  const column = Math.floor((x - field.grid.originX) / field.grid.cellSize);
  const row = Math.floor((y - field.grid.originY) / field.grid.cellSize);
  if (column < 0 || column >= field.grid.cols || row < 0 || row >= field.grid.rows) {
    return null;
  }
  const index = row * field.grid.cols + column;
  if (!field.grid.interior[index]) {
    return null;
  }
  return { column, row, index };
}

function sampleFlowField(field: FlowField, x: number, y: number) {
  const cell = cellAt(field, x, y);
  if (!cell) {
    return { x: 0, y: 0, speed: 0 };
  }
  const vx = field.vx[cell.index];
  const vy = field.vy[cell.index];
  return { x: vx, y: vy, speed: Math.hypot(vx, vy) };
}

function pointRoomId(layout: HouseLayout, x: number, y: number) {
  return (
    layout.rooms.find(
      (room) =>
        x >= room.origin.x &&
        x <= room.origin.x + room.width &&
        y >= room.origin.y &&
        y <= room.origin.y + room.depth
    )?.id ?? null
  );
}

function pointInAnyRoom(layout: HouseLayout, point: { x: number; y: number }) {
  return layout.rooms.some(
    (room) =>
      point.x >= room.origin.x &&
      point.x <= room.origin.x + room.width &&
      point.y >= room.origin.y &&
      point.y <= room.origin.y + room.depth
  );
}

function sampleHeatIntensity(layout: HouseLayout, heatmap: HeatmapCell[], point: { x: number; y: number }) {
  if (heatmap.length === 0) {
    return 0.45;
  }

  let weighted = 0;
  let total = 0;
  heatmap.forEach((cell) => {
    const center = { x: cell.x + cell.width / 2, y: cell.y + cell.depth / 2 };
    const distance = Math.max(0.08, Math.hypot(point.x - center.x, point.y - center.y));
    const weight = 1 / (distance * distance);
    weighted += cell.intensity * weight;
    total += weight;
  });

  const roomEdgeGlow = layout.rooms.reduce((glow, room) => {
    const nearX = Math.min(Math.abs(point.x - room.origin.x), Math.abs(point.x - (room.origin.x + room.width)));
    const nearY = Math.min(Math.abs(point.y - room.origin.y), Math.abs(point.y - (room.origin.y + room.depth)));
    return Math.max(glow, Math.exp(-Math.min(nearX, nearY) * 2.8) * 0.08);
  }, 0);

  return THREE.MathUtils.clamp(weighted / total + roomEdgeGlow, 0, 1);
}

function makeHeatmapTexture(layout: HouseLayout, heatmap: HeatmapCell[]) {
  const size = 384;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  const image = context.createImageData(size, size);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const x = (px / (size - 1)) * layout.bounds.width;
      const y = (py / (size - 1)) * layout.bounds.depth;
      const insideRoom = pointInAnyRoom(layout, { x, y });
      const intensity = sampleHeatIntensity(layout, heatmap, { x, y });
      const color = colorFromRamp(intensity);
      const contour = insideRoom && Math.abs((intensity * 8) % 1 - 0.5) < 0.028;
      const index = (py * size + px) * 4;

      image.data[index] = Math.round(color.r * 255 + (contour ? 34 : 0));
      image.data[index + 1] = Math.round(color.g * 255 + (contour ? 34 : 0));
      image.data[index + 2] = Math.round(color.b * 255 + (contour ? 34 : 0));
      image.data[index + 3] = insideRoom ? 210 : 28;
    }
  }

  context.putImageData(image, 0, 0);
  context.globalCompositeOperation = "screen";
  heatmap.forEach((cell) => {
    const x = ((cell.x + cell.width / 2) / layout.bounds.width) * size;
    const y = ((cell.y + cell.depth / 2) / layout.bounds.depth) * size;
    const radius = Math.max(cell.width / layout.bounds.width, cell.depth / layout.bounds.depth) * size * 1.9;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    const color = colorFromRamp(cell.intensity);
    gradient.addColorStop(0, `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, 0.42)`);
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function makeHeatLegendTexture(minTemp: number, maxTemp: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 180;
  canvas.height = 360;
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  context.fillStyle = "rgba(9, 13, 16, 0.78)";
  context.strokeStyle = "rgba(255, 255, 255, 0.24)";
  context.lineWidth = 2;
  context.roundRect(8, 8, 164, 344, 14);
  context.fill();
  context.stroke();
  context.fillStyle = "#f4f7f5";
  context.font = "600 18px Microsoft YaHei, Segoe UI, sans-serif";
  context.fillText("温度 C", 28, 42);

  for (let y = 0; y < 230; y += 1) {
    const value = 1 - y / 229;
    const color = colorFromRamp(value);
    context.fillStyle = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
    context.fillRect(34, 72 + y, 38, 1);
  }

  context.strokeStyle = "rgba(255,255,255,0.45)";
  context.strokeRect(34, 72, 38, 230);
  context.fillStyle = "#dbe7e2";
  context.font = "500 15px Microsoft YaHei, Segoe UI, sans-serif";
  context.fillText(maxTemp.toFixed(1), 84, 82);
  context.fillText(((minTemp + maxTemp) / 2).toFixed(1), 84, 190);
  context.fillText(minTemp.toFixed(1), 84, 304);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeYinYangTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }
  context.clearRect(0, 0, 256, 256);
  context.beginPath();
  context.arc(128, 128, 120, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = "#f6ca38";
  context.fillRect(0, 0, 128, 256);
  context.fillStyle = "#1d1408";
  context.fillRect(128, 0, 128, 256);
  context.beginPath();
  context.arc(128, 68, 60, 0, Math.PI * 2);
  context.fillStyle = "#1d1408";
  context.fill();
  context.beginPath();
  context.arc(128, 188, 60, 0, Math.PI * 2);
  context.fillStyle = "#f6ca38";
  context.fill();
  context.beginPath();
  context.arc(128, 68, 17, 0, Math.PI * 2);
  context.fillStyle = "#f6ca38";
  context.fill();
  context.beginPath();
  context.arc(128, 188, 17, 0, Math.PI * 2);
  context.fillStyle = "#1d1408";
  context.fill();
  context.strokeStyle = "#fff7c2";
  context.lineWidth = 8;
  context.beginPath();
  context.arc(128, 128, 120, 0, Math.PI * 2);
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function directionVector(direction: string) {
  const angle = directionToRadians(direction);
  return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize();
}

function degreesVector(degrees: number) {
  const angle = THREE.MathUtils.degToRad(degrees);
  return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize();
}

function roundCoord(value: number) {
  return Number(value.toFixed(3));
}

function wallKey(wall: { start: { x: number; y: number }; end: { x: number; y: number } }) {
  const horizontal = Math.abs(wall.start.y - wall.end.y) < 0.001;
  const vertical = Math.abs(wall.start.x - wall.end.x) < 0.001;
  if (horizontal) {
    const y = roundCoord(wall.start.y);
    return `h:${y}:${Math.min(roundCoord(wall.start.x), roundCoord(wall.end.x))}:${Math.max(roundCoord(wall.start.x), roundCoord(wall.end.x))}`;
  }
  if (vertical) {
    const x = roundCoord(wall.start.x);
    return `v:${x}:${Math.min(roundCoord(wall.start.y), roundCoord(wall.end.y))}:${Math.max(roundCoord(wall.start.y), roundCoord(wall.end.y))}`;
  }
  return `d:${roundCoord(wall.start.x)}:${roundCoord(wall.start.y)}:${roundCoord(wall.end.x)}:${roundCoord(wall.end.y)}`;
}

function getRenderableWalls(layout: HouseLayout) {
  const groups = new Map<string, typeof layout.walls>();
  layout.walls.forEach((wall) => {
    const key = wall.source === "custom" ? wall.id : wallKey(wall);
    groups.set(key, [...(groups.get(key) ?? []), wall]);
  });

  return Array.from(groups.values()).map((walls) => {
    const first = walls[0];
    const shared = walls.length > 1;
    const custom = walls.find((wall) => wall.source === "custom");
    return {
      ...first,
      id: walls.map((wall) => wall.id).join("__"),
      label: shared ? "公共内墙" : first.label,
      thickness: custom?.thickness ?? (shared ? 0.11 : 0.24),
      exterior: !shared,
      source: custom?.source ?? first.source
    };
  });
}

function directionToRadians(direction: string) {
  const map: Record<string, number> = {
    E: 0,
    SE: Math.PI / 4,
    S: Math.PI / 2,
    SW: (Math.PI * 3) / 4,
    W: Math.PI,
    NW: (Math.PI * 5) / 4,
    N: (Math.PI * 3) / 2,
    NE: (Math.PI * 7) / 4
  };
  return map[direction] ?? 0;
}

function makeLabelTexture(text: string, accent = "#19c2ff") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }
  context.fillStyle = "rgba(12, 17, 17, 0.78)";
  context.strokeStyle = "rgba(255, 255, 255, 0.22)";
  context.lineWidth = 2;
  context.roundRect(8, 8, 240, 80, 10);
  context.fill();
  context.stroke();
  context.fillStyle = accent;
  context.font = "600 26px Microsoft YaHei, Segoe UI, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 128, 48, 220);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function LabelSprite({
  text,
  position,
  accent
}: {
  text: string;
  position: [number, number, number];
  accent?: string;
}) {
  const texture = useMemo(() => makeLabelTexture(text, accent), [accent, text]);
  return (
    <sprite position={position} scale={[1.35, 0.5, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

function Controls() {
  const { camera, gl } = useThree();
  const ref = useRef<ThreeOrbitControls | null>(null);

  useEffect(() => {
    const controls = new ThreeOrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.minDistance = 5;
    controls.maxDistance = 28;
    controls.maxPolarAngle = Math.PI / 2.05;
    ref.current = controls;

    return () => {
      controls.dispose();
      ref.current = null;
    };
  }, [camera, gl.domElement]);

  useFrame(() => {
    ref.current?.update();
  });

  return null;
}

function RoomMeshes({
  layout,
  selectedRoomId,
  onSelectRoom
}: {
  layout: HouseLayout;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
}) {
  return (
    <>
      {layout.rooms.map((room) => {
        const isSelected = selectedRoomId === room.id;
        return (
          <group
            key={room.id}
            position={[sceneX(layout, room.origin.x + room.width / 2), 0, sceneZ(layout, room.origin.y + room.depth / 2)]}
            onClick={(event: ThreeEvent<MouseEvent>) => {
              event.stopPropagation();
              onSelectRoom(room.id);
            }}
          >
            <mesh position={[0, 0.04, 0]} receiveShadow>
              <boxGeometry args={[room.width, 0.08, room.depth]} />
              <meshStandardMaterial
                color={isSelected ? "#d9f2ff" : "#eef3f5"}
                emissive={isSelected ? "#38a3d1" : "#000000"}
                emissiveIntensity={isSelected ? 0.18 : 0}
                roughness={0.55}
              />
            </mesh>
            <LabelSprite text={room.name} position={[0, 0.38, 0]} accent={isSelected ? "#19c2ff" : "#f4f7f5"} />
          </group>
        );
      })}
    </>
  );
}

function HeatmapOverlay({
  layout,
  heatmap,
  sensors,
  visible
}: {
  layout: HouseLayout;
  heatmap: HeatmapCell[];
  sensors: SensorPoint[];
  visible: boolean;
}) {
  const heatTexture = useMemo(() => makeHeatmapTexture(layout, heatmap), [heatmap, layout]);
  const temperatures = heatmap.map((cell) => cell.temperature);
  const minTemp = Math.min(20, ...temperatures, ...sensors.map((sensor) => sensor.temperature));
  const maxTemp = Math.max(28, ...temperatures, ...sensors.map((sensor) => sensor.temperature));
  const legendTexture = useMemo(() => makeHeatLegendTexture(minTemp, maxTemp), [maxTemp, minTemp]);

  useEffect(() => {
    return () => {
      heatTexture.dispose();
      legendTexture.dispose();
    };
  }, [heatTexture, legendTexture]);

  if (!visible) {
    return null;
  }

  return (
    <>
      <mesh position={[0, 0.105, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[layout.bounds.width, layout.bounds.depth, 64, 64]} />
        <meshBasicMaterial map={heatTexture} transparent opacity={0.88} depthWrite={false} />
      </mesh>
      {sensors.map((sensor) => (
        <group key={sensor.id} position={[sceneX(layout, sensor.x), 0.42, sceneZ(layout, sensor.y)]}>
          <mesh>
            <sphereGeometry args={[0.1, 18, 18]} />
            <meshStandardMaterial color={colorFromRamp((sensor.temperature - 20) / 12)} emissive="#ff7a00" emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.13, 0.2, 24]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.72} depthWrite={false} />
          </mesh>
          <LabelSprite text={`${sensor.temperature.toFixed(1)}C`} position={[0, 0.3, 0]} accent="#ffd166" />
        </group>
      ))}
      <sprite position={[layout.bounds.width / 2 + 0.88, 1.15, 0]} scale={[0.7, 1.4, 1]}>
        <spriteMaterial map={legendTexture} transparent depthWrite={false} />
      </sprite>
    </>
  );
}

const heatVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const heatFragmentShader = `
  #extension GL_OES_standard_derivatives : enable
  precision highp float;
  uniform sampler2D uTemperature;
  uniform sampler2D uMask;
  uniform float uMin;
  uniform float uMax;
  uniform float uTime;
  uniform bool uContours;
  varying vec2 vUv;

  vec3 ramp(float t) {
    vec3 c0 = vec3(0.055, 0.141, 0.612);
    vec3 c1 = vec3(0.000, 0.620, 0.910);
    vec3 c2 = vec3(0.070, 0.720, 0.520);
    vec3 c3 = vec3(0.930, 0.800, 0.180);
    vec3 c4 = vec3(0.950, 0.360, 0.120);
    vec3 c5 = vec3(0.780, 0.065, 0.140);
    if (t < 0.20) return mix(c0, c1, t / 0.20);
    if (t < 0.42) return mix(c1, c2, (t - 0.20) / 0.22);
    if (t < 0.64) return mix(c2, c3, (t - 0.42) / 0.22);
    if (t < 0.84) return mix(c3, c4, (t - 0.64) / 0.20);
    return mix(c4, c5, (t - 0.84) / 0.16);
  }

  void main() {
    float mask = texture2D(uMask, vUv).r;
    if (mask < 0.5) discard;
    float temperature = texture2D(uTemperature, vUv).r;
    float n = clamp((temperature - uMin) / max(0.001, uMax - uMin), 0.0, 1.0);
    float cloud = clamp(n + sin((vUv.x * 9.0 + vUv.y * 7.0 + uTime * 0.18)) * 0.012, 0.0, 1.0);
    vec3 color = ramp(cloud);

    if (uContours) {
      float band = n * 11.0;
      float contour = abs(fract(band) - 0.5);
      float width = max(fwidth(band) * 1.35, 0.012);
      float line = 1.0 - smoothstep(width, width * 2.0, contour);
      color = mix(color, vec3(1.0), line * 0.42);
    }

    gl_FragColor = vec4(color, 0.86);
  }
`;

function HeatFieldOverlay({
  layout,
  field,
  sensors,
  visible,
  showContours
}: {
  layout: HouseLayout;
  field: HeatField;
  sensors: SensorPoint[];
  visible: boolean;
  showContours: boolean;
}) {
  const temperatureTexture = useMemo(
    () => makeScalarTexture(field.temperature, field.grid.cols, field.grid.rows),
    [field]
  );
  const maskTexture = useMemo(
    () => makeMaskTexture(field.grid.interior, field.grid.cols, field.grid.rows),
    [field]
  );
  const uniforms = useMemo(
    () => ({
      uTemperature: { value: temperatureTexture },
      uMask: { value: maskTexture },
      uMin: { value: field.min },
      uMax: { value: field.max },
      uTime: { value: 0 },
      uContours: { value: showContours }
    }),
    [field.max, field.min, maskTexture, showContours, temperatureTexture]
  );

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });

  useEffect(() => {
    return () => {
      temperatureTexture.dispose();
      maskTexture.dispose();
    };
  }, [maskTexture, temperatureTexture]);

  if (!visible) {
    return null;
  }

  return (
    <>
      <mesh position={[0, 0.106, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[layout.bounds.width, layout.bounds.depth, 1, 1]} />
        <shaderMaterial
          vertexShader={heatVertexShader}
          fragmentShader={heatFragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
      {sensors.map((sensor) => (
        <group key={sensor.id} position={[sceneX(layout, sensor.x), 0.42, sceneZ(layout, sensor.y)]}>
          <mesh>
            <sphereGeometry args={[0.1, 18, 18]} />
            <meshStandardMaterial color={colorFromRamp((sensor.temperature - field.min) / Math.max(0.1, field.max - field.min))} emissive="#ff7a00" emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.13, 0.2, 24]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.72} depthWrite={false} />
          </mesh>
          <LabelSprite text={`${sensor.temperature.toFixed(1)}C`} position={[0, 0.3, 0]} accent="#ffd166" />
        </group>
      ))}
    </>
  );
}

function FlowTube({
  points,
  color,
  radius,
  opacity = 0.9
}: {
  points: THREE.Vector3[];
  color: THREE.Color | string;
  radius: number;
  opacity?: number;
}) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  return (
    <mesh>
      <tubeGeometry args={[curve, 42, radius, 8, false]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function AirflowArrowHead({
  position,
  direction,
  color,
  scale = 1
}: {
  position: THREE.Vector3;
  direction: THREE.Vector3;
  color: THREE.Color;
  scale?: number;
}) {
  const angle = Math.atan2(direction.z, direction.x);
  return (
    <mesh position={position} rotation={[0, -angle, -Math.PI / 2]}>
      <coneGeometry args={[0.11 * scale, 0.34 * scale, 20]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.22} transparent opacity={0.9} depthWrite={false} />
    </mesh>
  );
}

function AirflowCurtain({
  center,
  direction,
  width,
  height,
  color
}: {
  center: THREE.Vector3;
  direction: THREE.Vector3;
  width: number;
  height: number;
  color: THREE.Color;
}) {
  const angle = Math.atan2(direction.z, direction.x);
  return (
    <mesh position={[center.x, height / 2 + 0.08, center.z]} rotation={[0, -angle + Math.PI / 2, 0]}>
      <planeGeometry args={[width, height, 1, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function AirflowOverlay({
  layout,
  airflow,
  selectedRoomId,
  visible
}: {
  layout: HouseLayout;
  airflow: AirflowVector[];
  selectedRoomId: string | null;
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }

  return (
    <>
      {layout.rooms.map((room) => {
        const flow = airflow.find((item) => item.roomId === room.id);
        if (!flow) {
          return null;
        }
        const isSelected = selectedRoomId === room.id;
        const direction = directionVector(flow.toDirection);
        const side = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
        const center = new THREE.Vector3(
          sceneX(layout, room.origin.x + room.width / 2),
          0,
          sceneZ(layout, room.origin.y + room.depth / 2)
        );
        const length = Math.max(0.9, Math.min(room.width, room.depth) * (0.74 + flow.strength * 0.28));
        const spread = Math.min(room.width, room.depth) * 0.22;
        const color = colorFromRamp(0.2 + flow.strength * 0.72);
        const streamCount = isSelected ? 5 : 3;
        const streams = Array.from({ length: streamCount }, (_, index) => {
          const ratio = index / (streamCount - 1) - 0.5;
          const offset = side.clone().multiplyScalar(ratio * spread);
          const bend = side.clone().multiplyScalar((index % 2 === 0 ? 1 : -1) * spread * 0.22);
          const start = center.clone().add(offset).add(direction.clone().multiplyScalar(-length / 2));
          const middle = center.clone().add(offset).add(bend);
          const end = center.clone().add(offset).add(direction.clone().multiplyScalar(length / 2));
          return {
            floor: [
              start.clone().setY(0.18),
              middle.clone().setY(0.2 + flow.strength * 0.08),
              end.clone().setY(0.18)
            ],
            volume: [
              start.clone().setY(0.75 + ratio * 0.08),
              middle.clone().add(bend).setY(1.0 + flow.strength * 0.22),
              end.clone().setY(0.76 - ratio * 0.08)
            ],
            end
          };
        });
        const inlet = center.clone().add(direction.clone().multiplyScalar(-length / 2 - 0.08));
        const outlet = center.clone().add(direction.clone().multiplyScalar(length / 2 + 0.08));

        return (
          <group key={flow.id}>
            <AirflowCurtain center={inlet} direction={direction} width={spread * 1.25} height={1.65} color={color} />
            <AirflowCurtain center={outlet} direction={direction} width={spread * 1.05} height={1.25} color={color} />
            {streams.map((stream, index) => (
              <group key={`${flow.id}-${index}`}>
                <FlowTube points={stream.floor} color={color} radius={isSelected ? 0.025 : 0.017} opacity={0.72} />
                <FlowTube points={stream.volume} color={color} radius={isSelected ? 0.035 : 0.024} opacity={0.86} />
                <AirflowArrowHead
                  position={stream.volume[2].clone().add(direction.clone().multiplyScalar(0.08))}
                  direction={direction}
                  color={color}
                  scale={0.86 + flow.strength * 0.55}
                />
              </group>
            ))}
            <LabelSprite text={`${Math.round(flow.strength * 100)}%`} position={[center.x, 1.58, center.z]} accent="#9af8ff" />
          </group>
        );
      })}
    </>
  );
}

function AirflowParticles({
  layout,
  field,
  selectedRoomId,
  density,
  speedScale,
  animate
}: {
  layout: HouseLayout;
  field: FlowField;
  selectedRoomId: string | null;
  density: number;
  speedScale: number;
  animate: boolean;
}) {
  const particleBundle = useMemo(() => {
    const count = Math.round(THREE.MathUtils.lerp(360, 1450, density));
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const life = new Float32Array(count);
    const color = new THREE.Color();

    const seeds =
      field.inlets.length > 0
        ? field.inlets
        : layout.rooms.map((room) => ({
            x: room.origin.x + room.width * 0.5,
            y: room.origin.y + room.depth * 0.5,
            strength: 0.25
          }));

    function respawn(index: number) {
      const seed = seeds[Math.floor(Math.random() * seeds.length)] ?? {
        x: layout.bounds.width / 2,
        y: layout.bounds.depth / 2,
        strength: 0.2
      };
      const jitter = field.grid.cellSize * 2.2;
      const x = THREE.MathUtils.clamp(seed.x + (Math.random() - 0.5) * jitter, 0, layout.bounds.width);
      const y = THREE.MathUtils.clamp(seed.y + (Math.random() - 0.5) * jitter, 0, layout.bounds.depth);
      const velocity = sampleFlowField(field, x, y);
      const speed = Math.min(1, velocity.speed / Math.max(0.001, field.speedMax));
      color.copy(colorFromRamp(0.18 + speed * 0.72));

      positions[index * 3] = sceneX(layout, x);
      positions[index * 3 + 1] = 0.28 + speed * 0.72 + Math.random() * 0.2;
      positions[index * 3 + 2] = sceneZ(layout, y);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
      life[index] = 1.2 + Math.random() * 2.6 + seed.strength * 0.8;
    }

    for (let index = 0; index < count; index += 1) {
      respawn(index);
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    return { count, geometry, positions, colors, life, respawn };
  }, [density, field, layout]);

  useEffect(() => {
    return () => {
      particleBundle.geometry.dispose();
    };
  }, [particleBundle]);

  useFrame(({ clock }, delta) => {
    if (!animate) {
      return;
    }
    const color = new THREE.Color();
    for (let index = 0; index < particleBundle.count; index += 1) {
      const px = particleBundle.positions[index * 3] + layout.bounds.width / 2;
      const py = particleBundle.positions[index * 3 + 2] + layout.bounds.depth / 2;
      const velocity = sampleFlowField(field, px, py);
      const speed = velocity.speed;
      const speedNorm = Math.min(1, speed / Math.max(0.001, field.speedMax));
      particleBundle.life[index] -= delta * (0.58 + speedNorm);

      if (particleBundle.life[index] <= 0 || speedNorm < 0.025 || !cellAt(field, px, py)) {
        particleBundle.respawn(index);
        continue;
      }

      const step = delta * speedScale * (0.6 + speedNorm * 1.8);
      const nextX = px + (velocity.x / Math.max(0.0001, speed)) * step;
      const nextY = py + (velocity.y / Math.max(0.0001, speed)) * step;
      if (!cellAt(field, nextX, nextY)) {
        particleBundle.respawn(index);
        continue;
      }

      const roomId = pointRoomId(layout, nextX, nextY);
      const dim = selectedRoomId && roomId !== selectedRoomId ? 0.45 : 1;
      color.copy(colorFromRamp(0.18 + speedNorm * 0.72)).multiplyScalar(dim);

      particleBundle.positions[index * 3] = sceneX(layout, nextX);
      particleBundle.positions[index * 3 + 1] = 0.24 + speedNorm * 0.74 + Math.sin(clock.elapsedTime * 4 + index) * 0.035;
      particleBundle.positions[index * 3 + 2] = sceneZ(layout, nextY);
      particleBundle.colors[index * 3] = color.r;
      particleBundle.colors[index * 3 + 1] = color.g;
      particleBundle.colors[index * 3 + 2] = color.b;
    }

    const positions = particleBundle.geometry.getAttribute("position");
    const colors = particleBundle.geometry.getAttribute("color");
    positions.needsUpdate = true;
    colors.needsUpdate = true;
  });

  return (
    <points geometry={particleBundle.geometry}>
      <pointsMaterial size={0.055} vertexColors transparent opacity={0.78} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function AirflowFieldOverlay({
  layout,
  field,
  selectedRoomId,
  visible,
  controls
}: {
  layout: HouseLayout;
  field: FlowField;
  selectedRoomId: string | null;
  visible: boolean;
  controls: AnalysisControls;
}) {
  if (!visible) {
    return null;
  }

  return (
    <>
      <AirflowParticles
        layout={layout}
        field={field}
        selectedRoomId={selectedRoomId}
        density={controls.airflowParticleDensity}
        speedScale={controls.airflowParticleSpeed}
        animate={controls.animateAirflow}
      />
      {field.streamlines.map((streamline, index) => {
        const speedNorm = Math.min(1, streamline.speed / Math.max(0.001, field.speedMax));
        const selected =
          selectedRoomId &&
          streamline.points.some(([x, y]) => pointRoomId(layout, x, y) === selectedRoomId);
        const color = colorFromRamp(0.24 + speedNorm * 0.68);
        const points = streamline.points.map(
          ([x, y], pointIndex) =>
            new THREE.Vector3(
              sceneX(layout, x),
              selected ? 0.34 + (pointIndex % 3) * 0.02 : 0.22 + (index % 2) * 0.08,
              sceneZ(layout, y)
            )
        );
        if (points.length < 2) {
          return null;
        }
        const end = points[points.length - 1];
        const prev = points[Math.max(0, points.length - 2)];
        const direction = end.clone().sub(prev).normalize();
        return (
          <group key={`stream-${index}`}>
            <FlowTube points={points} color={color} radius={selected ? 0.032 : 0.019} opacity={selected ? 0.92 : 0.64} />
            <AirflowArrowHead position={end.clone().setY(end.y + 0.04)} direction={direction} color={color} scale={0.7 + speedNorm * 0.45} />
          </group>
        );
      })}
      {field.inlets.slice(0, 14).map((inlet, index) => {
        const velocity = sampleFlowField(field, inlet.x, inlet.y);
        const direction = new THREE.Vector3(velocity.x, 0, velocity.y);
        if (direction.lengthSq() < 0.0001) {
          direction.set(1, 0, 0);
        }
        direction.normalize();
        const color = colorFromRamp(0.34 + Math.min(1, inlet.strength / Math.max(0.001, field.speedMax)) * 0.5);
        const center = new THREE.Vector3(sceneX(layout, inlet.x), 0, sceneZ(layout, inlet.y));
        return (
          <group key={`inlet-${index}`}>
            <AirflowCurtain center={center} direction={direction} width={0.42 + inlet.strength * 0.18} height={1.35} color={color} />
            {index < 4 ? (
              <LabelSprite text={`${Math.round(inlet.strength * 100)}`} position={[center.x, 1.5, center.z]} accent="#9af8ff" />
            ) : null}
          </group>
        );
      })}
    </>
  );
}

function WallMeshes({
  layout,
  selectedWallId,
  visible,
  onSelectWall
}: {
  layout: HouseLayout;
  selectedWallId: string | null;
  visible: boolean;
  onSelectWall: (wallId: string | null) => void;
}) {
  if (!visible) {
    return null;
  }

  return (
    <>
      {getRenderableWalls(layout).map((wall) => {
        const center = wallCenter(wall);
        const length = wallLength(wall);
        const rotation = wallRotationRadians(wall);
        const isSelected = wall.id === selectedWallId;
        return (
          <mesh
            key={wall.id}
            position={[sceneX(layout, center.x), 1.2, sceneZ(layout, center.y)]}
            rotation={[0, -rotation, 0]}
            castShadow
            onClick={(event: ThreeEvent<MouseEvent>) => {
              event.stopPropagation();
              onSelectWall(wall.source === "custom" ? wall.id : null);
            }}
          >
            <boxGeometry args={[length, 2.4, wall.thickness]} />
            <meshStandardMaterial
              color={wall.source === "custom" ? "#536d88" : wall.exterior ? "#f7f9fb" : "#d9dee0"}
              emissive={isSelected ? "#2a9fd6" : "#000000"}
              emissiveIntensity={isSelected ? 0.28 : 0}
              roughness={0.62}
            />
          </mesh>
        );
      })}
    </>
  );
}

function OpeningMeshes({ layout }: { layout: HouseLayout }) {
  const wallMap = new Map(layout.walls.map((wall) => [wall.id, wall]));

  return (
    <>
      {layout.openings.map((opening) => {
        const wall = wallMap.get(opening.wallId);
        if (!wall) {
          return null;
        }
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.max(0.01, Math.hypot(dx, dy));
        const unitX = dx / length;
        const unitY = dy / length;
        const centerOffset = opening.offset + opening.width / 2;
        const x = wall.start.x + unitX * centerOffset;
        const y = wall.start.y + unitY * centerOffset;
        const elevation = opening.type === "door" ? opening.height / 2 : (opening.sillHeight ?? 0.9) + opening.height / 2;
        return (
          <mesh
            key={opening.id}
            position={[sceneX(layout, x), elevation, sceneZ(layout, y)]}
            rotation={[0, -wallRotationRadians(wall), 0]}
          >
            <boxGeometry args={[opening.width, opening.height, opening.type === "door" ? 0.08 : 0.04]} />
            <meshStandardMaterial color={opening.type === "door" ? "#7f5b36" : "#4bb2d6"} transparent opacity={opening.type === "door" ? 0.9 : 0.5} />
          </mesh>
        );
      })}
    </>
  );
}

function DeviceMeshes({ layout }: { layout: HouseLayout }) {
  return (
    <>
      {(layout.devices ?? []).map((device) => {
        const direction = degreesVector(device.directionDegrees);
        const side = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
        const position: [number, number, number] = [sceneX(layout, device.x), device.type === "ac" ? 1.65 : 0.18, sceneZ(layout, device.y)];
        const color = device.type === "ac" ? new THREE.Color("#48d6ff") : new THREE.Color("#ff7a22");
        const flowStart = new THREE.Vector3(position[0], device.type === "ac" ? 1.45 : 0.35, position[2]);
        const flowEnd = flowStart.clone().add(direction.clone().multiplyScalar(0.9 + device.strength * 0.7));
        const flowMid = flowStart
          .clone()
          .add(direction.clone().multiplyScalar(0.45))
          .add(side.clone().multiplyScalar(device.type === "ac" ? 0.08 : -0.08));

        return (
          <group key={device.id}>
            {device.type === "ac" ? (
              <group position={position} rotation={[0, -THREE.MathUtils.degToRad(device.directionDegrees), 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.58, 0.22, 0.16]} />
                  <meshStandardMaterial color="#dff8ff" emissive="#48d6ff" emissiveIntensity={0.12} roughness={0.42} />
                </mesh>
                <mesh position={[0, -0.13, 0.05]}>
                  <boxGeometry args={[0.44, 0.035, 0.045]} />
                  <meshStandardMaterial color="#2a7085" emissive="#48d6ff" emissiveIntensity={0.18} />
                </mesh>
              </group>
            ) : (
              <group position={position}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.22, 0.25, 0.12, 28]} />
                  <meshStandardMaterial color="#3a2a1c" roughness={0.55} />
                </mesh>
                <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.12, 0.2, 28]} />
                  <meshBasicMaterial color="#ff7a22" transparent opacity={0.9} />
                </mesh>
              </group>
            )}
            <FlowTube points={[flowStart, flowMid, flowEnd]} color={color} radius={device.type === "ac" ? 0.018 : 0.026} opacity={0.68} />
            <AirflowArrowHead position={flowEnd} direction={direction} color={color} scale={device.type === "ac" ? 0.72 : 0.58} />
            <LabelSprite text={device.label} position={[position[0], position[1] + 0.34, position[2]]} accent={device.type === "ac" ? "#48d6ff" : "#ff9f43"} />
          </group>
        );
      })}
    </>
  );
}

function BaguaOverlay({
  layout,
  fengshui,
  activePalace,
  visible
}: {
  layout: HouseLayout;
  fengshui: FengshuiAnalysis;
  activePalace: BaguaPalace | null;
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }

  const cellWidth = layout.bounds.width / 3;
  const cellDepth = layout.bounds.depth / 3;
  return (
    <>
      {fengshui.bagua.map((sector) => {
        const isActive = sector.palace === activePalace;
        return (
          <group key={sector.palace}>
            <mesh
              position={[sceneX(layout, sector.gridX * cellWidth + cellWidth / 2), 0.12, sceneZ(layout, sector.gridY * cellDepth + cellDepth / 2)]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[cellWidth, cellDepth]} />
              <meshStandardMaterial color={isActive ? "#ffd166" : "#ffffff"} transparent opacity={isActive ? 0.28 : 0.08} depthWrite={false} />
            </mesh>
            <LabelSprite
              text={`${sector.label} ${sector.annualStar}`}
              position={[sceneX(layout, sector.gridX * cellWidth + cellWidth / 2), 0.26, sceneZ(layout, sector.gridY * cellDepth + cellDepth / 2)]}
              accent={isActive ? "#ffd166" : "#f4f7f5"}
            />
          </group>
        );
      })}
    </>
  );
}

const compassMountains = [
  "子",
  "癸",
  "丑",
  "艮",
  "寅",
  "甲",
  "卯",
  "乙",
  "辰",
  "巽",
  "巳",
  "丙",
  "午",
  "丁",
  "未",
  "坤",
  "申",
  "庚",
  "酉",
  "辛",
  "戌",
  "乾",
  "亥",
  "壬"
];

function CompassRing({
  layout,
  fengshui,
  visible
}: {
  layout: HouseLayout;
  fengshui: FengshuiAnalysis;
  visible: boolean;
}) {
  const yinYangTexture = useMemo(() => makeYinYangTexture(), []);

  useEffect(() => {
    return () => {
      yinYangTexture.dispose();
    };
  }, [yinYangTexture]);

  if (!visible) {
    return null;
  }

  const radius = Math.max(layout.bounds.width, layout.bounds.depth) / 2 + 1.25;
  const innerRadius = radius - 0.34;
  const midRadius = radius - 0.72;
  const tickRadius = radius - 0.16;

  return (
    <group position={[0, 0.2, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
        <circleGeometry args={[radius + 0.24, 160]} />
        <meshBasicMaterial color="#d9aa25" transparent opacity={0.18} depthWrite={false} />
      </mesh>

      {[radius, innerRadius, midRadius, radius - 1.08, radius - 1.42].map((ringRadius, index) => (
        <mesh key={ringRadius} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[ringRadius, index === 0 ? 0.035 : 0.018, 12, 128]} />
          <meshStandardMaterial color={index === 0 ? "#101820" : "#d8b451"} emissive={index === 0 ? "#000000" : "#3a2b00"} emissiveIntensity={0.1} />
        </mesh>
      ))}

      {Array.from({ length: 72 }, (_, index) => {
        const angle = (index / 72) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle);
        const z = Math.sin(angle);
        const tickLength = index % 3 === 0 ? 0.2 : 0.11;
        return (
          <mesh key={`tick-${index}`} position={[x * tickRadius, 0.035, z * tickRadius]} rotation={[0, -angle, 0]}>
            <boxGeometry args={[tickLength, 0.018, index % 3 === 0 ? 0.026 : 0.014]} />
            <meshStandardMaterial color={index % 3 === 0 ? "#2d2110" : "#7a5b18"} />
          </mesh>
        );
      })}

      {compassMountains.map((label, index) => {
        const angle = (index / compassMountains.length) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle);
        const z = Math.sin(angle);
        return (
          <LabelSprite
            key={label}
            text={label}
            position={[x * (radius - 0.52), 0.32, z * (radius - 0.52)]}
            accent={index % 3 === 0 ? "#101820" : "#5b4212"}
          />
        );
      })}

      {fengshui.compass.map((sector, index) => {
        const angle = (index / 8) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle);
        const z = Math.sin(angle);
        const length = radius - midRadius + 0.05;
        return (
          <group key={sector.id}>
            <mesh position={[x * (midRadius + length / 2), 0.04, z * (midRadius + length / 2)]} rotation={[0, -angle, 0]}>
              <boxGeometry args={[length, sector.active ? 0.055 : 0.025, sector.active ? 0.055 : 0.025]} />
              <meshStandardMaterial color={sector.active ? "#ff4d2e" : "#d8b451"} emissive={sector.active ? "#8b1200" : "#000000"} emissiveIntensity={sector.active ? 0.22 : 0} />
            </mesh>
            <LabelSprite
              text={formatDirectionLabel(sector.label)}
              position={[x * (radius + 0.38), 0.36, z * (radius + 0.38)]}
              accent={sector.active ? "#ff6b4a" : "#ffd166"}
            />
          </group>
        );
      })}

      <group rotation={[0, -THREE.MathUtils.degToRad(layout.orientation.facingDegrees), 0]}>
        <mesh position={[radius * 0.42, 0.09, 0]}>
          <boxGeometry args={[radius * 0.82, 0.055, 0.055]} />
          <meshStandardMaterial color="#ff4d2e" emissive="#8b1200" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[radius * 0.86, 0.09, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.14, 0.38, 18]} />
          <meshStandardMaterial color="#ff4d2e" emissive="#8b1200" emissiveIntensity={0.2} />
        </mesh>
      </group>

      <group rotation={[0, -THREE.MathUtils.degToRad(layout.orientation.facingDegrees), 0]}>
        <mesh position={[radius * 0.36, 0.2, 0]}>
          <boxGeometry args={[radius * 0.72, 0.08, 0.08]} />
          <meshStandardMaterial color="#ff7a22" emissive="#a82400" emissiveIntensity={0.22} />
        </mesh>
        <mesh position={[-radius * 0.28, 0.19, 0]}>
          <boxGeometry args={[radius * 0.55, 0.07, 0.07]} />
          <meshStandardMaterial color="#f3f4f0" emissive="#ffffff" emissiveIntensity={0.08} />
        </mesh>
        <mesh position={[radius * 0.78, 0.2, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.2, 0.48, 24]} />
          <meshStandardMaterial color="#ff4d2e" emissive="#8b1200" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, 0.24, 0]}>
          <sphereGeometry args={[0.18, 24, 24]} />
          <meshStandardMaterial color="#d7d9d2" metalness={0.6} roughness={0.22} />
        </mesh>
      </group>

      <group rotation={[0, -THREE.MathUtils.degToRad(layout.orientation.frontDoorDegrees), 0]}>
        <mesh position={[radius * 0.31, 0.13, 0]}>
          <boxGeometry args={[radius * 0.62, 0.035, 0.035]} />
          <meshStandardMaterial color="#28d7a7" emissive="#0d6960" emissiveIntensity={0.12} />
        </mesh>
      </group>

      <sprite position={[0, 0.28, 0]} scale={[1.35, 1.35, 1]}>
        <spriteMaterial map={yinYangTexture} transparent depthWrite={false} />
      </sprite>

      <LabelSprite
        text={`向${formatDirectionLabel(layout.orientation.facingLabel)} 门${formatDirectionLabel(layout.orientation.frontDoorLabel)}`}
        position={[0, 0.45, 0]}
        accent="#19c2ff"
      />
    </group>
  );
}

export function ThreeSceneCanvas({
  layout,
  selectedRoomId,
  selectedWallId,
  heatmap,
  airflow,
  heatField,
  flowField,
  fengshui,
  activePalace,
  layers,
  controls,
  onSelectRoom,
  onSelectWall
}: {
  layout: HouseLayout;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  heatmap: HeatmapCell[];
  airflow: AirflowVector[];
  heatField: HeatField;
  flowField: FlowField;
  fengshui: FengshuiAnalysis;
  activePalace: BaguaPalace | null;
  layers: SceneLayers;
  controls: AnalysisControls;
  onSelectRoom: (roomId: string) => void;
  onSelectWall: (wallId: string | null) => void;
}) {
  const cameraDistance = Math.max(layout.bounds.width, layout.bounds.depth) * 1.35;

  return (
    <Canvas className="three-canvas" camera={{ position: [cameraDistance, cameraDistance * 0.9, cameraDistance], fov: 42 }} shadows>
      <color attach="background" args={["#0f1720"]} />
      <fog attach="fog" args={["#0f1720", 12, 30]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[8, 14, 6]} intensity={1.35} castShadow />
      <spotLight position={[-8, 10, -6]} angle={0.5} penumbra={0.4} intensity={0.75} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[layout.bounds.width + 5, layout.bounds.depth + 5]} />
        <meshStandardMaterial color="#17212b" roughness={0.8} />
      </mesh>

      <CompassRing layout={layout} fengshui={fengshui} visible={layers.fengshui} />
      <BaguaOverlay layout={layout} fengshui={fengshui} activePalace={activePalace} visible={layers.fengshui} />
      <RoomMeshes layout={layout} selectedRoomId={selectedRoomId} onSelectRoom={onSelectRoom} />
      <HeatFieldOverlay
        layout={layout}
        field={heatField}
        sensors={layout.sensors}
        visible={layers.heat}
        showContours={controls.showHeatContours}
      />
      <AirflowFieldOverlay
        layout={layout}
        field={flowField}
        selectedRoomId={selectedRoomId}
        visible={layers.airflow}
        controls={controls}
      />
      <WallMeshes layout={layout} selectedWallId={selectedWallId} visible={layers.walls} onSelectWall={onSelectWall} />
      <OpeningMeshes layout={layout} />
      <DeviceMeshes layout={layout} />

      <gridHelper args={[layout.bounds.width + 4, 24, "#335066", "#233544"]} position={[0, 0.01, 0]} />
      <Controls />
    </Canvas>
  );
}
