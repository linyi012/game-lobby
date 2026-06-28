type GameTickTask = () => void | Promise<void>;

const tasksByInterval = new Map<number, GameTickTask[]>();
const runningByInterval = new Map<number, boolean>();
const intervals: NodeJS.Timeout[] = [];

export function registerGameTick(task: GameTickTask, intervalMs = 1000) {
  const tasks = tasksByInterval.get(intervalMs) ?? [];
  tasks.push(task);
  tasksByInterval.set(intervalMs, tasks);
}

export function startGameTicker() {
  if (intervals.length > 0) return;

  for (const [intervalMs, tasks] of tasksByInterval) {
    const timer = setInterval(() => {
      if (runningByInterval.get(intervalMs)) return;
      runningByInterval.set(intervalMs, true);
      void (async () => {
        try {
          for (const task of tasks) {
            await task();
          }
        } finally {
          runningByInterval.set(intervalMs, false);
        }
      })();
    }, intervalMs);

    if (typeof timer.unref === 'function') timer.unref();
    intervals.push(timer);
  }
}

export function stopGameTicker() {
  for (const timer of intervals) {
    clearInterval(timer);
  }
  intervals.length = 0;
  tasksByInterval.clear();
  runningByInterval.clear();
}
