import { spawnSync } from "node:child_process";

const [task] = process.argv.slice(2);
if (!task) {
  console.error("Usage: render.mjs <build|start>");
  process.exit(1);
}

const name = (process.env.RENDER_SERVICE_NAME || process.env.SERVICE || "").toLowerCase();
const isApi = name.includes("api");
const isWeb = name.includes("web");

const run = (args) => {
  const result = spawnSync(args[0], args.slice(1), { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const shouldRunMigrations = () => {
  const flag = (process.env.RUN_MIGRATIONS || "").toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
};

const bunRun = (script) => ["bun", "run", script];

if (task === "build") {
  if (isApi && !isWeb) {
    run(bunRun("build:packages"));
    run(bunRun("build:api"));
  } else if (isWeb && !isApi) {
    run(bunRun("build:packages"));
    run(bunRun("build:web"));
  } else {
    run(bunRun("build:all"));
  }
} else if (task === "start") {
  if (isApi && !isWeb) {
    if (shouldRunMigrations()) {
      run(bunRun("db:push"));
    }
    run(bunRun("start:api"));
  } else if (isWeb && !isApi) {
    run(bunRun("start:web"));
  } else {
    if (shouldRunMigrations()) {
      run(bunRun("db:push"));
    }
    run(bunRun("start:all"));
  }
} else {
  console.error(`Unknown task: ${task}`);
  process.exit(1);
}
