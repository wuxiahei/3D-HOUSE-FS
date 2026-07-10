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

const noRaycast: THREE.Object3D["raycast"] = () => undefined;

function sceneX(layout: HouseLayout, x: number) {
  return x - layout.bounds.width / 2;
}

function sceneZ(layout: HouseLayout, y: number) {
  return y - layout.bounds.depth / 2;
}

const heatStops = [
  { at: 0, color: new THREE.Color("#163dff") },
  { at: 0.22, color: new THREE.Color("#18a7ff") },
  { at: 0.5, color: new THREE.Color("#eef6ff") },
  { at: 0.74, color: new THREE.Color("#ff8a5b") },
  { at: 1, color: new THREE.Color("#d7191c") }
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
  const gx = (x - field.grid.originX) / field.grid.cellSize - 0.5;
  const gy = (y - field.grid.originY) / field.grid.cellSize - 0.5;
  const column0 = Math.floor(gx);
  const row0 = Math.floor(gy);
  const tx = gx - column0;
  const ty = gy - row0;
  let vx = 0;
  let vy = 0;
  let w = 0;
  let curl = 0;
  let totalWeight = 0;

  for (let rowOffset = 0; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset <= 1; columnOffset += 1) {
      const column = column0 + columnOffset;
      const row = row0 + rowOffset;
      if (column < 0 || column >= field.grid.cols || row < 0 || row >= field.grid.rows) {
        continue;
      }
      const index = row * field.grid.cols + column;
      if (!field.grid.interior[index]) {
        continue;
      }
      const weight = (columnOffset === 0 ? 1 - tx : tx) * (rowOffset === 0 ? 1 - ty : ty);
      vx += field.vx[index] * weight;
      vy += field.vy[index] * weight;
      w += (field.verticalVelocity[index] ?? 0) * weight;
      curl += (field.vorticity[index] ?? 0) * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight <= 0.0001) {
    return { x: 0, y: 0, w: 0, curl: 0, speed: 0 };
  }

  vx /= totalWeight;
  vy /= totalWeight;
  w /= totalWeight;
  curl /= totalWeight;
  return { x: vx, y: vy, w, curl, speed: Math.hypot(vx, vy) };
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

function makeLabelTexture(text: string, accent = "#19c2ff", boxed = true) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }
  if (boxed) {
    context.fillStyle = "rgba(12, 17, 17, 0.78)";
    context.strokeStyle = "rgba(255, 255, 255, 0.22)";
    context.lineWidth = 2;
    context.roundRect(8, 8, 240, 80, 10);
    context.fill();
    context.stroke();
  } else {
    context.shadowColor = "rgba(0, 0, 0, 0.7)";
    context.shadowBlur = 12;
    context.shadowOffsetY = 2;
  }
  context.fillStyle = accent;
  context.font = boxed ? "600 26px Microsoft YaHei, Segoe UI, sans-serif" : "700 34px Microsoft YaHei, Segoe UI, sans-serif";
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
  accent,
  boxed = true,
  scale = [1.35, 0.5, 1]
}: {
  text: string;
  position: [number, number, number];
  accent?: string;
  boxed?: boolean;
  scale?: [number, number, number];
}) {
  const texture = useMemo(() => makeLabelTexture(text, accent, boxed), [accent, boxed, text]);
  return (
    <sprite position={position} scale={scale}>
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
  uniform float uAlpha;
  uniform float uContourStrength;
  uniform bool uContours;
  varying vec2 vUv;

  vec3 ramp(float t) {
    vec3 c0 = vec3(0.086, 0.239, 1.000);
    vec3 c1 = vec3(0.094, 0.655, 1.000);
    vec3 c2 = vec3(0.933, 0.965, 1.000);
    vec3 c3 = vec3(1.000, 0.541, 0.357);
    vec3 c4 = vec3(0.843, 0.098, 0.110);
    if (t < 0.22) return mix(c0, c1, t / 0.22);
    if (t < 0.50) return mix(c1, c2, (t - 0.22) / 0.28);
    if (t < 0.74) return mix(c2, c3, (t - 0.50) / 0.24);
    return mix(c3, c4, (t - 0.74) / 0.26);
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
      color = mix(color, vec3(1.0), line * uContourStrength);
    }

    gl_FragColor = vec4(color, uAlpha);
  }
`;

function HeatPlumes({ layout, field }: { layout: HouseLayout; field: HeatField }) {
  return (
    <group>
      {field.thermalPlumes.map((plume, index) => {
        const height = layout.bounds.height * (plume.kind === "warm" ? 0.84 : 0.58);
        const color = plume.kind === "warm" ? new THREE.Color("#ff7a22") : new THREE.Color("#48d6ff");
        const y = plume.kind === "warm" ? height / 2 + 0.16 : layout.bounds.height - height / 2 - 0.18;
        return (
          <group key={`${plume.kind}-${index}`} position={[sceneX(layout, plume.x), y, sceneZ(layout, plume.y)]}>
            <mesh raycast={noRaycast}>
              <cylinderGeometry
                args={[
                  plume.radius * (plume.kind === "warm" ? 0.55 : 0.28),
                  plume.radius * (plume.kind === "warm" ? 0.2 : 0.62),
                  height,
                  32,
                  1,
                  true
                ]}
              />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={THREE.MathUtils.clamp(0.08 + plume.strength * 0.12, 0.08, 0.24)}
                depthWrite={false}
                side={THREE.DoubleSide}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
            <mesh position={[0, plume.kind === "warm" ? height / 2 : -height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
              <ringGeometry args={[plume.radius * 0.38, plume.radius * 0.68, 36]} />
              <meshBasicMaterial color={color} transparent opacity={0.24} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function sampleHeatLayer(field: HeatField, layer: Float32Array, x: number, y: number) {
  const gx = (x - field.grid.originX) / field.grid.cellSize - 0.5;
  const gy = (y - field.grid.originY) / field.grid.cellSize - 0.5;
  const column0 = Math.floor(gx);
  const row0 = Math.floor(gy);
  const tx = gx - column0;
  const ty = gy - row0;
  let value = 0;
  let totalWeight = 0;

  for (let rowOffset = 0; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset <= 1; columnOffset += 1) {
      const column = column0 + columnOffset;
      const row = row0 + rowOffset;
      if (column < 0 || column >= field.grid.cols || row < 0 || row >= field.grid.rows) {
        continue;
      }
      const index = row * field.grid.cols + column;
      if (!field.grid.interior[index]) {
        continue;
      }
      const weight = (columnOffset === 0 ? 1 - tx : tx) * (rowOffset === 0 ? 1 - ty : ty);
      value += layer[index] * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0.0001 ? value / totalWeight : null;
}

function sampleHeatAtHeight(field: HeatField, x: number, y: number, height: number) {
  const layers = field.layers.length > 0 ? field.layers : [field.temperature];
  if (layers.length === 1) {
    return sampleHeatLayer(field, layers[0], x, y);
  }

  const heights = field.layerHeights.length === layers.length ? field.layerHeights : layers.map((_, index) => index);
  let upperIndex = heights.findIndex((layerHeight) => layerHeight >= height);
  if (upperIndex < 0) {
    upperIndex = layers.length - 1;
  }
  const lowerIndex = Math.max(0, upperIndex - 1);
  const lowerHeight = heights[lowerIndex] ?? 0;
  const upperHeight = heights[upperIndex] ?? lowerHeight + 1;
  const lower = sampleHeatLayer(field, layers[lowerIndex], x, y);
  const upper = sampleHeatLayer(field, layers[upperIndex], x, y);
  if (lower === null && upper === null) {
    return null;
  }
  if (lower === null) {
    return upper;
  }
  if (upper === null) {
    return lower;
  }
  const t = THREE.MathUtils.clamp((height - lowerHeight) / Math.max(0.001, upperHeight - lowerHeight), 0, 1);
  return THREE.MathUtils.lerp(lower, upper, t);
}

function makeHeatSliceGeometry(layout: HouseLayout, field: HeatField, axis: "x" | "y", positionRatio: number) {
  const horizontalSegments = 48;
  const verticalSegments = 16;
  const span = Math.max(0.001, field.max - field.min);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = new THREE.Color();

  for (let row = 0; row <= verticalSegments; row += 1) {
    const height = THREE.MathUtils.lerp(0.14, layout.bounds.height - 0.12, row / verticalSegments);
    for (let column = 0; column <= horizontalSegments; column += 1) {
      const ratio = column / horizontalSegments;
      const x = axis === "x" ? layout.bounds.width * positionRatio : layout.bounds.width * ratio;
      const y = axis === "x" ? layout.bounds.depth * ratio : layout.bounds.depth * positionRatio;
      const temperature = sampleHeatAtHeight(field, x, y, height);
      const normalized = temperature === null ? 0 : THREE.MathUtils.clamp((temperature - field.min) / span, 0, 1);
      color.copy(colorFromRamp(normalized));
      positions.push(sceneX(layout, x), height, sceneZ(layout, y));
      colors.push(color.r, color.g, color.b);
    }
  }

  const rowWidth = horizontalSegments + 1;
  for (let row = 0; row < verticalSegments; row += 1) {
    for (let column = 0; column < horizontalSegments; column += 1) {
      const a = row * rowWidth + column;
      const b = a + 1;
      const c = a + rowWidth;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

function HeatVerticalSlices({
  layout,
  field,
  mode,
  sliceX,
  sliceY
}: {
  layout: HouseLayout;
  field: HeatField;
  mode: AnalysisControls["heatSliceMode"];
  sliceX: number;
  sliceY: number;
}) {
  const geometries = useMemo(() => {
    const items: THREE.BufferGeometry[] = [];
    if (mode !== "y") {
      items.push(makeHeatSliceGeometry(layout, field, "x", sliceX));
    }
    if (mode !== "x") {
      items.push(makeHeatSliceGeometry(layout, field, "y", sliceY));
    }
    return items;
  }, [field, layout, mode, sliceX, sliceY]);

  useEffect(() => {
    return () => {
      geometries.forEach((geometry) => geometry.dispose());
    };
  }, [geometries]);

  return (
    <>
      {geometries.map((geometry, index) => (
        <mesh key={`heat-slice-${index}`} geometry={geometry} raycast={noRaycast} renderOrder={4}>
          <meshBasicMaterial vertexColors transparent opacity={0.36} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

function makeHeatContourGeometry(layout: HouseLayout, field: HeatField) {
  const positions: number[] = [];
  const colors: number[] = [];
  const contourCount = 10;
  const span = Math.max(0.001, field.max - field.min);
  const color = new THREE.Color();

  function pointOnEdge(
    a: { x: number; y: number; value: number },
    b: { x: number; y: number; value: number },
    level: number
  ) {
    const t = THREE.MathUtils.clamp((level - a.value) / Math.max(0.0001, b.value - a.value), 0, 1);
    return {
      x: THREE.MathUtils.lerp(a.x, b.x, t),
      y: THREE.MathUtils.lerp(a.y, b.y, t)
    };
  }

  for (let levelIndex = 1; levelIndex < contourCount; levelIndex += 1) {
    const level = field.min + (span * levelIndex) / contourCount;
    const normalized = (level - field.min) / span;
    color.copy(colorFromRamp(normalized)).lerp(new THREE.Color("#ffffff"), 0.28);

    for (let row = 0; row < field.grid.rows - 1; row += 1) {
      for (let column = 0; column < field.grid.cols - 1; column += 1) {
        const i00 = row * field.grid.cols + column;
        const i10 = row * field.grid.cols + column + 1;
        const i11 = (row + 1) * field.grid.cols + column + 1;
        const i01 = (row + 1) * field.grid.cols + column;
        if (!field.grid.interior[i00] && !field.grid.interior[i10] && !field.grid.interior[i11] && !field.grid.interior[i01]) {
          continue;
        }

        const x0 = field.grid.originX + column * field.grid.cellSize;
        const x1 = x0 + field.grid.cellSize;
        const y0 = field.grid.originY + row * field.grid.cellSize;
        const y1 = y0 + field.grid.cellSize;
        const corners = [
          { x: x0, y: y0, value: field.temperature[i00] },
          { x: x1, y: y0, value: field.temperature[i10] },
          { x: x1, y: y1, value: field.temperature[i11] },
          { x: x0, y: y1, value: field.temperature[i01] }
        ];
        const edges: [number, number][] = [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 0]
        ];
        const hits = edges
          .filter(([a, b]) => (corners[a].value - level) * (corners[b].value - level) <= 0 && corners[a].value !== corners[b].value)
          .map(([a, b]) => pointOnEdge(corners[a], corners[b], level));

        for (let hitIndex = 0; hitIndex + 1 < hits.length; hitIndex += 2) {
          positions.push(
            sceneX(layout, hits[hitIndex].x),
            0.182 + levelIndex * 0.002,
            sceneZ(layout, hits[hitIndex].y),
            sceneX(layout, hits[hitIndex + 1].x),
            0.182 + levelIndex * 0.002,
            sceneZ(layout, hits[hitIndex + 1].y)
          );
          colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function HeatContourLayer({ layout, field }: { layout: HouseLayout; field: HeatField }) {
  const geometry = useMemo(() => makeHeatContourGeometry(layout, field), [field, layout]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <lineSegments geometry={geometry} raycast={noRaycast} renderOrder={6}>
      <lineBasicMaterial vertexColors transparent opacity={0.72} depthWrite={false} />
    </lineSegments>
  );
}

function makeHeatFluxGeometry(layout: HouseLayout, field: HeatField) {
  const positions: number[] = [];
  const colors: number[] = [];
  const stride = Math.max(2, Math.round(Math.max(field.grid.cols, field.grid.rows) / 26));
  const color = new THREE.Color("#fff0a8");

  for (let row = 1; row < field.grid.rows - 1; row += stride) {
    for (let column = 1; column < field.grid.cols - 1; column += stride) {
      const index = row * field.grid.cols + column;
      if (!field.grid.interior[index]) {
        continue;
      }
      const east = row * field.grid.cols + column + 1;
      const west = row * field.grid.cols + column - 1;
      const south = (row + 1) * field.grid.cols + column;
      const north = (row - 1) * field.grid.cols + column;
      const gx = (field.temperature[east] - field.temperature[west]) / Math.max(0.001, field.grid.cellSize * 2);
      const gy = (field.temperature[south] - field.temperature[north]) / Math.max(0.001, field.grid.cellSize * 2);
      const magnitude = Math.hypot(gx, gy);
      if (magnitude < 0.015) {
        continue;
      }
      const ux = -gx / magnitude;
      const uy = -gy / magnitude;
      const centerX = field.grid.originX + (column + 0.5) * field.grid.cellSize;
      const centerY = field.grid.originY + (row + 0.5) * field.grid.cellSize;
      const length = THREE.MathUtils.clamp(magnitude * 0.22, field.grid.cellSize * 0.5, field.grid.cellSize * stride * 0.82);
      const y = 0.255;

      positions.push(
        sceneX(layout, centerX - ux * length * 0.45),
        y,
        sceneZ(layout, centerY - uy * length * 0.45),
        sceneX(layout, centerX + ux * length * 0.55),
        y,
        sceneZ(layout, centerY + uy * length * 0.55)
      );
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function HeatFluxLayer({ layout, field }: { layout: HouseLayout; field: HeatField }) {
  const geometry = useMemo(() => makeHeatFluxGeometry(layout, field), [field, layout]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <lineSegments geometry={geometry} raycast={noRaycast} renderOrder={7}>
      <lineBasicMaterial vertexColors transparent opacity={0.64} depthWrite={false} />
    </lineSegments>
  );
}

function HeatFieldOverlay({
  layout,
  field,
  sensors,
  visible,
  controls
}: {
  layout: HouseLayout;
  field: HeatField;
  sensors: SensorPoint[];
  visible: boolean;
  controls: AnalysisControls;
}) {
  const temperatureLayers = useMemo(() => (field.layers.length > 0 ? field.layers : [field.temperature]), [field]);
  const renderLayers = useMemo(
    () =>
      temperatureLayers.map((_, index) => {
        const ratio = temperatureLayers.length <= 1 ? 0 : index / (temperatureLayers.length - 1);
        return {
          id: `heat-layer-${index}`,
          y: THREE.MathUtils.clamp(field.layerHeights[index] ?? layout.bounds.height * ratio, 0.112, layout.bounds.height - 0.18),
          scale: 1 - ratio * 0.055,
          alpha: index === 0 ? 0.76 : THREE.MathUtils.lerp(0.2, 0.34, 1 - Math.abs(ratio - 0.5) * 1.2),
          contourStrength: THREE.MathUtils.lerp(0.42, 0.12, ratio)
        };
      }),
    [field.layerHeights, layout.bounds.height, temperatureLayers]
  );
  const temperatureTextures = useMemo(
    () => temperatureLayers.map((layer) => makeScalarTexture(layer, field.grid.cols, field.grid.rows)),
    [field, temperatureLayers]
  );
  const maskTexture = useMemo(
    () => makeMaskTexture(field.grid.interior, field.grid.cols, field.grid.rows),
    [field]
  );
  const uniforms = useMemo(
    () =>
      renderLayers.map((layer, index) => ({
        uTemperature: { value: temperatureTextures[index] ?? temperatureTextures[0] },
        uMask: { value: maskTexture },
        uMin: { value: field.min },
        uMax: { value: field.max },
        uTime: { value: 0 },
        uAlpha: { value: layer.alpha },
        uContourStrength: { value: layer.contourStrength },
        uContours: { value: controls.showHeatContours }
      })),
    [controls.showHeatContours, field.max, field.min, maskTexture, renderLayers, temperatureTextures]
  );

  useFrame(({ clock }) => {
    uniforms.forEach((layerUniforms, index) => {
      layerUniforms.uTime.value = clock.elapsedTime + index * 0.73;
    });
  });

  useEffect(() => {
    return () => {
      temperatureTextures.forEach((texture) => texture.dispose());
      maskTexture.dispose();
    };
  }, [maskTexture, temperatureTextures]);

  if (!visible) {
    return null;
  }

  return (
    <>
      {controls.showHeatLayers
        ? renderLayers.map((layer, index) => (
            <mesh
              key={layer.id}
              position={[0, layer.y, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              scale={[layer.scale, layer.scale, 1]}
              raycast={noRaycast}
            >
              <planeGeometry args={[layout.bounds.width, layout.bounds.depth, 1, 1]} />
              <shaderMaterial
                vertexShader={heatVertexShader}
                fragmentShader={heatFragmentShader}
                uniforms={uniforms[index]}
                transparent
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))
        : null}
      {controls.showHeatPlumes ? <HeatPlumes layout={layout} field={field} /> : null}
      {controls.showHeatSlices ? (
        <HeatVerticalSlices
          layout={layout}
          field={field}
          mode={controls.heatSliceMode}
          sliceX={controls.heatSliceX}
          sliceY={controls.heatSliceY}
        />
      ) : null}
      {controls.showHeatContours ? <HeatContourLayer layout={layout} field={field} /> : null}
      {controls.showHeatFlux ? <HeatFluxLayer layout={layout} field={field} /> : null}
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
    const count = Math.round(THREE.MathUtils.lerp(760, 2600, density));
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const life = new Float32Array(count);
    const color = new THREE.Color();

    const inletSeeds = field.inlets.filter((seed) => cellAt(field, seed.x, seed.y));
    const interiorSeeds: { x: number; y: number; strength: number; roomId: string | null }[] = [];

    for (let row = 0; row < field.grid.rows; row += 1) {
      for (let column = 0; column < field.grid.cols; column += 1) {
        const index = row * field.grid.cols + column;
        if (!field.grid.interior[index]) {
          continue;
        }
        const speed = Math.hypot(field.vx[index], field.vy[index]);
        interiorSeeds.push({
          x: field.grid.originX + (column + 0.5) * field.grid.cellSize,
          y: field.grid.originY + (row + 0.5) * field.grid.cellSize,
          strength: 0.18 + Math.min(1, speed / Math.max(0.001, field.speedMax)) * 0.82,
          roomId: field.grid.roomIds[index]
        });
      }
    }

    function pickSeed() {
      if (inletSeeds.length > 0 && Math.random() < 0.48) {
        return inletSeeds[Math.floor(Math.random() * inletSeeds.length)];
      }
      if (selectedRoomId) {
        const selectedSeeds = interiorSeeds.filter((seed) => seed.roomId === selectedRoomId);
        if (selectedSeeds.length > 0 && Math.random() < 0.62) {
          return selectedSeeds[Math.floor(Math.random() * selectedSeeds.length)];
        }
      }
      return interiorSeeds[Math.floor(Math.random() * interiorSeeds.length)] ?? {
        x: layout.bounds.width / 2,
        y: layout.bounds.depth / 2,
        strength: 0.2
      };
    }

    function respawn(index: number) {
      const seed = pickSeed();
      const jitter = field.grid.cellSize * (inletSeeds.includes(seed) ? 2.1 : 0.82);
      let x = THREE.MathUtils.clamp(seed.x + (Math.random() - 0.5) * jitter, 0, layout.bounds.width);
      let y = THREE.MathUtils.clamp(seed.y + (Math.random() - 0.5) * jitter, 0, layout.bounds.depth);
      if (!cellAt(field, x, y)) {
        x = seed.x;
        y = seed.y;
      }
      const velocity = sampleFlowField(field, x, y);
      const speed = Math.min(1, velocity.speed / Math.max(0.001, field.speedMax));
      const verticalBias = THREE.MathUtils.clamp(velocity.w * 1.8, -0.18, 0.28);
      color.copy(colorFromRamp(0.18 + speed * 0.68 + Math.abs(velocity.curl) * 0.08));

      positions[index * 3] = sceneX(layout, x);
      positions[index * 3 + 1] = THREE.MathUtils.clamp(
        0.36 + speed * 0.92 + verticalBias + Math.random() * 0.38,
        0.24,
        layout.bounds.height - 0.18
      );
      positions[index * 3 + 2] = sceneZ(layout, y);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
      life[index] = 1.4 + Math.random() * 3.2 + seed.strength * 0.9;
    }

    for (let index = 0; index < count; index += 1) {
      respawn(index);
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    return { count, geometry, positions, colors, life, respawn };
  }, [density, field, layout, selectedRoomId]);

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

      if (particleBundle.life[index] <= 0 || !cellAt(field, px, py)) {
        particleBundle.respawn(index);
        continue;
      }

      const step = delta * speedScale * (0.58 + speedNorm * 2.15);
      const canAdvect = speed > 0.0001;
      const midX = canAdvect ? px + (velocity.x / speed) * step * 0.5 : px;
      const midY = canAdvect ? py + (velocity.y / speed) * step * 0.5 : py;
      const midVelocity = sampleFlowField(field, midX, midY);
      const midSpeed = Math.hypot(midVelocity.x, midVelocity.y);
      const nextX = midSpeed > 0.0001 ? px + (midVelocity.x / midSpeed) * step : px;
      const nextY = midSpeed > 0.0001 ? py + (midVelocity.y / midSpeed) * step : py;
      if (!cellAt(field, nextX, nextY)) {
        particleBundle.respawn(index);
        continue;
      }

      const roomId = pointRoomId(layout, nextX, nextY);
      const dim = selectedRoomId && roomId !== selectedRoomId ? 0.42 : 1;
      color.copy(colorFromRamp(0.18 + speedNorm * 0.66 + Math.min(0.14, Math.abs(velocity.curl) * 0.12))).multiplyScalar(dim);
      const currentHeight = particleBundle.positions[index * 3 + 1];
      const nextHeight =
        currentHeight +
        velocity.w * delta * speedScale * 1.8 +
        Math.sin(clock.elapsedTime * 4 + index) * 0.018 +
        (speedNorm - 0.42) * 0.01;

      particleBundle.positions[index * 3] = sceneX(layout, nextX);
      particleBundle.positions[index * 3 + 1] = THREE.MathUtils.clamp(nextHeight, 0.22, layout.bounds.height - 0.16);
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
      <pointsMaterial size={0.045 + density * 0.022} vertexColors transparent opacity={0.82} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function makeAirflowGlyphGeometry(layout: HouseLayout, field: FlowField, selectedRoomId: string | null) {
  const positions: number[] = [];
  const colors: number[] = [];
  const stride = Math.max(1, Math.round(Math.max(field.grid.cols, field.grid.rows) / 34));
  const color = new THREE.Color();

  for (let row = 0; row < field.grid.rows; row += stride) {
    for (let column = 0; column < field.grid.cols; column += stride) {
      const index = row * field.grid.cols + column;
      if (!field.grid.interior[index]) {
        continue;
      }

      const vx = field.vx[index];
      const vy = field.vy[index];
      const speed = Math.hypot(vx, vy);
      if (speed <= field.speedMax * 0.004) {
        continue;
      }

      const speedNorm = Math.min(1, speed / Math.max(0.001, field.speedMax));
      const centerX = field.grid.originX + (column + 0.5) * field.grid.cellSize;
      const centerY = field.grid.originY + (row + 0.5) * field.grid.cellSize;
      const length = field.grid.cellSize * stride * (0.28 + speedNorm * 0.82);
      const ux = vx / speed;
      const uy = vy / speed;
      const roomId = field.grid.roomIds[index];
      const dim = selectedRoomId && roomId !== selectedRoomId ? 0.38 : 1;
      const y = 0.16 + speedNorm * 0.24;
      const vertical = field.verticalVelocity[index] ?? 0;
      const curl = Math.abs(field.vorticity[index] ?? 0);

      color.copy(colorFromRamp(0.18 + speedNorm * 0.66 + Math.min(0.14, curl * 0.12))).multiplyScalar(dim);
      positions.push(
        sceneX(layout, centerX - ux * length * 0.5),
        y,
        sceneZ(layout, centerY - uy * length * 0.5),
        sceneX(layout, centerX + ux * length * 0.5),
        y,
        sceneZ(layout, centerY + uy * length * 0.5)
      );
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);

      if (Math.abs(vertical) > 0.018) {
        const lift = THREE.MathUtils.clamp(vertical * 3.4, -0.42, 0.52);
        positions.push(
          sceneX(layout, centerX),
          y,
          sceneZ(layout, centerY),
          sceneX(layout, centerX),
          THREE.MathUtils.clamp(y + lift, 0.16, layout.bounds.height - 0.12),
          sceneZ(layout, centerY)
        );
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function AirflowGlyphLayer({
  layout,
  field,
  selectedRoomId
}: {
  layout: HouseLayout;
  field: FlowField;
  selectedRoomId: string | null;
}) {
  const geometry = useMemo(() => makeAirflowGlyphGeometry(layout, field, selectedRoomId), [field, layout, selectedRoomId]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <lineSegments geometry={geometry} raycast={noRaycast} renderOrder={3}>
      <lineBasicMaterial vertexColors transparent opacity={0.54} depthWrite={false} />
    </lineSegments>
  );
}

function makeAirPressureGeometry(layout: HouseLayout, field: FlowField) {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const cold = new THREE.Color("#2367ff");
  const neutral = new THREE.Color("#d7fff7");
  const warm = new THREE.Color("#ffb14a");
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let vertexOffset = 0;

  for (let index = 0; index < field.pressure.length; index += 1) {
    if (!field.grid.interior[index]) {
      continue;
    }
    min = Math.min(min, field.pressure[index]);
    max = Math.max(max, field.pressure[index]);
  }
  const span = Math.max(0.001, max - min);

  for (let row = 0; row < field.grid.rows; row += 1) {
    for (let column = 0; column < field.grid.cols; column += 1) {
      const index = row * field.grid.cols + column;
      if (!field.grid.interior[index]) {
        continue;
      }
      const x0 = field.grid.originX + column * field.grid.cellSize;
      const x1 = x0 + field.grid.cellSize;
      const y0 = field.grid.originY + row * field.grid.cellSize;
      const y1 = y0 + field.grid.cellSize;
      const normalized = THREE.MathUtils.clamp((field.pressure[index] - min) / span, 0, 1);
      const color = normalized < 0.5 ? cold.clone().lerp(neutral, normalized / 0.5) : neutral.clone().lerp(warm, (normalized - 0.5) / 0.5);

      positions.push(
        sceneX(layout, x0),
        0.122,
        sceneZ(layout, y0),
        sceneX(layout, x1),
        0.122,
        sceneZ(layout, y0),
        sceneX(layout, x1),
        0.122,
        sceneZ(layout, y1),
        sceneX(layout, x0),
        0.122,
        sceneZ(layout, y1)
      );
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b);
      indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3);
      vertexOffset += 4;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

function AirPressureLayer({ layout, field }: { layout: HouseLayout; field: FlowField }) {
  const geometry = useMemo(() => makeAirPressureGeometry(layout, field), [field, layout]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh geometry={geometry} raycast={noRaycast} renderOrder={1}>
      <meshBasicMaterial vertexColors transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function makeAirPathlineGeometry(layout: HouseLayout, field: FlowField, selectedRoomId: string | null) {
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  const seeds = field.seedPoints.slice(0, 260);

  for (const seed of seeds) {
    let x = seed.x;
    let y = seed.y;
    for (let step = 0; step < 28; step += 1) {
      const velocity = sampleFlowField(field, x, y);
      const speed = velocity.speed;
      const speedNorm = Math.min(1, speed / Math.max(0.001, field.speedMax));
      if (speed < field.speedMax * 0.006) {
        break;
      }
      const stepLength = field.grid.cellSize * (0.42 + speedNorm * 0.32);
      const nextX = x + (velocity.x / Math.max(0.0001, speed)) * stepLength;
      const nextY = y + (velocity.y / Math.max(0.0001, speed)) * stepLength;
      if (!cellAt(field, nextX, nextY)) {
        break;
      }
      const roomId = pointRoomId(layout, x, y);
      const dim = selectedRoomId && roomId !== selectedRoomId ? 0.36 : 1;
      color.copy(colorFromRamp(0.22 + speedNorm * 0.68)).multiplyScalar(dim);
      const height = THREE.MathUtils.clamp(0.34 + speedNorm * 0.42 + velocity.w * 0.9, 0.24, layout.bounds.height - 0.18);
      positions.push(sceneX(layout, x), height, sceneZ(layout, y), sceneX(layout, nextX), height, sceneZ(layout, nextY));
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      x = nextX;
      y = nextY;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function AirPathlineLayer({
  layout,
  field,
  selectedRoomId
}: {
  layout: HouseLayout;
  field: FlowField;
  selectedRoomId: string | null;
}) {
  const geometry = useMemo(() => makeAirPathlineGeometry(layout, field, selectedRoomId), [field, layout, selectedRoomId]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <lineSegments geometry={geometry} raycast={noRaycast} renderOrder={5}>
      <lineBasicMaterial vertexColors transparent opacity={0.72} depthWrite={false} />
    </lineSegments>
  );
}

function makeAirDeadZoneGeometry(layout: HouseLayout, field: FlowField, threshold: number) {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = new THREE.Color("#ffcf5a");
  const lowColor = new THREE.Color("#ff6b46");
  let vertexOffset = 0;

  for (let row = 0; row < field.grid.rows; row += 1) {
    for (let column = 0; column < field.grid.cols; column += 1) {
      const index = row * field.grid.cols + column;
      if (!field.grid.interior[index]) {
        continue;
      }
      const speedNorm = Math.hypot(field.vx[index], field.vy[index]) / Math.max(0.001, field.speedMax);
      if (speedNorm > threshold) {
        continue;
      }

      const x0 = field.grid.originX + column * field.grid.cellSize;
      const x1 = x0 + field.grid.cellSize;
      const y0 = field.grid.originY + row * field.grid.cellSize;
      const y1 = y0 + field.grid.cellSize;
      const severity = THREE.MathUtils.clamp(1 - speedNorm / Math.max(0.001, threshold), 0, 1);
      color.copy(new THREE.Color("#ffcf5a")).lerp(lowColor, severity);

      positions.push(
        sceneX(layout, x0),
        0.135,
        sceneZ(layout, y0),
        sceneX(layout, x1),
        0.135,
        sceneZ(layout, y0),
        sceneX(layout, x1),
        0.135,
        sceneZ(layout, y1),
        sceneX(layout, x0),
        0.135,
        sceneZ(layout, y1)
      );
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b);
      indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3);
      vertexOffset += 4;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

function AirDeadZoneLayer({
  layout,
  field,
  threshold
}: {
  layout: HouseLayout;
  field: FlowField;
  threshold: number;
}) {
  const geometry = useMemo(() => makeAirDeadZoneGeometry(layout, field, threshold), [field, layout, threshold]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh geometry={geometry} raycast={noRaycast} renderOrder={2}>
      <meshBasicMaterial vertexColors transparent opacity={0.26} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
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
      {controls.showAirPressure ? <AirPressureLayer layout={layout} field={field} /> : null}
      {controls.showAirDeadZones ? (
        <AirDeadZoneLayer layout={layout} field={field} threshold={controls.airDeadZoneThreshold} />
      ) : null}
      {controls.showAirPathlines ? <AirPathlineLayer layout={layout} field={field} selectedRoomId={selectedRoomId} /> : null}
      {controls.showAirGlyphs ? <AirflowGlyphLayer layout={layout} field={field} selectedRoomId={selectedRoomId} /> : null}
      {controls.showAirParticles ? (
        <AirflowParticles
          layout={layout}
          field={field}
          selectedRoomId={selectedRoomId}
          density={controls.airflowParticleDensity}
          speedScale={controls.airflowParticleSpeed}
          animate={controls.animateAirflow}
        />
      ) : null}
      {controls.showAirPathlines ? field.streamlines.map((streamline, index) => {
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
      }) : null}
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
  opacity,
  onSelectWall
}: {
  layout: HouseLayout;
  selectedWallId: string | null;
  visible: boolean;
  opacity: number;
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
        const materialOpacity = isSelected ? Math.max(0.78, opacity) : opacity;
        return (
          <mesh
            key={wall.id}
            position={[sceneX(layout, center.x), layout.bounds.height / 2, sceneZ(layout, center.y)]}
            rotation={[0, -rotation, 0]}
            castShadow
            onClick={(event: ThreeEvent<MouseEvent>) => {
              event.stopPropagation();
              onSelectWall(wall.source === "custom" ? wall.id : null);
            }}
          >
            <boxGeometry args={[length, layout.bounds.height, wall.thickness]} />
            <meshStandardMaterial
              color={wall.source === "custom" ? "#536d88" : wall.exterior ? "#f7f9fb" : "#d9dee0"}
              emissive={isSelected ? "#2a9fd6" : "#000000"}
              emissiveIntensity={isSelected ? 0.28 : 0}
              roughness={0.62}
              transparent={materialOpacity < 0.99}
              opacity={materialOpacity}
            />
          </mesh>
        );
      })}
    </>
  );
}

function RoofMesh({
  layout,
  visible,
  opacity
}: {
  layout: HouseLayout;
  visible: boolean;
  opacity: number;
}) {
  if (!visible) {
    return null;
  }

  const roofThickness = 0.12;
  const overhang = 0.12;
  const fasciaHeight = 0.34;
  const y = layout.bounds.height + roofThickness / 2;
  const roofOpacity = Math.min(0.42, Math.max(0.16, opacity * 0.46));

  return (
    <group position={[0, y, 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[layout.bounds.width + overhang * 2, roofThickness, layout.bounds.depth + overhang * 2]} />
        <meshStandardMaterial
          color="#d9edf0"
          emissive="#5fd8f2"
          emissiveIntensity={0.04}
          roughness={0.48}
          transparent
          opacity={roofOpacity}
          depthWrite={false}
        />
      </mesh>
      {[
        { position: [0, -fasciaHeight / 2, layout.bounds.depth / 2 + overhang] as [number, number, number], size: [layout.bounds.width + overhang * 2, fasciaHeight, 0.08] as [number, number, number] },
        { position: [0, -fasciaHeight / 2, -layout.bounds.depth / 2 - overhang] as [number, number, number], size: [layout.bounds.width + overhang * 2, fasciaHeight, 0.08] as [number, number, number] },
        { position: [layout.bounds.width / 2 + overhang, -fasciaHeight / 2, 0] as [number, number, number], size: [0.08, fasciaHeight, layout.bounds.depth + overhang * 2] as [number, number, number] },
        { position: [-layout.bounds.width / 2 - overhang, -fasciaHeight / 2, 0] as [number, number, number], size: [0.08, fasciaHeight, layout.bounds.depth + overhang * 2] as [number, number, number] }
      ].map((fascia, index) => (
        <mesh key={`roof-fascia-${index}`} position={fascia.position} raycast={noRaycast}>
          <boxGeometry args={fascia.size} />
          <meshStandardMaterial color="#d9edf0" transparent opacity={Math.min(0.36, roofOpacity + 0.08)} depthWrite={false} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(layout.bounds.width, layout.bounds.depth) * 0.5, Math.max(layout.bounds.width, layout.bounds.depth) * 0.5 + 0.015, 96]} />
        <meshBasicMaterial color="#bff5ff" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(layout.bounds.width + overhang * 2, roofThickness, layout.bounds.depth + overhang * 2)]} />
        <lineBasicMaterial color="#c9fbff" transparent opacity={0.5} />
      </lineSegments>
    </group>
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

const compassMountainLabels = [
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

const compassTrigramLayers = [
  { trigram: "坎", star: "一白", tone: "#65d6ff" },
  { trigram: "艮", star: "八白", tone: "#ffd166" },
  { trigram: "震", star: "三碧", tone: "#71e59f" },
  { trigram: "巽", star: "四绿", tone: "#8cebd0" },
  { trigram: "离", star: "九紫", tone: "#ff795f" },
  { trigram: "坤", star: "二黑", tone: "#e2c38d" },
  { trigram: "兑", star: "七赤", tone: "#e7eef5" },
  { trigram: "乾", star: "六白", tone: "#d6c1ff" }
];

const compassHexagramLabels = [
  "乾",
  "姤",
  "遁",
  "否",
  "观",
  "剥",
  "晋",
  "大有",
  "坎",
  "节",
  "屯",
  "既济",
  "革",
  "丰",
  "明夷",
  "师",
  "艮",
  "贲",
  "大畜",
  "损",
  "睽",
  "履",
  "中孚",
  "渐",
  "震",
  "豫",
  "解",
  "恒",
  "升",
  "井",
  "大过",
  "随",
  "巽",
  "小畜",
  "家人",
  "益",
  "无妄",
  "噬嗑",
  "颐",
  "蛊",
  "离",
  "旅",
  "鼎",
  "未济",
  "蒙",
  "涣",
  "讼",
  "同人",
  "坤",
  "复",
  "临",
  "泰",
  "大壮",
  "夬",
  "需",
  "比",
  "兑",
  "困",
  "萃",
  "咸",
  "蹇",
  "谦",
  "小过",
  "归妹"
];

const compassInnerSystems = [
  { label: "方位", tone: "#65d6ff" },
  { label: "六十四卦", tone: "#ffd166" },
  { label: "紫微", tone: "#d6c1ff" },
  { label: "风水盘", tone: "#71e59f" }
];

function CompassSectorBand({
  innerRadius,
  outerRadius,
  startAngle,
  span,
  active,
  index
}: {
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  span: number;
  active: boolean;
  index: number;
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, active ? 0.022 : 0.006, 0]} raycast={noRaycast}>
      <ringGeometry args={[innerRadius, outerRadius, 36, 1, startAngle, span]} />
      <meshBasicMaterial
        color={active ? "#ffcf5a" : index % 2 === 0 ? "#f0c75a" : "#f8e2a0"}
        transparent
        opacity={active ? 0.28 : 0.08}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function CompassNeedle({
  radius,
  degrees,
  color,
  emissive,
  y,
  lengthRatio,
  width,
  label,
  labelOffset = 0.12
}: {
  radius: number;
  degrees: number;
  color: string;
  emissive: string;
  y: number;
  lengthRatio: number;
  width: number;
  label: string;
  labelOffset?: number;
}) {
  const labelRadius = radius * lengthRatio + labelOffset;
  return (
    <group rotation={[0, -THREE.MathUtils.degToRad(degrees), 0]}>
      <mesh position={[radius * lengthRatio * 0.5, y, 0]} raycast={noRaycast}>
        <boxGeometry args={[radius * lengthRatio, width, width]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.24} roughness={0.38} />
      </mesh>
      <mesh position={[radius * lengthRatio, y, 0]} rotation={[0, 0, -Math.PI / 2]} raycast={noRaycast}>
        <coneGeometry args={[width * 2.6, width * 6.2, 24]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.28} roughness={0.34} />
      </mesh>
      <mesh position={[-radius * lengthRatio * 0.28, y - 0.006, 0]} raycast={noRaycast}>
        <boxGeometry args={[radius * lengthRatio * 0.42, width * 0.72, width * 0.72]} />
        <meshStandardMaterial color="#eef4ef" emissive="#ffffff" emissiveIntensity={0.06} roughness={0.42} />
      </mesh>
      <LabelSprite text={label} position={[labelRadius, y + 0.2, 0]} accent={color} boxed={false} scale={[0.9, 0.28, 1]} />
    </group>
  );
}

function CompassScanEffect({ radius }: { radius: number }) {
  const scanRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (scanRef.current) {
      scanRef.current.rotation.y = state.clock.elapsedTime * 0.28;
    }
  });

  return (
    <group ref={scanRef} position={[0, 0.052, 0]} raycast={noRaycast}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <ringGeometry args={[0.72, radius + 0.12, 64, 1, -0.04, 0.22]} />
        <meshBasicMaterial color="#7df9ff" transparent opacity={0.13} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[radius * 0.54, 0.018, 0]} raycast={noRaycast}>
        <boxGeometry args={[radius * 0.92, 0.01, 0.015]} />
        <meshBasicMaterial color="#7df9ff" transparent opacity={0.32} depthWrite={false} />
      </mesh>
    </group>
  );
}

function CompassLayerLabel({
  label,
  tone,
  radius,
  index,
  total,
  y = 0.35,
  scale = [0.48, 0.16, 1]
}: {
  label: string;
  tone: string;
  radius: number;
  index: number;
  total: number;
  y?: number;
  scale?: [number, number, number];
}) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const x = Math.cos(angle);
  const z = Math.sin(angle);
  return <LabelSprite text={label} position={[x * radius, y, z * radius]} accent={tone} boxed={false} scale={scale} />;
}

function CompassRing({
  layout,
  fengshui,
  visible,
  mode
}: {
  layout: HouseLayout;
  fengshui: FengshuiAnalysis;
  visible: boolean;
  mode: AnalysisControls["compassMode"];
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
  const sectorInnerRadius = radius - 1.42;
  const sectorOuterRadius = radius - 0.08;
  const hexagramRadius = radius - 1.72;
  const systemRadius = radius - 2.06;
  const sectorSpan = (Math.PI * 2) / 8 - 0.035;

  return (
    <group position={[0, 0.2, 0]}>
      <mesh position={[0, -0.09, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[radius + 0.34, radius + 0.5, 0.16, 160]} />
        <meshStandardMaterial
          color="#11191c"
          emissive="#0e3742"
          emissiveIntensity={0.2}
          roughness={0.42}
          metalness={0.28}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
        <circleGeometry args={[radius + 0.24, 160]} />
        <meshBasicMaterial color="#d9aa25" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.018, 0]} raycast={noRaycast}>
        <ringGeometry args={[radius - 2.3, radius + 0.22, 160]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.05} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <CompassScanEffect radius={radius} />

      {mode === "professional"
        ? fengshui.compass.map((sector, index) => (
            <CompassSectorBand
              key={`band-${sector.id}`}
              innerRadius={sectorInnerRadius}
              outerRadius={sectorOuterRadius}
              startAngle={(index / 8) * Math.PI * 2 - Math.PI / 2 - sectorSpan / 2}
              span={sectorSpan}
              active={sector.active}
              index={index}
            />
          ))
        : null}

      {[radius, innerRadius, midRadius, radius - 1.08, radius - 1.42, hexagramRadius, systemRadius].map((ringRadius, index) => (
        <mesh key={ringRadius} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[ringRadius, index === 0 ? 0.045 : index > 4 ? 0.012 : 0.018, 12, 128]} />
          <meshStandardMaterial
            color={index === 0 ? "#071114" : index > 4 ? "#65d6ff" : "#d8b451"}
            emissive={index === 0 ? "#000000" : index > 4 ? "#0b5364" : "#3a2b00"}
            emissiveIntensity={index > 4 ? 0.18 : 0.1}
          />
        </mesh>
      ))}

      {mode === "professional"
        ? [0, Math.PI / 2].map((rotation, index) => (
            <group key={`compass-cross-${index}`} rotation={[0, rotation, 0]}>
              <mesh position={[0, 0.052, 0]} raycast={noRaycast}>
                <boxGeometry args={[radius * 2.02, 0.018, 0.018]} />
                <meshBasicMaterial color={index === 0 ? "#c62121" : "#202820"} transparent opacity={index === 0 ? 0.52 : 0.28} depthWrite={false} />
              </mesh>
            </group>
          ))
        : null}

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

      {mode === "professional"
        ? Array.from({ length: 64 }, (_, index) => {
            const angle = (index / 64) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(angle);
            const z = Math.sin(angle);
            const tickLength = index % 8 === 0 ? 0.19 : 0.1;
            return (
              <mesh
                key={`hex-tick-${index}`}
                position={[x * (hexagramRadius + tickLength / 2), 0.034, z * (hexagramRadius + tickLength / 2)]}
                rotation={[0, -angle, 0]}
                raycast={noRaycast}
              >
                <boxGeometry args={[tickLength, 0.012, index % 8 === 0 ? 0.024 : 0.011]} />
                <meshStandardMaterial color={index % 8 === 0 ? "#fff1a8" : "#65d6ff"} emissive="#0b5364" emissiveIntensity={0.12} />
              </mesh>
            );
          })
        : null}

      {mode === "professional"
        ? compassInnerSystems.map((item, index) => {
            const angle = (index / compassInnerSystems.length) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(angle);
            const z = Math.sin(angle);
            return (
              <mesh
                key={`system-spoke-${item.label}`}
                position={[x * (systemRadius + 0.42), 0.04, z * (systemRadius + 0.42)]}
                rotation={[0, -angle, 0]}
                raycast={noRaycast}
              >
                <boxGeometry args={[0.8, 0.014, 0.018]} />
                <meshBasicMaterial color={item.tone} transparent opacity={0.35} depthWrite={false} />
              </mesh>
            );
          })
        : null}

      {mode === "professional"
        ? compassMountainLabels.map((label, index) => (
            <CompassLayerLabel
              key={`mountain-${index}-${label}`}
              label={label}
              tone={index % 3 === 0 ? "#f8e2a0" : "#d8b451"}
              radius={radius - 0.52}
              index={index}
              total={compassMountainLabels.length}
            />
          ))
        : null}

      {mode === "professional"
        ? compassTrigramLayers.map((item, index) => (
            <CompassLayerLabel
              key={`${item.trigram}-${item.star}`}
              label={`${item.trigram}${item.star}`}
              tone={item.tone}
              radius={radius - 1.22}
              index={index}
              total={compassTrigramLayers.length}
              y={0.38}
              scale={[0.68, 0.2, 1]}
            />
          ))
        : null}

      {mode === "professional"
        ? compassHexagramLabels.map((label, index) =>
            index % 2 === 0 ? (
              <CompassLayerLabel
                key={`hex-${index}-${label}`}
                label={label}
                tone={index % 8 === 0 ? "#fff1a8" : "#b9f7ff"}
                radius={hexagramRadius}
                index={index}
                total={compassHexagramLabels.length}
                y={0.31}
                scale={[0.34, 0.12, 1]}
              />
            ) : null
          )
        : null}

      {mode === "professional"
        ? compassInnerSystems.map((item, index) => (
            <CompassLayerLabel
              key={item.label}
              label={item.label}
              tone={item.tone}
              radius={systemRadius}
              index={index}
              total={compassInnerSystems.length}
              y={0.36}
              scale={[0.82, 0.24, 1]}
            />
          ))
        : null}

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
              boxed={false}
              scale={[0.82, 0.26, 1]}
            />
          </group>
        );
      })}

      <CompassNeedle
        radius={radius}
        degrees={layout.orientation.facingDegrees}
        color="#ff5f46"
        emissive="#8b1200"
        y={0.24}
        lengthRatio={0.78}
        width={0.075}
        label={`朝向 ${formatDirectionLabel(layout.orientation.facingLabel)}`}
      />
      <CompassNeedle
        radius={radius}
        degrees={layout.orientation.frontDoorDegrees}
        color="#28d7a7"
        emissive="#0d6960"
        y={0.15}
        lengthRatio={0.58}
        width={0.046}
        label={`门向 ${formatDirectionLabel(layout.orientation.frontDoorLabel)}`}
        labelOffset={0.34}
      />

      <mesh position={[0, 0.245, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[0.34, 0.4, 0.08, 48]} />
        <meshStandardMaterial color="#e6e7dc" metalness={0.45} roughness={0.25} emissive="#ffffff" emissiveIntensity={0.06} />
      </mesh>

      <sprite position={[0, 0.28, 0]} scale={[1.35, 1.35, 1]}>
        <spriteMaterial map={yinYangTexture} transparent depthWrite={false} />
      </sprite>

      <LabelSprite
        text={`坐向 ${layout.orientation.facingDegrees}° / 门向 ${layout.orientation.frontDoorDegrees}°`}
        position={[0, 0.58, 0]}
        accent="#19c2ff"
        scale={[1.52, 0.48, 1]}
      />
    </group>
  );
}

export function ThreeSceneCanvas({
  layout,
  selectedRoomId,
  selectedWallId,
  heatmap: _heatmap,
  airflow: _airflow,
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

      <CompassRing layout={layout} fengshui={fengshui} visible={layers.fengshui} mode={controls.compassMode} />
      <BaguaOverlay layout={layout} fengshui={fengshui} activePalace={activePalace} visible={layers.fengshui} />
      <RoomMeshes layout={layout} selectedRoomId={selectedRoomId} onSelectRoom={onSelectRoom} />
      <HeatFieldOverlay
        layout={layout}
        field={heatField}
        sensors={layout.sensors}
        visible={layers.heat}
        controls={controls}
      />
      <AirflowFieldOverlay
        layout={layout}
        field={flowField}
        selectedRoomId={selectedRoomId}
        visible={layers.airflow}
        controls={controls}
      />
      <WallMeshes
        layout={layout}
        selectedWallId={selectedWallId}
        visible={layers.walls}
        opacity={controls.structureOpacity}
        onSelectWall={onSelectWall}
      />
      <RoofMesh layout={layout} visible={layers.walls && controls.showRoof} opacity={controls.structureOpacity} />
      <OpeningMeshes layout={layout} />
      <DeviceMeshes layout={layout} />

      <gridHelper args={[layout.bounds.width + 4, 24, "#335066", "#233544"]} position={[0, 0.01, 0]} />
      <Controls />
    </Canvas>
  );
}
