import type { HouseLayout, LayoutPoint, WallSegment } from "../types/layout";

const EPSILON = 0.001;

export interface WallTopology {
  wallId: string;
  internal: boolean;
  sharedWithRoomIds: string[];
}

function samePoint(a: LayoutPoint, b: LayoutPoint) {
  return Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.y - b.y) <= EPSILON;
}

function wallKey(wall: WallSegment) {
  const a = wall.start;
  const b = wall.end;
  const ordered = a.x < b.x || (a.x === b.x && a.y <= b.y) ? [a, b] : [b, a];
  return `${ordered[0].x},${ordered[0].y}:${ordered[1].x},${ordered[1].y}`;
}

export function areCoincidentWalls(left: WallSegment, right: WallSegment) {
  return (
    (samePoint(left.start, right.start) && samePoint(left.end, right.end)) ||
    (samePoint(left.start, right.end) && samePoint(left.end, right.start))
  );
}

export function buildWallTopology(layout: HouseLayout): WallTopology[] {
  const groups = new Map<string, WallSegment[]>();
  for (const wall of layout.walls) {
    groups.set(wallKey(wall), [...(groups.get(wallKey(wall)) ?? []), wall]);
  }

  return layout.walls.map((wall) => {
    const group = groups.get(wallKey(wall)) ?? [wall];
    const roomIds = [...new Set(group.map((item) => item.roomId).filter((value): value is string => Boolean(value)))];
    return {
      wallId: wall.id,
      internal: roomIds.length > 1 || !wall.exterior,
      sharedWithRoomIds: roomIds.filter((id) => id !== wall.roomId)
    };
  });
}

export function isExteriorOpeningWall(layout: HouseLayout, wallId: string) {
  const topology = buildWallTopology(layout).find((item) => item.wallId === wallId);
  return topology ? !topology.internal : false;
}
