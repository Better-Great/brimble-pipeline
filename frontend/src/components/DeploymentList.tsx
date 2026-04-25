import { DeploymentCard } from "./DeploymentCard";
import { useDeployments } from "../api/queries";

export function DeploymentList() {
  const { data, isLoading, isError, error, refetch } = useDeployments();

  if (isLoading) {
    return (
      <div className="deployments">
        <p className="deployments__meta">Loading deployments...</p>
        {[1, 2, 3].map((id) => (
          <div key={id} className="card deployment-skeleton" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card load-error">
        <p className="error-text">
          {error instanceof Error ? error.message : "Failed to load deployments."}
        </p>
        <button type="button" className="btn" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const deployments = data || [];
  if (deployments.length === 0) {
    return <p className="empty-state">No deployments yet</p>;
  }

  return (
    <section className="deployments">
      <p className="deployments__meta">{deployments.length} deployments</p>
      {deployments.map((deployment) => (
        <DeploymentCard key={deployment.id} deployment={deployment} />
      ))}
    </section>
  );
}
