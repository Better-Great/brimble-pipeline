import { DeployForm } from "../components/DeployForm";
import { DeploymentList } from "../components/DeploymentList";

export function HomePage() {
  return (
    <main className="container">
      <header className="hero">
        <h1 className="hero__title">Brimble Pipeline</h1>
        <p className="hero__subtitle">Build, deploy, and stream logs from one dashboard.</p>
      </header>
      <DeployForm />
      <hr className="section-divider" />
      <section className="section-head">
        <h2 className="section-head__title">Deployments</h2>
        <p className="section-head__subtitle">Track status, open live logs, and verify deployed URLs.</p>
      </section>
      <DeploymentList />
    </main>
  );
}
