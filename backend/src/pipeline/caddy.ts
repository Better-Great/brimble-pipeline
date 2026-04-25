const CADDY_ADMIN_URL = process.env.CADDY_ADMIN_URL || "http://caddy:2019";
const CADDY_ADMIN_ORIGIN = process.env.CADDY_ADMIN_ORIGIN || "//0.0.0.0:2019";
const DEPLOYMENT_BASE_URL = (process.env.DEPLOYMENT_BASE_URL || "http://localhost").replace(
  /\/$/,
  "",
);

function normalizeDeploymentId(deploymentId: string): string {
  return deploymentId.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

export async function addRoute(deploymentId: string, port: number): Promise<string> {
  const routeId = normalizeDeploymentId(deploymentId);
  const route = {
    match: [{ path: [`/${routeId}/*`] }],
    handle: [
      {
        handler: "reverse_proxy",
        upstreams: [{ dial: `host.docker.internal:${port}` }],
      },
    ],
  };

  const response = await fetch(`${CADDY_ADMIN_URL}/config/apps/http/servers/srv0/routes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: CADDY_ADMIN_ORIGIN,
    },
    body: JSON.stringify(route),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to add Caddy route: ${response.status} ${text}`);
  }

  return `${DEPLOYMENT_BASE_URL}/${routeId}`;
}

export async function removeRoute(deploymentId: string): Promise<void> {
  const routeId = normalizeDeploymentId(deploymentId);
  const configResponse = await fetch(`${CADDY_ADMIN_URL}/config/apps/http/servers/srv0/routes`, {
    headers: { Origin: CADDY_ADMIN_ORIGIN },
  });
  if (!configResponse.ok) {
    const text = await configResponse.text();
    throw new Error(`Failed to fetch Caddy routes: ${configResponse.status} ${text}`);
  }

  const routes = (await configResponse.json()) as Array<{
    match?: Array<{ path?: string[] }>;
  }>;
  const targetPath = `/${routeId}/*`;
  const routeIndex = routes.findIndex((route) =>
    route.match?.some((matcher) => matcher.path?.includes(targetPath)),
  );

  if (routeIndex < 0) {
    return;
  }

  const deleteResponse = await fetch(
    `${CADDY_ADMIN_URL}/config/apps/http/servers/srv0/routes/${routeIndex}`,
    {
      method: "DELETE",
      headers: { Origin: CADDY_ADMIN_ORIGIN },
    },
  );

  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    const text = await deleteResponse.text();
    throw new Error(`Failed to remove Caddy route: ${deleteResponse.status} ${text}`);
  }
}
