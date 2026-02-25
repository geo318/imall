import { spawn, spawnSync } from "node:child_process";

const now = () => new Date().toISOString();

function log(step, message, extra) {
  if (extra === undefined) {
    console.log(`[API-ENTRYPOINT] ${now()} [${step}] ${message}`);
    return;
  }
  console.log(`[API-ENTRYPOINT] ${now()} [${step}] ${message}`, extra);
}

function fail(message, error) {
  console.error(`[API-ENTRYPOINT] ${now()} [ERROR] ${message}`, error ?? "");
  process.exit(1);
}

function summarizeDatabaseUrl(value) {
  if (!value) return { present: false };

  try {
    const url = new URL(value);
    return {
      present: true,
      protocol: url.protocol.replace(":", ""),
      host: url.hostname || undefined,
      port: url.port || undefined,
      database: url.pathname.replace(/^\//, "") || undefined,
      sslmode: url.searchParams.get("sslmode") || undefined,
    };
  } catch {
    return { present: true, parseable: false };
  }
}

function runChecked(step, command, args) {
  const startedAt = Date.now();
  log(step, `Running: ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit" });
  const durationMs = Date.now() - startedAt;

  if (result.status !== 0) {
    fail(`${step} failed after ${durationMs}ms (exit ${result.status ?? "unknown"})`);
  }

  log(step, `Success in ${durationMs}ms`);
}

log("1/4", "Container startup diagnostics");
log("1/4", "Runtime env", {
  nodeEnv: process.env.NODE_ENV ?? null,
  port: process.env.PORT ?? null,
  renderServiceName: process.env.RENDER_SERVICE_NAME ?? null,
  renderExternalUrl: process.env.RENDER_EXTERNAL_URL ?? null,
  domain: process.env.DOMAIN ?? null,
  nextPublicDomain: process.env.NEXT_PUBLIC_DOMAIN ?? null,
  domainSet: Boolean(process.env.DOMAIN),
  nextPublicDomainSet: Boolean(process.env.NEXT_PUBLIC_DOMAIN),
  databaseUrl: summarizeDatabaseUrl(process.env.DATABASE_URL),
});

log("2/4", "Running database migrations (db:push)");
runChecked("2/4", "bun", ["run", "db:push"]);

log("3/4", "Starting API process");
const child = spawn("bun", ["apps/api/dist/index.js"], { stdio: "inherit" });

const forwardSignal = (signal) => {
  log("3/4", `Forwarding signal ${signal} to API process`);
  child.kill(signal);
};

process.on("SIGTERM", () => forwardSignal("SIGTERM"));
process.on("SIGINT", () => forwardSignal("SIGINT"));

child.on("error", (error) => fail("Failed to spawn API process", error));
child.on("exit", (code, signal) => {
  if (signal) {
    log("4/4", `API process exited via signal ${signal}`);
    process.exit(0);
  }

  log("4/4", `API process exited with code ${code ?? 0}`);
  process.exit(code ?? 0);
});
