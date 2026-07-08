import { wallLength } from "../geometry/layout-helpers";
import type { HouseLayout, ValidationIssue } from "../types/layout";

export function validateLayout(layout: HouseLayout): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (layout.rooms.length === 0) {
    issues.push({
      level: "error",
      code: "NO_ROOMS",
      message: "至少需要一个房间。"
    });
  }

  layout.rooms.forEach((room) => {
    if (room.width <= 0 || room.depth <= 0) {
      issues.push({
        level: "error",
        code: "ROOM_SIZE",
        message: `${room.name} 的长宽必须大于 0。`
      });
    }
  });

  layout.walls
    .filter((wall) => wall.source === "custom")
    .forEach((wall) => {
      if (wallLength(wall) < 0.35) {
        issues.push({
          level: "warning",
          code: "SHORT_CUSTOM_WALL",
          message: `${wall.label} 太短，建议至少绘制 0.35m 以上以便分析和渲染。`
        });
      }
    });

  const wallMap = new Map(layout.walls.map((wall) => [wall.id, wall]));

  layout.openings.forEach((opening) => {
    const wall = wallMap.get(opening.wallId);

    if (!wall) {
      issues.push({
        level: "error",
        code: "OPENING_WALL_MISSING",
        message: `${opening.notes ?? opening.id} 没有关联到有效墙体。`
      });
      return;
    }

    if (opening.width <= 0 || opening.height <= 0) {
      issues.push({
        level: "error",
        code: "OPENING_SIZE",
        message: `${opening.notes ?? opening.id} 的宽高必须大于 0。`
      });
    }

    if (opening.offset < 0 || opening.offset + opening.width > wallLength(wall)) {
      issues.push({
        level: "warning",
        code: "OPENING_OUT_OF_WALL",
        message: `${opening.notes ?? opening.id} 超出了 ${wall.label} 的长度范围。`
      });
    }
  });

  if (!layout.openings.some((opening) => opening.type === "door")) {
    issues.push({
      level: "warning",
      code: "NO_DOOR",
      message: "当前户型还没有门，气流与动线分析会偏弱。"
    });
  }

  if (!layout.openings.some((opening) => opening.type === "window")) {
    issues.push({
      level: "warning",
      code: "NO_WINDOW",
      message: "当前户型还没有窗，采光、热力和通风判断会偏弱。"
    });
  }

  if (!layout.metadata.address) {
    issues.push({
      level: "warning",
      code: "ADDRESS_MISSING",
      message: "未填写地址时，天气与风向联动信息会受限。"
    });
  }

  if (layout.sensors.length < 2) {
    issues.push({
      level: "warning",
      code: "SENSOR_SPARSE",
      message: "温度点位过少时，热力图会更偏向估算。"
    });
  }

  return issues;
}
