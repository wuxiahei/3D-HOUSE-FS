import type { SensorPoint } from "@fengshui/core";
import type { HeatField, RoomHeatSummary } from "@fengshui/simulation";

export function HeatmapPanel({
  heatmap,
  sensors,
  field
}: {
  heatmap: RoomHeatSummary[];
  sensors: SensorPoint[];
  field?: HeatField;
}) {
  const hottest = [...heatmap].sort((a, b) => b.temperature - a.temperature)[0];
  const coolest = [...heatmap].sort((a, b) => a.temperature - b.temperature)[0];
  const min = field?.min ?? coolest?.temperature ?? 0;
  const max = field?.max ?? hottest?.temperature ?? 0;
  const spread = Math.max(0, max - min);

  return (
    <section className="dock-panel">
      <div className="dock-title">
        <strong>热力场</strong>
        <span>{field ? `${field.grid.cols} x ${field.grid.rows} 网格` : "房间摘要"}</span>
      </div>
      <div className="dock-metrics">
        <span>最高 {max.toFixed(1)} C</span>
        <span>最低 {min.toFixed(1)} C</span>
        <span>温差 {spread.toFixed(1)} C</span>
        <span>{sensors.length} 个传感点</span>
      </div>
      <div className="heat-room-list">
        {heatmap.map((cell) => (
          <div key={cell.id} className="heat-room-row">
            <span>{cell.roomName ?? cell.roomId}</span>
            <div className="heat-room-track">
              <i style={{ width: `${Math.max(8, cell.intensity * 100)}%`, background: `hsl(${205 - cell.intensity * 175} 82% 58%)` }} />
            </div>
            <strong>{cell.temperature.toFixed(1)} C</strong>
          </div>
        ))}
      </div>
      {hottest && coolest ? (
        <p className="dock-note">
          热场由传感点、朝向日照、墙体导热、门窗连通、空调和厨房热源共同求解；当前最热为 {hottest.roomName ?? hottest.roomId}，
          最冷为 {coolest.roomName ?? coolest.roomId}。
        </p>
      ) : null}
    </section>
  );
}
