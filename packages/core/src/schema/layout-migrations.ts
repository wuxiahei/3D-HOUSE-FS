import type { HouseLayout, ValidationIssue } from "../types/layout";
import { degreesToDirection, syncDerivedLayoutData } from "../geometry/layout-helpers";
import { CURRENT_SCHEMA_VERSION, parseHouseLayoutV2, type LayoutParseResult } from "./layout-schema";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function versionOf(input: Record<string, unknown>) {
  const version = input.schemaVersion;
  if (version === undefined) {
    return 1;
  }
  return typeof version === "number" && Number.isInteger(version) ? version : Number.NaN;
}

function issue(code: string, message: string): ValidationIssue {
  return { level: "error", code, message };
}

export function migrateHouseLayoutDocument(input: unknown): LayoutParseResult {
  if (!isRecord(input)) {
    return {
      success: false,
      issues: [issue("INVALID_DOCUMENT", "Layout document must be an object")]
    };
  }

  const version = versionOf(input);
  if (!Number.isInteger(version)) {
    return {
      success: false,
      issues: [issue("INVALID_VERSION", "schemaVersion must be an integer")]
    };
  }

  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      success: false,
      issues: [issue("UNSUPPORTED_VERSION", `Unsupported schemaVersion ${version}`)]
    };
  }

  if (version === CURRENT_SCHEMA_VERSION) {
    return parseHouseLayoutV2(input);
  }

  const orientation = isRecord(input.orientation) ? input.orientation : {};
  const facingDegrees = typeof orientation.facingDegrees === "number" ? orientation.facingDegrees : 0;
  const frontDoorDegrees = typeof orientation.frontDoorDegrees === "number" ? orientation.frontDoorDegrees : facingDegrees;
  const migrated = syncDerivedLayoutData({
    ...(input as Omit<HouseLayout, "schemaVersion">),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    devices: Array.isArray(input.devices) ? input.devices : [],
    orientation: {
      ...orientation,
      facingDegrees,
      facingLabel: degreesToDirection(facingDegrees),
      frontDoorDegrees,
      frontDoorLabel: degreesToDirection(frontDoorDegrees)
    }
  } as HouseLayout);

  return parseHouseLayoutV2(migrated);
}

export const parseHouseLayoutDocument = migrateHouseLayoutDocument;
