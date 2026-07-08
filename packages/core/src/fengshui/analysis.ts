import type {
  BaguaPalace,
  BaguaSector,
  FengshuiAnalysis,
  FengshuiFinding,
  HouseLayout,
  Room,
  RoomPalaceMapping
} from "../types/layout";
import { roomCenter } from "../geometry/layout-helpers";
import { buildCompass } from "./compass";

const palaceMatrix: BaguaPalace[][] = [
  ["northwest", "north", "northeast"],
  ["west", "center", "east"],
  ["southwest", "south", "southeast"]
];

const palaceLabels: Record<BaguaPalace, string> = {
  north: "北方坎宫",
  northeast: "东北艮宫",
  east: "东方震宫",
  southeast: "东南巽宫",
  south: "南方离宫",
  southwest: "西南坤宫",
  west: "西方兑宫",
  northwest: "西北乾宫",
  center: "中宫"
};

const palaceDirections: Record<BaguaPalace, "CENTER" | "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW"> = {
  north: "N",
  northeast: "NE",
  east: "E",
  southeast: "SE",
  south: "S",
  southwest: "SW",
  west: "W",
  northwest: "NW",
  center: "CENTER"
};

const palaceReferences: Record<BaguaPalace, string> = {
  north: "适合结合动线、风流入方向与安静程度一起观察。",
  northeast: "适合查看角落空间、书房或储物边界的信息。",
  east: "可关注采光、活动频率与门窗分布。",
  southeast: "适合和风入方向、窗位与空气交换一起对照。",
  south: "适合对照采光、温度与主要活动区域。",
  southwest: "可重点观察卧室、安静空间和停留空间。",
  west: "可关注封闭感、窗位与通道关系。",
  northwest: "适合对照入口、过道与主要外部来向。",
  center: "适合观察动线、通达性和各房间连接关系。"
};

const annualStarReference: Record<number, { label: string; meaning: string }> = {
  1: { label: "一白贪狼", meaning: "常用于观察流动性、连通性与安静区域的关系。" },
  2: { label: "二黑巨门", meaning: "适合结合潮湿、停留区和空间使用频率一起参考。" },
  3: { label: "三碧禄存", meaning: "可对照通道、门位和高频活动区的信息。" },
  4: { label: "四绿文曲", meaning: "适合观察书房、学习区和通风采光的配合情况。" },
  5: { label: "五黄廉贞", meaning: "建议重点查看中心区、拥堵点和结构变化区域。" },
  6: { label: "六白武曲", meaning: "可结合开阔度、入口关系和主要活动区一起理解。" },
  7: { label: "七赤破军", meaning: "适合与门窗位置、边界感和外部来向一起分析。" },
  8: { label: "八白左辅", meaning: "可观察稳定停留空间、卧室与主要落座区。" },
  9: { label: "九紫右弼", meaning: "适合对照采光、显眼区域和情绪氛围相关空间。" }
};

function getAnnualStar(baseYear: number, gridX: number, gridY: number): number {
  return ((baseYear + gridX + gridY) % 9) + 1;
}

function getPalaceForPoint(layout: HouseLayout, x: number, y: number): BaguaPalace {
  const cellWidth = layout.bounds.width / 3;
  const cellDepth = layout.bounds.depth / 3;
  const gridX = Math.min(2, Math.floor(x / cellWidth));
  const gridY = Math.min(2, Math.floor(y / cellDepth));
  return palaceMatrix[gridY][gridX];
}

function buildRoomPalaceMap(layout: HouseLayout): RoomPalaceMapping[] {
  return layout.rooms.map((room) => {
    const center = roomCenter(room);
    const palace = getPalaceForPoint(layout, center.x, center.y);
    const annualStar = getAnnualStar(
      layout.metadata.renovationYear,
      Math.min(2, Math.floor(center.x / (layout.bounds.width / 3))),
      Math.min(2, Math.floor(center.y / (layout.bounds.depth / 3)))
    );
    return {
      roomId: room.id,
      roomName: room.name,
      palace,
      palaceLabel: palaceLabels[palace],
      annualStar
    };
  });
}

function buildBagua(layout: HouseLayout, roomPalaceMap: RoomPalaceMapping[]): BaguaSector[] {
  return palaceMatrix.flatMap((row, gridY) =>
    row.map((palace, gridX) => {
      const annualStar = getAnnualStar(layout.metadata.renovationYear, gridX, gridY);
      return {
        palace,
        label: palaceLabels[palace],
        gridX,
        gridY,
        roomIds: roomPalaceMap
          .filter((mapping) => mapping.palace === palace)
          .map((mapping) => mapping.roomId),
        reference: palaceReferences[palace],
        annualStar,
        annualStarLabel: annualStarReference[annualStar].label,
        annualStarMeaning: annualStarReference[annualStar].meaning,
        compassDirection: palaceDirections[palace]
      };
    })
  );
}

function roomByPurpose(layout: HouseLayout, purpose: Room["purpose"]) {
  return layout.rooms.find((room) => room.purpose === purpose);
}

function buildFindings(
  layout: HouseLayout,
  bagua: BaguaSector[],
  roomPalaceMap: RoomPalaceMapping[]
): FengshuiFinding[] {
  const findings: FengshuiFinding[] = [];
  const entry = roomByPurpose(layout, "entry");
  const living = roomByPurpose(layout, "living");
  const entryMapping = entry ? roomPalaceMap.find((item) => item.roomId === entry.id) : undefined;
  const livingMapping = living ? roomPalaceMap.find((item) => item.roomId === living.id) : undefined;

  findings.push({
    id: "orientation-summary",
    title: "朝向与门向信息",
    basis: `房屋朝向约 ${layout.orientation.facingDegrees}°（${layout.orientation.facingLabel}），入户门约 ${layout.orientation.frontDoorDegrees}°（${layout.orientation.frontDoorLabel}）。`,
    relatedRooms: entry ? [entry.id] : [],
    tone: "neutral",
    reference: "建议结合 3D 罗盘、九宫映射和门窗位置一起阅读，不单独解读吉凶。",
    relatedPalace: entryMapping?.palace
  });

  if (living && livingMapping) {
    findings.push({
      id: "living-palace-reference",
      title: "主要活动空间方位参考",
      basis: `${living.name} 当前中心点落在 ${livingMapping.palaceLabel}，对应年星 ${livingMapping.annualStar}。`,
      relatedRooms: [living.id],
      tone: "supportive",
      reference: "适合同时对照热力图和气流图，观察采光、温度、气流与房间用途的对应关系。",
      relatedPalace: livingMapping.palace
    });
  }

  const entrySector = entryMapping ? bagua.find((sector) => sector.palace === entryMapping.palace) : undefined;
  if (entrySector) {
    findings.push({
      id: "entry-sector-reference",
      title: "入户对应宫位信息",
      basis: `入户空间当前映射到 ${entrySector.label}，年星为 ${entrySector.annualStarLabel}。`,
      relatedRooms: entry ? [entry.id] : [],
      tone: "attention",
      reference: "这是帮助理解门向和空间位置关系的信息，不等同于直接结论。",
      relatedPalace: entrySector.palace
    });
  }

  const crossVentRooms = layout.rooms
    .filter(
      (room) =>
        layout.openings.filter(
          (opening) => opening.wallId.startsWith(room.id) && opening.type === "window"
        ).length >= 1
    )
    .map((room) => room.id);

  findings.push({
    id: "openings-reference",
    title: "门窗分布信息",
    basis: `当前共识别 ${layout.openings.length} 个门窗开口，其中 ${crossVentRooms.length} 个房间具备可观察的自然通风条件。`,
    relatedRooms: crossVentRooms,
    tone: "neutral",
    reference: "这是一条结构与环境信息，建议与气流方向、门向、房间用途一起综合分析。"
  });

  return findings;
}

export function analyzeFengshui(layout: HouseLayout): FengshuiAnalysis {
  const roomPalaceMap = buildRoomPalaceMap(layout);
  const bagua = buildBagua(layout, roomPalaceMap);
  return {
    summary: [
      "本模块提供方位、宫位、飞星和空间关系的参考信息。",
      "系统不会直接替用户给出好坏结论。",
      "请结合热力图、气流图、3D 罗盘和实际居住习惯综合判断。"
    ],
    compass: buildCompass(layout),
    bagua,
    findings: buildFindings(layout, bagua, roomPalaceMap),
    roomPalaceMap
  };
}
