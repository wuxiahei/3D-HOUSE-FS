"use client";

import type { ChangeEvent } from "react";
import type { HouseLayout, TemplateId } from "@fengshui/core";
import type { AiProviderMode, BrowserAiConfig } from "../../lib/ai-config";
import { MAX_REFERENCE_IMAGES } from "../../lib/ai-config";

const templateLabels: Record<TemplateId, string> = {
  blank: "空白",
  "compact-two-room": "紧凑两居",
  "family-three-room": "家庭三居"
};

type AiDraftStatusTone = "idle" | "loading" | "success" | "warning" | "error";

interface AiDraftStatus {
  tone: AiDraftStatusTone;
  text: string;
}

export function ModelingPanel({
  layout,
  aiPrompt,
  aiReferenceFiles,
  aiDraftPending,
  aiDraftStatus,
  aiSettingsOpen,
  aiProviderMode,
  browserAiConfig,
  serverAiPassword,
  serverAiStatusPending,
  serverAiStatus,
  canExportAiDraft,
  onAiPromptChange,
  onAiReferenceFilesSelect,
  onAiReferenceFileRemove,
  onGenerateAiDraft,
  onExportAiDraft,
  onAiSettingsToggle,
  onAiProviderModeChange,
  onBrowserAiConfigChange,
  onServerAiPasswordChange,
  onVerifyServerAiConfig,
  onClearBrowserAiConfig,
  onSelectTemplate
}: {
  layout: HouseLayout;
  aiPrompt: string;
  aiReferenceFiles: File[];
  aiDraftPending: boolean;
  aiDraftStatus: AiDraftStatus;
  aiSettingsOpen: boolean;
  aiProviderMode: AiProviderMode;
  browserAiConfig: BrowserAiConfig;
  serverAiPassword: string;
  serverAiStatusPending: boolean;
  serverAiStatus: AiDraftStatus;
  canExportAiDraft: boolean;
  onAiPromptChange: (value: string) => void;
  onAiReferenceFilesSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onAiReferenceFileRemove: (index: number) => void;
  onGenerateAiDraft: () => void;
  onExportAiDraft: () => void;
  onAiSettingsToggle: () => void;
  onAiProviderModeChange: (value: AiProviderMode) => void;
  onBrowserAiConfigChange: <K extends keyof BrowserAiConfig>(
    key: K,
    value: BrowserAiConfig[K]
  ) => void;
  onServerAiPasswordChange: (value: string) => void;
  onVerifyServerAiConfig: () => void;
  onClearBrowserAiConfig: () => void;
  onSelectTemplate: (templateId: TemplateId) => void;
}) {
  return (
    <section className="dock-panel modeling-dock">
      <div className="dock-title">
        <strong>建模工作台</strong>
        <span>AI 草案 / 图片参考 / 模板 / 手动编辑</span>
      </div>
      <div className="modeling-grid">
        <div className="modeling-block modeling-block-wide">
          <div className="modeling-block-header">
            <span className="eyebrow">AI 建模</span>
            <button type="button" className={aiSettingsOpen ? "active" : ""} onClick={onAiSettingsToggle}>
              AI 设置
            </button>
          </div>
          <textarea
            value={aiPrompt}
            onChange={(event) => onAiPromptChange(event.target.value)}
            placeholder="例如：做一个 90 平三室两厅，南向客厅，厨房靠西，主卧带卫生间；如果有草图或现场照片，也可以一并上传。"
          />
          <div className="reference-upload-row">
            <label className="file-button">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onAiReferenceFilesSelect}
              />
              上传草图 / 照片
            </label>
            <span className="reference-upload-hint">
              最多 {MAX_REFERENCE_IMAGES} 张，支持客户手绘草图、现场拍照、户型截图
            </span>
          </div>
          {aiReferenceFiles.length > 0 ? (
            <div className="reference-file-list">
              {aiReferenceFiles.map((file, index) => (
                <div key={`${file.name}-${file.size}-${index}`} className="reference-file-chip">
                  <span>
                    {file.name} <small>{Math.max(1, Math.round(file.size / 1024))} KB</small>
                  </span>
                  <button type="button" onClick={() => onAiReferenceFileRemove(index)}>
                    移除
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {aiSettingsOpen ? (
            <div className="ai-settings-panel">
              <div className="segmented">
                <button
                  type="button"
                  className={aiProviderMode === "browser" ? "active" : ""}
                  onClick={() => onAiProviderModeChange("browser")}
                >
                  浏览器本地 Key
                </button>
                <button
                  type="button"
                  className={aiProviderMode === "server" ? "active" : ""}
                  onClick={() => onAiProviderModeChange("server")}
                >
                  服务器内置配置
                </button>
              </div>
              {aiProviderMode === "browser" ? (
                <div className="settings-field-grid">
                  <label className="range-field">
                    <span>Provider 名称</span>
                    <input
                      value={browserAiConfig.providerName}
                      onChange={(event) =>
                        onBrowserAiConfigChange("providerName", event.target.value)
                      }
                      placeholder="openai-compatible"
                    />
                  </label>
                  <label className="range-field">
                    <span>API Key</span>
                    <input
                      type="password"
                      value={browserAiConfig.apiKey}
                      onChange={(event) =>
                        onBrowserAiConfigChange("apiKey", event.target.value)
                      }
                      placeholder="sk-..."
                    />
                  </label>
                  <label className="range-field">
                    <span>Model</span>
                    <input
                      value={browserAiConfig.model}
                      onChange={(event) =>
                        onBrowserAiConfigChange("model", event.target.value)
                      }
                      placeholder="gpt-4.1-mini"
                    />
                  </label>
                  <label className="range-field">
                    <span>Base URL</span>
                    <input
                      value={browserAiConfig.baseUrl}
                      onChange={(event) =>
                        onBrowserAiConfigChange("baseUrl", event.target.value)
                      }
                      placeholder="https://api.openai.com/v1"
                    />
                  </label>
                  <label className="range-field">
                    <span>Chat Path</span>
                    <input
                      value={browserAiConfig.chatCompletionsPath}
                      onChange={(event) =>
                        onBrowserAiConfigChange("chatCompletionsPath", event.target.value)
                      }
                      placeholder="/chat/completions"
                    />
                  </label>
                  <label className="range-field">
                    <span>超时毫秒</span>
                    <input
                      type="number"
                      min={5000}
                      max={60000}
                      step={1000}
                      value={browserAiConfig.timeoutMs}
                      onChange={(event) =>
                        onBrowserAiConfigChange(
                          "timeoutMs",
                          Number(event.target.value || browserAiConfig.timeoutMs)
                        )
                      }
                    />
                  </label>
                  <p className="settings-note">
                    这些配置只保存在当前浏览器，本项目不会把它们写入服务器。
                  </p>
                  <div className="mini-action-row">
                    <button type="button" onClick={onClearBrowserAiConfig}>
                      清空本地配置
                    </button>
                  </div>
                </div>
              ) : (
                <div className="settings-field-grid">
                  <label className="range-field">
                    <span>服务器密码</span>
                    <input
                      type="password"
                      value={serverAiPassword}
                      onChange={(event) => onServerAiPasswordChange(event.target.value)}
                      placeholder="输入密码后才能调用服务器内置 AI"
                    />
                  </label>
                  <p className="settings-note">
                    服务器模式不会读取你本地填写的 Key。每次生成时都会带上这次输入的密码做鉴权。
                  </p>
                  <div className="mini-action-row">
                    <button
                      type="button"
                      disabled={serverAiStatusPending}
                      onClick={onVerifyServerAiConfig}
                    >
                      {serverAiStatusPending ? "验证中..." : "验证服务器配置"}
                    </button>
                  </div>
                  <p className={`ai-draft-status tone-${serverAiStatus.tone}`}>{serverAiStatus.text}</p>
                </div>
              )}
            </div>
          ) : null}
          <div className="mini-action-row">
            <button type="button" disabled={aiDraftPending} onClick={onGenerateAiDraft}>
              {aiDraftPending ? "生成中..." : "生成 AI 建模 JSON"}
            </button>
            <button type="button" disabled={!canExportAiDraft} onClick={onExportAiDraft}>
              导出最近 AI JSON
            </button>
          </div>
          <p className={`ai-draft-status tone-${aiDraftStatus.tone}`}>{aiDraftStatus.text}</p>
        </div>

        <div className="modeling-block">
          <span className="eyebrow">模板建模</span>
          <div className="template-chip-row">
            {(Object.keys(templateLabels) as TemplateId[]).map((templateId) => (
              <button
                key={templateId}
                type="button"
                className={layout.templateId === templateId ? "active" : ""}
                data-testid={`template-option-${templateId}`}
                data-template-id={templateId}
                onClick={() => onSelectTemplate(templateId)}
              >
                {templateLabels[templateId]}
              </button>
            ))}
          </div>
          <p>选择模板后仍可继续画墙、改门窗、加设备和传感点，再配合 AI 二次细化。</p>
        </div>

        <div className="modeling-block">
          <span className="eyebrow">当前模型</span>
          <strong>{layout.metadata.projectName}</strong>
          <p>
            {layout.rooms.length} 个房间 / {layout.walls.length} 段墙 / {layout.openings.length} 个门窗 /{" "}
            {layout.devices.length} 个设备
          </p>
        </div>
      </div>
    </section>
  );
}
