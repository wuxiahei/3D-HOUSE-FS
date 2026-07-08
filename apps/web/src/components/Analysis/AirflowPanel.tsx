import type { AirflowVector, Room } from "@fengshui/core";
import type { FlowField } from "@fengshui/simulation";
import { formatDirectionLabel } from "../../lib/editor";

export function AirflowPanel({
  airflow,
  rooms,
  field
}: {
  airflow: AirflowVector[];
  rooms: Room[];
  field?: FlowField;
}) {
  const strongest = [...airflow].sort((a, b) => b.strength - a.strength)[0];
  const strongestRoom = rooms.find((room) => room.id === strongest?.roomId);

  return (
    <section className="dock-panel">
      <div className="dock-title">
        <strong>Airflow field</strong>
        <span>{field ? `${field.streamlines.length} streamlines` : "summary"}</span>
      </div>
      {strongest ? (
        <div className="dock-metrics">
          <span>{strongestRoom?.name ?? strongest.roomId}</span>
          <span>
            {formatDirectionLabel(strongest.fromDirection)} to {formatDirectionLabel(strongest.toDirection)}
          </span>
          <span>{Math.round(strongest.strength * 100)}%</span>
          {field ? <span>Peak {field.speedMax.toFixed(2)}</span> : null}
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
