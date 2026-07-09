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
  north: "宜结合动线、风口和安静程度观察，尤其关注水汽、入口与停留时间。",
  northeast: "宜关注角落空间、书房、储物边界和低频使用区域的清爽度。",
  east: "宜对照采光、活动频率、开窗位置和早间使用节奏。",
  southeast: "宜与自然风进入方向、窗位和空气交换效率一起判断。",
  south: "宜对照日照、温度峰值、客厅或显眼活动区的舒适度。",
  southwest: "宜重点观察卧室、安静停留区和长期休息空间的稳定感。",
  west: "宜关注封闭感、夕晒、窗位与通道转折关系。",
  northwest: "宜对照入口、过道、外部来向和主要交通节点。",
  center: "宜观察动线、通达性、拥堵点和各房间之间的连接关系。"
};

const annualStarReference: Record<number, { label: string; meaning: string }> = {
  1: { label: "一白贪狼", meaning: "常用于观察流动性、连通性与安静区域之间的关系。" },
  2: { label: "二黑巨门", meaning: "适合结合潮湿、停留区和空间使用频率一起参考。" },
  3: { label: "三碧禄存", meaning: "可对照通道、门位和高频活动区的信息。" },
  4: { label: "四绿文曲", meaning: "适合观察书房、学习区、采光和通风的配合。" },
  5: { label: "五黄廉贞", meaning: "建议重点查看中心区、拥堵点和结构变化区域。" },
  6: { label: "六白武曲", meaning: "可结合开阔度、入口关系和主要活动区理解。" },
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
    const gridX = Math.min(2, Math.floor(center.x / (layout.bounds.width / 3)));
    const gridY = Math.min(2, Math.floor(center.y / (layout.bounds.depth / 3)));
    const palace = getPalaceForPoint(layout, center.x, center.y);
    const annualStar = getAnnualStar(layout.metadata.renovationYear, gridX, gridY);
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

function roomOpeningCount(layout: HouseLayout, roomId: string, type?: "door" | "window") {
  return layout.openings.filter((opening) => {
    const sameRoom = opening.wallId.startsWith(roomId);
    return sameRoom && (!type || opening.type === type);
  }).length;
}

function buildFindings(
  layout: HouseLayout,
  bagua: BaguaSector[],
  roomPalaceMap: RoomPalaceMapping[]
): FengshuiFinding[] {
  const findings: FengshuiFinding[] = [];
  const entry = roomByPurpose(layout, "entry");
  const living = roomByPurpose(layout, "living");
  const kitchen = roomByPurpose(layout, "kitchen");
  const entryMapping = entry ? roomPalaceMap.find((item) => item.roomId === entry.id) : undefined;
  const livingMapping = living ? roomPalaceMap.find((item) => item.roomId === living.id) : undefined;
  const kitchenMapping = kitchen ? roomPalaceMap.find((item) => item.roomId === kitchen.id) : undefined;

  findings.push({
    id: "orientation-summary",
    title: "坐向与门向基准",
    basis: `房屋朝向 ${layout.orientation.facingDegrees} 度，入户门向 ${layout.orientation.frontDoorDegrees} 度。`,
    relatedRooms: entry ? [entry.id] : [],
    tone: "neutral",
    reference: "建议把罗盘、九宫、门窗位置和实际动线放在同一张图上阅读，避免只凭单项信息下判断。",
    relatedPalace: entryMapping?.palace
  });

  if (living && livingMapping) {
    findings.push({
      id: "living-palace-reference",
      title: "主要活动空间",
      basis: `${living.name} 的中心落在 ${livingMapping.palaceLabel}，对应年星 ${livingMapping.annualStar}。`,
      relatedRooms: [living.id],
      tone: "supportive",
      reference: "此处适合交叉查看热力图与气流图，确认温度、空气交换和高频停留行为是否一致。",
      relatedPalace: livingMapping.palace
    });
  }

  if (entryMapping) {
    const entrySector = bagua.find((sector) => sector.palace === entryMapping.palace);
    if (entrySector) {
      findings.push({
        id: "entry-sector-reference",
        title: "入户宫位",
        basis: `入户空间映射到 ${entrySector.label}，年星为 ${entrySector.annualStarLabel}。`,
        relatedRooms: entry ? [entry.id] : [],
        tone: "attention",
        reference: "这是理解门向、过渡空间和外部来向关系的参考，不等同于直接给出吉凶结论。",
        relatedPalace: entrySector.palace
      });
    }
  }

  if (kitchen && kitchenMapping) {
    findings.push({
      id: "kitchen-thermal-reference",
      title: "厨房热源提示",
      basis: `${kitchen.name} 位于 ${kitchenMapping.palaceLabel}，模型会把厨房作为热源参与热扩散求解。`,
      relatedRooms: [kitchen.id],
      tone: "attention",
      reference: "如果厨房临近卧室或中宫，建议重点查看热力层和开口通风是否能带走局部热量。",
      relatedPalace: kitchenMapping.palace
    });
  }

  const crossVentRooms = layout.rooms
    .filter((room) => roomOpeningCount(layout, room.id, "window") >= 1 && roomOpeningCount(layout, room.id) >= 2)
    .map((room) => room.id);

  findings.push({
    id: "openings-reference",
    title: "门窗与通风条件",
    basis: `当前识别 ${layout.openings.length} 个门窗开口，其中 ${crossVentRooms.length} 个房间具备可进一步观察的对流条件。`,
    relatedRooms: crossVentRooms,
    tone: "neutral",
    reference: "建议把这条信息与气流粒子方向、风速输入和房间用途一起综合分析。"
  });

  return findings;
}

export function analyzeFengshui(layout: HouseLayout): FengshuiAnalysis {
  const roomPalaceMap = buildRoomPalaceMap(layout);
  const bagua = buildBagua(layout, roomPalaceMap);
  return {
    summary: [
      "本模块提供方位、宫位、年星和空间关系的参考信息。",
      "系统不会替用户直接给出好坏结论，而是把依据拆开呈现。",
      "请结合热力图、气流图、3D 罗盘和实际居住习惯综合判断。"
    ],
    compass: buildCompass(layout),
    bagua,
    findings: buildFindings(layout, bagua, roomPalaceMap),
    roomPalaceMap
  };
}
