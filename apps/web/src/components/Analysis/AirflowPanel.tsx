import type { AirflowVector, Room } from "@fengshui/core";
import { formatDirectionLabel } from "../../lib/editor";

export function AirflowPanel({
  airflow,
  rooms
}: {
  airflow: AirflowVector[];
  rooms: Room[];
}) {
  return (
    <div className="subpanel stack gap-md">
      <div className="subpanel-header">
        <h2>房间气流图</h2>
        <span className="badge">功能 2</span>
      </div>
      <div className="stack gap-sm">
        {airflow.map((flow) => {
          const room = rooms.find((item) => item.id === flow.roomId);
          return (
            <div key={flow.id} className="flow-card">
              <div className="subpanel-header">
                <strong>{room?.name ?? flow.roomId}</strong>
                <span className="badge">{Math.round(flow.strength * 100)}%</span>
              </div>
              <div className="flow-arrow">
                <span>{formatDirectionLabel(flow.fromDirection)}</span>
                <div className="flow-bar">
                  <div className="flow-bar-fill" style={{ width: `${Math.round(flow.strength * 100)}%` }} />
                </div>
                <span>{formatDirectionLabel(flow.toDirection)}</span>
              </div>
              <p className="muted">{flow.explanation}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
