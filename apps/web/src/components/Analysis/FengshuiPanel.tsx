import type { BaguaPalace, FengshuiAnalysis, HouseLayout } from "@fengshui/core";
import { formatDirectionLabel } from "../../lib/editor";

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

  return (
    <section className="dock-panel fengshui-dock">
      <div className="dock-title">
        <strong>罗盘与九宫</strong>
        <span>3D 场景内显示</span>
      </div>
      <div className="dock-metrics">
        <span>朝向 {layout.orientation.facingDegrees}° / {formatDirectionLabel(layout.orientation.facingLabel)}</span>
        <span>门向 {layout.orientation.frontDoorDegrees}° / {formatDirectionLabel(layout.orientation.frontDoorLabel)}</span>
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
