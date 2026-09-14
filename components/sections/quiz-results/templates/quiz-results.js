import { Component, css, html } from "../../../../Component.js";
import { downloadOfflineResultsHtml } from "../scripts/quiz-export-service.js";

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
   * @param {function(): void} [configuration.onRetakeExam] - Retake callback.
   */
  constructor({
    scoreTally = {},
    examMetadata = {},
    onRetakeExam = () => {}
  } = {}) {
    super();

    this.scoreTally = scoreTally;
    this.examMetadata = examMetadata;
    this.onRetakeExam = onRetakeExam;

    const {
      totalCorrect = 0,
      totalQuestions = 150,
      percentage = 0,
      isPassed = false,
      categoryBreakdown = []
    } = this.scoreTally;

    const {
      quizTitle = "Examination",
      isTimed = false,
      totalTimeSeconds = 0,
      startTime = Date.now(),
      publisher = "MASTERY",
      examScope = "full",
      sectionTitle = ""
    } = this.examMetadata;

    const isSection = examScope === "section" || this.scoreTally.examScope === "section";
    const resolvedSectionTitle = sectionTitle || this.scoreTally.categoryBreakdown?.[0]?.title || "Section";
    const examScopeLabel = isSection ? `${resolvedSectionTitle} (Section Exam)` : "Full Examination";

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    const durationLabel = isTimed
      ? `Timed (${Math.floor(totalTimeSeconds / 60)} mins)`
      : `Untimed (${Math.floor(elapsedSeconds / 60)} mins taken)`;

    const handleDownload = () => {
      const exportTitle = isSection ? `${quizTitle} — ${resolvedSectionTitle}` : quizTitle;
      const exportSubtitle = isSection
        ? `Official Verification & Solution Key • ${resolvedSectionTitle} Section Exam`
        : "Official Verification & Solution Key • Comprehensive Full Mock Exam";

      const exportPayload = {
        quizTitle: exportTitle,
        quizSubtitle: exportSubtitle,
        publisher,
        isTimed,
        durationLabel,
        completionDate: new Date().toLocaleString(),
        totalScore: totalCorrect,
        totalQuestions,
        percentage,
        isPassed,
        categoryBreakdown,
        questionReviewList: this.scoreTally.questionReviewList || []
      };

      const titleSlug = quizTitle.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const sectionSlug = isSection ? `-${resolvedSectionTitle.toLowerCase().replace(/[^a-z0-9]/g, "-")}` : "";
      const safeFilename = `queez-${titleSlug}${sectionSlug}-results.html`;
      downloadOfflineResultsHtml(exportPayload, safeFilename);
    };

    const handleRetake = () => {
      if (typeof this.onRetakeExam === "function") {
        this.onRetakeExam();
      }
    };

    const categoryCardsHtml = categoryBreakdown.map((cat) => {
      return html`
        <div class="quiz-results__category-card">
          <div class="quiz-results__category-header">
            <span class="quiz-results__category-title">
              <span class="google-symbols notranslate">${cat.icon || "category"}</span>
              <span>${cat.title}</span>
            </span>
            <span class="quiz-results__category-score">
              ${cat.correct} / ${cat.total} (${cat.percentage}%)
            </span>
          </div>
          <div class="quiz-results__progress-bar-bg">
            <div class="quiz-results__progress-bar-fill" style="width: ${cat.percentage}%;"></div>
          </div>
        </div>
      `;
    });

    const statusBadgeClass = isPassed
      ? "quiz-results__status-badge quiz-results__status-badge--passed"
      : "quiz-results__status-badge quiz-results__status-badge--failed";
    const statusText = isPassed ? "PASSED (Benchmark \u2265 75%)" : "NEEDS IMPROVEMENT";
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
              id="buttonDownloadResults"
              class="bright-squircle quiz-results__button"
              data-tooltip="Download Results (HTML)"
              aria-label="Download Standalone Offline Results HTML"
              onclick=${handleDownload}
            >
              <span class="google-symbols notranslate icon--download">download</span>
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
      const downloadbutton = document.getElementById("buttonDownloadResults");
      if (downloadbutton) downloadbutton.onclick = handleDownload;
      const retakebutton = document.getElementById("buttonRetakeExam");
      if (retakebutton) retakebutton.onclick = handleRetake;
    };
  }
}
