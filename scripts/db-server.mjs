#!/usr/bin/env node
/**
 * Controls the project's PostgreSQL cluster — no admin rights required.
 *
 *   npm run db:start   — start the cluster (no-op if already running)
 *   npm run db:stop    — stop the cluster (fast shutdown)
 *   npm run db:status  — show whether it is running
 *
 * pg_ctl runs with stdio fully ignored: on Windows its server child otherwise
 * inherits the caller's console pipe and the terminal never sees EOF.
 * Server-side messages always land in <data dir>/db-server.log.
 *
 * Override locations via env vars if your setup differs:
 *   PG_HOME — directory containing bin/pg_ctl(.exe)
 *             default: <home>/postgres-pg18/pgsql on Windows, pg_ctl from PATH otherwise
 *   PG_DATA — cluster data directory
 *             default: <home>/postgres-stagepass
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const home = os.homedir();
const isWin = process.platform === "win32";

function resolvePgCtl() {
  if (process.env.PG_HOME) {
    const p = path.join(process.env.PG_HOME, "bin", isWin ? "pg_ctl.exe" : "pg_ctl");
    if (!existsSync(p)) throw new Error(`PG_HOME is set but pg_ctl not found at ${p}`);
    return p;
  }
  if (isWin) {
    const p = path.join(home, "postgres-pg18", "pgsql", "bin", "pg_ctl.exe");
    if (existsSync(p)) return p;
  }
  return "pg_ctl"; // system install on PATH (Linux/mac)
}

const dataDir = process.env.PG_DATA ?? path.join(home, "postgres-stagepass");
const logFile = path.join(dataDir, "db-server.log");

if (!existsSync(dataDir)) {
  console.error(
    `✖ Cluster data directory not found: ${dataDir}\n` +
      `  Set PG_DATA (and PG_HOME if needed), or create the cluster per README.md.`
  );
  process.exit(1);
}

const pgCtl = resolvePgCtl();
const action = process.argv[2] ?? "status";

/** Run pg_ctl with stdio ignored so no handle can leak into this terminal's pipe. */
function ctl(args, timeoutMs = 35_000) {
  return new Promise((resolve) => {
    const child = spawn(pgCtl, ["-D", dataDir, ...args], { stdio: "ignore" });
    const timer = setTimeout(() => {
      child.kill();
      resolve(-1);
    }, timeoutMs);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(-2);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code ?? -3);
    });
  });
}

/** Last few lines of the server log, for failure diagnostics. */
function logTail(lines = 6) {
  try {
    const all = readFileSync(logFile, "utf8").trim().split(/\r?\n/);
    return all.slice(-lines).join("\n");
  } catch {
    return `(no log at ${logFile})`;
  }
}

switch (action) {
  case "start": {
    if ((await ctl(["status"])) === 0) {
      console.log(`✔ PostgreSQL already running (data dir: ${dataDir})`);
      process.exit(0);
    }
    console.log(`Starting PostgreSQL (data dir: ${dataDir})…`);
    const code = await ctl(["-l", logFile, "-w", "-t", "30", "start"]);
    if (code === 0) {
      console.log(`✔ PostgreSQL started — port from postgresql.conf (5433), db "stagepass"`);
      process.exit(0);
    }
    console.error(`✖ pg_ctl start failed (exit code ${code}) — last server log lines:`);
    console.error(logTail());
    process.exit(1);
  }
  case "stop": {
    console.log("Stopping PostgreSQL…");
    const code = await ctl(["-m", "fast", "-w", "-t", "30", "stop"]);
    if (code === 0) {
      console.log("✔ PostgreSQL stopped");
      process.exit(0);
    }
    if (code === 3 || code === 4) {
      console.log("○ PostgreSQL is not running");
      process.exit(0); // already stopped is fine for a stop command
    }
    console.error(`✖ pg_ctl stop failed (exit code ${code}) — last server log lines:`);
    console.error(logTail());
    process.exit(1);
  }
  case "status": {
    const code = await ctl(["status"]);
    if (code === 0) {
      console.log(`✔ PostgreSQL running (data dir: ${dataDir})`);
      process.exit(0);
    }
    if (code === 3) {
      console.log(`○ PostgreSQL not running — start it with: npm run db:start`);
      process.exit(3);
    }
    console.log(`✖ pg_ctl status returned ${code} — see ${logFile}`);
    process.exit(code);
  }
  default:
    console.error(`Unknown action "${action}". Use: start | stop | status`);
    process.exit(1);
}
