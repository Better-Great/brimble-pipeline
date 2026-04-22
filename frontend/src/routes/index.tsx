import { DeployForm } from "../components/DeployForm";
import { DeploymentList } from "../components/DeploymentList";

export function HomePage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "#fff" }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ marginBottom: 4 }}>Brimble Pipeline</h1>
        <p style={{ margin: 0, color: "#b5b5b5" }}>Build, deploy, and stream logs from one dashboard.</p>
      </header>
      <DeployForm />
      <hr style={{ margin: "22px 0", borderColor: "#2a2a2a" }} />
      <DeploymentList />
    </main>
  );
}
