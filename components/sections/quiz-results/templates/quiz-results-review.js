import { Component, css, html } from "../../../../Component.js";

css(import.meta, ["../styles/quiz-results-review.css"]);

/**
 * QuizResultsReview Component
 * Displays the in-app question-by-question review with 10-item pagination,
 * status filters (All, Correct, Incorrect), score summary header, and offline export trigger.
 */
export class QuizResultsReview extends Component {
  /**
   * @param {Object} [configuration={}]
   * @param {Object} [configuration.scoreTally={}] - Scoring result object from evaluateScoreTally.
   * @param {Object} [configuration.examMetadata={}] - Metadata object for the examination.
   * @param {function(): void} [configuration.onBackToSummary=() => {}] - Navigation back to summary callback.
   * @param {function(): void} [configuration.onRetakeExam=() => {}] - Exam reset callback.
   * @param {function(): void} [configuration.onDownloadResults=() => {}] - HTML download callback.
   */
  constructor({
    scoreTally = {},
    examMetadata = {},
    onBackToSummary = () => {},
    onRetakeExam = () => {},
    onDownloadResults = () => {}
  } = {}) {
    super();

    this.scoreTally = scoreTally;
    this.examMetadata = examMetadata;
    this.onBackToSummary = onBackToSummary;
    this.onRetakeExam = onRetakeExam;
    this.onDownloadResults = onDownloadResults;

    /** @type {number} */
    this.totalCorrect = this.scoreTally.totalCorrect ?? 0;
    /** @type {number} */
    this.totalQuestions = this.scoreTally.totalQuestions ?? 0;
    /** @type {number} */
    this.percentage = this.scoreTally.percentage ?? 0;
    /** @type {Array<Object>} */
    this.allQuestions = this.scoreTally.questionReviewList || [];

    /** @type {string} */
    this.activeFilter = "all";
    /** @type {number} */
    this.currentPage = 1;
    /** @type {number} */
    this.itemsPerPage = 10;

    /** @type {string} */
    this.quizTitle = this.examMetadata.quizTitle || "Examination";

    /**
     * @returns {Array<Object>} Filtered questions based on activeFilter.
     */
    const getFilteredQuestions = () => {
      if (this.activeFilter === "correct") {
        return this.allQuestions.filter((questionItem) => questionItem.isCorrect);
      }
      if (this.activeFilter === "incorrect") {
        return this.allQuestions.filter((questionItem) => !questionItem.isCorrect);
      }
      return this.allQuestions;
    };

    /**
     * @param {Object} questionItem
     * @returns {string} Options HTML markup.
     */
    const renderOptionsHtml = (questionItem) => {
      /** @type {Array<string>} */
      const optionKeys = Object.keys(questionItem.options || {});
      if (optionKeys.length > 0) {
        /** @type {Array<string>} */
        const optionItemsMarkup = optionKeys.map((optionKey) => {
          /** @type {boolean} */
          const isUserSelected = questionItem.userAnswer === optionKey;
          /** @type {boolean} */
          const isCorrectAnswer = questionItem.correctAnswer === optionKey;

          /** @type {string} */
          let optionClassName = "quiz-review__option-item";
          if (isCorrectAnswer) {
            optionClassName += " quiz-review__option-item--correct-answer";
          } else if (isUserSelected) {
            optionClassName += " quiz-review__option-item--user-selected";
          }

          /** @type {string} */
          let tagMarkup = "";
          if (isCorrectAnswer) {
            tagMarkup = '<span class="quiz-review__option-tag quiz-review__option-tag--correct">Correct Answer</span>';
          } else if (isUserSelected) {
            tagMarkup = '<span class="quiz-review__option-tag quiz-review__option-tag--user">Your Answer</span>';
          }

          return html`
            <div class="${optionClassName}">
              <span class="quiz-review__option-key">${optionKey}</span>
              <span class="quiz-review__option-text">${questionItem.options[optionKey]}</span>
              ${tagMarkup}
            </div>
          `;
        });

        return html`
          <div class="quiz-review__options-list">
            ${optionItemsMarkup.join("")}
          </div>
        `;
      }

      return html`
        <div class="quiz-review__text-answer-block">
          <p>Your Answer: <strong>${questionItem.userAnswer}</strong></p>
          <p style="color: #4caf50;">Correct Answer: <strong>${questionItem.correctAnswer}</strong></p>
        </div>
      `;
    };

    /**
     * Renders questions for current page and active filter.
     * @returns {void}
     */
    const renderQuestionsPage = () => {
      /** @type {HTMLElement|null} */
      const questionsContainer = document.getElementById("quizReviewQuestionsContainer");
      /** @type {HTMLElement|null} */
      const pageIndicatorElement = document.getElementById("quizReviewPageIndicator");
      /** @type {HTMLButtonElement|null} */
      const previousButton = /** @type {HTMLButtonElement|null} */ (document.getElementById("buttonPreviousPage"));
      /** @type {HTMLButtonElement|null} */
      const nextButton = /** @type {HTMLButtonElement|null} */ (document.getElementById("buttonNextPage"));

      if (!questionsContainer) return;

      /** @type {Array<Object>} */
      const filteredQuestions = getFilteredQuestions();
      /** @type {number} */
      const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / this.itemsPerPage));

      if (this.currentPage > totalPages) {
        this.currentPage = totalPages;
      }
      if (this.currentPage < 1) {
        this.currentPage = 1;
      }

      /** @type {number} */
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      /** @type {number} */
      const endIndex = Math.min(filteredQuestions.length, startIndex + this.itemsPerPage);
      /** @type {Array<Object>} */
      const pageQuestions = filteredQuestions.slice(startIndex, endIndex);

      if (pageQuestions.length === 0) {
        questionsContainer.innerHTML = html`
          <div class="quiz-review__card" style="text-align: center; color: var(--md-sys-color-on-surface-variant);">
            <p>No questions match the selected filter.</p>
          </div>
        `;
      } else {
        /** @type {Array<string>} */
        const cardsMarkup = pageQuestions.map((questionItem) => {
          /** @type {string} */
          const statusClassName = questionItem.isCorrect
            ? "quiz-review__status-tag quiz-review__status-tag--correct"
            : "quiz-review__status-tag quiz-review__status-tag--incorrect";
          /** @type {string} */
          const statusText = questionItem.isCorrect ? "Correct" : "Incorrect";

          return html`
            <div class="quiz-review__card">
              <div class="quiz-review__card-header">
                <span class="quiz-review__badge">Q${String(questionItem.number)}</span>
                <div class="quiz-review__question-text">${questionItem.question}</div>
                <span class="${statusClassName}">${statusText}</span>
              </div>
              ${renderOptionsHtml(questionItem)}
            </div>
          `;
        });

        questionsContainer.innerHTML = cardsMarkup.join("");
      }

      if (pageIndicatorElement) {
        /** @type {string} */
        const displayRange = filteredQuestions.length > 0 ? ` (Questions ${startIndex + 1}–${endIndex})` : "";
        pageIndicatorElement.textContent = `Page ${this.currentPage} of ${totalPages}${displayRange}`;
      }

      if (previousButton) {
        previousButton.disabled = this.currentPage <= 1;
      }
      if (nextButton) {
        nextButton.disabled = this.currentPage >= totalPages;
      }
    };

    /**
     * @param {string} filterName
     * @returns {void}
     */
    const setFilter = (filterName) => {
      this.activeFilter = filterName;
      this.currentPage = 1;

      /** @type {NodeListOf<Element>} */
      const filterChips = document.querySelectorAll(".quiz-review__filter-chip");
      filterChips.forEach((chipElement) => {
        /** @type {string|null} */
        const chipFilter = chipElement.getAttribute("data-filter");
        if (chipFilter === filterName) {
          chipElement.classList.add("quiz-review__filter-chip--active");
        } else {
          chipElement.classList.remove("quiz-review__filter-chip--active");
        }
      });

      renderQuestionsPage();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    /** @type {number} */
    const correctCount = this.allQuestions.filter((questionItem) => questionItem.isCorrect).length;
    /** @type {number} */
    const incorrectCount = this.allQuestions.filter((questionItem) => !questionItem.isCorrect).length;

    this.template = html`
      <div class="quiz-review" role="region" aria-label="Question Answers Review">
        <!-- Header Group Card -->
        <div class="quiz-review__header-card">
          <div class="quiz-review__title-group">
            <button
              type="button"
              id="buttonBackToSummary"
              class="bright-squircle quiz-results__button"
              data-tooltip="Back to Summary"
              aria-label="Back to Exam Summary"
            >
              <span class="google-symbols notranslate">arrow_back</span>
            </button>

            <div>
              <h2 class="quiz-review__title">${this.quizTitle}</h2>
              <span class="quiz-review__score-pill">
                Score: ${this.totalCorrect} / ${this.totalQuestions} (${this.percentage}%)
              </span>
            </div>
          </div>

          <div class="quiz-review__header-actions">
            <button
              type="button"
              id="buttonDownloadResultsReview"
              class="bright-squircle quiz-results__button"
              data-tooltip="Download Results (HTML)"
              aria-label="Download Standalone Offline Results HTML"
            >
              <span class="google-symbols notranslate icon--download">download</span>
            </button>

            <button
              type="button"
              id="buttonRetakeExamReview"
              class="bright-squircle quiz-results__button"
              data-tooltip="Retake Examination"
              aria-label="Retake Examination"
            >
              <span class="google-symbols notranslate icon--refresh">refresh</span>
            </button>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="quiz-review__filter-bar" role="toolbar" aria-label="Question filters">
          <button
            type="button"
            class="quiz-review__filter-chip quiz-review__filter-chip--active"
            data-filter="all"
          >
            <span>All Questions (${this.allQuestions.length})</span>
          </button>
          <button
            type="button"
            class="quiz-review__filter-chip"
            data-filter="correct"
          >
            <span>Correct (${correctCount})</span>
          </button>
          <button
            type="button"
            class="quiz-review__filter-chip"
            data-filter="incorrect"
          >
            <span>Incorrect (${incorrectCount})</span>
          </button>
        </div>

        <!-- Questions List Container -->
        <div class="quiz-review__questions-list" id="quizReviewQuestionsContainer"></div>

        <!-- Pagination Controls with Page Info ABOVE Previous/Next -->
        <div class="quiz-review__pagination-wrapper">
          <div class="quiz-review__page-info" id="quizReviewPageIndicator">Page 1 of 1</div>
          <div class="quiz-review__pagination-actions">
            <button
              type="button"
              class="quiz-review__page-button"
              id="buttonPreviousPage"
            >
              Previous 10
            </button>
            <button
              type="button"
              class="quiz-review__page-button"
              id="buttonNextPage"
            >
              Next 10
            </button>
          </div>
        </div>
      </div>
    `;

    this.mounted = () => {
      /** @type {HTMLElement|null} */
      const backButton = document.getElementById("buttonBackToSummary");
      if (backButton) {
        backButton.onclick = () => {
          if (typeof this.onBackToSummary === "function") {
            this.onBackToSummary();
          }
        };
      }

      /** @type {HTMLElement|null} */
      const downloadButton = document.getElementById("buttonDownloadResultsReview");
      if (downloadButton) {
        downloadButton.onclick = () => {
          if (typeof this.onDownloadResults === "function") {
            this.onDownloadResults();
          }
        };
      }

      /** @type {HTMLElement|null} */
      const retakeButton = document.getElementById("buttonRetakeExamReview");
      if (retakeButton) {
        retakeButton.onclick = () => {
          if (typeof this.onRetakeExam === "function") {
            this.onRetakeExam();
          }
        };
      }

      /** @type {HTMLButtonElement|null} */
      const previousPageButton = /** @type {HTMLButtonElement|null} */ (document.getElementById("buttonPreviousPage"));
      if (previousPageButton) {
        previousPageButton.onclick = () => {
          if (this.currentPage > 1) {
            this.currentPage -= 1;
            renderQuestionsPage();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        };
      }

      /** @type {HTMLButtonElement|null} */
      const nextPageButton = /** @type {HTMLButtonElement|null} */ (document.getElementById("buttonNextPage"));
      if (nextPageButton) {
        nextPageButton.onclick = () => {
          /** @type {Array<Object>} */
          const filteredQuestions = getFilteredQuestions();
          /** @type {number} */
          const totalPages = Math.ceil(filteredQuestions.length / this.itemsPerPage);
          if (this.currentPage < totalPages) {
            this.currentPage += 1;
            renderQuestionsPage();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        };
      }

      /** @type {NodeListOf<Element>} */
      const filterChips = document.querySelectorAll(".quiz-review__filter-chip");
      filterChips.forEach((chipElement) => {
        /** @type {string} */
        const filterName = chipElement.getAttribute("data-filter") || "all";
        /** @type {HTMLElement} */
        const htmlChipElement = /** @type {HTMLElement} */ (chipElement);
        htmlChipElement.onclick = () => setFilter(filterName);
      });

      renderQuestionsPage();
    };
  }
}
