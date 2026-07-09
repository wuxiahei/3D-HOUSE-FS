import type { BaguaPalace, BaguaSector, FengshuiAnalysis, HouseLayout } from "@fengshui/core";
import { formatDirectionLabel } from "../../lib/editor";

function selectedSectorFor({
  fengshui,
  selectedRoomId,
  activePalace
}: {
  fengshui: FengshuiAnalysis;
  selectedRoomId: string | null;
  activePalace: BaguaPalace | null;
}): BaguaSector {
  const selectedMapping = selectedRoomId
    ? fengshui.roomPalaceMap.find((item) => item.roomId === selectedRoomId)
    : null;
  const palace = activePalace ?? selectedMapping?.palace ?? "center";
  return fengshui.bagua.find((sector) => sector.palace === palace) ?? fengshui.bagua[4];
}

function roomsInSector(fengshui: FengshuiAnalysis, sector: BaguaSector) {
  return fengshui.roomPalaceMap.filter((mapping) => mapping.palace === sector.palace);
}

function findingToneLabel(tone: string) {
  if (tone === "attention") {
    return "重点";
  }
  if (tone === "supportive") {
    return "匹配";
  }
  return "参考";
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
  const activeSector = selectedSectorFor({ fengshui, selectedRoomId, activePalace });
  const sectorRooms = roomsInSector(fengshui, activeSector);
  const relatedFindings = fengshui.findings.filter(
    (finding) =>
      finding.relatedPalace === activeSector.palace ||
      finding.relatedRooms.some((roomId) => activeSector.roomIds.includes(roomId))
  );
  const deviceCount = (layout.devices ?? []).length;
  const acCount = (layout.devices ?? []).filter((device) => device.type === "ac").length;
  const heatSourceCount = (layout.devices ?? []).filter((device) => device.type === "kitchen-heat").length;

  return (
    <section className="dock-panel fengshui-dock">
      <div className="dock-title">
        <strong>罗盘风水盘</strong>
        <span>方位依据，不作吉凶断语</span>
      </div>

      <div className="fengshui-summary-grid">
        <div>
          <span>房屋朝向</span>
          <strong>
            {layout.orientation.facingDegrees} 度 / {formatDirectionLabel(layout.orientation.facingLabel)}
          </strong>
        </div>
        <div>
          <span>入户门向</span>
          <strong>
            {layout.orientation.frontDoorDegrees} 度 / {formatDirectionLabel(layout.orientation.frontDoorLabel)}
          </strong>
        </div>
        <div>
          <span>环境开口</span>
          <strong>{layout.openings.length} 个门窗</strong>
        </div>
        <div>
          <span>冷热设备</span>
          <strong>
            {deviceCount} 个设备 / {acCount} 空调 / {heatSourceCount} 热源
          </strong>
        </div>
      </div>

      <div className="fengshui-focus">
        <div>
          <span className="eyebrow">当前宫位</span>
          <strong>{activeSector.label}</strong>
          <p>
            {activeSector.annualStarLabel}：{activeSector.annualStarMeaning}
          </p>
        </div>
        <div className="fengshui-room-stack">
          <span className="eyebrow">关联房间</span>
          {sectorRooms.length > 0 ? (
            sectorRooms.map((mapping) => (
              <button key={mapping.roomId} type="button" onClick={() => onSelectRoom(mapping.roomId)}>
                {mapping.roomName}
              </button>
            ))
          ) : (
            <span className="muted">该宫位暂无房间中心点落入</span>
          )}
        </div>
      </div>

      {selectedMapping ? (
        <div className="selected-summary">
          当前选中 {selectedMapping.roomName}，落在 {selectedMapping.palaceLabel}，年星 {selectedMapping.annualStar}。
        </div>
      ) : null}

      <div className="fengshui-findings">
        {relatedFindings.length > 0 ? (
          relatedFindings.slice(0, 3).map((finding) => (
            <article key={finding.id} className={`finding-card tone-${finding.tone}`}>
              <span>{findingToneLabel(finding.tone)}</span>
              <strong>{finding.title}</strong>
              <p>{finding.basis}</p>
              <p>{finding.reference}</p>
            </article>
          ))
        ) : (
          <article className="finding-card tone-neutral">
            <span>参考</span>
            <strong>{activeSector.label}</strong>
            <p>{activeSector.reference}</p>
          </article>
        )}
      </div>

      <div className="compact-bagua-grid">
        {fengshui.bagua.map((sector) => {
          const roomCount = sector.roomIds.length;
          return (
            <button
              key={sector.palace}
              type="button"
              className={sector.palace === activeSector.palace ? "active" : ""}
              onClick={() => sector.roomIds[0] && onSelectRoom(sector.roomIds[0])}
              title={sector.reference}
            >
              <strong>{sector.label.replace("方", "")}</strong>
              <span>{sector.annualStarLabel}</span>
              <small>{roomCount > 0 ? `${roomCount} 房间` : "无房间"}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
