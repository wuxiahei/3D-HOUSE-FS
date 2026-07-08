import type { BaguaPalace, FengshuiAnalysis, HouseLayout } from "@fengshui/core";
import { formatDirectionLabel } from "../../lib/editor";

function buildCompassReading({
  layout,
  fengshui,
  selectedRoomId,
  activePalace
}: {
  layout: HouseLayout;
  fengshui: FengshuiAnalysis;
  selectedRoomId: string | null;
  activePalace: BaguaPalace | null;
}) {
  const selectedMapping = selectedRoomId
    ? fengshui.roomPalaceMap.find((item) => item.roomId === selectedRoomId)
    : null;
  const activeSector = activePalace
    ? fengshui.bagua.find((sector) => sector.palace === activePalace)
    : selectedMapping
      ? fengshui.bagua.find((sector) => sector.palace === selectedMapping.palace)
      : null;
  const deviceText =
    (layout.devices ?? []).length > 0
      ? `已标注 ${(layout.devices ?? []).filter((device) => device.type === "ac").length} 个空调和 ${(layout.devices ?? []).filter((device) => device.type === "kitchen-heat").length} 个热源，可与热力图、气流图交叉观察。`
      : "尚未标注空调或热源，热力和气流判断会更依赖门窗与传感点。";

  return [
    `当前坐向约 ${layout.orientation.facingDegrees} 度（${formatDirectionLabel(layout.orientation.facingLabel)}），门向约 ${layout.orientation.frontDoorDegrees} 度（${formatDirectionLabel(layout.orientation.frontDoorLabel)}）。`,
    selectedMapping
      ? `${selectedMapping.roomName} 落在 ${selectedMapping.palaceLabel}，年星为 ${selectedMapping.annualStar}。`
      : "选择房间后，可以查看该房间落入的宫位、年星和对应参考信息。",
    activeSector
      ? `${activeSector.label}：${activeSector.annualStarLabel}。${activeSector.annualStarMeaning}`
      : "九宫区域会随选中房间同步高亮，便于把罗盘信息映射回 3D 户型。",
    `当前识别 ${layout.openings.length} 个门窗开口。${deviceText}`
  ];
}

export function FengshuiPanel({
  layout,
  fengshui,
  selectedRoomId,
  activePalace,
  onSelectRoom
}: {
  layout: HouseLayout;
  fengshui: FengshuiAnalysis;
  selectedRoomId: string | null;
  activePalace: BaguaPalace | null;
  onSelectRoom: (roomId: string) => void;
}) {
  const selectedMapping = selectedRoomId
    ? fengshui.roomPalaceMap.find((item) => item.roomId === selectedRoomId)
    : null;
  const reading = buildCompassReading({ layout, fengshui, selectedRoomId, activePalace });

  return (
    <section className="dock-panel fengshui-dock">
      <div className="dock-title">
        <strong>罗盘风水解读</strong>
        <span>只给信息依据，不直接下结论</span>
      </div>
      <div className="dock-metrics">
        <span>朝向 {layout.orientation.facingDegrees}度 / {formatDirectionLabel(layout.orientation.facingLabel)}</span>
        <span>门向 {layout.orientation.frontDoorDegrees}度 / {formatDirectionLabel(layout.orientation.frontDoorLabel)}</span>
      </div>
      <div className="compass-reading">
        {reading.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {selectedMapping ? (
        <div className="selected-summary">
          {selectedMapping.roomName} 位于 {selectedMapping.palaceLabel}，年星 {selectedMapping.annualStar}
        </div>
      ) : null}
      <div className="compact-bagua-grid">
        {fengshui.bagua.map((sector) => (
          <button
            key={sector.palace}
            type="button"
            className={sector.palace === activePalace ? "active" : ""}
            onClick={() => sector.roomIds[0] && onSelectRoom(sector.roomIds[0])}
          >
            <strong>{sector.label.replace("方", "")}</strong>
            <span>{sector.annualStarLabel}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
