"use client";

import { validateLayout } from "@fengshui/core";
import type { HouseLayout } from "@fengshui/core";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  parseLayoutJson,
  SAVED_LAYOUT_STORAGE_KEY,
  stringifyLayout
} from "../../utils/serializers/layout-storage";

const STORAGE_TIME_KEY = "3d-house-fs:layout-saved-at";

interface LayoutPersistencePanelProps {
  layout: HouseLayout;
  onRestoreLayout: (layout: HouseLayout) => void;
}

function readLayoutJson(raw: string): { layout?: HouseLayout; error?: string } {
  try {
    const layout = parseLayoutJson(raw);
    const blockingIssues = validateLayout(layout).filter((issue) => issue.level === "error");
    if (blockingIssues.length > 0) {
      return { error: blockingIssues.map((issue) => issue.message).join(" ") };
    }

    return { layout };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "JSON 解析失败，请检查格式。" };
  }
}

function exportFileName(layout: HouseLayout) {
  const projectName = layout.metadata.projectName.trim() || "house-layout";
  const safeName = projectName.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  return `${safeName}.json`;
}

export function LayoutPersistencePanel({ layout, onRestoreLayout }: LayoutPersistencePanelProps) {
  const [importText, setImportText] = useState("");
  const [status, setStatus] = useState("尚未保存当前布局");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const exportText = useMemo(() => stringifyLayout(layout), [layout]);

  useEffect(() => {
    const storedTime = window.localStorage.getItem(STORAGE_TIME_KEY);
    if (storedTime) {
      setSavedAt(storedTime);
      setStatus(`浏览器中有一份保存于 ${storedTime} 的布局`);
    }
  }, []);

  function saveToBrowser() {
    const now = new Date().toLocaleString("zh-CN", { hour12: false });
    window.localStorage.setItem(SAVED_LAYOUT_STORAGE_KEY, exportText);
    window.localStorage.setItem(STORAGE_TIME_KEY, now);
    setSavedAt(now);
    setStatus(`已保存到浏览器：${now}`);
  }

  function restoreFromBrowser() {
    const stored = window.localStorage.getItem(SAVED_LAYOUT_STORAGE_KEY);
    if (!stored) {
      setStatus("浏览器里还没有保存过布局");
      return;
    }

    const result = readLayoutJson(stored);
    if (!result.layout) {
      setStatus(result.error ?? "恢复失败");
      return;
    }

    onRestoreLayout(result.layout);
    setStatus("已从浏览器恢复布局");
  }

  function importLayout(raw: string) {
    const result = readLayoutJson(raw);
    if (!result.layout) {
      setStatus(result.error ?? "导入失败");
      return;
    }

    onRestoreLayout(result.layout);
    setImportText("");
    setStatus("已导入 JSON 布局");
  }

  function importFromText() {
    importLayout(importText);
  }

  function importFromFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => importLayout(String(reader.result ?? ""));
    reader.onerror = () => setStatus("读取文件失败，请重新选择 JSON 文件。");
    reader.readAsText(file);
  }

  function exportJson() {
    const blob = new Blob([exportText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exportFileName(layout);
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("已生成 JSON 导出文件");
  }

  return (
    <div className="subpanel stack gap-lg">
      <div className="subpanel-header">
        <h2>布局文件</h2>
        <span className="badge">{savedAt ? "可恢复" : "未保存"}</span>
      </div>

      <div className="tool-row">
        <button type="button" className="tool-button" onClick={saveToBrowser}>
          保存
        </button>
        <button type="button" className="tool-button" onClick={restoreFromBrowser}>
          恢复
        </button>
        <button type="button" className="tool-button" onClick={exportJson}>
          导出 JSON
        </button>
        <label className="tool-button file-button">
          导入文件
          <input type="file" accept="application/json,.json" onChange={importFromFile} />
        </label>
      </div>

      <label className="field">
        <span>粘贴 JSON 导入</span>
        <textarea
          value={importText}
          rows={5}
          placeholder="把导出的 HouseLayout JSON 粘贴到这里"
          onChange={(event) => setImportText(event.target.value)}
        />
      </label>

      <div className="mini-action-row">
        <button type="button" className="ghost-button" disabled={!importText.trim()} onClick={importFromText}>
          导入布局
        </button>
      </div>

      <p className="status-line">{status}</p>
    </div>
  );
}
