"use client";

import type { SensorPoint } from "@fengshui/core";
import type { HeatField, RoomHeatSummary } from "@fengshui/simulation";
import { useEffect, useState } from "react";

function formatSigned(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

const previewStops = [
  { at: 0, color: [22, 61, 255] },
  { at: 0.22, color: [24, 167, 255] },
  { at: 0.5, color: [238, 246, 255] },
  { at: 0.74, color: [255, 138, 91] },
  { at: 1, color: [215, 25, 28] }
] as const;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function colorFromPreviewRamp(value: number) {
  const clamped = Math.min(1, Math.max(0, value));
  const upperIndex = previewStops.findIndex((stop) => stop.at >= clamped);
  const upper = previewStops[Math.max(upperIndex, 1)];
  const lower = previewStops[Math.max(0, previewStops.indexOf(upper) - 1)];
  const span = Math.max(0.0001, upper.at - lower.at);
  const t = (clamped - lower.at) / span;

  return [
    Math.round(lerp(lower.color[0], upper.color[0], t)),
    Math.round(lerp(lower.color[1], upper.color[1], t)),
    Math.round(lerp(lower.color[2], upper.color[2], t))
  ] as const;
}

function buildPreviewDataUrl(field?: HeatField) {
  if (!field || typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = field.grid.cols;
  canvas.height = field.grid.rows;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const image = context.createImageData(field.grid.cols, field.grid.rows);
  const span = Math.max(0.001, field.max - field.min);

  for (let row = 0; row < field.grid.rows; row += 1) {
    for (let column = 0; column < field.grid.cols; column += 1) {
      const index = row * field.grid.cols + column;
      const pixelIndex = (row * field.grid.cols + column) * 4;

      if (!field.grid.interior[index]) {
        image.data[pixelIndex] = 12;
        image.data[pixelIndex + 1] = 18;
        image.data[pixelIndex + 2] = 22;
        image.data[pixelIndex + 3] = 0;
        continue;
      }

      const normalized = (field.temperature[index] - field.min) / span;
      const [r, g, b] = colorFromPreviewRamp(normalized);
      image.data[pixelIndex] = r;
      image.data[pixelIndex + 1] = g;
      image.data[pixelIndex + 2] = b;
      image.data[pixelIndex + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

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
  const diagnostics = field?.diagnostics;
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  useEffect(() => {
    setPreviewSrc(buildPreviewDataUrl(field));
  }, [field]);

  return (
    <section className="dock-panel">
      <div className="dock-title">
        <strong>热力场</strong>
        <span>{field ? `${field.grid.cols} x ${field.grid.rows} 连续网格` : "房间摘要"}</span>
      </div>
      <div className="dock-metrics">
        <span>最高 {max.toFixed(1)} C</span>
        <span>最低 {min.toFixed(1)} C</span>
        <span>温差 {spread.toFixed(1)} C</span>
        <span>{sensors.length} 个传感点</span>
      </div>
      {field && previewSrc ? (
        <div className="heat-preview-card">
          <div className="heat-preview-header">
            <strong>连续温度分布预览</strong>
            <span>蓝色偏冷，红色偏热</span>
          </div>
          <div className="heat-preview-frame" style={{ aspectRatio: `${field.grid.cols} / ${field.grid.rows}` }}>
            <img src={previewSrc} alt="连续热力图预览" className="heat-preview-image" />
          </div>
          <div className="heat-preview-scale">
            <span>{min.toFixed(1)} C</span>
            <i />
            <span>{((min + max) / 2).toFixed(1)} C</span>
            <i />
            <span>{max.toFixed(1)} C</span>
          </div>
        </div>
      ) : null}
      {diagnostics ? (
        <div className="diagnostic-grid">
          <span className="diagnostic-chip">
            <small>求解步数</small>
            <strong>{diagnostics.iterations}</strong>
          </span>
          <span className="diagnostic-chip">
            <small>收敛残差</small>
            <strong>{diagnostics.residual.toFixed(4)}</strong>
          </span>
          <span className="diagnostic-chip">
            <small>平均温度</small>
            <strong>{diagnostics.meanTemperature.toFixed(1)} C</strong>
          </span>
          <span className="diagnostic-chip">
            <small>平均热梯度</small>
            <strong>{diagnostics.meanGradient.toFixed(3)} C/m</strong>
          </span>
          <span className="diagnostic-chip">
            <small>峰值热梯度</small>
            <strong>{diagnostics.peakGradient.toFixed(3)} C/m</strong>
          </span>
          <span className="diagnostic-chip">
            <small>垂直分层</small>
            <strong>{formatSigned(diagnostics.verticalStratification)} C</strong>
          </span>
          <span className="diagnostic-chip">
            <small>温度层</small>
            <strong>{diagnostics.layerCount}</strong>
          </span>
          <span className="diagnostic-chip">
            <small>气流耦合</small>
            <strong>{diagnostics.coupledAirflow ? "已启用" : "未启用"}</strong>
          </span>
        </div>
      ) : null}
      <div className="heat-room-list">
        {heatmap.map((cell) => (
          <div key={cell.id} className="heat-room-row">
            <span>{cell.roomName ?? cell.roomId}</span>
            <div className="heat-room-track">
              <i
                style={{
                  width: `${Math.max(8, cell.intensity * 100)}%`,
                  background: `linear-gradient(90deg, #1c5dff, #f2f7ff ${Math.max(
                    22,
                    Math.min(78, cell.intensity * 100)
                  )}%, #d7191c)`
                }}
              />
            </div>
            <strong>{cell.temperature.toFixed(1)} C</strong>
            <small>
              {cell.minTemperature.toFixed(1)} - {cell.maxTemperature.toFixed(1)}
            </small>
          </div>
        ))}
      </div>
      {hottest && coolest ? (
        <p className="dock-note">
          连续热场由传感点、朝向日照、墙体导热、门窗连通、空调和厨房热源共同求解；当前最热为 {hottest.roomName ?? hottest.roomId}，
          最冷为 {coolest.roomName ?? coolest.roomId}。
        </p>
      ) : null}
    </section>
  );
}
