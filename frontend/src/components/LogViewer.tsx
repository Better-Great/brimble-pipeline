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
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const containerRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const latestLineRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    setLogs([]);
    setStatus("connecting");
    doneRef.current = false;
    latestLineRef.current = 0;

    let eventSource: EventSource | null = null;
    const connect = () => {
      eventSource = new EventSource(`/api/deployments/${deploymentId}/logs`);
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            done?: boolean;
            line?: number;
            content?: string;
            deploymentId?: string;
          };
          if (payload.done) {
            doneRef.current = true;
            setStatus("done");
            eventSource?.close();
            return;
          }
          if (typeof payload.line === "number" && typeof payload.content === "string") {
            setLogs((current) => {
              if (payload.line === undefined || payload.line <= latestLineRef.current) {
                return current;
              }
              latestLineRef.current = payload.line;
              return [...current, payload as LogLine];
            });
            setStatus("streaming");
          }
        } catch {
          setStatus("error");
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        if (!doneRef.current) {
          setStatus("error");
          reconnectTimeoutRef.current = window.setTimeout(() => {
            setStatus("connecting");
            connect();
          }, 1500);
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      eventSource?.close();
    };
  }, [deploymentId, isActive]);

  useEffect(() => {
    if (isAutoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [isAutoScroll, logs]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const statusLabel =
    status === "connecting"
      ? "Connecting"
      : status === "streaming"
        ? "Live"
        : status === "done"
          ? "Completed"
          : "Reconnecting";

  const content = useMemo(() => logs.map((line) => `${line.line}: ${line.content}`).join("\n"), [logs]);

  if (!isActive) {
    return null;
  }

  return (
    <div className="log-panel">
      <div className="log-panel__header">
        <div className="log-panel__heading">
          <strong className="log-panel__title">Logs</strong>
          <span className={`log-status log-status--${status}`}>{statusLabel}</span>
          <span className="log-count">{logs.length} lines</span>
        </div>
        <div className="log-panel__actions">
          <button type="button" className="btn" onClick={() => setIsAutoScroll((current) => !current)}>
            {isAutoScroll ? "Auto-scroll: on" : "Auto-scroll: off"}
          </button>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(content);
              setCopyLabel("Copied");
              if (copyTimeoutRef.current !== null) {
                clearTimeout(copyTimeoutRef.current);
              }
              copyTimeoutRef.current = window.setTimeout(() => {
                setCopyLabel("Copy");
              }, 1200);
            }}
            className="btn"
          >
            {copyLabel}
          </button>
        </div>
      </div>
      <div ref={containerRef} className="log-console">
        {status === "connecting" ? <span className="log-console__hint">Connecting...</span> : null}
        {logs.length === 0 ? <span className="log-console__hint">Waiting for deployment logs...</span> : null}
        <pre>{content}</pre>
        {status === "done" ? <span className="log-console__hint">{"\nStream ended"}</span> : null}
        {status === "error" ? <span className="log-console__hint">{"\nStream interrupted, retrying..."}</span> : null}
      </div>
    </div>
  );
}
