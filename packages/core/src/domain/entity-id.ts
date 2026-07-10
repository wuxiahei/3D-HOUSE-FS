export function nextEntityId(prefix: string, existingIds: Iterable<string>): string {
  const used = new Set(existingIds);
  let index = 1;
  let candidate = `${prefix}-${index}`;

  while (used.has(candidate)) {
    index += 1;
    candidate = `${prefix}-${index}`;
  }

  return candidate;
}

export function collectEntityIds(layout: {
  rooms: { id: string }[];
  walls: { id: string }[];
  openings: { id: string }[];
  sensors: { id: string }[];
  devices?: { id: string }[];
}) {
  return [
    ...layout.rooms.map((item) => item.id),
    ...layout.walls.map((item) => item.id),
    ...layout.openings.map((item) => item.id),
    ...layout.sensors.map((item) => item.id),
    ...(layout.devices ?? []).map((item) => item.id)
  ];
}
