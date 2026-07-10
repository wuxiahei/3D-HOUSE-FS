import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { AppShell } from "./AppShell";

const simulationState = vi.hoisted(() => ({ pending: true }));

vi.mock("../simulation/useSimulation", async () => {
  const { createTemplateLayout } = await import("@fengshui/core");
  const { generateSimulation } = await import("@fengshui/simulation");
  const simulation = generateSimulation(createTemplateLayout("compact-two-room"));

  return {
    useSimulation: () => ({ simulation, pending: simulationState.pending })
  };
});

vi.mock("./Scene/SceneViewport", () => ({
  SceneViewport: () => <div data-testid="scene-viewport" />
}));

beforeEach(() => {
  vi.stubGlobal("React", React);
  simulationState.pending = true;
  window.localStorage.clear();
});

test("exposes a stable simulation status hook for computing and ready states", () => {
  const { rerender } = render(<AppShell />);

  expect(screen.getByTestId("simulation-status")).toHaveAttribute("data-state", "computing");
  expect(screen.getByTestId("template-option-blank")).toHaveAttribute("data-template-id", "blank");

  simulationState.pending = false;
  rerender(<AppShell />);

  expect(screen.getByTestId("simulation-status")).toHaveAttribute("data-state", "ready");
});
