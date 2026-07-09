import type { Room } from "@fengshui/core";
import type { FlowField, RoomFlowSummary } from "@fengshui/simulation";
import { formatDirectionLabel } from "../../lib/editor";

export function AirflowPanel({
  airflow,
  rooms,
  field
}: {
  airflow: RoomFlowSummary[];
  rooms: Room[];
  field?: FlowField;
}) {
  const strongest = [...airflow].sort((a, b) => b.peakSpeed - a.peakSpeed)[0];
  const quietest = [...airflow].sort((a, b) => a.averageSpeed - b.averageSpeed)[0];
  const strongestRoom = rooms.find((room) => room.id === strongest?.roomId);
  const quietestRoom = rooms.find((room) => room.id === quietest?.roomId);

  return (
    <section className="dock-panel">
      <div className="dock-title">
        <strong>气流场</strong>
        <span>{field ? `${field.streamlines.length} 条流线 / 峰值 ${field.speedMax.toFixed(2)}` : "房间摘要"}</span>
      </div>
      {strongest ? (
        <div className="dock-metrics">
          <span>主流向 {formatDirectionLabel(strongest.fromDirection)} 到 {formatDirectionLabel(strongest.toDirection)}</span>
          <span>最高房间 {strongestRoom?.name ?? strongest.roomId}</span>
          <span>平均 {strongest.averageSpeed.toFixed(3)}</span>
          <span>峰值 {strongest.peakSpeed.toFixed(3)}</span>
        </div>
      ) : null}
      <div className="flow-room-list">
        {airflow.map((flow) => {
          const room = rooms.find((item) => item.id === flow.roomId);
          return (
            <div key={flow.id} className="flow-room-row">
              <span>{room?.name ?? flow.roomId}</span>
              <div className="flow-room-track">
                <i style={{ width: `${Math.max(8, flow.strength * 100)}%` }} />
              </div>
              <strong>{Math.round(flow.strength * 100)}%</strong>
              <small>{flow.openingCount} 开口</small>
            </div>
          );
        })}
      </div>
      {quietest ? (
        <p className="dock-note">
          气流由门窗迎背风压差和设备送风共同求解，墙体边界按不可穿透处理；当前相对静风区为 {quietestRoom?.name ?? quietest.roomId}。
        </p>
      ) : null}
    </section>
  );
}
