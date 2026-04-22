import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  deploymentId: string;
  isActive: boolean;
};

type LogLine = {
  line: number;
  content: string;
  deploymentId: string;
};

export function LogViewer({ deploymentId, isActive }: Props) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<"connecting" | "streaming" | "done" | "error">("connecting");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    setLogs([]);
    setStatus("connecting");
    const eventSource = new EventSource(`/api/deployments/${deploymentId}/logs`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { done?: boolean; line?: number; content?: string; deploymentId?: string };
        if (payload.done) {
          setStatus("done");
          eventSource.close();
          return;
        }
        if (typeof payload.line === "number" && typeof payload.content === "string") {
          setLogs((current) => [...current, payload as LogLine]);
          setStatus("streaming");
        }
      } catch {
        setStatus("error");
      }
    };

    eventSource.onerror = () => {
      setStatus("error");
    };

    return () => {
      eventSource.close();
    };
  }, [deploymentId, isActive]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const content = useMemo(() => logs.map((line) => `${line.line}: ${line.content}`).join("\n"), [logs]);

  if (!isActive) {
    return null;
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong>Logs</strong>
        <button
          type="button"
          onClick={async () => navigator.clipboard.writeText(content)}
          style={{ background: "#242424", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "4px 10px" }}
        >
          Copy
        </button>
      </div>
      <div
        ref={containerRef}
        style={{ background: "#111", color: "#00ff88", fontFamily: "monospace", padding: 10, borderRadius: 8, maxHeight: 260, overflow: "auto" }}
      >
        {status === "connecting" ? "Connecting..." : null}
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{content}</pre>
        {status === "done" ? "\nStream ended" : null}
        {status === "error" ? "\nStream error" : null}
      </div>
    </div>
  );
}
