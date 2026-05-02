interface TimerApi {
  setInterval(callback: () => void, ms: number): ReturnType<typeof setInterval>;
  clearInterval(id: ReturnType<typeof setInterval>): void;
  setTimeout(callback: () => void, ms: number): ReturnType<typeof setTimeout>;
  clearTimeout(id: ReturnType<typeof setTimeout>): void;
}

interface CreateAutoplayControllerOptions {
  timers?: TimerApi;
  autoIntervalMs: number;
  canRun: () => boolean;
  onTick: () => void;
}

export function createAutoplayController(options: CreateAutoplayControllerOptions) {
  const timers = options.timers ?? globalThis;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let resumeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  function clearIntervalTimer() {
    if (intervalId) {
      timers.clearInterval(intervalId);
      intervalId = null;
    }
  }

  function clearResumeTimeout() {
    if (resumeTimeoutId) {
      timers.clearTimeout(resumeTimeoutId);
      resumeTimeoutId = null;
    }
  }

  function start() {
    clearResumeTimeout();
    clearIntervalTimer();

    if (!options.canRun()) return;

    intervalId = timers.setInterval(() => {
      if (!options.canRun()) {
        clearIntervalTimer();
        return;
      }
      options.onTick();
    }, options.autoIntervalMs);
  }

  function pause(resumeAfterMs: number) {
    clearIntervalTimer();
    clearResumeTimeout();

    if (!options.canRun()) return;

    resumeTimeoutId = timers.setTimeout(() => {
      resumeTimeoutId = null;
      start();
    }, resumeAfterMs);
  }

  function stop() {
    clearIntervalTimer();
    clearResumeTimeout();
  }

  return {
    start,
    pause,
    stop,
  };
}
