/**
 * @file start-exam-options.js
 * @description Pure state and computation helpers for the start-exam configuration dialog.
 */

/**
 * Clamps a question count integer between a minimum and maximum boundary.
 * @param {number} rawValue - Raw input value.
 * @param {number} minimumBoundary - Minimum permissible count.
 * @param {number} maximumBoundary - Maximum permissible count.
 * @returns {number} Clamped integer count.
 */
export const clampQuestionCount = (
  rawValue,
  minimumBoundary,
  maximumBoundary
) => {
  /** @type {number} */
  const parsedValue = Math.floor(Number(rawValue));
  /** @type {number} */
  const safeValue = Number.isFinite(parsedValue) ? parsedValue : minimumBoundary;
  return Math.max(minimumBoundary, Math.min(safeValue, maximumBoundary));
};

/**
 * Resolves the initial default question count based on preferred budget and available pool size.
 * @param {number} preferredCount - Preferred default count (e.g. 100 for mock, 10 for tab).
 * @param {number} poolSize - Total questions available in the pool.
 * @returns {number} Resolved default question count.
 */
export const resolveDefaultQuestionCount = (preferredCount, poolSize) => {
  /** @type {number} */
  const safePoolSize = Math.max(1, Math.floor(Number(poolSize)) || 1);
  /** @type {number} */
  const safePreferredCount = Math.floor(Number(preferredCount)) || 1;
  return clampQuestionCount(safePreferredCount, 1, safePoolSize);
};

/**
 * Maximum seconds allowed in the timer dialog (23 hours, 59 minutes, 59 seconds).
 * @type {number}
 */
export const MAXIMUM_TIMER_SECONDS = 23 * 3600 + 59 * 60 + 59;

/**
 * Computes duration in seconds from question count (1 minute per question, capped at 23:59:59).
 * @param {number} questionCount - Number of questions.
 * @returns {number} Duration in seconds.
 */
export const secondsForQuestionCount = (questionCount) => {
  /** @type {number} */
  const safeCount = Math.max(0, Math.floor(Number(questionCount)) || 0);
  /** @type {number} */
  const computedSeconds = safeCount * 60;
  return Math.min(computedSeconds, MAXIMUM_TIMER_SECONDS);
};

/**
 * Creates initial timer state (untimed, unlinked).
 * @returns {{ hours: number, minutes: number, seconds: number, linked: boolean }} Initial time state.
 */
export const createTimeState = () => ({
  hours: 0,
  minutes: 0,
  seconds: 0,
  linked: false
});

/**
 * Applies the 'By question count' duration (1 min/item) and sets linked mode.
 * @param {{ hours: number, minutes: number, seconds: number, linked: boolean }} currentState - Current time state.
 * @param {number} questionCount - Question count to derive time from.
 * @returns {{ hours: number, minutes: number, seconds: number, linked: boolean }} Updated time state.
 */
export const applyByQuestionCount = (currentState, questionCount) => {
  /** @type {number} */
  const totalSeconds = secondsForQuestionCount(questionCount);
  /** @type {number} */
  const derivedHours = Math.floor(totalSeconds / 3600);
  /** @type {number} */
  const derivedMinutes = Math.floor((totalSeconds % 3600) / 60);
  /** @type {number} */
  const derivedSeconds = totalSeconds % 60;

  return {
    hours: derivedHours,
    minutes: derivedMinutes,
    seconds: derivedSeconds,
    linked: true
  };
};

/**
 * Updates timer state when question count changes, updating time only if linked.
 * @param {{ hours: number, minutes: number, seconds: number, linked: boolean }} currentState - Current time state.
 * @param {number} questionCount - New question count.
 * @returns {{ hours: number, minutes: number, seconds: number, linked: boolean }} Updated time state.
 */
export const onQuestionCountChanged = (currentState, questionCount) => {
  if (currentState.linked) {
    return applyByQuestionCount(currentState, questionCount);
  }
  return { ...currentState };
};

/**
 * Updates timer state upon user manual editing of hours, minutes, and seconds, clearing linked mode.
 * @param {{ hours: number, minutes: number, seconds: number, linked: boolean }} currentState - Current time state.
 * @param {number|string} rawHours - Raw hours input.
 * @param {number|string} rawMinutes - Raw minutes input.
 * @param {number|string} [rawSeconds=0] - Raw seconds input.
 * @returns {{ hours: number, minutes: number, seconds: number, linked: boolean }} Updated time state.
 */
export const onTimeEdited = (currentState, rawHours, rawMinutes, rawSeconds = 0) => {
  /** @type {number} */
  const parsedHours = Math.floor(Number(rawHours));
  /** @type {number} */
  const safeHours = Number.isFinite(parsedHours)
    ? Math.max(0, Math.min(23, parsedHours))
    : 0;

  /** @type {number} */
  const parsedMinutes = Math.floor(Number(rawMinutes));
  /** @type {number} */
  const safeMinutes = Number.isFinite(parsedMinutes)
    ? Math.max(0, Math.min(59, parsedMinutes))
    : 0;

  /** @type {number} */
  const parsedSeconds = Math.floor(Number(rawSeconds));
  /** @type {number} */
  const safeSeconds = Number.isFinite(parsedSeconds)
    ? Math.max(0, Math.min(59, parsedSeconds))
    : 0;

  return {
    hours: safeHours,
    minutes: safeMinutes,
    seconds: safeSeconds,
    linked: false
  };
};

/**
 * Formats duration in seconds to standard clock string ("M:SS" or "H:MM:SS").
 * @param {number} totalSeconds - Duration in seconds.
 * @returns {string} Formatted clock string.
 */
export const formatSecondsToClockString = (totalSeconds) => {
  /** @type {number} */
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds)) || 0);
  /** @type {number} */
  const hours = Math.floor(safeSeconds / 3600);
  /** @type {number} */
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  /** @type {number} */
  const remainingSeconds = safeSeconds % 60;

  /** @type {string} */
  const paddedMinutes = String(minutes).padStart(2, "0");
  /** @type {string} */
  const paddedSeconds = String(remainingSeconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
};

/**
 * Builds the final result payload for the onConfirm callback.
 * @param {number} questionCount - Selected question count.
 * @param {{ hours: number, minutes: number, seconds?: number, linked: boolean }} timeState - Final timer state.
 * @returns {{ isTimed: boolean, durationSeconds: number, formattedTime: string, questionCount: number }} Result payload.
 */
export const buildStartResult = (questionCount, timeState) => {
  /** @type {number} */
  const safeCount = Math.max(1, Math.floor(Number(questionCount)) || 1);
  /** @type {number} */
  const totalSeconds = (timeState.hours || 0) * 3600 + (timeState.minutes || 0) * 60 + (timeState.seconds || 0);
  /** @type {boolean} */
  const isTimed = totalSeconds > 0;
  /** @type {string} */
  const formattedTime = isTimed
    ? formatSecondsToClockString(totalSeconds)
    : "";

  return {
    isTimed,
    durationSeconds: totalSeconds,
    formattedTime,
    questionCount: safeCount
  };
};
