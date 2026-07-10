import { parseHouseLayoutDocument } from "@fengshui/core";
import type { HouseLayout } from "@fengshui/core";

export const SAVED_LAYOUT_STORAGE_KEY = "3d-house-fs:layout";

export function stringifyLayout(layout: HouseLayout): string {
  return JSON.stringify(layout, null, 2);
}

export function parseLayoutJson(source: string): HouseLayout {
  const parsed = JSON.parse(source) as unknown;
  return normalizeImportedLayout(parsed);
}

export function normalizeImportedLayout(value: unknown): HouseLayout {
  const parsed = parseHouseLayoutDocument(value);
  if (!parsed.success || !parsed.layout) {
    const details = parsed.issues.map((issue) => issue.message).join("; ");
    throw new Error(details || "导入内容不是有效的 v2 户型布局。");
  }

  return parsed.layout;
}
