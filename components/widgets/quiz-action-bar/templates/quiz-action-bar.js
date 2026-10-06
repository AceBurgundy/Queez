/**
 * @file quiz-action-bar.js
 * @description Single-card start exam action bar that opens the start-exam configuration dialog.
 */

import { Component, css, html } from "../../../../Component.js";
import { openStartExamDialog } from "../scripts/start-exam-dialog.js";

css(import.meta, ["../styles/quiz-action-bar.css"]);

/**
 * Parses user-entered time string into total seconds.
 * Supports:
 * - "HH:MM:SS" (e.g. "01:00:15" -> 3615s)
 * - "MM:SS" (e.g. "02:00" -> 120s, "00:30" -> 30s)
 * - Single integer (e.g. "5" -> 5 minutes = 300s)
 * @param {string} timeString - Raw time string.
 * @returns {number} Total seconds (0 if invalid or empty).
 */
export const parseTimeStringToSeconds = (timeString) => {
  if (!timeString || typeof timeString !== "string") {
    return 0;
  }
  /** @type {string} */
  const cleanedString = timeString.trim();
  if (!cleanedString) {
    return 0;
  }

  if (cleanedString.includes(":")) {
    /** @type {Array<string>} */
    const stringParts = cleanedString.split(":");
    if (stringParts.length === 3) {
      /** @type {number} */
      const hours = parseInt(stringParts[0], 10) || 0;
      /** @type {number} */
      const minutes = parseInt(stringParts[1], 10) || 0;
      /** @type {number} */
      const seconds = parseInt(stringParts[2], 10) || 0;
      return Math.max(0, hours * 3600 + minutes * 60 + seconds);
    }
    /** @type {number} */
    const minutes = parseInt(stringParts[0], 10) || 0;
    /** @type {number} */
    const seconds = parseInt(stringParts[1], 10) || 0;
    return Math.max(0, minutes * 60 + seconds);
  }

  /** @type {number} */
  const rawNumber = parseInt(cleanedString, 10);
  if (!Number.isNaN(rawNumber) && rawNumber > 0) {
    return rawNumber * 60;
  }
  return 0;
};

/**
 * Formats total seconds into standard "MM:SS" (or "HH:MM:SS" if >= 1 hour).
 * @param {number} totalSeconds - Total seconds duration.
 * @returns {string} Formatted duration string.
 */
export const formatSecondsToTime = (totalSeconds) => {
  if (!totalSeconds || totalSeconds <= 0) {
    return "00:00";
  }
  /** @type {number} */
  const hours = Math.floor(totalSeconds / 3600);
  /** @type {number} */
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  /** @type {number} */
  const seconds = totalSeconds % 60;

  /**
   * Pads an integer with leading zeros to 2 digits.
   * @param {number} numericValue
   * @returns {string}
   */
  const padTwoDigits = (numericValue) => String(numericValue).padStart(2, "0");

  if (hours > 0) {
    return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`;
  }
  return `${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`;
};

/**
 * Formats total seconds into standard timer string "MM:SS" or "HH:MM:SS".
 * @param {number} totalSeconds - Total seconds duration.
 * @returns {string} Formatted duration string.
 */
export const formatSecondsToTimeStr = (totalSeconds) => {
  return formatSecondsToTime(totalSeconds);
};

/**
 * Action bar component rendering a prominent start card that triggers the start-exam configuration dialog.
 */
export class QuizActionBar extends Component {
  /**
   * @param {Object} [options={}]
   * @param {function(Object): void} [options.onStartQuiz] - Callback triggered when exam starts.
   * @param {string} [options.buttonLabel="Start Exam"] - Action button label.
   * @param {string} [options.tooltipText="Launch exam"] - Accessibility tooltip.
   * @param {boolean} [options.isBanner=false] - Whether action bar is embedded in banner.
   * @param {boolean} [options.isSection=false] - Whether action bar is the minimalist section variant.
   * @param {string} [options.sectionDescription=""] - Educational section description text.
   * @param {string} [options.sectionIcon="category"] - Material symbol icon name for section.
   * @param {string} [options.questionRangeText=""] - Text badge describing item count and question bounds.
   * @param {string} [options.dialogTitle] - Optional custom title for the configuration dialog.
   * @param {string} [options.dialogSubtitle] - Optional custom subtitle for the configuration dialog.
   * @param {number} [options.minimumQuestionCount=1] - Minimum questions allowed.
   * @param {number} [options.questionsCount] - Alias for maximumQuestionCount.
   * @param {number} [options.defaultQuestionsCount] - Alias for defaultQuestionCount.
   */
  constructor({
    onStartQuiz,
    buttonLabel = "Start Exam",
    tooltipText = "Launch exam",
    isBanner = false,
    isSection = false,
    sectionDescription = "",
    sectionIcon = "category",
    questionRangeText = "",
    dialogTitle,
    dialogSubtitle,
    minimumQuestionCount = 1,
    maximumQuestionCount,
    defaultQuestionCount,
    questionsCount,
    defaultQuestionsCount
  } = {}) {
    super();

    /** @type {function(Object): void|undefined} */
    this.onStartQuiz = onStartQuiz;
    /** @type {string} */
    this.buttonLabel = buttonLabel;
    /** @type {string} */
    this.tooltipText = tooltipText;
    /** @type {boolean} */
    this.isBanner = isBanner;
    /** @type {boolean} */
    this.isSection = isSection;
    /** @type {string} */
    this.sectionDescription = sectionDescription;
    /** @type {string} */
    this.sectionIcon = sectionIcon;
    /** @type {string} */
    this.questionRangeText = questionRangeText;
    /** @type {string|undefined} */
    this.dialogTitle = dialogTitle;
    /** @type {string|undefined} */
    this.dialogSubtitle = dialogSubtitle;
    /** @type {number} */
    this.minimumQuestionCount = minimumQuestionCount;
    /** @type {number} */
    this.maximumQuestionCount = maximumQuestionCount ?? questionsCount ?? 100;
    /** @type {number} */
    this.defaultQuestionCount = defaultQuestionCount ?? defaultQuestionsCount ?? this.maximumQuestionCount;

    /**
     * Handles opening the start-exam modal dialog.
     * @param {Event} [event]
     * @returns {void}
     */
    const handleLaunchClick = (event) => {
      if (event) {
        event.preventDefault();
      }
      openStartExamDialog({
        title: this.dialogTitle || (this.isSection ? "Start Section Exam" : this.buttonLabel) || "Start Exam",
        subtitle: this.dialogSubtitle || "Choose items and duration",
        minimumQuestionCount: this.minimumQuestionCount,
        maximumQuestionCount: this.maximumQuestionCount,
        defaultQuestionCount: this.defaultQuestionCount,
        onConfirm: (startResult) => {
          if (typeof this.onStartQuiz === "function") {
            this.onStartQuiz(startResult);
          }
        }
      });
    };

    /**
     * Handles keyboard activation via Enter or Space.
     * @param {KeyboardEvent} event
     * @returns {void}
     */
    const handleLaunchKeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleLaunchClick(event);
      }
    };

    /** @type {string} */
    const containerClass = this.isBanner
      ? "quiz-action-bar quiz-action-bar--banner"
      : this.isSection
        ? "quiz-action-bar quiz-action-bar--section"
        : "quiz-action-bar";

    if (this.isSection) {
      this.template = html`
        <div class="${containerClass}" aria-label="Section Exam Controls">
          <div class="quiz-action-bar__section-info">
            <span class="material-symbols-outlined quiz-action-bar__section-icon" aria-hidden="true">${this.sectionIcon}</span>
            <div class="quiz-action-bar__section-text">
              ${this.sectionDescription ? html`<p class="quiz-action-bar__section-description">${this.sectionDescription}</p>` : ""}
              ${this.questionRangeText ? html`<span class="quiz-action-bar__section-badge">${this.questionRangeText}</span>` : ""}
            </div>
          </div>
          <div class="quiz-action-bar__section-action">
            <button
              type="button"
              class="bright-squircle quiz-action-bar__play-button quiz-action-bar__play-button--compact"
              data-tooltip="${this.tooltipText}"
              aria-label="${this.tooltipText}"
              onclick=${handleLaunchClick}
              onkeydown=${handleLaunchKeydown}
            >
              <span class="bright-squircle__icon-slot bright-squircle__icon-slot--play">
                <svg class="squircle-play-svg squircle-play-svg--main" viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
                </svg>
                <svg class="squircle-play-svg squircle-play-svg--incoming" viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      `;
    } else {
      this.template = html`
        <div class="${containerClass}" aria-label="Exam Launch Controls">
          <div
            class="quiz-action-bar__play-card"
            data-action="play-quiz"
            role="button"
            tabindex="0"
            data-tooltip="${this.tooltipText}"
            aria-label="${this.tooltipText}"
            onclick=${handleLaunchClick}
            onkeydown=${handleLaunchKeydown}
          >
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

            <div class="quiz-action-bar__play-text-widget">
              <span class="quiz-action-bar__play-label">${this.buttonLabel}</span>
            </div>
          </div>
        </div>
      `;
    }
  }
}
