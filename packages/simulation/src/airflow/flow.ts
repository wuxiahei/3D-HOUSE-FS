import { degreesToDirection } from "@fengshui/core";
import type { AirflowVector, HouseLayout } from "@fengshui/core";

const directionSequence = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

function nextDirection(direction: (typeof directionSequence)[number]) {
  const index = directionSequence.indexOf(direction);
  return directionSequence[(index + 4) % directionSequence.length];
}

export function generateAirflow(layout: HouseLayout): AirflowVector[] {
  const incoming = degreesToDirection(layout.weather.windDirection);

  return layout.rooms.map((room) => {
    const openingCount = layout.openings.filter((opening) => opening.wallId.startsWith(room.id)).length;
    const ac = (layout.devices ?? []).find((device) => device.roomId === room.id && device.type === "ac");
    const heatSource = (layout.devices ?? []).find((device) => device.roomId === room.id && device.type === "kitchen-heat");
    const toDirection = ac ? degreesToDirection(ac.directionDegrees) : nextDirection(incoming);
    const strength = Number(
      Math.min(
        1,
        0.18 +
          openingCount * 0.12 +
          layout.weather.windSpeed / 10 +
          (ac ? ac.strength * 0.28 : 0) +
          (heatSource ? heatSource.strength * 0.08 : 0)
      ).toFixed(2)
    );

    return {
      id: `flow-${room.id}`,
      roomId: room.id,
      fromDirection: incoming,
      toDirection,
      strength,
      explanation: `${room.name} 基于 ${openingCount} 个门窗开口、室外 ${layout.weather.windSpeed}m/s 风速${ac ? `、${ac.label}送风` : ""}${heatSource ? `、${heatSource.label}热浮力` : ""}进行简化估算。`
    };
  });
}
