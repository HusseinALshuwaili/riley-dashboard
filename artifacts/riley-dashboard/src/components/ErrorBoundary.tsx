/**
 * ErrorBoundary — catches React render errors and shows a recoverable UI
 * instead of a white screen.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Riley] Render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "60vh",
            gap: "16px",
            fontFamily: "monospace",
            color: "rgba(180,185,200,0.5)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "32px" }}>⚠</div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "rgba(249,115,22,0.8)" }}>
            Something went wrong
          </div>
          <div style={{ fontSize: "12px", maxWidth: "360px", lineHeight: 1.6 }}>
            {this.state.error?.message ?? "An unexpected error occurred."}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            style={{
              marginTop: "8px",
              padding: "8px 20px",
              background: "rgba(132,0,255,0.15)",
              border: "1px solid rgba(132,0,255,0.3)",
              borderRadius: "6px",
              color: "hsl(272,100%,72%)",
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "monospace",
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * ApiErrorCard — standard inline error display for failed API calls
 */
export function ApiErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      style={{
        padding: "24px 28px",
        background: "rgba(249,115,22,0.05)",
        border: "1px solid rgba(249,115,22,0.15)",
        borderRadius: "10px",
        display: "flex",
        alignItems: "flex-start",
        gap: "16px",
        maxWidth: "540px",
      }}
    >
      <div style={{ fontSize: "18px", lineHeight: 1 }}>⚡</div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "rgba(249,115,22,0.9)",
            fontFamily: "monospace",
            marginBottom: "6px",
          }}
        >
          API connection issue
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "rgba(180,185,200,0.5)",
            lineHeight: 1.55,
            fontFamily: "monospace",
          }}
        >
          {message}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginTop: "12px",
              padding: "6px 16px",
              background: "rgba(249,115,22,0.1)",
              border: "1px solid rgba(249,115,22,0.25)",
              borderRadius: "5px",
              color: "rgba(249,115,22,0.9)",
              fontSize: "11px",
              cursor: "pointer",
              fontFamily: "monospace",
              letterSpacing: "0.05em",
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * OfflineBanner — shows a sticky notice when the API server is unreachable.
 * Add to any page that polls /api/health.
 */
export function OfflineBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(249,115,22,0.95)",
        color: "#fff",
        padding: "10px 20px",
        borderRadius: "8px",
        fontSize: "12px",
        fontFamily: "monospace",
        fontWeight: 600,
        letterSpacing: "0.04em",
        zIndex: 9999,
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <span style={{ animation: "pulse 1.5s infinite" }}>●</span>
      API server offline — check Render env vars
    </div>
  );
}
