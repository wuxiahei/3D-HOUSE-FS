import { degreesToDirection } from "@fengshui/core";
import type { AirflowVector, HouseLayout } from "@fengshui/core";

const directionSequence = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

function nextDirection(direction: (typeof directionSequence)[number]) {
  const index = directionSequence.indexOf(direction);
  return directionSequence[(index + 4) % directionSequence.length];
}

export function generateAirflow(layout: HouseLayout): AirflowVector[] {
  const incoming = degreesToDirection(layout.weather.windDirection);
  return layout.rooms.map((room, index) => {
    const openingCount = layout.openings.filter((opening) => opening.wallId.startsWith(room.id)).length;
    const strength = Number(Math.min(1, 0.25 + openingCount * 0.18 + layout.weather.windSpeed / 8).toFixed(2));
    return {
      id: `flow-${room.id}`,
      roomId: room.id,
      fromDirection: incoming,
      toDirection: nextDirection(incoming),
      strength,
      explanation: `${room.name} 当前基于 ${openingCount} 个门窗开口和室外 ${layout.weather.windSpeed}m/s 风速做简化估算。`
    };
  });
}

