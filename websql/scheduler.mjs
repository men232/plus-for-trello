let isFlushing = false;
let isFlushPending = false;
let flushIndex = 0;
let currentFlushPromise = null;

/**
 * Utility to schedule jobs and run in sequence
 */

const resolvedPromise = Promise.resolve();

/** @type {import('./types').SchedulerJob} */
const queue = [];

/**
 * @param {unknown} val
 * @return {val is Record<any, any>}
 */
const isObject = (val) => val !== null && typeof val === "object";

/**
 * @param {unknown} val
 * @return {val is Function}
 */
const isFunction = (val) => typeof val === "function";

/**
 * @template [T = any]
 * @param {T} val
 * @return {val is Promise<T>}
 */
const isPromise = (val) => {
  return (
    (isObject(val) || isFunction(val)) &&
    isFunction(val.then) &&
    isFunction(val.catch)
  );
};

const handleError = (err) => {
  console.error(err);
};

/**
 * @param {Function} [fn]
 * @return {Promise<void>}
 */
export function nextTick(fn) {
  const p = currentFlushPromise || resolvedPromise;
  return fn ? p.then(this ? fn.bind(this) : fn) : p;
}

/**
 * @param {Function} fn
 * @param {any[]} [args]
 */
export function callWithErrorHandling(fn, args) {
  let res;
  try {
    res = args ? fn(...args) : fn();
  } catch (err) {
    handleError(err);
  }
  return res;
}

/**
 * @param {Function} fn
 * @param {any[]} [args]
 * @return {any[]}
 */
export function callWithAsyncErrorHandling(fn, args) {
  if (isFunction(fn)) {
    const res = callWithErrorHandling(fn, args);
    if (res && isPromise(res)) {
      res.catch((err) => handleError(err));
    }
    return res;
  }

  const values = [];
  for (let i = 0; i < fn.length; i++) {
    values.push(callWithAsyncErrorHandling(fn[i], args));
  }
  return Promise.all(values);
}

function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true;
    currentFlushPromise = resolvedPromise.then(flushJobs);
  }
}

async function flushJobs() {
  isFlushPending = false;
  isFlushing = true;

  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex];
      if (job) {
        await callWithAsyncErrorHandling(job);
      }
    }
  } finally {
    flushIndex = 0;
    queue.length = 0;
    isFlushing = false;
    currentFlushPromise = null;
  }
}

/**
 * @param {import('./types').SchedulerJob} job
 */
export function queueJob(job) {
  queue.push(job);
  queueFlush();
}
