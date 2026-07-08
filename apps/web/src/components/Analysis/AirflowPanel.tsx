import type { AirflowVector, Room } from "@fengshui/core";
import { formatDirectionLabel } from "../../lib/editor";

export function AirflowPanel({
  airflow,
  rooms
}: {
  airflow: AirflowVector[];
  rooms: Room[];
}) {
  const strongest = [...airflow].sort((a, b) => b.strength - a.strength)[0];
  const strongestRoom = rooms.find((room) => room.id === strongest?.roomId);

  return (
    <section className="dock-panel">
      <div className="dock-title">
        <strong>气流图层</strong>
        <span>箭头已进入 3D 房间</span>
      </div>
      {strongest ? (
        <div className="dock-metrics">
          <span>{strongestRoom?.name ?? strongest.roomId}</span>
          <span>{formatDirectionLabel(strongest.fromDirection)} → {formatDirectionLabel(strongest.toDirection)}</span>
          <span>{Math.round(strongest.strength * 100)}%</span>
        </div>
      ) : null}
      <div className="flow-strip">
        {airflow.map((flow) => {
          const room = rooms.find((item) => item.id === flow.roomId);
          return (
            <span key={flow.id}>
              {room?.name ?? flow.roomId} {Math.round(flow.strength * 100)}%
            </span>
          );
        })}
      </div>
    </section>
  );
}
