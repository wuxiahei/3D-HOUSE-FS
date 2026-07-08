import type { BaguaPalace, FengshuiAnalysis, HouseLayout } from "@fengshui/core";
import { formatDirectionLabel, palaceToneMap } from "../../lib/editor";

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
    <div className="subpanel stack gap-md">
      <div className="subpanel-header">
        <h2>风水信息</h2>
        <span className="badge">功能 3</span>
      </div>

      <div className="info-card accent-soft">
        <strong>3D 罗盘已接入场景</strong>
        <p>
          中间的 Three.js 场景里已经叠加了 3D 罗盘。这里则负责把朝向、九宫、飞星和房间位置整理成方便阅读的信息。
        </p>
      </div>

      <div className="field-grid two-col">
        <div className="info-card">
          <strong>房屋朝向</strong>
          <p>{layout.orientation.facingDegrees}° / {formatDirectionLabel(layout.orientation.facingLabel)}</p>
        </div>
        <div className="info-card">
          <strong>入户门向</strong>
          <p>{layout.orientation.frontDoorDegrees}° / {formatDirectionLabel(layout.orientation.frontDoorLabel)}</p>
        </div>
      </div>

      {selectedMapping ? (
        <div className="info-card selected-palace-card">
          <strong>当前选中房间</strong>
          <p>
            {selectedMapping.roomName} 位于 {selectedMapping.palaceLabel}，对应年星 {selectedMapping.annualStar}。
          </p>
        </div>
      ) : null}

      <div className="bagua-grid">
        {fengshui.bagua.map((sector) => {
          const isActive = sector.palace === activePalace;
          return (
            <button
              key={`${sector.gridX}-${sector.gridY}`}
              type="button"
              className={`bagua-cell ${isActive ? "active" : ""} ${palaceToneMap[sector.palace]}`}
              onClick={() => sector.roomIds[0] && onSelectRoom(sector.roomIds[0])}
            >
              <strong>{sector.label}</strong>
              <span>{sector.compassDirection === "CENTER" ? "中宫" : formatDirectionLabel(sector.compassDirection)}</span>
              <span>{sector.annualStarLabel}</span>
              <p>{sector.annualStarMeaning}</p>
              <small>
                {sector.roomIds.length === 0
                  ? "当前没有房间中心落在这里"
                  : `点击定位 ${sector.roomIds.length} 个房间`}
              </small>
            </button>
          );
        })}
      </div>

      <div className="info-card">
        <strong>房间与宫位对应</strong>
        <div className="mapping-list">
          {fengshui.roomPalaceMap.map((mapping) => (
            <button
              key={mapping.roomId}
              type="button"
              className={`mapping-card ${mapping.roomId === selectedRoomId ? "active" : ""}`}
              onClick={() => onSelectRoom(mapping.roomId)}
            >
              <strong>{mapping.roomName}</strong>
              <span>{mapping.palaceLabel}</span>
              <small>年星 {mapping.annualStar}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="info-card accent-soft">
        <strong>阅读原则</strong>
        <ul className="plain-list">
          {fengshui.summary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="stack gap-sm">
        {fengshui.findings.map((finding) => (
          <div key={finding.id} className={`finding-card tone-${finding.tone}`}>
            <strong>{finding.title}</strong>
            <p>{finding.basis}</p>
            <p className="muted">{finding.reference}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
