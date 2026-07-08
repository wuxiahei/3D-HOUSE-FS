import type { HeatmapCell, SensorPoint } from "@fengshui/core";
import type { HeatField } from "@fengshui/simulation";

export function HeatmapPanel({
  heatmap,
  sensors,
  field
}: {
  heatmap: HeatmapCell[];
  sensors: SensorPoint[];
  field?: HeatField;
}) {
  const hottest = [...heatmap].sort((a, b) => b.temperature - a.temperature)[0];
  const coolest = [...heatmap].sort((a, b) => a.temperature - b.temperature)[0];
  const min = field?.min ?? coolest?.temperature ?? 0;
  const max = field?.max ?? hottest?.temperature ?? 0;

  return (
    <section className="dock-panel">
      <div className="dock-title">
        <strong>Thermal field</strong>
        <span>{field ? `${field.grid.cols}x${field.grid.rows}` : "summary"}</span>
      </div>
      <div className="dock-metrics">
        <span>High {max.toFixed(1)}C</span>
        <span>Low {min.toFixed(1)}C</span>
        <span>{sensors.length} sensors</span>
      </div>
      <div className="heat-strip">
        {heatmap.map((cell) => (
          <span
            key={cell.id}
            title={`${cell.roomId ?? cell.id}: ${cell.temperature.toFixed(1)}C`}
            style={{ background: `hsl(${205 - cell.intensity * 175} 82% 58%)` }}
          />
        ))}
      </div>
    </section>
  );
}
