import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync, closeSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const STATE_DIRNAME = '.server-state';
const POLL_INTERVAL_MS = 500;
export const EG_SERVER_START_TIMEOUT_MS = 180_000;

export const EG_SERVER_PORTS = {
  dev: 4321,
  preview: 4322,
} as const;

export type EgServerAction = 'start-dev' | 'restart-dev' | 'start-preview' | 'restart-preview';
export type EgServerTarget = 'dev' | 'preview';

interface EgServerContractEntry {
  target: EgServerTarget;
  port: number;
  browserUrl: string;
  pidFile: string;
  logFile: string;
  command: string;
}

interface EgServerContract {
  dev: EgServerContractEntry;
  preview: EgServerContractEntry;
}

interface EgServerActionInput {
  action: EgServerAction;
  root: string;
  trackedPidRunning: boolean;
  portOccupied: boolean;
}

interface EgServerPlan {
  ok: boolean;
  target: EgServerTarget;
  port: number;
  browserUrl: string;
  pidFile: string;
  command: string;
  shouldStart: boolean;
  shouldStopTracked: boolean;
  shouldClearViteCache: boolean;
  shouldOpenBrowser: boolean;
  shouldReuseRunningServer: boolean;
  error?: string;
}

export function getEgServerContract(root: string): EgServerContract {
  const stateDir = path.join(root, STATE_DIRNAME);

  return {
    dev: {
      target: 'dev',
      port: EG_SERVER_PORTS.dev,
      browserUrl: `http://${HOST}:${EG_SERVER_PORTS.dev}`,
      pidFile: path.join(stateDir, 'eg-astro-dev.pid'),
      logFile: path.join(stateDir, 'eg-astro-dev.log'),
      command: `npx astro dev --port ${EG_SERVER_PORTS.dev} --host ${HOST}`,
    },
    preview: {
      target: 'preview',
      port: EG_SERVER_PORTS.preview,
      browserUrl: `http://${HOST}:${EG_SERVER_PORTS.preview}`,
      pidFile: path.join(stateDir, 'eg-astro-preview.pid'),
      logFile: path.join(stateDir, 'eg-astro-preview.log'),
      command: `npx astro preview --port ${EG_SERVER_PORTS.preview} --host ${HOST}`,
    },
  };
}

export function planEgServerAction({
  action,
  root,
  trackedPidRunning,
  portOccupied,
}: EgServerActionInput): EgServerPlan {
  const contract = getEgServerContract(root);
  const target: EgServerTarget = action.includes('preview') ? 'preview' : 'dev';
  const server = contract[target];
  const isRestart = action === 'restart-dev' || action === 'restart-preview';

  if (!trackedPidRunning && portOccupied) {
    return {
      ok: false,
      target,
      port: server.port,
      browserUrl: server.browserUrl,
      pidFile: server.pidFile,
      command: server.command,
      shouldStart: false,
      shouldStopTracked: false,
      shouldClearViteCache: false,
      shouldOpenBrowser: false,
      shouldReuseRunningServer: false,
      error: `EG ${target} port ${server.port} is already in use by another process.`,
    };
  }

  if (isRestart) {
    return {
      ok: true,
      target,
      port: server.port,
      browserUrl: server.browserUrl,
      pidFile: server.pidFile,
      command: server.command,
      shouldStart: true,
      shouldStopTracked: trackedPidRunning,
      shouldClearViteCache: action === 'restart-dev',
      shouldOpenBrowser: true,
      shouldReuseRunningServer: false,
    };
  }

  if (trackedPidRunning) {
    return {
      ok: true,
      target,
      port: server.port,
      browserUrl: server.browserUrl,
      pidFile: server.pidFile,
      command: server.command,
      shouldStart: false,
      shouldStopTracked: false,
      shouldClearViteCache: false,
      shouldOpenBrowser: true,
      shouldReuseRunningServer: true,
    };
  }

  return {
    ok: true,
    target,
    port: server.port,
    browserUrl: server.browserUrl,
    pidFile: server.pidFile,
    command: server.command,
    shouldStart: true,
    shouldStopTracked: false,
    shouldClearViteCache: false,
    shouldOpenBrowser: true,
    shouldReuseRunningServer: false,
  };
}

function ensureStateDir(root: string): string {
  const stateDir = path.join(root, STATE_DIRNAME);
  mkdirSync(stateDir, { recursive: true });
  return stateDir;
}

function readTrackedPid(pidFile: string): number | null {
  try {
    const raw = readFileSync(pidFile, 'utf8').trim();
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function removeFileIfPresent(filePath: string): void {
  try {
    rmSync(filePath, { force: true, recursive: true });
  } catch {
    // Ignore stale cleanup failures.
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function isPortOccupied(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: HOST, port });
    let settled = false;

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(300, () => finish(false));
  });
}

async function waitForPort(port: number, occupied: boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const current = await isPortOccupied(port);
    if (current === occupied) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return false;
}

function stopTrackedProcess(pidFile: string): void {
  const pid = readTrackedPid(pidFile);
  if (pid == null) {
    removeFileIfPresent(pidFile);
    return;
  }

  try {
    spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch {
    // Ignore taskkill failures; the stale pid file is cleaned either way.
  }

  removeFileIfPresent(pidFile);
}

function clearViteCache(root: string): void {
  removeFileIfPresent(path.join(root, 'node_modules', '.vite'));
}

function startManagedProcess(server: EgServerContractEntry, root: string): void {
  ensureStateDir(root);
  const logFd = openSync(server.logFile, 'a');

  try {
    const child = spawn('cmd.exe', ['/d', '/c', server.command], {
      cwd: root,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true,
    });

    child.unref();
    writeFileSync(server.pidFile, `${child.pid}\n`, 'utf8');
  } finally {
    closeSync(logFd);
  }
}

function openBrowser(url: string): void {
  const child = spawn('cmd.exe', ['/d', '/c', `start "" "${url}"`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });

  child.unref();
}

async function run(action: EgServerAction, root: string): Promise<number> {
  const contract = getEgServerContract(root);
  const target: EgServerTarget = action.includes('preview') ? 'preview' : 'dev';
  const server = contract[target];
  const trackedPid = readTrackedPid(server.pidFile);
  const trackedPidRunning = trackedPid != null && isProcessRunning(trackedPid);

  if (!trackedPidRunning) {
    removeFileIfPresent(server.pidFile);
  }

  const portOccupied = await isPortOccupied(server.port);
  const plan = planEgServerAction({
    action,
    root,
    trackedPidRunning,
    portOccupied,
  });

  if (!plan.ok) {
    console.error(plan.error);
    console.error(`Refusing to start ${target} on ${server.browserUrl}.`);
    return 1;
  }

  if (plan.shouldStopTracked) {
    stopTrackedProcess(server.pidFile);
    await waitForPort(server.port, false, 10_000);
  }

  if (plan.shouldClearViteCache) {
    clearViteCache(root);
  }

  if (plan.shouldStart) {
    startManagedProcess(server, root);
  }

  if (plan.shouldReuseRunningServer || plan.shouldStart) {
    const ready = await waitForPort(server.port, true, EG_SERVER_START_TIMEOUT_MS);
    if (!ready) {
      console.error(`${target} did not open ${server.browserUrl} within ${EG_SERVER_START_TIMEOUT_MS}ms.`);
      console.error(`Check ${server.logFile} for details.`);
      return 1;
    }
  }

  if (plan.shouldOpenBrowser) {
    openBrowser(server.browserUrl);
  }

  console.log(`${target} available at ${server.browserUrl}`);
  console.log(`Log: ${server.logFile}`);
  return 0;
}

async function main(): Promise<void> {
  const action = process.argv[2] as EgServerAction | undefined;
  const root = process.cwd();

  if (
    action !== 'start-dev'
    && action !== 'restart-dev'
    && action !== 'start-preview'
    && action !== 'restart-preview'
  ) {
    console.error('Usage: node --import tsx scripts/dev-server-control.ts <start-dev|restart-dev|start-preview|restart-preview>');
    process.exitCode = 1;
    return;
  }

  process.exitCode = await run(action, root);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);
if (invokedPath === path.resolve(modulePath)) {
  void main();
}
