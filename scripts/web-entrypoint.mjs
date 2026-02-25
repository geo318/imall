import { spawn } from "node:child_process";

const now = () => new Date().toISOString();

function log(step, message, extra) {
  if (extra === undefined) {
    console.log(`[WEB-ENTRYPOINT] ${now()} [${step}] ${message}`);
    return;
  }
  console.log(`[WEB-ENTRYPOINT] ${now()} [${step}] ${message}`, extra);
}

function fail(message, error) {
  console.error(`[WEB-ENTRYPOINT] ${now()} [ERROR] ${message}`, error ?? "");
  process.exit(1);
}

function summarizeUrl(value) {
  if (!value) return { present: false };

  try {
    const url = new URL(value.includes("://") ? value : `http://${value}`);
    return {
      present: true,
      protocol: url.protocol.replace(":", ""),
      host: url.hostname || undefined,
      port: url.port || undefined,
      pathname: url.pathname || undefined,
    };
  } catch {
    return { present: true, parseable: false };
  }
}

function memorySnapshot() {
  const { rss, heapTotal, heapUsed, external, arrayBuffers } = process.memoryUsage();
  const mb = (value) => Math.round((value / 1024 / 1024) * 10) / 10;
  return {
    rssMb: mb(rss),
    heapTotalMb: mb(heapTotal),
    heapUsedMb: mb(heapUsed),
    externalMb: mb(external),
    arrayBuffersMb: mb(arrayBuffers),
  };
}

log("1/3", "Container startup diagnostics");
log("1/3", "Runtime env", {
  nodeEnv: process.env.NODE_ENV ?? null,
  port: process.env.PORT ?? null,
  renderServiceName: process.env.RENDER_SERVICE_NAME ?? null,
  renderExternalUrl: process.env.RENDER_EXTERNAL_URL ?? null,
  backendUrl: summarizeUrl(process.env.BACKEND_URL),
  domain: process.env.DOMAIN ?? null,
  nextPublicDomain: process.env.NEXT_PUBLIC_DOMAIN ?? null,
  clerkPublishableKeySet: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
  clerkSecretKeySet: Boolean(process.env.CLERK_SECRET_KEY),
  startupMemory: memorySnapshot(),
});

log("2/3", "Starting Next.js web server");
const child = spawn("bun", ["run", "--bun", "next", "start"], { stdio: "inherit" });

const heartbeatMs = Number.parseInt(process.env.WEB_MEMORY_LOG_INTERVAL_MS ?? "0", 10);
if (Number.isFinite(heartbeatMs) && heartbeatMs > 0) {
  setInterval(() => {
    log("2/3", "Memory heartbeat", memorySnapshot());
  }, heartbeatMs).unref();
}

const forwardSignal = (signal) => {
  log("2/3", `Forwarding signal ${signal} to web process`);
  child.kill(signal);
};

process.on("SIGTERM", () => forwardSignal("SIGTERM"));
process.on("SIGINT", () => forwardSignal("SIGINT"));

child.on("error", (error) => fail("Failed to spawn Next.js process", error));
child.on("exit", (code, signal) => {
  if (signal) {
    log("3/3", `Web process exited via signal ${signal}`);
    process.exit(0);
  }

  log("3/3", `Web process exited with code ${code ?? 0}`);
  process.exit(code ?? 0);
});
