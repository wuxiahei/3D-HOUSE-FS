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
import type { SceneLayers } from "../AppShell";
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

function directionVector(direction: string) {
  const angle = directionToRadians(direction);
  return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize();
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
      {layout.walls.map((wall) => {
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
              color={wall.source === "custom" ? "#536d88" : "#f7f9fb"}
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

function CompassRing({
  layout,
  fengshui,
  visible
}: {
  layout: HouseLayout;
  fengshui: FengshuiAnalysis;
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }

  const radius = Math.max(layout.bounds.width, layout.bounds.depth) / 2 + 1.25;
  const innerRadius = radius - 0.34;
  const midRadius = radius - 0.72;

  return (
    <group position={[0, 0.2, 0]}>
      {[radius, innerRadius, midRadius].map((ringRadius, index) => (
        <mesh key={ringRadius} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[ringRadius, index === 0 ? 0.035 : 0.018, 12, 128]} />
          <meshStandardMaterial color={index === 0 ? "#101820" : "#d8b451"} emissive={index === 0 ? "#000000" : "#3a2b00"} emissiveIntensity={0.08} />
        </mesh>
      ))}

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

      <group rotation={[0, -THREE.MathUtils.degToRad(layout.orientation.frontDoorDegrees), 0]}>
        <mesh position={[radius * 0.31, 0.13, 0]}>
          <boxGeometry args={[radius * 0.62, 0.035, 0.035]} />
          <meshStandardMaterial color="#28d7a7" emissive="#0d6960" emissiveIntensity={0.12} />
        </mesh>
      </group>

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
  fengshui,
  activePalace,
  layers,
  onSelectRoom,
  onSelectWall
}: {
  layout: HouseLayout;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  heatmap: HeatmapCell[];
  airflow: AirflowVector[];
  fengshui: FengshuiAnalysis;
  activePalace: BaguaPalace | null;
  layers: SceneLayers;
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
      <HeatmapOverlay layout={layout} heatmap={heatmap} sensors={layout.sensors} visible={layers.heat} />
      <AirflowOverlay layout={layout} airflow={airflow} selectedRoomId={selectedRoomId} visible={layers.airflow} />
      <WallMeshes layout={layout} selectedWallId={selectedWallId} visible={layers.walls} onSelectWall={onSelectWall} />
      <OpeningMeshes layout={layout} />

      <gridHelper args={[layout.bounds.width + 4, 24, "#335066", "#233544"]} position={[0, 0.01, 0]} />
      <Controls />
    </Canvas>
  );
}
