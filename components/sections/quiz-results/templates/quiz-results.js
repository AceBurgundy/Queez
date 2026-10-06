import { Component, css, html } from "../../../../Component.js";

css(import.meta, ["../styles/quiz-results.css"]);

/**
 * QuizResults Component
 * Displays the final examination results summary, category breakdown,
 * and handles standalone offline HTML download and exam reset.
 */
export class QuizResults extends Component {
  /**
   * @param {Object} configuration
   * @param {Object} configuration.scoreTally - Result from evaluateScoreTally.
   * @param {Object} configuration.examMetadata - Metadata (quizTitle, isTimed, durationSeconds, etc.).
   * @param {function(): void} [configuration.onShowResults] - Show review answers callback.
   * @param {function(): void} [configuration.onRetakeExam] - Retake callback.
   */
  constructor({
    scoreTally = {},
    examMetadata = {},
    onShowResults = () => {},
    onRetakeExam = () => {}
  } = {}) {
    super();

    this.scoreTally = scoreTally;
    this.examMetadata = examMetadata;
    this.onShowResults = onShowResults;
    this.onRetakeExam = onRetakeExam;

    /** @type {number} */
    const totalCorrect = this.scoreTally.totalCorrect ?? 0;
    /** @type {number} */
    const totalQuestions = this.scoreTally.totalQuestions ?? 150;
    /** @type {number} */
    const percentage = this.scoreTally.percentage ?? 0;
    /** @type {boolean} */
    const isPassed = this.scoreTally.isPassed ?? false;
    /** @type {Array<Object>} */
    const categoryBreakdown = this.scoreTally.categoryBreakdown || [];

    /** @type {string} */
    const quizTitle = this.examMetadata.quizTitle || "Examination";
    /** @type {boolean} */
    const isTimed = this.examMetadata.isTimed ?? false;
    /** @type {number} */
    const totalTimeSeconds = this.examMetadata.totalTimeSeconds ?? 0;
    /** @type {number} */
    const startTime = this.examMetadata.startTime ?? Date.now();
    /** @type {string} */
    const examScope = this.examMetadata.examScope || "full";
    /** @type {string} */
    const sectionTitle = this.examMetadata.sectionTitle || "";

    /** @type {boolean} */
    const isSection = examScope === "section" || this.scoreTally.examScope === "section";
    /** @type {string} */
    const resolvedSectionTitle = sectionTitle || this.scoreTally.categoryBreakdown?.[0]?.title || "Section";
    /** @type {string} */
    const examScopeLabel = isSection ? `${resolvedSectionTitle} (Section Exam)` : "Full Examination";

    /** @type {number} */
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    /** @type {string} */
    const durationLabel = isTimed
      ? `Timed (${Math.floor(totalTimeSeconds / 60)} mins)`
      : `Untimed (${Math.floor(elapsedSeconds / 60)} mins taken)`;

    const handleShowResults = () => {
      if (typeof this.onShowResults === "function") {
        this.onShowResults();
      }
    };

    const handleRetake = () => {
      if (typeof this.onRetakeExam === "function") {
        this.onRetakeExam();
      }
    };

    /** @type {Array<string>} */
    const categoryCardsHtml = categoryBreakdown.map((categoryItem) => {
      return html`
        <div class="quiz-results__category-card">
          <div class="quiz-results__category-header">
            <span class="quiz-results__category-title">
              <span class="google-symbols notranslate">${categoryItem.icon || "category"}</span>
              <span>${categoryItem.title}</span>
            </span>
            <span class="quiz-results__category-score">
              ${categoryItem.correct} / ${categoryItem.total} (${categoryItem.percentage}%)
            </span>
          </div>
          <div class="quiz-results__progress-bar-bg">
            <div class="quiz-results__progress-bar-fill" style="width: ${categoryItem.percentage}%;"></div>
          </div>
        </div>
      `;
    });

    /** @type {string} */
    const statusBadgeClass = isPassed
      ? "quiz-results__status-badge quiz-results__status-badge--passed"
      : "quiz-results__status-badge quiz-results__status-badge--failed";
    /** @type {string} */
    const statusText = isPassed ? "PASSED (Benchmark \u2265 75%)" : "NEEDS IMPROVEMENT";
    /** @type {string} */
    const statusIcon = isPassed ? "check_circle" : "cancel";

    this.template = html`
      <div class="quiz-results" role="region" aria-label="Exam Results Summary">
        <!-- Hero Score Card -->
        <div class="quiz-results__hero-card">
          <div class="quiz-results__score-circle">
            <span class="quiz-results__score-value">${totalCorrect}</span>
            <span class="quiz-results__score-total">out of ${totalQuestions}</span>
          </div>

          <div class="quiz-results__percentage">${percentage}% Overall Score</div>

          <div class="${statusBadgeClass}">
            <span class="google-symbols notranslate">${statusIcon}</span>
            <span>${statusText}</span>
          </div>

          <div class="quiz-results__meta-row">
            <span class="quiz-results__meta-chip">
              <span class="google-symbols notranslate" style="font-size: 1rem;">assignment</span>
              <span>${examScopeLabel}</span>
            </span>
            <span class="quiz-results__meta-chip">
              <span class="google-symbols notranslate" style="font-size: 1rem;">timer</span>
              <span>${durationLabel}</span>
            </span>
            <span class="quiz-results__meta-chip">
              <span class="google-symbols notranslate" style="font-size: 1rem;">event</span>
              <span>${new Date().toLocaleDateString()}</span>
            </span>
            <span class="quiz-results__meta-chip">
              <span class="google-symbols notranslate" style="font-size: 1rem;">verified</span>
              <span>Verified Answer Key</span>
            </span>
          </div>

          <div class="quiz-results__actions-row">
            <button
              type="button"
              id="buttonShowResults"
              class="bright-squircle quiz-results__button"
              data-tooltip="Review Answers"
              aria-label="Review Question Answers"
              onclick=${handleShowResults}
            >
              <span class="google-symbols notranslate icon--visibility">visibility</span>
            </button>

            <button
              type="button"
              id="buttonRetakeExam"
              class="bright-squircle quiz-results__button"
              data-tooltip="Retake Examination"
              aria-label="Retake Examination"
              onclick=${handleRetake}
            >
              <span class="google-symbols notranslate icon--refresh">refresh</span>
            </button>
          </div>
        </div>

        <!-- Category Breakdown Grid -->
        <h3 style="font-size: 1.25rem; font-weight: 600; margin-top: 0.5rem;">Subject Performance Breakdown</h3>
        <div class="quiz-results__categories-grid">
          ${categoryCardsHtml}
        </div>
      </div>
    `;

    this.mounted = () => {
      /** @type {HTMLElement|null} */
      const showResultsButton = document.getElementById("buttonShowResults");
      if (showResultsButton) showResultsButton.onclick = handleShowResults;
      /** @type {HTMLElement|null} */
      const retakeButton = document.getElementById("buttonRetakeExam");
      if (retakeButton) retakeButton.onclick = handleRetake;
    };
  }
}
