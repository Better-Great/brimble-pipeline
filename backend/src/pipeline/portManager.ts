import net from "node:net";

const usedPorts = new Set<number>();
const defaultMinPort = Number(process.env.DEPLOYMENT_PORT_MIN || 4000);
const defaultMaxPort = Number(process.env.DEPLOYMENT_PORT_MAX || 5000);

function canBind(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen(port, "0.0.0.0", () => {
      server.close(() => resolve(true));
    });
  });
}

export async function getAvailablePort(): Promise<number> {
  for (let port = defaultMinPort; port <= defaultMaxPort; port += 1) {
    if (usedPorts.has(port)) {
      continue;
    }
    if (await canBind(port)) {
      usedPorts.add(port);
      return port;
    }
  }
  throw new Error(`No available port found in range ${defaultMinPort}-${defaultMaxPort}.`);
}

export function releasePort(port: number): void {
  usedPorts.delete(port);
}
