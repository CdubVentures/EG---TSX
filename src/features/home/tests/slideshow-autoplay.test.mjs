import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createAutoplayController } from '../slideshow-autoplay.ts';

function createFakeTimers() {
  let nextId = 1;
  const intervals = new Map();
  const timeouts = new Map();

  return {
    intervals,
    timeouts,
    api: {
      setInterval(callback, ms) {
        const id = nextId++;
        intervals.set(id, { callback, ms });
        return id;
      },
      clearInterval(id) {
        intervals.delete(id);
      },
      setTimeout(callback, ms) {
        const id = nextId++;
        timeouts.set(id, { callback, ms });
        return id;
      },
      clearTimeout(id) {
        timeouts.delete(id);
      },
    },
    runNextTimeout() {
      const next = timeouts.entries().next().value;
      if (!next) return;
      const [id, { callback }] = next;
      timeouts.delete(id);
      callback();
    },
  };
}

describe('createAutoplayController', () => {
  it('keeps only one pending resume timeout when pause is called repeatedly', () => {
    const timers = createFakeTimers();
    let canRun = true;
    const controller = createAutoplayController({
      timers: timers.api,
      autoIntervalMs: 5000,
      canRun: () => canRun,
      onTick: () => {},
    });

    controller.start();
    controller.pause(5000);
    controller.pause(5000);

    assert.equal(timers.intervals.size, 0);
    assert.equal(timers.timeouts.size, 1);
  });

  it('stop clears both the active interval and pending resume timeout', () => {
    const timers = createFakeTimers();
    const controller = createAutoplayController({
      timers: timers.api,
      autoIntervalMs: 5000,
      canRun: () => true,
      onTick: () => {},
    });

    controller.start();
    controller.pause(5000);
    controller.stop();

    assert.equal(timers.intervals.size, 0);
    assert.equal(timers.timeouts.size, 0);
  });

  it('resume callback does not create duplicate intervals after repeated pauses', () => {
    const timers = createFakeTimers();
    const controller = createAutoplayController({
      timers: timers.api,
      autoIntervalMs: 5000,
      canRun: () => true,
      onTick: () => {},
    });

    controller.start();
    controller.pause(5000);
    timers.runNextTimeout();

    assert.equal(timers.timeouts.size, 0);
    assert.equal(timers.intervals.size, 1);
  });

  it('does not start or resume when canRun becomes false', () => {
    const timers = createFakeTimers();
    let canRun = true;
    const controller = createAutoplayController({
      timers: timers.api,
      autoIntervalMs: 5000,
      canRun: () => canRun,
      onTick: () => {},
    });

    controller.start();
    canRun = false;
    controller.pause(5000);

    assert.equal(timers.intervals.size, 0);
    assert.equal(timers.timeouts.size, 0);
  });
});
