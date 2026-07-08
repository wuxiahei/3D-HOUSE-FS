from __future__ import annotations

from backend.models import HouseLayout

PALACE_MATRIX = [
    ["northwest", "north", "northeast"],
    ["west", "center", "east"],
    ["southwest", "south", "southeast"],
]

PALACE_LABELS = {
    "north": "北方坎宫",
    "northeast": "东北艮宫",
    "east": "东方震宫",
    "southeast": "东南巽宫",
    "south": "南方离宫",
    "southwest": "西南坤宫",
    "west": "西方兑宫",
    "northwest": "西北乾宫",
    "center": "中宫",
}


def analyze_fengshui(layout: HouseLayout) -> dict:
    bagua = build_bagua(layout)
    findings = [
        {
            "id": "orientation-summary",
            "title": "朝向与门向信息",
            "basis": f"房屋朝向约 {layout.orientation.facingDegrees}°（{layout.orientation.facingLabel}），入户门约 {layout.orientation.frontDoorDegrees}°（{layout.orientation.frontDoorLabel}）。",
            "tone": "neutral",
            "reference": "建议结合罗盘方位、九宫映射和门窗位置一起阅读。",
        },
        {
            "id": "openings-reference",
            "title": "门窗分布信息",
            "basis": f"当前识别到 {len(layout.openings)} 个门窗开口，可与气流图对照阅读。",
            "tone": "supportive",
            "reference": "系统提供的是信息视图，不直接替用户输出好坏结论。",
        },
    ]

    return {
        "summary": [
            "本模块提供方位、宫位、飞星和空间关系的参考信息。",
            "系统不会直接替用户给出好坏结论。",
            "请结合热力图、气流图和实际居住习惯综合判断。",
        ],
        "compass": build_compass(layout),
        "bagua": bagua,
        "findings": findings,
    }


def build_compass(layout: HouseLayout) -> list[dict]:
    labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    sectors = []
    for index, label in enumerate(labels):
        start_angle = ((index * 45 - 22.5) % 360 + 360) % 360
        sectors.append(
            {
                "id": f"compass-{label}",
                "label": label,
                "startAngle": start_angle,
                "endAngle": (start_angle + 45) % 360,
                "active": label == layout.orientation.facingLabel,
            }
        )
    return sectors


def build_bagua(layout: HouseLayout) -> list[dict]:
    sectors = []
    cell_width = layout.bounds.width / 3
    cell_depth = layout.bounds.depth / 3
    for grid_y, row in enumerate(PALACE_MATRIX):
        for grid_x, palace in enumerate(row):
            room_ids = []
            for room in layout.rooms:
                center_x = room.origin.x + room.width / 2
                center_y = room.origin.y + room.depth / 2
                rx = min(2, int(center_x / cell_width))
                ry = min(2, int(center_y / cell_depth))
                if rx == grid_x and ry == grid_y:
                    room_ids.append(room.id)
            sectors.append(
                {
                    "palace": palace,
                    "label": PALACE_LABELS[palace],
                    "gridX": grid_x,
                    "gridY": grid_y,
                    "roomIds": room_ids,
                    "reference": "用于帮助理解方位与空间位置的对应关系。",
                    "annualStar": ((layout.metadata.renovationYear + grid_x + grid_y) % 9) + 1,
                }
            )
    return sectors

