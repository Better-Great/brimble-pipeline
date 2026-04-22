import { useState, type MouseEvent } from "react";

import { useDeleteDeployment, type Deployment } from "../api/queries";
import { LogViewer } from "./LogViewer";

type Props = {
  deployment: Deployment;
};

const statusColors: Record<Deployment["status"], string> = {
  pending: "#888",
  building: "#d6ae00",
  deploying: "#4688ff",
  running: "#1bbf73",
  failed: "#d94848",
};

export function DeploymentCard({ deployment }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteMutation = useDeleteDeployment();

  const onDelete = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(deployment.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete deployment.";
      setDeleteError(message);
    }
  };

  return (
    <article
      onClick={() => setExpanded((state) => !state)}
      style={{ border: "1px solid #333", borderRadius: 10, padding: 14, background: "#171717", cursor: "pointer" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h3 style={{ margin: "0 0 8px" }}>{deployment.name}</h3>
          <span style={{ padding: "2px 10px", borderRadius: 999, background: statusColors[deployment.status], color: "#fff", fontSize: 12 }}>
            {deployment.status}
          </span>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleteMutation.isPending}
          style={{ height: 32, background: "#3b1c1c", color: "#ff9c9c", border: "1px solid #664", borderRadius: 8 }}
        >
          {deleteMutation.isPending ? "Deleting..." : "Delete"}
        </button>
      </div>
      <p style={{ margin: "10px 0 0" }}>Image: {deployment.image_tag || "-"}</p>
      <p style={{ margin: "6px 0 0" }}>
        URL: {deployment.url ? <a href={deployment.url} target="_blank" rel="noreferrer">{deployment.url}</a> : "-"}
      </p>
      <p style={{ margin: "6px 0 0", color: "#bbb" }}>
        Created: {new Date(deployment.created_at).toLocaleString()}
      </p>
      {deleteError ? <p style={{ margin: "8px 0 0", color: "#ff6666" }}>{deleteError}</p> : null}
      <LogViewer deploymentId={deployment.id} isActive={expanded} />
    </article>
  );
}
