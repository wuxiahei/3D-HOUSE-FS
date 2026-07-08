import { analyzeFengshui, validateLayout } from "@fengshui/core";
import { generateAirflow, generateHeatmap } from "@fengshui/simulation";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const layout = await request.json();
  return NextResponse.json({
    validation: validateLayout(layout),
    heatmap: generateHeatmap(layout),
    airflow: generateAirflow(layout),
    fengshui: analyzeFengshui(layout)
  });
}

