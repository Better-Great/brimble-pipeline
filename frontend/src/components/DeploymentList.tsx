import { DeploymentCard } from "./DeploymentCard";
import { useDeployments } from "../api/queries";

export function DeploymentList() {
  const { data, isLoading } = useDeployments();

  if (isLoading) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        {[1, 2, 3].map((id) => (
          <div key={id} style={{ height: 120, borderRadius: 10, background: "#1b1b1b", border: "1px solid #2a2a2a" }} />
        ))}
      </div>
    );
  }

  const deployments = data || [];
  if (deployments.length === 0) {
    return <p style={{ color: "#aaa" }}>No deployments yet</p>;
  }

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, color: "#bbb" }}>{deployments.length} deployments</p>
      {deployments.map((deployment) => (
        <DeploymentCard key={deployment.id} deployment={deployment} />
      ))}
    </section>
  );
}
