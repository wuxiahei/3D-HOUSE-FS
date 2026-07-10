"use client";

import type { FlowField, HeatField } from "@fengshui/simulation";
import { useState } from "react";
import type { AnalysisControls, AnalysisLayer, WorkspaceMode } from "../AppShell";

interface ToggleChip {
  key: keyof AnalysisControls;
  label: string;
}

function ChipGroup({
  chips,
  controls,
  onUpdate
}: {
  chips: ToggleChip[];
  controls: AnalysisControls;
  onUpdate: <K extends keyof AnalysisControls>(key: K, value: AnalysisControls[K]) => void;
}) {
  return (
    <div className="chip-toggle-group" role="group">
      {chips.map((chip) => {
        const active = Boolean(controls[chip.key]);
        return (
          <button
            key={String(chip.key)}
            type="button"
            className={`chip-toggle ${active ? "active" : ""}`}
            aria-pressed={active}
            onClick={() => onUpdate(chip.key, !active as AnalysisControls[typeof chip.key])}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

const HEAT_CHIPS: ToggleChip[] = [
  { key: "showHeatLayers", label: "3D 温度层" },
  { key: "showHeatContours", label: "等温线" },
  { key: "showHeatSlices", label: "剖切面" },
  { key: "showHeatFlux", label: "热通量线" },
  { key: "showHeatPlumes", label: "冷热羽流" }
];

const AIR_CHIPS: ToggleChip[] = [
  { key: "showAirPressure", label: "压力底图" },
  { key: "showAirPathlines", label: "路径线" },
  { key: "showAirGlyphs", label: "速度矢量" },
  { key: "showAirParticles", label: "粒子场" },
  { key: "animateAirflow", label: "动画" },
  { key: "showAirDeadZones", label: "死角区" }
];

export function AnalysisControlsPanel({
  workspaceMode,
  activeAnalysis,
  controls,
  onUpdate,
  heatField,
  flowField
}: {
  workspaceMode: WorkspaceMode;
  activeAnalysis: AnalysisLayer;
  controls: AnalysisControls;
  onUpdate: <K extends keyof AnalysisControls>(key: K, value: AnalysisControls[K]) => void;
  heatField: HeatField;
  flowField: FlowField;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const midTemp = (heatField.min + heatField.max) / 2;

  return (
    <div className="inspector-section analysis-controls-panel">
      {workspaceMode === "analysis" && activeAnalysis === "heat" ? (
        <>
          <div className="section-title">
            <h3>热力图层</h3>
            <span>温度场显示项</span>
          </div>
          <ChipGroup chips={HEAT_CHIPS} controls={controls} onUpdate={onUpdate} />
          <div className="legend-scale heat-scale">
            <div className="legend-bar heat-legend" aria-hidden="true" />
            <div className="legend-readout">
              <span>{heatField.min.toFixed(1)}°C</span>
              <span>{midTemp.toFixed(1)}°C</span>
              <span>{heatField.max.toFixed(1)}°C</span>
            </div>
          </div>
          {controls.showHeatSlices ? (
            <div className="control-subgroup">
              <label className="range-field">
                <span>剖面方向</span>
                <select
                  value={controls.heatSliceMode}
                  onChange={(event) => onUpdate("heatSliceMode", event.target.value as AnalysisControls["heatSliceMode"])}
                >
                  <option value="both">双向</option>
                  <option value="x">横剖</option>
                  <option value="y">纵剖</option>
                </select>
              </label>
              <label className="range-field">
                <span>横剖位置</span>
                <input type="range" min={0.08} max={0.92} step={0.02} value={controls.heatSliceX} onChange={(event) => onUpdate("heatSliceX", Number(event.target.value))} />
              </label>
              <label className="range-field">
                <span>纵剖位置</span>
                <input type="range" min={0.08} max={0.92} step={0.02} value={controls.heatSliceY} onChange={(event) => onUpdate("heatSliceY", Number(event.target.value))} />
              </label>
            </div>
          ) : null}
        </>
      ) : null}

      {workspaceMode === "analysis" && activeAnalysis === "airflow" ? (
        <>
          <div className="section-title">
            <h3>气流图层</h3>
            <span>{flowField.streamlines.length} 条路径 / {flowField.seedPoints.length} 个种子</span>
          </div>
          <ChipGroup chips={AIR_CHIPS} controls={controls} onUpdate={onUpdate} />
          <div className="legend-bar flow-legend" aria-hidden="true" />
          <button type="button" className={`advanced-toggle ${advancedOpen ? "open" : ""}`} aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((current) => !current)}>
            高级参数 {advancedOpen ? "▾" : "▸"}
          </button>
          {advancedOpen ? (
            <div className="control-subgroup">
              <label className="range-field">
                <span>粒子密度</span>
                <input type="range" min={0.15} max={1} step={0.05} value={controls.airflowParticleDensity} onChange={(event) => onUpdate("airflowParticleDensity", Number(event.target.value))} />
              </label>
              <label className="range-field">
                <span>流速显示</span>
                <input type="range" min={0.4} max={2.2} step={0.1} value={controls.airflowParticleSpeed} onChange={(event) => onUpdate("airflowParticleSpeed", Number(event.target.value))} />
              </label>
              <label className="range-field">
                <span>死角阈值</span>
                <input type="range" min={0.06} max={0.32} step={0.02} value={controls.airDeadZoneThreshold} onChange={(event) => onUpdate("airDeadZoneThreshold", Number(event.target.value))} />
              </label>
            </div>
          ) : null}
        </>
      ) : null}

      {workspaceMode === "analysis" && activeAnalysis === "fengshui" ? (
        <>
          <div className="section-title">
            <h3>罗盘风水</h3>
            <span>罗盘显示模式</span>
          </div>
          <label className="range-field">
            <span>罗盘模式</span>
            <select value={controls.compassMode} onChange={(event) => onUpdate("compassMode", event.target.value as AnalysisControls["compassMode"])}>
              <option value="simple">简洁</option>
              <option value="professional">专业</option>
            </select>
          </label>
          <div className="legend-note">简洁模式保留方向和双针；专业模式显示 24 山、八卦、九星和基准线。</div>
        </>
      ) : null}

      <div className="control-subgroup view-controls">
        <div className="eyebrow">视图</div>
        <label className="toggle-field">
          <input type="checkbox" checked={controls.showRoof} onChange={(event) => onUpdate("showRoof", event.target.checked)} />
          <span>屋顶</span>
        </label>
        <label className="range-field">
          <span>结构透明度</span>
          <input type="range" min={0.18} max={0.92} step={0.02} value={controls.structureOpacity} onChange={(event) => onUpdate("structureOpacity", Number(event.target.value))} />
        </label>
      </div>
    </div>
  );
}
