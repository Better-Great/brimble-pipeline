const CADDY_ADMIN_URL = process.env.CADDY_ADMIN_URL || "http://caddy:2019";

export async function addRoute(deploymentId: string, port: number): Promise<string> {
  const route = {
    match: [{ path: [`/${deploymentId}/*`] }],
    handle: [
      {
        handler: "reverse_proxy",
        upstreams: [{ dial: `host.docker.internal:${port}` }],
      },
    ],
  };

  const response = await fetch(`${CADDY_ADMIN_URL}/config/apps/http/servers/srv0/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(route),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to add Caddy route: ${response.status} ${text}`);
  }

  return `http://localhost/${deploymentId}`;
}

export async function removeRoute(deploymentId: string): Promise<void> {
  const configResponse = await fetch(`${CADDY_ADMIN_URL}/config/apps/http/servers/srv0/routes`);
  if (!configResponse.ok) {
    const text = await configResponse.text();
    throw new Error(`Failed to fetch Caddy routes: ${configResponse.status} ${text}`);
  }

  const routes = (await configResponse.json()) as Array<{
    match?: Array<{ path?: string[] }>;
  }>;
  const targetPath = `/${deploymentId}/*`;
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
    },
  );

  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    const text = await deleteResponse.text();
    throw new Error(`Failed to remove Caddy route: ${deleteResponse.status} ${text}`);
  }
}
