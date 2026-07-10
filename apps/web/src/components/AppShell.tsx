"use client";

import {
  analyzeFengshui,
  clampDeviceToRoom,
  clampOpeningToWall,
  createDeviceForRoom,
  createOpeningForWall,
  createTemplateLayout,
  syncDerivedLayoutData,
  validateLayout
} from "@fengshui/core";
import type { ClimateDevice, HouseLayout, LayoutPoint, Opening, SensorPoint, TemplateId } from "@fengshui/core";
import type { ChangeEvent, CSSProperties, PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { requestBrowserAiDraft } from "../ai/browser-provider";
import {
  AI_SETTINGS_STORAGE_KEY,
  DEFAULT_BROWSER_AI_CONFIG,
  MAX_REFERENCE_IMAGES,
  normalizeAiProviderMode,
  normalizeBrowserAiConfig,
  type AiProviderMode,
  type BrowserAiConfig
} from "../lib/ai-config";
import type { EditorMode } from "../lib/editor";
import { AirflowPanel } from "./Analysis/AirflowPanel";
import { AnalysisControlsPanel } from "./Analysis/AnalysisControlsPanel";
import { FengshuiPanel } from "./Analysis/FengshuiPanel";
import { HeatmapPanel } from "./Analysis/HeatmapPanel";
import { ModelingPanel } from "./Analysis/ModelingPanel";
import { RenovationReportPanel } from "./Analysis/RenovationReportPanel";
import { LayoutEditor } from "./Editor/LayoutEditor";
import { SceneViewport } from "./Scene/SceneViewport";
import { LayoutPersistencePanel } from "./Templates/LayoutPersistencePanel";
import { TemplatePicker } from "./Templates/TemplatePicker";
import { useSimulation } from "../simulation/useSimulation";
import { SAVED_LAYOUT_STORAGE_KEY, stringifyLayout } from "../utils/serializers/layout-storage";

export interface SceneLayers {
  heat: boolean;
  airflow: boolean;
  fengshui: boolean;
  walls: boolean;
}

export type AnalysisLayer = "heat" | "airflow" | "fengshui";
export type WorkspaceMode = "modeling" | "analysis" | "renovation";

export interface AnalysisControls {
  showHeatLayers: boolean;
  showHeatContours: boolean;
  showHeatSlices: boolean;
  showHeatFlux: boolean;
  showHeatPlumes: boolean;
  heatSliceMode: "both" | "x" | "y";
  heatSliceX: number;
  heatSliceY: number;
  showAirPressure: boolean;
  showAirPathlines: boolean;
  showAirGlyphs: boolean;
  showAirParticles: boolean;
  animateAirflow: boolean;
  airflowParticleDensity: number;
  airflowParticleSpeed: number;
  showAirDeadZones: boolean;
  airDeadZoneThreshold: number;
  compassMode: "simple" | "professional";
  showRoof: boolean;
  structureOpacity: number;
}

type InspectorTab = "properties" | "files" | "templates";

interface DraftWall {
  start: LayoutPoint;
  end: LayoutPoint;
}

type AiDraftStatusTone = "idle" | "loading" | "success" | "warning" | "error";

interface AiDraftStatus {
  tone: AiDraftStatusTone;
  text: string;
}

interface AiLayoutResponse {
  source?: "provider" | "local" | "fallback";
  configured?: boolean;
  layout?: HouseLayout;
  message?: string;
  rationale?: string;
  tags?: string[];
  confidence?: number;
  provider?: {
    name?: string;
    model?: string;
    baseUrl?: string;
  };
}

interface ServerAiStatus {
  tone: AiDraftStatusTone;
  text: string;
}

const DOCK_HEIGHT_STORAGE_KEY = "3d-house-fs:dock-height";
const LAYOUT_SAVE_TIME_KEY = "3d-house-fs:layout-saved-at";
const MAX_HISTORY_ITEMS = 30;
const DEFAULT_DOCK_HEIGHT = 180;
const MIN_DOCK_HEIGHT = 120;
const MAX_DOCK_HEIGHT_RATIO = 0.58;

function cloneLayout(layout: HouseLayout): HouseLayout {
  return JSON.parse(JSON.stringify(layout)) as HouseLayout;
}

function ToolIcon({
  name
}: {
  name:
    | "select"
    | "wall"
    | "move"
    | "door"
    | "window"
    | "ac"
    | "measure"
    | "sensor"
    | "heat"
    | "air"
    | "compass"
    | "walls"
    | "eye"
    | "eye-off"
    | "undo"
    | "redo"
    | "save"
    | "download";
}) {
  if (name === "eye") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5c5 0 9 4.2 10 7-1 2.8-5 7-10 7S3 14.8 2 12c1-2.8 5-7 10-7zm0 3a4 4 0 100 8 4 4 0 000-8zm0 2a2 2 0 110 4 2 2 0 010-4z" />
      </svg>
    );
  }
  if (name === "eye-off") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.3 4.7l16 16-1.4 1.4-2.7-2.7c-1 .4-2.1.6-3.2.6-5 0-9-4.2-10-7 .5-1.4 1.7-3.2 3.5-4.7L1.9 6.1zm5 5l1.5 1.5a2 2 0 002.7 2.7l1.5 1.5A4 4 0 018.3 9.7zM12 5c5 0 9 4.2 10 7-.5 1.3-1.5 2.9-3.1 4.3l-2.2-2.1A4 4 0 0011 6.2L9.3 4.5C10.2 5.2 11.1 5 12 5z" />
      </svg>
    );
  }
  if (name === "select") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3l11 9-5 1.3 3.2 6.1-2.3 1.2-3.2-6-3.7 3.4V3z" />
      </svg>
    );
  }
  if (name === "undo") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 7H4v5h2V9.9A7 7 0 0118.2 14a4 4 0 01-6.9 2.8l-1.4 1.4A6 6 0 1020.2 14 9 9 0 006.8 6.2L6.7 5H4v2z" />
      </svg>
    );
  }
  if (name === "redo") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 7h5v5h-2V9.9A7 7 0 005.8 14a4 4 0 006.9 2.8l1.4 1.4A6 6 0 013.8 14 9 9 0 0117.2 6.2l.1-1.2H20v2z" />
      </svg>
    );
  }
  if (name === "save") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4h12l2 2v14H5zm2 2v12h10V8.2L15.8 7H15v5H8V6zm3 0v4h3V6zm-1 9h6v2H9z" />
      </svg>
    );
  }
  if (name === "download") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 4h2v8l3-3 1.4 1.4L12 15.8l-5.4-5.4L8 9l3 3zM5 18h14v2H5z" />
      </svg>
    );
  }
  if (name === "wall") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17h16v3H4zM5 4h5v5H5zm9 0h5v5h-5zM5 11h14v3H5z" />
      </svg>
    );
  }
  if (name === "door") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 21V4h10v17h-2V6H8v15zm5-9h2v2h-2z" />
      </svg>
    );
  }
  if (name === "window") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v14H4zm2 2v4h5V7zm7 0v4h5V7zm-7 6v4h5v-4zm7 0v4h5v-4z" />
      </svg>
    );
  }
  if (name === "ac") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v7H4zm2 2v3h12V7zm2 9c1.8-1.4 4.2-1.4 6 0 1 .8 2.3.8 3.3 0l1.2 1.6c-1.7 1.3-4 1.3-5.7 0-1.1-.9-2.6-.9-3.7 0-1.7 1.3-4 1.3-5.7 0L4.6 16c1 .8 2.3.8 3.4 0z" />
      </svg>
    );
  }
  if (name === "sensor") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 4h2v8.1a4 4 0 11-2 0zm1 10a2 2 0 100 4 2 2 0 000-4z" />
      </svg>
    );
  }
  if (name === "heat") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3c3 3.1 5 5.7 5 9.3A5 5 0 017 12.4C7 9.9 8.4 8 10.1 6c.4 1.5 1.2 2.7 2.3 3.6.4-2.1.2-4.1-.4-6.6z" />
      </svg>
    );
  }
  if (name === "air") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8h10a2 2 0 10-1.7-3l-1.7-.9A4 4 0 1114 10H4zm0 5h13a2 2 0 11-1.7 3l-1.7.9A4 4 0 1017 11H4zm0 4h7v2H4z" />
      </svg>
    );
  }
  if (name === "compass") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a9 9 0 100 18 9 9 0 000-18zm3.8 5.2l-2.2 5.4-5.4 2.2 2.2-5.4zM12 11a1 1 0 100 2 1 1 0 000-2z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v3H4zm0 6h16v3H4zm0 6h16v3H4z" />
    </svg>
  );
}

export function AppShell() {
  const [layout, setLayout] = useState<HouseLayout>(() => createTemplateLayout("compact-two-room"));
  const [undoStack, setUndoStack] = useState<HouseLayout[]>([]);
  const [redoStack, setRedoStack] = useState<HouseLayout[]>([]);
  const [layoutSaveStatus, setLayoutSaveStatus] = useState("Ready");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(layout.rooms[0]?.id ?? null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("select");
  const [draftWall, setDraftWall] = useState<DraftWall | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("modeling");
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisLayer>("heat");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("properties");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("做一个南向客厅、通风好、适合三口之家的住宅");
  const [aiReferenceFiles, setAiReferenceFiles] = useState<File[]>([]);
  const [aiDraftPending, setAiDraftPending] = useState(false);
  const [aiDraftStatus, setAiDraftStatus] = useState<AiDraftStatus>({
    tone: "idle",
    text: "未配置 AI 时会自动使用本地规则生成草案。"
  });
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false);
  const [aiProviderMode, setAiProviderMode] = useState<AiProviderMode>("browser");
  const [browserAiConfig, setBrowserAiConfig] = useState<BrowserAiConfig>(DEFAULT_BROWSER_AI_CONFIG);
  const [serverAiPassword, setServerAiPassword] = useState("");
  const [serverAiStatusPending, setServerAiStatusPending] = useState(false);
  const [serverAiStatus, setServerAiStatus] = useState<ServerAiStatus>({
    tone: "idle",
    text: "切换到服务器模式后，可先验证密码再生成。"
  });
  const [latestAiDraftLayout, setLatestAiDraftLayout] = useState<HouseLayout | null>(null);
  const [dockHeight, setDockHeight] = useState(DEFAULT_DOCK_HEIGHT);
  const dockResizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [analysisControls, setAnalysisControls] = useState<AnalysisControls>({
    showHeatLayers: true,
    showHeatContours: false,
    showHeatSlices: false,
    showHeatFlux: true,
    showHeatPlumes: true,
    heatSliceMode: "both",
    heatSliceX: 0.5,
    heatSliceY: 0.5,
    showAirPressure: true,
    showAirPathlines: true,
    showAirGlyphs: true,
    showAirParticles: true,
    animateAirflow: true,
    airflowParticleDensity: 0.68,
    airflowParticleSpeed: 1.25,
    showAirDeadZones: true,
    airDeadZoneThreshold: 0.16,
    compassMode: "professional",
    showRoof: true,
    structureOpacity: 0.42
  });
  const [layers, setLayers] = useState<SceneLayers>({
    heat: true,
    airflow: true,
    fengshui: true,
    walls: true
  });

  const validation = useMemo(() => validateLayout(layout), [layout]);
  const { simulation, pending: simulationPending } = useSimulation(layout);
  const simulationStatus = simulationPending ? "computing" : validation.length === 0 ? "ready" : "invalid";
  const heatmap = simulation.heatmap;
  const airflow = simulation.airflow;
  const fengshui = useMemo(() => analyzeFengshui(layout), [layout]);
  const selectedRoom = layout.rooms.find((room) => room.id === selectedRoomId) ?? null;
  const activePalace = selectedRoom
    ? fengshui.roomPalaceMap.find((item) => item.roomId === selectedRoom.id)?.palace ?? null
    : null;

  useEffect(() => {
    const stored = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!stored) {
      setAiSettingsLoaded(true);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as {
        mode?: unknown;
        browserConfig?: unknown;
      };
      setAiProviderMode(normalizeAiProviderMode(parsed.mode));
      setBrowserAiConfig(normalizeBrowserAiConfig(parsed.browserConfig));
    } catch {
      window.localStorage.removeItem(AI_SETTINGS_STORAGE_KEY);
    } finally {
      setAiSettingsLoaded(true);
    }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(DOCK_HEIGHT_STORAGE_KEY);
    if (!stored) {
      const responsiveDefault =
        window.innerWidth <= 760 ? 260 : window.innerWidth <= 1180 ? 220 : DEFAULT_DOCK_HEIGHT;
      setDockHeight(clampDockHeight(responsiveDefault));
      return;
    }

    const parsed = Number(stored);
    if (Number.isFinite(parsed)) {
      setDockHeight(clampDockHeight(parsed));
    }
  }, []);

  useEffect(() => {
    if (!aiSettingsLoaded) {
      return;
    }

    window.localStorage.setItem(
      AI_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mode: aiProviderMode,
        browserConfig: browserAiConfig
      })
    );
  }, [aiProviderMode, aiSettingsLoaded, browserAiConfig]);

  useEffect(() => {
    window.localStorage.setItem(DOCK_HEIGHT_STORAGE_KEY, String(Math.round(dockHeight)));
  }, [dockHeight]);

  useEffect(() => {
    if (aiProviderMode !== "server") {
      setServerAiStatus({
        tone: "idle",
        text: "当前使用浏览器本地 AI 配置，不需要服务器密码。"
      });
      return;
    }

    setServerAiStatus({
      tone: "idle",
      text: "切换到服务器模式后，可先验证密码再生成。"
    });
  }, [aiProviderMode]);

  function exportFileName(targetLayout: HouseLayout) {
    const projectName = targetLayout.metadata.projectName.trim() || "house-layout";
    const safeName = projectName.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
    return `${safeName}.json`;
  }

  function syncSelectionForLayout(nextLayout: HouseLayout) {
    setSelectedRoomId((current) =>
      current && nextLayout.rooms.some((room) => room.id === current) ? current : nextLayout.rooms[0]?.id ?? null
    );
    setSelectedWallId((current) => (current && nextLayout.walls.some((wall) => wall.id === current) ? current : null));
  }

  function commitLayoutChange(update: HouseLayout | ((current: HouseLayout) => HouseLayout), options: { history?: boolean } = {}) {
    const shouldRecordHistory = options.history !== false;
    setLayout((current) => {
      const nextLayout = typeof update === "function" ? update(current) : update;
      if (nextLayout === current) {
        return current;
      }
      if (shouldRecordHistory) {
        setUndoStack((stack) => [...stack.slice(Math.max(0, stack.length - MAX_HISTORY_ITEMS + 1)), cloneLayout(current)]);
        setRedoStack([]);
        setLayoutSaveStatus("Unsaved changes");
      }
      return nextLayout;
    });
  }

  function undoLayout() {
    if (undoStack.length === 0) {
      return;
    }
    const previous = cloneLayout(undoStack[undoStack.length - 1]);
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack.slice(Math.max(0, stack.length - MAX_HISTORY_ITEMS + 1)), cloneLayout(layout)]);
    setLayout(previous);
    syncSelectionForLayout(previous);
    setDraftWall(null);
    setLayoutSaveStatus("Undo applied");
  }

  function redoLayout() {
    if (redoStack.length === 0) {
      return;
    }
    const next = cloneLayout(redoStack[redoStack.length - 1]);
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack.slice(Math.max(0, stack.length - MAX_HISTORY_ITEMS + 1)), cloneLayout(layout)]);
    setLayout(next);
    syncSelectionForLayout(next);
    setDraftWall(null);
    setLayoutSaveStatus("Redo applied");
  }

  function saveLayoutToBrowser() {
    const now = new Date().toLocaleString("zh-CN", { hour12: false });
    window.localStorage.setItem(SAVED_LAYOUT_STORAGE_KEY, stringifyLayout(layout));
    window.localStorage.setItem(LAYOUT_SAVE_TIME_KEY, now);
    setLayoutSaveStatus(`Saved ${now}`);
  }

  function exportLayoutJson() {
    const blob = new Blob([stringifyLayout(layout)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exportFileName(layout);
    anchor.click();
    URL.revokeObjectURL(url);
    setLayoutSaveStatus("JSON exported");
  }

  function applyTemplate(templateId: TemplateId) {
    const nextLayout = createTemplateLayout(templateId);
    commitLayoutChange(nextLayout);
    setSelectedRoomId(nextLayout.rooms[0]?.id ?? null);
    setSelectedWallId(null);
    setDraftWall(null);
    setEditorMode("select");
  }

  function clampDockHeight(value: number) {
    const viewportHeight = typeof window === "undefined" ? 900 : window.innerHeight;
    const maxHeight = Math.max(220, Math.round(viewportHeight * MAX_DOCK_HEIGHT_RATIO));
    return Math.min(maxHeight, Math.max(MIN_DOCK_HEIGHT, Math.round(value)));
  }

  function beginDockResize(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    dockResizeRef.current = {
      startY: event.clientY,
      startHeight: dockHeight
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDockResize(event: PointerEvent<HTMLButtonElement>) {
    if (!dockResizeRef.current) {
      return;
    }
    const delta = dockResizeRef.current.startY - event.clientY;
    setDockHeight(clampDockHeight(dockResizeRef.current.startHeight + delta));
  }

  function endDockResize(event: PointerEvent<HTMLButtonElement>) {
    dockResizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resetDockHeight() {
    setDockHeight(DEFAULT_DOCK_HEIGHT);
  }

  function templateFromPrompt(prompt: string): TemplateId {
    const normalized = prompt.toLowerCase();
    if (normalized.includes("三") || normalized.includes("3") || normalized.includes("家庭") || normalized.includes("老人") || normalized.includes("孩子")) {
      return "family-three-room";
    }
    if (normalized.includes("空白") || normalized.includes("自定义")) {
      return "blank";
    }
    return "compact-two-room";
  }

  function applyAiDraftLayout(nextLayout: HouseLayout) {
    const syncedLayout = syncDerivedLayoutData(nextLayout);
    commitLayoutChange(syncedLayout);
    setSelectedRoomId(syncedLayout.rooms[0]?.id ?? null);
    setSelectedWallId(null);
    setDraftWall(null);
    setEditorMode("select");
  }

  function rememberLatestAiDraft(nextLayout: HouseLayout) {
    setLatestAiDraftLayout(cloneLayout(syncDerivedLayoutData(nextLayout)));
  }

  function updateBrowserAiConfigField<K extends keyof BrowserAiConfig>(key: K, value: BrowserAiConfig[K]) {
    setBrowserAiConfig((current) => ({ ...current, [key]: value }));
  }

  function selectAiReferenceFiles(event: ChangeEvent<HTMLInputElement>) {
    const incomingFiles = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";

    if (incomingFiles.length === 0) {
      return;
    }

    setAiReferenceFiles((current) => {
      const merged = [...current, ...incomingFiles].slice(0, MAX_REFERENCE_IMAGES);
      if (current.length + incomingFiles.length > MAX_REFERENCE_IMAGES) {
        setAiDraftStatus({
          tone: "warning",
          text: `最多上传 ${MAX_REFERENCE_IMAGES} 张参考图，其余图片已忽略。`
        });
      }
      return merged;
    });
  }

  function removeAiReferenceFile(index: number) {
    setAiReferenceFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  function clearBrowserAiConfig() {
    setBrowserAiConfig(DEFAULT_BROWSER_AI_CONFIG);
    setAiDraftStatus({
      tone: "idle",
      text: "浏览器本地 AI 配置已清空，不会影响服务器端配置。"
    });
  }

  function generateLocalAiDraft(message: string, tone: AiDraftStatusTone = "warning") {
    const templateId = templateFromPrompt(aiPrompt);
    const nextLayout = syncDerivedLayoutData(createTemplateLayout(templateId));
    const aiDraftLayout = {
      ...nextLayout,
      metadata: {
        ...nextLayout.metadata,
        projectName: `AI 草案 - ${nextLayout.metadata.projectName}`
      }
    };
    applyAiDraftLayout(aiDraftLayout);
    rememberLatestAiDraft(aiDraftLayout);
    setAiDraftStatus({ tone, text: message });
  }

  async function verifyServerAiConfig() {
    if (!serverAiPassword.trim()) {
      setServerAiStatus({
        tone: "warning",
        text: "请先输入服务器密码，再验证内置 AI 配置。"
      });
      return;
    }

    setServerAiStatusPending(true);
    setServerAiStatus({
      tone: "loading",
      text: "正在验证服务器内置 AI 配置..."
    });

    try {
      const response = await fetch("/api/ai/server-config-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: serverAiPassword.trim() }),
        cache: "no-store"
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        provider?: { model?: string; name?: string };
      };

      if (!response.ok || !payload.ok) {
        setServerAiStatus({
          tone: "error",
          text: payload.message ?? "服务器内置 AI 验证失败。"
        });
        return;
      }

      const providerText = payload.provider?.model ? `（${payload.provider.model}）` : "";
      setServerAiStatus({
        tone: "success",
        text: payload.message ?? `服务器内置 AI${providerText} 已验证通过。`
      });
    } catch (error) {
      setServerAiStatus({
        tone: "error",
        text:
          error instanceof Error
            ? `服务器内置 AI 验证失败：${error.message}`
            : "服务器内置 AI 验证失败。"
      });
    } finally {
      setServerAiStatusPending(false);
    }
  }

  function exportLatestAiDraft() {
    if (!latestAiDraftLayout) {
      setAiDraftStatus({
        tone: "warning",
        text: "还没有可导出的 AI 建模 JSON，请先生成一次草案。"
      });
      return;
    }

    const exportText = stringifyLayout(latestAiDraftLayout);
    const blob = new Blob([exportText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeName = (latestAiDraftLayout.metadata.projectName || "ai-draft")
      .replace(/[\\/:*?\"<>|]+/g, "-")
      .replace(/\s+/g, "-");
    anchor.href = url;
    anchor.download = `${safeName}-ai.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setAiDraftStatus({
      tone: "success",
      text: "最近一次 AI 建模 JSON 已导出。"
    });
  }

  async function generateAiDraft() {
    const prompt = aiPrompt.trim();
    if (!prompt && aiReferenceFiles.length === 0) {
      generateLocalAiDraft("请先输入客户需求，或上传草图 / 照片后再生成。", "warning");
      return;
    }

    setAiDraftPending(true);
    setAiDraftStatus({
      tone: "loading",
      text:
        aiReferenceFiles.length > 0
          ? "正在结合文字与参考图片生成可编辑建模 JSON..."
          : "正在根据客户描述生成可编辑建模 JSON..."
    });

    try {
      if (aiProviderMode === "browser") {
        const payload = await requestBrowserAiDraft({
          prompt,
          referenceFiles: aiReferenceFiles,
          config: browserAiConfig,
          fallbackTemplateId: templateFromPrompt(prompt)
        });

        if (!payload.layout) {
          generateLocalAiDraft(payload.message, payload.configured ? "warning" : "idle");
          return;
        }

        applyAiDraftLayout(payload.layout);
        rememberLatestAiDraft(payload.layout);
        const providerText = payload.provider?.model ? `（${payload.provider.model}）` : "";
        setAiDraftStatus({
          tone: "success",
          text: payload.rationale
            ? `浏览器本地 AI${providerText} 已生成建模 JSON。 ${payload.rationale}`
            : payload.message
        });
        return;
      }

      const formData = new FormData();
      formData.append("prompt", prompt);
      formData.append("providerMode", aiProviderMode);
      formData.append("serverPassword", serverAiPassword.trim());
      aiReferenceFiles.forEach((file) => {
        formData.append("referenceImages", file);
      });

      const response = await fetch("/api/ai/layout-from-text", {
        method: "POST",
        body: formData,
        cache: "no-store"
      });
      const payload = (await response.json()) as AiLayoutResponse;

      if (!response.ok || !payload.layout) {
        generateLocalAiDraft(payload.message ?? "AI 接口返回异常，已回落本地规则。", "warning");
        return;
      }

      applyAiDraftLayout(payload.layout);
      rememberLatestAiDraft(payload.layout);
      const providerText = payload.provider?.model ? `（${payload.provider.model}）` : "";
      const sourceText =
        payload.source === "provider"
          ? `AI 服务${providerText}已生成建模 JSON。`
          : payload.source === "fallback"
            ? "AI 服务不可用，已回落本地规则。"
            : "未配置 AI 服务，已使用本地规则。";
      setAiDraftStatus({
        tone: payload.source === "provider" ? "success" : payload.source === "fallback" ? "warning" : "idle",
        text: payload.rationale ? `${sourceText} ${payload.rationale}` : payload.message ?? sourceText
      });

      if (aiProviderMode === "server") {
        setServerAiStatus({
          tone: payload.source === "provider" ? "success" : "warning",
          text:
            payload.source === "provider"
              ? `服务器内置 AI${providerText} 已验证并成功生成。`
              : payload.message ?? "服务器内置 AI 已通过鉴权，但本次生成回退到了本地规则。"
        });
      }
    } catch (error) {
      generateLocalAiDraft(
        error instanceof Error ? `AI 接口请求失败，已回落本地规则：${error.message}` : "AI 接口请求失败，已回落本地规则。",
        "error"
      );
    } finally {
      setAiDraftPending(false);
    }
  }

  function restoreLayout(nextLayout: HouseLayout) {
    const syncedLayout = syncDerivedLayoutData(nextLayout);
    commitLayoutChange(syncedLayout);
    setSelectedRoomId(syncedLayout.rooms[0]?.id ?? null);
    setSelectedWallId(null);
    setDraftWall(null);
    setEditorMode("select");
  }

  function updateMetadata(key: keyof HouseLayout["metadata"], value: string | number) {
    commitLayoutChange((current) => ({ ...current, metadata: { ...current.metadata, [key]: value } }));
  }

  function updateWeather(key: keyof HouseLayout["weather"], value: number) {
    commitLayoutChange((current) => ({ ...current, weather: { ...current.weather, [key]: value } }));
  }

  function updateOrientation(key: "facingDegrees" | "frontDoorDegrees", value: number) {
    commitLayoutChange((current) =>
      syncDerivedLayoutData({
        ...current,
        orientation: { ...current.orientation, [key]: value }
      })
    );
  }

  function updateRoomDimensions(roomId: string, key: "width" | "depth", value: number) {
    commitLayoutChange((current) =>
      syncDerivedLayoutData({
        ...current,
        rooms: current.rooms.map((room) =>
          room.id === roomId ? { ...room, [key]: Math.max(0.4, Number(value.toFixed(2))) } : room
        )
      })
    );
  }

  function updateRoomOrigin(roomId: string, axis: "x" | "y", value: number) {
    commitLayoutChange((current) =>
      syncDerivedLayoutData({
        ...current,
        rooms: current.rooms.map((room) =>
          room.id === roomId
            ? { ...room, origin: { ...room.origin, [axis]: Number(Math.max(0, value).toFixed(2)) } }
            : room
        )
      })
    );
  }

  function nudgeRoom(roomId: string, axis: "x" | "y", delta: number) {
    commitLayoutChange((current) => {
      const next = cloneLayout(current);
      next.rooms = next.rooms.map((room) =>
        room.id === roomId
          ? { ...room, origin: { ...room.origin, [axis]: Number(Math.max(0, room.origin[axis] + delta).toFixed(2)) } }
          : room
      );
      return syncDerivedLayoutData(next);
    });
  }

  function addSensorPoint() {
    commitLayoutChange((current) => {
      const nextNumber = current.sensors.length + 1;
      const sensor: SensorPoint = {
        id: `sensor-${Date.now()}`,
        label: `温度点 ${nextNumber}`,
        x: Number((current.bounds.width / 2).toFixed(2)),
        y: Number((current.bounds.depth / 2).toFixed(2)),
        temperature: Number((current.weather.outdoorTemperature - 4).toFixed(1))
      };
      return { ...current, sensors: [...current.sensors, sensor] };
    });
  }

  function updateSensorPoint(sensorId: string, patch: Partial<SensorPoint>) {
    commitLayoutChange((current) => ({
      ...current,
      sensors: current.sensors.map((sensor) =>
        sensor.id === sensorId
          ? {
              ...sensor,
              ...patch,
              x: patch.x === undefined ? sensor.x : Number(Math.min(current.bounds.width, Math.max(0, patch.x)).toFixed(2)),
              y: patch.y === undefined ? sensor.y : Number(Math.min(current.bounds.depth, Math.max(0, patch.y)).toFixed(2)),
              temperature: patch.temperature === undefined ? sensor.temperature : Number(patch.temperature.toFixed(1))
            }
          : sensor
      )
    }));
  }

  function deleteSensorPoint(sensorId: string) {
    commitLayoutChange((current) => ({ ...current, sensors: current.sensors.filter((sensor) => sensor.id !== sensorId) }));
  }

  function addOpening(wallId: string, type: Opening["type"]) {
    commitLayoutChange((current) => {
      const opening = createOpeningForWall(current, wallId, type);
      if (!opening) {
        return current;
      }
      return syncDerivedLayoutData({ ...current, openings: [...current.openings, opening] });
    });
  }

  function updateOpening(openingId: string, patch: Partial<Opening>) {
    commitLayoutChange((current) => {
      const wallMap = new Map(current.walls.map((wall) => [wall.id, wall]));
      return syncDerivedLayoutData({
        ...current,
        openings: current.openings.map((opening) => {
          if (opening.id !== openingId) {
            return opening;
          }
          const next = { ...opening, ...patch };
          const wall = wallMap.get(next.wallId);
          return wall ? clampOpeningToWall(next, wall) : next;
        })
      });
    });
  }

  function deleteOpening(openingId: string) {
    commitLayoutChange((current) => syncDerivedLayoutData({ ...current, openings: current.openings.filter((opening) => opening.id !== openingId) }));
  }

  function addDevice(roomId: string, type: ClimateDevice["type"]) {
    commitLayoutChange((current) => {
      const device = createDeviceForRoom(current, roomId, type);
      if (!device) {
        return current;
      }
      return syncDerivedLayoutData({ ...current, devices: [...(current.devices ?? []), device] });
    });
  }

  function updateDevice(deviceId: string, patch: Partial<ClimateDevice>) {
    commitLayoutChange((current) =>
      syncDerivedLayoutData({
        ...current,
        devices: (current.devices ?? []).map((device) =>
          device.id === deviceId ? clampDeviceToRoom({ ...device, ...patch }, current) : device
        )
      })
    );
  }

  function deleteDevice(deviceId: string) {
    commitLayoutChange((current) => syncDerivedLayoutData({ ...current, devices: (current.devices ?? []).filter((device) => device.id !== deviceId) }));
  }

  function replaceLayout(nextLayout: HouseLayout) {
    commitLayoutChange(nextLayout);
  }

  function deleteSelectedWall() {
    if (!selectedWallId) {
      return;
    }
    commitLayoutChange((current) => syncDerivedLayoutData({ ...current, walls: current.walls.filter((wall) => wall.id !== selectedWallId) }));
    setSelectedWallId(null);
  }

  function selectRoom(roomId: string) {
    setSelectedRoomId(roomId);
    setSelectedWallId(null);
  }

  function toggleLayerVisibility(key: keyof SceneLayers) {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  }

  function focusAnalysis(key: AnalysisLayer) {
    setActiveAnalysis(key);
    setWorkspaceMode("analysis");
    // 聚焦某个分析时,确保它的叠层可见,避免"选中却看不到"的困惑。
    setLayers((current) => (current[key] ? current : { ...current, [key]: true }));
  }

  function updateAnalysisControl<K extends keyof AnalysisControls>(key: K, value: AnalysisControls[K]) {
    setAnalysisControls((current) => ({ ...current, [key]: value }));
  }

  const shellStyle = { "--dock-height": `${dockHeight}px` } as CSSProperties;

  return (
    <main className="studio-shell" style={shellStyle}>
      <header className="studio-topbar">
        <div className="brand-block">
          <strong>3D HOUSE FS</strong>
          <span>{layout.metadata.projectName}</span>
        </div>
        <div className="workspace-switch" aria-label="workspace mode">
          {[
            ["modeling", "建模"],
            ["analysis", "专业分析"],
            ["renovation", "装修报告"]
          ].map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={workspaceMode === mode ? "active" : ""}
              onClick={() => setWorkspaceMode(mode as WorkspaceMode)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="layer-strip analysis-switch" aria-label="分析图层">
          {[
            ["heat", "热力", "heat"],
            ["airflow", "气流", "air"],
            ["fengshui", "罗盘", "compass"]
          ].map(([key, label, icon]) => {
            const layerKey = key as AnalysisLayer;
            const visible = layers[layerKey];
            const current = activeAnalysis === key && workspaceMode === "analysis";
            return (
              <div key={key} className={`analysis-layer-group ${current ? "current" : ""}`}>
                <button
                  type="button"
                  className="analysis-focus"
                  aria-pressed={current}
                  title={`聚焦${label}分析`}
                  onClick={() => focusAnalysis(layerKey)}
                >
                  <ToolIcon name={icon as "heat" | "air" | "compass"} />
                  <span>{label}</span>
                </button>
                <button
                  type="button"
                  className={`analysis-visibility ${visible ? "on" : "off"}`}
                  aria-pressed={visible}
                  aria-label={`${visible ? "隐藏" : "显示"}${label}叠层`}
                  title={`${visible ? "隐藏" : "显示"}${label}叠层`}
                  onClick={() => toggleLayerVisibility(layerKey)}
                >
                  <ToolIcon name={visible ? "eye" : "eye-off"} />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className={`aux-layer-toggle ${layers.walls ? "active" : ""}`}
          aria-pressed={layers.walls}
          title={`${layers.walls ? "隐藏" : "显示"}结构墙体`}
          onClick={() => toggleLayerVisibility("walls")}
        >
          <ToolIcon name={layers.walls ? "eye" : "eye-off"} />
          <span>结构</span>
        </button>
        <div className="quick-actions" aria-label="layout actions">
          <button type="button" disabled={undoStack.length === 0} title="Undo" aria-label="Undo" onClick={undoLayout}>
            <ToolIcon name="undo" />
          </button>
          <button type="button" disabled={redoStack.length === 0} title="Redo" aria-label="Redo" onClick={redoLayout}>
            <ToolIcon name="redo" />
          </button>
          <button type="button" title="Save to browser" aria-label="Save to browser" onClick={saveLayoutToBrowser}>
            <ToolIcon name="save" />
          </button>
          <button type="button" title="Export JSON" aria-label="Export JSON" onClick={exportLayoutJson}>
            <ToolIcon name="download" />
          </button>
          <span>{layoutSaveStatus}</span>
        </div>
        <div
          className={`status-pill ${simulationPending ? "computing" : ""}`}
          data-testid="simulation-status"
          data-state={simulationStatus}
        >
          {simulationPending ? (
            <>
              <span className="status-spinner" aria-hidden="true" />
              场计算中
            </>
          ) : validation.length === 0 ? (
            "模型有效"
          ) : (
            `${validation.length} 个问题`
          )}
        </div>
      </header>

      <div className="studio-body">
        <nav className="tool-rail" aria-label="编辑工具">
          <button type="button" className={editorMode === "select" ? "active" : ""} title="选择" onClick={() => setEditorMode("select")}>
            <ToolIcon name="select" />
            <em>选择</em>
          </button>
          <button type="button" className={editorMode === "draw-wall" ? "active" : ""} title="画墙" onClick={() => setEditorMode("draw-wall")}>
            <ToolIcon name="wall" />
            <em>画墙</em>
          </button>
          <button type="button" className={editorMode === "move" ? "active" : ""} title="移动" onClick={() => setEditorMode("move")}>
            <ToolIcon name="move" />
            <em>移动</em>
          </button>
          <button type="button" className={editorMode === "door" ? "active" : ""} title="门工具" onClick={() => setEditorMode("door")}>
            <ToolIcon name="door" />
            <em>门</em>
          </button>
          <button type="button" className={editorMode === "window" ? "active" : ""} title="窗工具" onClick={() => setEditorMode("window")}>
            <ToolIcon name="window" />
            <em>窗</em>
          </button>
          <button type="button" className={editorMode === "device" ? "active" : ""} title="设备工具" onClick={() => setEditorMode("device")}>
            <ToolIcon name="ac" />
            <em>设备</em>
          </button>
          <button type="button" className={editorMode === "measure" ? "active" : ""} title="测量" onClick={() => setEditorMode("measure")}>
            <ToolIcon name="measure" />
            <em>测量</em>
          </button>
          <button type="button" title="加温度点" onClick={addSensorPoint}>
            <ToolIcon name="sensor" />
            <em>温度点</em>
          </button>
        </nav>

        <section className="main-stage">
          <SceneViewport
            layout={layout}
            selectedRoomId={selectedRoomId}
            selectedWallId={selectedWallId}
            activePalace={activePalace}
            editorMode={editorMode}
            draftWall={draftWall}
            layers={layers}
            onSetEditorMode={setEditorMode}
            onSelectRoom={selectRoom}
            onSelectWall={setSelectedWallId}
            onDraftWallChange={setDraftWall}
            onCommitLayout={replaceLayout}
            onDeleteSelectedWall={deleteSelectedWall}
            heatmap={heatmap}
            airflow={airflow}
            heatField={simulation.heatField}
            flowField={simulation.flowField}
            controls={analysisControls}
            fengshui={fengshui}
          />
        </section>

        <button
          type="button"
          className="inspector-fab"
          aria-expanded={inspectorOpen}
          onClick={() => setInspectorOpen((current) => !current)}
        >
          {inspectorOpen ? "关闭属性" : "属性 / 模板"}
        </button>

        <aside className={`inspector ${inspectorOpen ? "open" : ""}`}>
          {workspaceMode === "analysis" ? (
            <AnalysisControlsPanel
              workspaceMode={workspaceMode}
              activeAnalysis={activeAnalysis}
              controls={analysisControls}
              onUpdate={updateAnalysisControl}
              heatField={simulation.heatField}
              flowField={simulation.flowField}
            />
          ) : null}
          <div className="inspector-tabs">
            {[
              ["properties", "属性"],
              ["files", "文件"],
              ["templates", "模板"]
            ].map(([tab, label]) => (
              <button key={tab} type="button" className={inspectorTab === tab ? "active" : ""} onClick={() => setInspectorTab(tab as InspectorTab)}>
                {label}
              </button>
            ))}
          </div>
          {inspectorTab === "properties" ? (
            <LayoutEditor
              layout={layout}
              selectedRoomId={selectedRoomId}
              selectedWallId={selectedWallId}
              editorMode={editorMode}
              onSelectRoom={selectRoom}
              onSelectWall={setSelectedWallId}
              onSetEditorMode={setEditorMode}
              onDeleteSelectedWall={deleteSelectedWall}
              onUpdateMetadata={updateMetadata}
              onUpdateWeather={updateWeather}
              onUpdateOrientation={updateOrientation}
              onUpdateRoomDimensions={updateRoomDimensions}
              onUpdateRoomOrigin={updateRoomOrigin}
              onNudgeRoom={nudgeRoom}
              onAddSensorPoint={addSensorPoint}
              onUpdateSensorPoint={updateSensorPoint}
              onDeleteSensorPoint={deleteSensorPoint}
              onAddOpening={addOpening}
              onUpdateOpening={updateOpening}
              onDeleteOpening={deleteOpening}
              onAddDevice={addDevice}
              onUpdateDevice={updateDevice}
              onDeleteDevice={deleteDevice}
            />
          ) : null}
          {inspectorTab === "files" ? <LayoutPersistencePanel layout={layout} onRestoreLayout={restoreLayout} /> : null}
          {inspectorTab === "templates" ? <TemplatePicker currentTemplate={layout.templateId} onSelect={applyTemplate} /> : null}
        </aside>
      </div>

      <footer className={`analysis-dock active-${activeAnalysis} workspace-${workspaceMode}`}>
        <button
          type="button"
          className="dock-resize-handle"
          aria-label="调整底部功能区高度"
          title="拖动调整底部功能区高度，双击恢复默认"
          onPointerDown={beginDockResize}
          onPointerMove={moveDockResize}
          onPointerUp={endDockResize}
          onPointerCancel={endDockResize}
          onDoubleClick={resetDockHeight}
        >
          <span />
        </button>
        <div className="dock-main" data-testid="template-controls">
          {workspaceMode === "modeling" ? (
            <ModelingPanel
              layout={layout}
              aiPrompt={aiPrompt}
              aiReferenceFiles={aiReferenceFiles}
              aiDraftPending={aiDraftPending}
              aiDraftStatus={aiDraftStatus}
              aiSettingsOpen={aiSettingsOpen}
              aiProviderMode={aiProviderMode}
              browserAiConfig={browserAiConfig}
              serverAiPassword={serverAiPassword}
              serverAiStatusPending={serverAiStatusPending}
              serverAiStatus={serverAiStatus}
              canExportAiDraft={latestAiDraftLayout !== null}
              onAiPromptChange={setAiPrompt}
              onAiReferenceFilesSelect={selectAiReferenceFiles}
              onAiReferenceFileRemove={removeAiReferenceFile}
              onGenerateAiDraft={generateAiDraft}
              onExportAiDraft={exportLatestAiDraft}
              onAiSettingsToggle={() => setAiSettingsOpen((current) => !current)}
              onAiProviderModeChange={setAiProviderMode}
              onBrowserAiConfigChange={updateBrowserAiConfigField}
              onServerAiPasswordChange={setServerAiPassword}
              onVerifyServerAiConfig={verifyServerAiConfig}
              onClearBrowserAiConfig={clearBrowserAiConfig}
              onSelectTemplate={applyTemplate}
            />
          ) : null}
          {workspaceMode === "analysis" && activeAnalysis === "heat" ? <HeatmapPanel heatmap={heatmap} sensors={layout.sensors} field={simulation.heatField} /> : null}
          {workspaceMode === "analysis" && activeAnalysis === "airflow" ? <AirflowPanel airflow={airflow} rooms={layout.rooms} field={simulation.flowField} /> : null}
          {workspaceMode === "analysis" && activeAnalysis === "fengshui" ? (
            <FengshuiPanel layout={layout} fengshui={fengshui} selectedRoomId={selectedRoom?.id ?? null} activePalace={activePalace} onSelectRoom={selectRoom} />
          ) : null}
          {workspaceMode === "renovation" ? <RenovationReportPanel layout={layout} heatmap={heatmap} airflow={airflow} /> : null}
        </div>
      </footer>
    </main>
  );
}
