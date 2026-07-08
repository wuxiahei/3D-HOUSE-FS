from __future__ import annotations

from backend.models import HouseLayout


def generate_heatmap(layout: HouseLayout, grid_size: int = 6) -> list[dict]:
    cell_width = layout.bounds.width / grid_size
    cell_depth = layout.bounds.depth / grid_size
    cells: list[dict] = []

    for row in range(grid_size):
        for column in range(grid_size):
            center_x = column * cell_width + cell_width / 2
            center_y = row * cell_depth + cell_depth / 2
            temp = infer_temperature(layout, center_x, center_y)
            solar_boost = 0.8 if row > grid_size / 2 else 0.2
            adjusted = round(temp + solar_boost, 1)
            cells.append(
                {
                    "id": f"cell-{row}-{column}",
                    "x": round(column * cell_width, 2),
                    "y": round(row * cell_depth, 2),
                    "width": round(cell_width, 2),
                    "depth": round(cell_depth, 2),
                    "temperature": adjusted,
                    "intensity": max(0.0, min(1.0, round((adjusted - 20) / 12, 2))),
                }
            )

    return cells


def infer_temperature(layout: HouseLayout, x: float, y: float) -> float:
    if not layout.sensors:
        return layout.weather.outdoorTemperature - 4

    weighted = 0.0
    total_weight = 0.0
    for sensor in layout.sensors:
        distance = max(0.25, ((sensor.x - x) ** 2 + (sensor.y - y) ** 2) ** 0.5)
        weight = 1 / distance
        weighted += sensor.temperature * weight
        total_weight += weight

    return weighted / total_weight
