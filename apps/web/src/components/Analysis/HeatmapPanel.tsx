import type { HeatmapCell, SensorPoint } from "@fengshui/core";

export function HeatmapPanel({
  heatmap,
  sensors
}: {
  heatmap: HeatmapCell[];
  sensors: SensorPoint[];
}) {
  const hottest = [...heatmap].sort((a, b) => b.temperature - a.temperature)[0];
  const coolest = [...heatmap].sort((a, b) => a.temperature - b.temperature)[0];

  return (
    <section className="dock-panel">
      <div className="dock-title">
        <strong>热力图层</strong>
        <span>已贴合 3D 地面</span>
      </div>
      <div className="dock-metrics">
        <span>最高 {hottest?.temperature.toFixed(1)}°C</span>
        <span>最低 {coolest?.temperature.toFixed(1)}°C</span>
        <span>{sensors.length} 个温度点</span>
      </div>
      <div className="heat-strip">
        {heatmap.slice(0, 12).map((cell) => (
          <span
            key={cell.id}
            style={{ background: `hsl(${205 - cell.intensity * 175} 82% 58%)` }}
          />
        ))}
      </div>
    </section>
  );
}
