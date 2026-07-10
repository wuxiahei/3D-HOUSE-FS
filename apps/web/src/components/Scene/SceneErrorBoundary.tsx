"use client";

import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

interface SceneErrorBoundaryProps {
  children: ReactNode;
}

interface SceneErrorBoundaryState {
  error: string | null;
}

export class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  state: SceneErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SceneErrorBoundaryState {
    return { error: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Scene failed", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="scene-error" role="alert">
          <strong>3D scene failed to load</strong>
          <span>{this.state.error}</span>
        </div>
      );
    }

    return this.props.children;
  }
}
