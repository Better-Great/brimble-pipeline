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
  const [expanded, setExpanded] = useState(
    () => deployment.status === "pending" || deployment.status === "building" || deployment.status === "deploying",
  );
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
    <article className="card deployment-card">
      <div className="deployment-card__header">
        <div>
          <h3 className="deployment-card__name">{deployment.name}</h3>
          <span className="status-badge" style={{ background: statusColors[deployment.status] }}>
            {deployment.status}
          </span>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleteMutation.isPending}
          className="btn btn--danger"
        >
          {deleteMutation.isPending ? "Deleting..." : "Delete"}
        </button>
      </div>
      <div className="deployment-card__controls">
        <button
          type="button"
          className="btn"
          onClick={() => setExpanded((state) => !state)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide logs" : "Show logs"}
        </button>
      </div>
      <p className="deployment-detail">
        <strong>Image:</strong> {deployment.image_tag || "-"}
      </p>
      <p className="deployment-detail">
        <strong>URL:</strong>{" "}
        {deployment.url ? <a href={deployment.url} target="_blank" rel="noreferrer">{deployment.url}</a> : "-"}
      </p>
      <p className="deployment-date">
        Created: {new Date(deployment.created_at).toLocaleString()}
      </p>
      {deployment.error_message ? <p className="error-text">{deployment.error_message}</p> : null}
      {deleteError ? <p className="error-text">{deleteError}</p> : null}
      <LogViewer deploymentId={deployment.id} isActive={expanded} />
    </article>
  );
}
