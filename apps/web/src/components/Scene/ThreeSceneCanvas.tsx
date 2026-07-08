"use client";

import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type {
  AirflowVector,
  BaguaPalace,
  FengshuiAnalysis,
  HeatmapCell,
  HouseLayout
} from "@fengshui/core";
import {
  wallCenter,
  wallLength,
  wallRotationRadians
} from "@fengshui/core";
import { useMemo } from "react";
import * as THREE from "three";
import { formatDirectionLabel } from "../../lib/editor";

function sceneX(layout: HouseLayout, x: number) {
  return x - layout.bounds.width / 2;
}

function sceneZ(layout: HouseLayout, y: number) {
  return y - layout.bounds.depth / 2;
}

function colorForIntensity(intensity: number) {
  const color = new THREE.Color();
  color.setHSL((210 - intensity * 180) / 360, 0.72, 0.58);
  return color;
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

function RoomMeshes({
  layout,
  selectedRoomId,
  heatmap,
  airflow,
  onSelectRoom
}: {
  layout: HouseLayout;
  selectedRoomId: string | null;
  heatmap: HeatmapCell[];
  airflow: AirflowVector[];
  onSelectRoom: (roomId: string) => void;
}) {
  return (
    <>
      {layout.rooms.map((room) => {
        const roomHeat = heatmap.find((cell) => {
          const centerX = cell.x + cell.width / 2;
          const centerY = cell.y + cell.depth / 2;
          return (
            centerX >= room.origin.x &&
            centerX <= room.origin.x + room.width &&
            centerY >= room.origin.y &&
            centerY <= room.origin.y + room.depth
          );
        });
        const airflowInfo = airflow.find((item) => item.roomId === room.id);
        const isSelected = selectedRoomId === room.id;
        return (
          <group
            key={room.id}
            position={[
              sceneX(layout, room.origin.x + room.width / 2),
              0,
              sceneZ(layout, room.origin.y + room.depth / 2)
            ]}
            onClick={(event) => {
              event.stopPropagation();
              onSelectRoom(room.id);
            }}
          >
            <mesh position={[0, 0.03, 0]}>
              <boxGeometry args={[room.width, 0.06, room.depth]} />
              <meshStandardMaterial
                color={roomHeat ? colorForIntensity(roomHeat.intensity) : "#e9d9c5"}
                emissive={isSelected ? "#a14d25" : "#000000"}
                emissiveIntensity={isSelected ? 0.18 : 0}
                transparent
                opacity={0.92}
              />
            </mesh>
            {airflowInfo ? (
              <group position={[0, 0.16, 0]} rotation={[0, -directionToRadians(airflowInfo.fromDirection), 0]}>
                <Line points={[[-0.55, 0, 0], [0.55, 0, 0]]} color="#237d77" lineWidth={2} />
                <mesh position={[0.6, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                  <coneGeometry args={[0.08, 0.2, 16]} />
                  <meshStandardMaterial color="#237d77" />
                </mesh>
              </group>
            ) : null}
            <Html position={[0, 0.34, 0]} center distanceFactor={14}>
              <div className={`scene-label ${isSelected ? "active" : ""}`}>
                <strong>{room.name}</strong>
                <span>{room.width.toFixed(1)}m × {room.depth.toFixed(1)}m</span>
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

function WallMeshes({
  layout,
  selectedWallId,
  onSelectWall
}: {
  layout: HouseLayout;
  selectedWallId: string | null;
  onSelectWall: (wallId: string | null) => void;
}) {
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
            onClick={(event) => {
              event.stopPropagation();
              onSelectWall(wall.source === "custom" ? wall.id : null);
            }}
          >
            <boxGeometry args={[length, 2.4, wall.thickness]} />
            <meshStandardMaterial
              color={wall.source === "custom" ? "#91693c" : "#f7f0e7"}
              emissive={isSelected ? "#a14d25" : "#000000"}
              emissiveIntensity={isSelected ? 0.2 : 0}
            />
          </mesh>
        );
      })}
    </>
  );
}

function OpeningMeshes({ layout }: { layout: HouseLayout }) {
  const wallMap = useMemo(
    () => new Map(layout.walls.map((wall) => [wall.id, wall])),
    [layout.walls]
  );

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
            <meshStandardMaterial
              color={opening.type === "door" ? "#8b5a2b" : "#7bb8d3"}
              transparent
              opacity={opening.type === "door" ? 0.88 : 0.42}
            />
          </mesh>
        );
      })}
    </>
  );
}

function BaguaFloor({
  layout,
  fengshui,
  activePalace
}: {
  layout: HouseLayout;
  fengshui: FengshuiAnalysis;
  activePalace: BaguaPalace | null;
}) {
  const cellWidth = layout.bounds.width / 3;
  const cellDepth = layout.bounds.depth / 3;
  return (
    <>
      {fengshui.bagua.map((sector) => {
        const isActive = sector.palace === activePalace;
        return (
          <group key={sector.palace}>
            <mesh
              position={[
                sceneX(layout, sector.gridX * cellWidth + cellWidth / 2),
                0.01,
                sceneZ(layout, sector.gridY * cellDepth + cellDepth / 2)
              ]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[cellWidth, cellDepth]} />
              <meshStandardMaterial
                color={isActive ? "#f3a14c" : "#eed8bc"}
                transparent
                opacity={isActive ? 0.26 : 0.08}
              />
            </mesh>
            <Html
              position={[
                sceneX(layout, sector.gridX * cellWidth + cellWidth / 2),
                0.06,
                sceneZ(layout, sector.gridY * cellDepth + cellDepth / 2)
              ]}
              center
              distanceFactor={20}
            >
              <div className={`bagua-label ${isActive ? "active" : ""}`}>
                <strong>{sector.label}</strong>
                <span>{sector.annualStarLabel}</span>
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

function Compass3DScene({
  layout,
  fengshui
}: {
  layout: HouseLayout;
  fengshui: FengshuiAnalysis;
}) {
  const baseX = layout.bounds.width / 2 - 1.35;
  const baseZ = layout.bounds.depth / 2 + 1.4;
  return (
    <group position={[baseX, 0.2, baseZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.82, 0.04, 16, 64]} />
        <meshStandardMaterial color="#b95c2e" />
      </mesh>
      {fengshui.compass.map((sector, index) => {
        const angle = (index / 8) * Math.PI * 2;
        const x = Math.cos(angle) * 0.78;
        const z = Math.sin(angle) * 0.78;
        return (
          <group key={sector.id}>
            <mesh position={[x / 2, 0.04, z / 2]} rotation={[0, -angle, 0]}>
              <boxGeometry args={[0.52, 0.06, 0.02]} />
              <meshStandardMaterial color={sector.active ? "#d06a33" : "#caa27d"} />
            </mesh>
            <Html position={[x * 1.08, 0.12, z * 1.08]} center distanceFactor={12}>
              <div className={`compass-label ${sector.active ? "active" : ""}`}>
                {formatDirectionLabel(sector.label)}
              </div>
            </Html>
          </group>
        );
      })}
      <group rotation={[0, -THREE.MathUtils.degToRad(layout.orientation.facingDegrees), 0]}>
        <mesh position={[0.42, 0.12, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.11, 0.3, 18]} />
          <meshStandardMaterial color="#d63a2b" />
        </mesh>
        <mesh position={[0.12, 0.08, 0]}>
          <boxGeometry args={[0.42, 0.05, 0.05]} />
          <meshStandardMaterial color="#d63a2b" />
        </mesh>
      </group>
      <Html position={[0, 0.18, 0]} center distanceFactor={10}>
        <div className="compass-scene-card">
          <strong>3D 罗盘</strong>
          <span>
            向 {layout.orientation.facingLabel} / 门 {layout.orientation.frontDoorLabel}
          </span>
        </div>
      </Html>
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
  onSelectRoom: (roomId: string) => void;
  onSelectWall: (wallId: string | null) => void;
}) {
  return (
    <div className="three-stage">
      <Canvas camera={{ position: [8, 10, 12], fov: 46 }}>
        <color attach="background" args={["#f1e9db"]} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[8, 12, 5]} intensity={1.2} castShadow />
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[layout.bounds.width + 4, layout.bounds.depth + 4]} />
            <meshStandardMaterial color="#efe6d8" />
          </mesh>
          <BaguaFloor layout={layout} fengshui={fengshui} activePalace={activePalace} />
          <RoomMeshes
            layout={layout}
            selectedRoomId={selectedRoomId}
            heatmap={heatmap}
            airflow={airflow}
            onSelectRoom={onSelectRoom}
          />
          <WallMeshes layout={layout} selectedWallId={selectedWallId} onSelectWall={onSelectWall} />
          <OpeningMeshes layout={layout} />
          <Compass3DScene layout={layout} fengshui={fengshui} />
        </group>
        <gridHelper args={[layout.bounds.width + 2, 20, "#bba58e", "#d8c4b0"]} position={[0, 0.001, 0]} />
        <OrbitControls makeDefault minDistance={7} maxDistance={22} maxPolarAngle={Math.PI / 2.2} />
      </Canvas>
    </div>
  );
}
