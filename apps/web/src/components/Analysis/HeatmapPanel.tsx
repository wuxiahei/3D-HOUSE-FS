import type { HeatmapCell, SensorPoint } from "@fengshui/core";

function cellColor(intensity: number) {
  return `linear-gradient(135deg, hsl(${205 - intensity * 160} 80% 66%), hsl(${35 + intensity * 25} 88% 62%))`;
}

export function HeatmapPanel({
  heatmap,
  sensors
}: {
  heatmap: HeatmapCell[];
  sensors: SensorPoint[];
}) {
  const topCells = [...heatmap].sort((a, b) => b.temperature - a.temperature).slice(0, 3);

  return (
    <div className="subpanel stack gap-md">
      <div className="subpanel-header">
        <h2>热力图</h2>
        <span className="badge">功能 1</span>
      </div>
      <div className="mini-heatmap">
        {heatmap.slice(0, 18).map((cell) => (
          <div key={cell.id} className="mini-heat-cell" style={{ background: cellColor(cell.intensity) }}>
            <span>{cell.temperature.toFixed(1)}°</span>
          </div>
        ))}
      </div>
      <div className="info-card">
        <strong>热点区域参考</strong>
        <ul className="plain-list">
          {topCells.map((cell) => (
            <li key={cell.id}>
              {cell.temperature.toFixed(1)}°C，位置约 ({cell.x.toFixed(1)}, {cell.y.toFixed(1)})
            </li>
          ))}
        </ul>
      </div>
      <div className="info-card accent-soft">
        <strong>温度输入点</strong>
        <ul className="plain-list">
          {sensors.map((sensor) => (
            <li key={sensor.id}>
              {sensor.label}：{sensor.temperature.toFixed(1)}°C
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
