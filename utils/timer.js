/**
 * Timer utility functions for managing timeouts and thresholds
 */

class Timer {
  constructor(callback, delay) {
    this.callback = callback;
    this.delay = delay;
    this.timerId = null;
    this.startTime = null;
  }

  start() {
    this.startTime = Date.now();
    this.timerId = setTimeout(() => {
      this.callback();
      this.timerId = null;
    }, this.delay);
  }

  stop() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  getElapsedTime() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  isRunning() {
    return this.timerId !== null;
  }
}

/**
 * Creates a timer instance
 * @param {Function} callback - Function to call when timer expires
 * @param {number} delay - Delay in milliseconds
 * @returns {Timer} Timer instance
 */
function createTimer(callback, delay) {
  return new Timer(callback, delay);
}

/**
 * Sleep utility function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if time has exceeded threshold
 * @param {number} startTime - Start time timestamp
 * @param {number} maxTime - Maximum time in milliseconds
 * @returns {boolean} True if exceeded
 */
function hasExceededTime(startTime, maxTime) {
  return Date.now() - startTime > maxTime;
}

module.exports = {
  Timer,
  createTimer,
  sleep,
  hasExceededTime,
};

