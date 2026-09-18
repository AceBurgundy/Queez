import { Component, css, html, signal } from "../../../../Component.js";
import { showToast } from "../../toast/scripts/toast__service.js";

css(import.meta, ["../styles/quiz-action-bar.css"]);

/**
 * Parses user-entered time string into total seconds.
 * Supports:
 * - "HH:MM:SS" (e.g. "01:00:15" -> 3615s)
 * - "MM:SS" (e.g. "02:00" -> 120s, "00:30" -> 30s)
 * - Single integer (e.g. "5" -> 5 minutes = 300s)
 * @param {string} timeString
 * @returns {number} Total seconds (0 if invalid/empty).
 */
export function parseTimeStringToSeconds(timeString) {
  if (!timeString || typeof timeString !== "string") {
    return 0;
  }
  const clean = timeString.trim();
  if (!clean) return 0;

  if (clean.includes(":")) {
    const parts = clean.split(":");
    if (parts.length === 3) {
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      const seconds = parseInt(parts[2], 10) || 0;
      return Math.max(0, hours * 3600 + minutes * 60 + seconds);
    }
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseInt(parts[1], 10) || 0;
    return Math.max(0, minutes * 60 + seconds);
  }

  const num = parseInt(clean, 10);
  if (!Number.isNaN(num) && num > 0) {
    return num * 60;
  }
  return 0;
}

/**
 * Formats total seconds into "MM:SS" (or "HH:MM:SS" if >= 1 hour).
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatSecondsToTime(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return "00:00";
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Formats total seconds into standard timer string "MM:SS" or "HH:MM:SS".
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatSecondsToTimeStr(totalSeconds) {
  return formatSecondsToTime(totalSeconds);
}

/**
 * Opens a mobile-optimized Material Design 3 / Flutter-inspired TimePicker dialog modal.
 * @param {Object} options
 * @param {number} [options.initialHours=0]
 * @param {number} [options.initialMinutes=0]
 * @param {number} [options.defaultHours=0]
 * @param {number} [options.defaultMinutes=1]
 * @param {function(string): void} [options.onConfirm]
 */
export function openTimePickerDialog({
  initialHours = 0,
  initialMinutes = 0,
  defaultHours = 0,
  defaultMinutes = 1,
  onConfirm = () => {}
} = {}) {
  if (typeof document === "undefined") return;

  const existingModal = document.getElementById("queezTimePickerModal");
  if (existingModal) {
    existingModal.remove();
  }

  let curHours = Math.max(0, Math.min(23, initialHours));
  let curMinutes = Math.max(0, Math.min(59, initialMinutes));

  const pad = (n) => String(n).padStart(2, "0");
  const defaultFormatted = `${pad(defaultHours)}:${pad(defaultMinutes)}`;

  const modalContainer = document.createElement("div");
  modalContainer.id = "queezTimePickerModal";
  modalContainer.className = "time-picker-scrim";
  modalContainer.setAttribute("role", "dialog");
  modalContainer.setAttribute("aria-modal", "true");
  modalContainer.setAttribute("aria-labelledby", "timePickerTitle");

  modalContainer.innerHTML = `
    <div class="time-picker-dialog" role="document">
      <div class="time-picker-dialog__header">
        <div class="time-picker-dialog__icon">
          <svg class="squircle-clock-svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9.5" />
            <line x1="12" y1="12" x2="12" y2="6.5" />
            <line x1="12" y1="12" x2="12" y2="4" />
            <circle cx="12" cy="12" r="1.25" fill="currentColor" />
          </svg>
        </div>
        <div>
          <h3 id="timePickerTitle" class="time-picker-dialog__title">Set Exam Timer</h3>
          <p class="time-picker-dialog__subtitle">Configure countdown duration</p>
        </div>
      </div>

      <div class="time-picker-dialog__time-display">
        <div class="time-picker-dialog__input-wrap">
          <label class="time-picker-dialog__label" for="timePickerHoursInput">Hour</label>
          <input
            id="timePickerHoursInput"
            type="number"
            min="0"
            max="23"
            step="1"
            class="time-picker-dialog__input-box"
            value="${pad(curHours)}"
            aria-label="Hours (00-23)"
          />
        </div>
        <span class="time-picker-dialog__colon">:</span>
        <div class="time-picker-dialog__input-wrap">
          <label class="time-picker-dialog__label" for="timePickerMinutesInput">Minute</label>
          <input
            id="timePickerMinutesInput"
            type="number"
            min="0"
            max="59"
            step="1"
            class="time-picker-dialog__input-box"
            value="${pad(curMinutes)}"
            aria-label="Minutes (00-59)"
          />
        </div>
      </div>

      <!-- Quick Preset Chips -->
      <div class="time-picker-dialog__presets" aria-label="Timer Quick Presets">
        <button type="button" class="time-picker-dialog__chip" data-preset="default">
          Default (${defaultFormatted})
        </button>
        <button type="button" class="time-picker-dialog__chip" data-preset="5m">5 min</button>
        <button type="button" class="time-picker-dialog__chip" data-preset="15m">15 min</button>
        <button type="button" class="time-picker-dialog__chip" data-preset="30m">30 min</button>
        <button type="button" class="time-picker-dialog__chip" data-preset="untimed">Untimed</button>
      </div>

      <!-- Actions -->
      <div class="time-picker-dialog__actions">
        <button type="button" class="time-picker-dialog__button time-picker-dialog__button--cancel" data-action="cancel">
          Cancel
        </button>
        <button type="button" class="time-picker-dialog__button time-picker-dialog__button--confirm" data-action="confirm">
          Set Timer
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalContainer);

  // Trigger enter animation on next frame
  requestAnimationFrame(() => {
    modalContainer.classList.add("time-picker-scrim--visible");
  });

  const hoursInput = modalContainer.querySelector("#timePickerHoursInput");
  const minutesInput = modalContainer.querySelector("#timePickerMinutesInput");

  const closeModal = () => {
    modalContainer.classList.remove("time-picker-scrim--visible");
    setTimeout(() => {
      modalContainer.remove();
    }, 250);
  };

  const handleConfirm = () => {
    const rawH = parseInt(hoursInput?.value || "0", 10) || 0;
    const rawM = parseInt(minutesInput?.value || "0", 10) || 0;
    const clampedH = Math.max(0, Math.min(23, rawH));
    const clampedM = Math.max(0, Math.min(59, rawM));

    const isUntimed = clampedH === 0 && clampedM === 0;
    const finalTimeStr = isUntimed ? "" : `${pad(clampedH)}:${pad(clampedM)}`;

    closeModal();
    onConfirm(finalTimeStr);
  };

  // Preset click handling
  modalContainer.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const presetType = button.getAttribute("data-preset");
      if (presetType === "default") {
        if (hoursInput) hoursInput.value = pad(defaultHours);
        if (minutesInput) minutesInput.value = pad(defaultMinutes);
      } else if (presetType === "5m") {
        if (hoursInput) hoursInput.value = "00";
        if (minutesInput) minutesInput.value = "05";
      } else if (presetType === "15m") {
        if (hoursInput) hoursInput.value = "00";
        if (minutesInput) minutesInput.value = "15";
      } else if (presetType === "30m") {
        if (hoursInput) hoursInput.value = "00";
        if (minutesInput) minutesInput.value = "30";
      } else if (presetType === "untimed") {
        if (hoursInput) hoursInput.value = "00";
        if (minutesInput) minutesInput.value = "00";
      }
    });
  });

  // Action button handling
  modalContainer.querySelector('[data-action="cancel"]')?.addEventListener("click", closeModal);
  modalContainer.querySelector('[data-action="confirm"]')?.addEventListener("click", handleConfirm);

  // Click on background scrim closes modal
  modalContainer.addEventListener("click", (e) => {
    if (e.target === modalContainer) {
      closeModal();
    }
  });

  // Escape key closes modal
  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", handleKeyDown);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
      document.removeEventListener("keydown", handleKeyDown);
    }
  };
  document.addEventListener("keydown", handleKeyDown);

  // Auto-select text on focus
  hoursInput?.addEventListener("focus", () => hoursInput.select());
  minutesInput?.addEventListener("focus", () => minutesInput.select());
}

/**
 * QuizActionBar Component
 * Renders the extendable Bright Squircle Play Button and Morphing Timer Squircle Button.
 * Features:
 * - Zero movement displacement on button hover (smooth icon animations only).
 * - SVG Play Icon with pulse/pop hover animation.
 * - SVG Clock Icon with spinning minute & hour hands on hover.
 * - Tooltip on both buttons.
 * - Extendable Row Architecture:
 *   - Play button: Desktop = icon-only squircle; Mobile = row with "Start Exam" text.
 *   - Timer button: Default initial value is (questions x 1 minute).
 *     - Desktop: toggles inline row expansion with HH:MM input and clear button.
 *     - Mobile: icon squircle only; tapping it opens Flutter-inspired TimePicker dialog modal.
 */
export class QuizActionBar extends Component {
  /**
   * @param {Object} configuration
   * @param {function({ isTimed: boolean, durationSeconds: number, formattedTime: string }): void} [configuration.onStartQuiz]
   * @param {number} [configuration.questionsCount=1] - Question count used for (questions x 1 min) default calculation.
   * @param {string} [configuration.initialTime=""] - Explicit pre-filled time string. If omitted, uses default (questions x 1 min).
   * @param {string} [configuration.buttonLabel="Start Exam"] - Display text on the play button row on mobile.
   * @param {string} [configuration.tooltipText="Start Exam"] - Hover tooltip text on desktop.
   * @param {boolean} [configuration.isBanner=false] - Whether rendered inside the banner hero.
   */
  constructor({
    onStartQuiz = () => {},
    questionsCount = 1,
    initialTime = "",
    buttonLabel = "Start Exam",
    tooltipText = "Start Exam",
    isBanner = false
  } = {}) {
    super();

    this.onStartQuiz = onStartQuiz;
    this.questionsCount = Math.max(1, questionsCount);
    this.buttonLabel = buttonLabel;
    this.tooltipText = tooltipText;
    this.isBanner = isBanner;

    // Default time calculation: (1 minute x number of questions) formatted to MM:SS (or HH:MM:SS)
    const defaultSeconds = this.questionsCount * 60;
    const defaultTimeStr = formatSecondsToTime(defaultSeconds);
    const effectiveInitialTime = (initialTime !== "") ? initialTime : defaultTimeStr;

    this.defaultTimeStr = defaultTimeStr;
    this.timeInputSignal = signal(effectiveInitialTime);

    const instanceId = `quiz-action-bar-${Math.random().toString(36).slice(2, 9)}`;
    this.instanceId = instanceId;

    // Calculate current clock arm angles (hour hand & minute hand based on local Date)
    const calculateClockAngles = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const hourAngle = Number((((hours % 12) + minutes / 60) * 30).toFixed(2));
      const minuteAngle = Number(((minutes + seconds / 60) * 6).toFixed(2));
      return { hourAngle, minuteAngle };
    };

    const initialAngles = calculateClockAngles();

    const handlePlayClick = () => {
      const inputEl = document.getElementById(`${instanceId}-input`);
      const rawValue = inputEl ? inputEl.value : this.timeInputSignal.value;
      const seconds = parseTimeStringToSeconds(rawValue);
      const isTimed = seconds > 0;
      const formattedTime = isTimed ? formatSecondsToTime(seconds) : "";

      if (typeof this.onStartQuiz === "function") {
        this.onStartQuiz({
          isTimed,
          durationSeconds: seconds,
          formattedTime
        });
      }
    };

    const handleToggleClock = () => {
      if (typeof window !== "undefined" && window.innerWidth <= 600) {
        // Mobile screen: open Flutter TimePicker dialog modal!
        const inputEl = document.getElementById(`${instanceId}-input`);
        const currentVal = inputEl ? inputEl.value : this.timeInputSignal.value;
        const totalSecs = parseTimeStringToSeconds(currentVal);
        const curH = Math.floor(totalSecs / 3600);
        const curM = Math.floor((totalSecs % 3600) / 60);

        const defTotalMins = this.questionsCount;
        const defH = Math.floor(defTotalMins / 60);
        const defM = defTotalMins % 60;

        openTimePickerDialog({
          initialHours: curH,
          initialMinutes: curM,
          defaultHours: defH,
          defaultMinutes: defM,
          onConfirm: (newTimeStr) => {
            this.timeInputSignal.value = newTimeStr;
            const liveInput = document.getElementById(`${instanceId}-input`);
            if (liveInput) {
              liveInput.value = newTimeStr;
            }
            if (newTimeStr) {
              showToast(`Exam timer set to ${newTimeStr}`);
            } else {
              showToast("Exam set to untimed");
            }
          }
        });
        return;
      }

      // Desktop screen: focus & select time input
      const input = document.getElementById(`${instanceId}-input`);
      if (input) {
        input.focus();
        input.select();
      }
    };

    const handleClearTime = (e) => {
      if (e) e.stopPropagation();
      const input = document.getElementById(`${instanceId}-input`);
      if (input) {
        input.value = "";
        input.focus();
      }
      this.timeInputSignal.value = "";
      showToast("Timer cleared (Untimed exam)");
    };

    const handleTimeInputChange = (e) => {
      this.timeInputSignal.value = e.target.value;
    };

    const handleTimeInputBlur = (e) => {
      const val = e.target.value.trim();
      if (!val) {
        this.timeInputSignal.value = "";
        return;
      }
      const secs = parseTimeStringToSeconds(val);
      if (secs > 0) {
        const formatted = formatSecondsToTime(secs);
        this.timeInputSignal.value = formatted;
        e.target.value = formatted;
      }
    };

    const containerClass = this.isBanner
      ? "quiz-action-bar quiz-action-bar--banner"
      : "quiz-action-bar";

    this.template = html`
      <div id="${instanceId}" class="${containerClass}" aria-label="Exam Launch Controls">
        <style id="${instanceId}-clock-dynamic-style">
          #${instanceId} .clock-hand--hour {
            transform: rotate(${initialAngles.hourAngle}deg);
            transform-origin: 12px 12px;
          }
          #${instanceId} .clock-hand--minute {
            transform: rotate(${initialAngles.minuteAngle}deg);
            transform-origin: 12px 12px;
          }
          #${instanceId} .quiz-action-bar__timer-card:hover .clock-hand--hour,
          #${instanceId} .quiz-action-bar__timer-icon-button:hover .clock-hand--hour {
            animation: clockHourFullCycle_${instanceId} 1.5s cubic-bezier(0.35, 0, 0.2, 1) 1 forwards;
          }
          #${instanceId} .quiz-action-bar__timer-card:hover .clock-hand--minute,
          #${instanceId} .quiz-action-bar__timer-icon-button:hover .clock-hand--minute {
            animation: clockMinuteFullCycle_${instanceId} 0.65s cubic-bezier(0.4, 0, 0.2, 1) 1 forwards;
          }
          @keyframes clockHourFullCycle_${instanceId} {
            0% { transform: rotate(${initialAngles.hourAngle}deg); }
            100% { transform: rotate(${(initialAngles.hourAngle + 360).toFixed(2)}deg); }
          }
          @keyframes clockMinuteFullCycle_${instanceId} {
            0% { transform: rotate(${initialAngles.minuteAngle}deg); }
            100% { transform: rotate(${(initialAngles.minuteAngle + 360).toFixed(2)}deg); }
          }
        </style>

        <!-- Composite Play Card: Bright Squircle Button overlapping Text Widget Card -->
        <div
          class="quiz-action-bar__play-card"
          data-action="play-quiz"
          role="button"
          tabindex="0"
          data-tooltip="${this.tooltipText}"
          aria-label="${this.tooltipText}"
          onclick=${handlePlayClick}
        >
          <!-- The button is still the same as before (Untouched Bright Squircle) -->
          <div class="bright-squircle quiz-action-bar__play-button" aria-hidden="true">
            <span class="bright-squircle__icon-slot bright-squircle__icon-slot--play">
              <svg class="squircle-play-svg squircle-play-svg--main" viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
              </svg>
              <svg class="squircle-play-svg squircle-play-svg--incoming" viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
              </svg>
            </span>
          </div>

          <!-- Overlapped Text Widget on the right: Non-bright background -->
          <div class="quiz-action-bar__play-text-widget">
            <span class="quiz-action-bar__play-label">${this.buttonLabel || "Start Exam"}</span>
          </div>
        </div>

        <!-- Exposed Timer Component (Card Component - separate timer button removed) -->
        <div id="${instanceId}-timer-card" class="quiz-action-bar__timer-card" aria-label="Exam Timer">
          <button
            type="button"
            class="quiz-action-bar__timer-icon-button"
            data-action="toggle-clock"
            title="Exam Duration"
            aria-label="Exam Duration"
            onclick=${handleToggleClock}
          >
            <svg class="squircle-clock-svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9.5" />
              <line x1="12" y1="12" x2="12" y2="6.5" class="clock-hand clock-hand--hour" />
              <line x1="12" y1="12" x2="12" y2="4" class="clock-hand clock-hand--minute" />
              <circle cx="12" cy="12" r="1.25" fill="currentColor" />
            </svg>
          </button>

          <input
            id="${instanceId}-input"
            type="text"
            class="quiz-action-bar__time-input"
            placeholder="HH:MM"
            value="${this.timeInputSignal.value}"
            aria-label="Timer Duration in HH:MM"
            title="Exam Duration (HH:MM)"
            oninput=${handleTimeInputChange}
            onblur=${handleTimeInputBlur}
          />

          <button
            type="button"
            class="quiz-action-bar__clear-button"
            data-action="clear-clock"
            title="Clear Timer (Untimed)"
            aria-label="Clear Timer (Untimed)"
            onclick=${handleClearTime}
          >
            <span class="google-symbols notranslate">close</span>
          </button>
        </div>
      </div>
    `;

    this.mounted = () => {
      const root = document.getElementById(instanceId);
      if (!root) return;

      const updateClockStyles = () => {
        const styleEl = document.getElementById(`${instanceId}-clock-dynamic-style`);
        if (!styleEl) return;
        const { hourAngle, minuteAngle } = calculateClockAngles();
        styleEl.textContent = `
          #${instanceId} .clock-hand--hour {
            transform: rotate(${hourAngle}deg);
            transform-origin: 12px 12px;
          }
          #${instanceId} .clock-hand--minute {
            transform: rotate(${minuteAngle}deg);
            transform-origin: 12px 12px;
          }
          #${instanceId} .quiz-action-bar__timer-card:hover .clock-hand--hour,
          #${instanceId} .quiz-action-bar__timer-icon-button:hover .clock-hand--hour {
            animation: clockHourFullCycle_${instanceId} 1.5s cubic-bezier(0.35, 0, 0.2, 1) 1 forwards;
          }
          #${instanceId} .quiz-action-bar__timer-card:hover .clock-hand--minute,
          #${instanceId} .quiz-action-bar__timer-icon-button:hover .clock-hand--minute {
            animation: clockMinuteFullCycle_${instanceId} 0.65s cubic-bezier(0.4, 0, 0.2, 1) 1 forwards;
          }
          @keyframes clockHourFullCycle_${instanceId} {
            0% { transform: rotate(${hourAngle}deg); }
            100% { transform: rotate(${(hourAngle + 360).toFixed(2)}deg); }
          }
          @keyframes clockMinuteFullCycle_${instanceId} {
            0% { transform: rotate(${minuteAngle}deg); }
            100% { transform: rotate(${(minuteAngle + 360).toFixed(2)}deg); }
          }
        `;
      };

      const timerCard = document.getElementById(`${instanceId}-timer-card`);
      if (timerCard) {
        timerCard.addEventListener("mouseenter", updateClockStyles);
      }
      setInterval(updateClockStyles, 30000);

      const playCard = root.querySelector('[data-action="play-quiz"]');
      if (playCard) {
        playCard.onclick = handlePlayClick;
        playCard.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handlePlayClick();
          }
        });
      }

      const clockIconbutton = root.querySelector('[data-action="toggle-clock"]');
      if (clockIconbutton) clockIconbutton.onclick = handleToggleClock;

      const clearbutton = root.querySelector('[data-action="clear-clock"]');
      if (clearbutton) clearbutton.onclick = handleClearTime;

      const timeInput = root.querySelector(".quiz-action-bar__time-input");
      if (timeInput) {
        timeInput.oninput = handleTimeInputChange;
        timeInput.onblur = handleTimeInputBlur;
        timeInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handlePlayClick();
          }
        });
      }

      // Delegated event listener on root for bulletproof event handling
      root.addEventListener("click", (e) => {
        const toggleTarget = e.target.closest('[data-action="toggle-clock"]');
        if (toggleTarget) {
          e.preventDefault();
          e.stopPropagation();
          handleToggleClock();
          return;
        }

        const clearTarget = e.target.closest('[data-action="clear-clock"]');
        if (clearTarget) {
          e.preventDefault();
          e.stopPropagation();
          handleClearTime(e);
          return;
        }

        const playTarget = e.target.closest('[data-action="play-quiz"]');
        if (playTarget) {
          e.preventDefault();
          handlePlayClick();
        }
      });
    };
  }
}
