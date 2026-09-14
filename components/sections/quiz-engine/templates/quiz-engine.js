import { Component, css, html, signal } from "../../../../Component.js";
import { QuestionCard } from "../../../widgets/question-card/templates/question-card.js";
import { formatSecondsToTime } from "../../../widgets/quiz-action-bar/templates/quiz-action-bar.js";
import { saveActiveSession, clearActiveSession, getCategoryBounds } from "../scripts/quiz-state-manager.js";

css(import.meta, ["../styles/quiz-engine.css"]);

/**
 * Maps question number to its category index (0-indexed).
 * Dynamically supports any total question count and category count.
 * @param {number} questionNumber
 * @param {number} [totalQuestions=150]
 * @param {number} [categoriesCount=4]
 * @returns {number}
 */
export function getCategoryIndexForQuestion(questionNumber, totalQuestions = 150, categoriesCount = 4) {
  if (totalQuestions === 2 && categoriesCount === 2) {
    return questionNumber <= 1 ? 0 : 1;
  }
  if (totalQuestions <= categoriesCount && totalQuestions > 0) {
    return Math.min(categoriesCount - 1, Math.max(0, questionNumber - 1));
  }
  if (totalQuestions === 150 && categoriesCount === 4) {
    if (questionNumber <= 45) return 0;
    if (questionNumber <= 90) return 1;
    if (questionNumber <= 135) return 2;
    return 3;
  }
  const perCat = Math.max(1, Math.ceil(totalQuestions / Math.max(1, categoriesCount)));
  return Math.min(categoriesCount - 1, Math.floor((questionNumber - 1) / perCat));
}

/**
 * QuizEngine Component
 * Main interactive examination controller managing:
 * - 10 questions per page
 * - Progress tracking [current / total]
 * - Category transition checkpoints with animated play button
 * - Live countdown timer
 * - Strict localStorage persistence
 */
export class QuizEngine extends Component {
  /**
   * @param {Object} configuration
   * @param {string} configuration.quizId
   * @param {Array<Object>} configuration.questions - Sanitized questions (no correct answers).
   * @param {Array<Object>} configuration.categories - Category list.
   * @param {Object} [configuration.savedSession] - Restored session from localStorage.
   * @param {boolean} [configuration.isTimed=false]
   * @param {number} [configuration.totalTimeSeconds=0]
   * @param {number} [configuration.startTime=Date.now()]
   * @param {string} [configuration.examScope="full"] - "full" or "section".
   * @param {number} [configuration.sectionCategoryIndex=0] - Category index if examScope === "section".
   * @param {function(number): void} [configuration.onCategoryChange]
   * @param {function(Record<number, string>, Object): void} [configuration.onFinishExam]
   */
  constructor({
    quizId,
    questions = [],
    categories = [],
    savedSession = null,
    isTimed = false,
    totalTimeSeconds = 0,
    startTime = Date.now(),
    examScope = "full",
    sectionCategoryIndex = 0,
    onCategoryChange = () => {},
    onFinishExam = () => {}
  } = {}) {
    super();

    this.quizId = quizId;
    this.questions = questions;
    this.categories = categories;
    this.onCategoryChange = onCategoryChange;
    this.onFinishExam = onFinishExam;

    this.examScope = savedSession?.examScope || examScope;
    this.sectionCategoryIndex = savedSession?.sectionCategoryIndex ?? sectionCategoryIndex;

    const bounds = (this.examScope === "section")
      ? getCategoryBounds(this.sectionCategoryIndex, this.questions.length, this.categories.length)
      : { startNum: 1, endNum: this.questions.length };
    this.sectionBounds = bounds;
    this.sectionTotalQuestions = bounds.endNum - bounds.startNum + 1;

    // Restore or initialize state
    const defaultInitialIndex = (this.examScope === "section") ? (bounds.startNum - 1) : 0;
    const initialQuestionIndex = savedSession?.currentQuestionIndex ?? defaultInitialIndex;
    const initialAnswers = savedSession?.answers || {};
    const initialCategoryIndex = (this.examScope === "section")
      ? this.sectionCategoryIndex
      : getCategoryIndexForQuestion(initialQuestionIndex + 1, this.questions.length, this.categories.length);

    this.isTimed = savedSession?.isTimed ?? isTimed;
    this.totalTimeSeconds = savedSession?.totalTimeSeconds ?? totalTimeSeconds;
    this.startTime = savedSession?.startTime ?? startTime;

    this.answers = { ...initialAnswers };
    this.currentQuestionIndexSignal = signal(initialQuestionIndex);
    this.activeCategoryIndexSignal = signal(initialCategoryIndex);
    this.isTransitionSignal = signal(Boolean(this.examScope === "full" && savedSession?.status === "transition"));
    this.transitionNextCategorySignal = signal(savedSession?.transitionNextCategory || 1);

    // Timer signal
    const calcRemainingSeconds = () => {
      if (!this.isTimed || this.totalTimeSeconds <= 0) return 0;
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      return Math.max(0, this.totalTimeSeconds - elapsed);
    };

    this.remainingSecondsSignal = signal(calcRemainingSeconds());

    const persistCurrentState = (status = "in_progress") => {
      saveActiveSession({
        quizId: this.quizId,
        examScope: this.examScope,
        sectionCategoryIndex: this.sectionCategoryIndex,
        currentQuestionIndex: this.currentQuestionIndexSignal.value,
        answers: this.answers,
        isTimed: this.isTimed,
        totalTimeSeconds: this.totalTimeSeconds,
        startTime: this.startTime,
        activeCategoryIndex: this.activeCategoryIndexSignal.value,
        status,
        transitionNextCategory: this.transitionNextCategorySignal.value
      });
    };

    // Answer Selection
    const handleSelectAnswer = (qNumber, selectedValue) => {
      this.answers[qNumber] = selectedValue;
      persistCurrentState("in_progress");

      // Update active option style in DOM instantly
      const qCard = document.querySelector(`.question-card[data-question-number="${qNumber}"]`);
      if (qCard) {
        qCard.querySelectorAll(".question-card__option-button").forEach((button) => {
          const keyEl = button.querySelector(".question-card__option-key");
          const radioIcon = button.querySelector(".question-card__radio-icon");
          const isSelected = keyEl && keyEl.textContent.trim() === selectedValue;
          button.classList.toggle("question-card__option-button--selected", isSelected);
          button.setAttribute("aria-checked", isSelected ? "true" : "false");
          if (radioIcon) {
            radioIcon.textContent = isSelected ? "radio_button_checked" : "radio_button_unchecked";
          }
        });
      }
    };

    // Pagination handlers
    const handleNextPage = () => {
      const currentIdx = this.currentQuestionIndexSignal.value;
      const currentQNum = currentIdx + 1;
      const currentCat = getCategoryIndexForQuestion(currentQNum, this.questions.length, this.categories.length);
      const { endNum } = getCategoryBounds(currentCat, this.questions.length, this.categories.length);

      // Check if current page slice reaches the end of current category
      const nextPageFirstQNum = currentIdx + 11;
      if (this.examScope === "section") {
        if (nextPageFirstQNum > endNum) {
          finishQuiz();
          return;
        }
      } else {
        if (nextPageFirstQNum > endNum) {
          // At the end of this category
          if (currentCat < this.categories.length - 1) {
            // Show category transition checkpoint!
            const nextCat = currentCat + 1;
            this.transitionNextCategorySignal.value = nextCat;
            this.isTransitionSignal.value = true;
            persistCurrentState("transition");
            this.renderView();
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
          } else {
            // Reached the final question of the entire exam! Finish exam!
            finishQuiz();
            return;
          }
        }
      }

      // Advance 10 questions
      const maxIdx = (this.examScope === "section") ? endNum - 1 : this.questions.length - 1;
      const nextIdx = Math.min(maxIdx, currentIdx + 10);
      this.currentQuestionIndexSignal.value = nextIdx;
      persistCurrentState("in_progress");
      this.renderView();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handlePrevPage = () => {
      const currentIdx = this.currentQuestionIndexSignal.value;
      const currentQNum = currentIdx + 1;
      const currentCat = (this.examScope === "section")
        ? this.sectionCategoryIndex
        : getCategoryIndexForQuestion(currentQNum, this.questions.length, this.categories.length);
      const { startNum } = getCategoryBounds(currentCat, this.questions.length, this.categories.length);

      // Go back 10 questions within this category
      const prevIdx = Math.max(startNum - 1, currentIdx - 10);
      this.currentQuestionIndexSignal.value = prevIdx;
      persistCurrentState("in_progress");
      this.renderView();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleResumeCategory = () => {
      const nextCat = this.transitionNextCategorySignal.value;
      const { startNum } = getCategoryBounds(nextCat, this.questions.length, this.categories.length);
      this.currentQuestionIndexSignal.value = startNum - 1;
      this.activeCategoryIndexSignal.value = nextCat;
      this.isTransitionSignal.value = false;
      persistCurrentState("in_progress");

      if (typeof this.onCategoryChange === "function") {
        this.onCategoryChange(nextCat);
      }

      this.renderView();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const finishQuiz = () => {
      persistCurrentState("completed");
      if (this.timerIntervalId) {
        clearInterval(this.timerIntervalId);
      }
      if (typeof this.onFinishExam === "function") {
        this.onFinishExam(this.answers, {
          examScope: this.examScope,
          sectionCategoryIndex: this.sectionCategoryIndex,
          isTimed: this.isTimed,
          totalTimeSeconds: this.totalTimeSeconds,
          startTime: this.startTime
        });
      }
    };

    this.jumpToCategory = (targetCatIdx) => {
      if (this.examScope === "section") {
        return; // Exam is locked to this tab's questions
      }
      if (targetCatIdx < 0 || targetCatIdx >= this.categories.length) return;
      const { startNum } = getCategoryBounds(targetCatIdx, this.questions.length, this.categories.length);
      this.currentQuestionIndexSignal.value = startNum - 1;
      this.activeCategoryIndexSignal.value = targetCatIdx;
      this.isTransitionSignal.value = false;
      persistCurrentState("in_progress");
      this.renderView();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    this.renderView = () => {
      const container = document.getElementById("quizEngineRoot");
      if (!container) return;
      container.innerHTML = this.buildContent();
      this.attachListeners();
    };

    this.buildContent = () => {
      // 1. Transition Screen Checkpoint
      if (this.isTransitionSignal.value) {
        const nextCatIdx = this.transitionNextCategorySignal.value;
        const nextCatDef = this.categories[nextCatIdx] || {};
        const catTitle = nextCatDef.tab_title || nextCatDef.tabTitle || `Category ${nextCatIdx + 1}`;
        const catIcon = nextCatDef.icon_name || nextCatDef.iconName || "school";
        const { startNum, endNum } = getCategoryBounds(nextCatIdx, this.questions.length, this.categories.length);
        const count = endNum - startNum + 1;

        return `
          <div class="quiz-engine__transition-view" role="region" aria-label="Section Transition">
            <div class="quiz-engine__transition-icon">
              <span class="google-symbols notranslate">${catIcon}</span>
            </div>
            <h2 class="quiz-engine__transition-headline">Proceed to ${catTitle}</h2>
            <p class="quiz-engine__transition-subtext">
              Part ${nextCatIdx + 1} of ${this.categories.length} • Questions ${startNum} to ${endNum} (${count} items).
              Take a breath and continue when you are ready.
            </p>
            <button
              type="button"
              id="buttonResumeCategory"
              class="bright-squircle quiz-engine__transition-play-button"
              data-tooltip="Start ${catTitle}"
              aria-label="Start ${catTitle}"
            >
              <span class="bright-squircle__icon-slot bright-squircle__icon-slot--play">
                <svg class="squircle-play-svg squircle-play-svg--main" viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
                </svg>
                <svg class="squircle-play-svg squircle-play-svg--incoming" viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
                </svg>
              </span>
            </button>
          </div>
        `;
      }

      // 2. Active 10 Questions Page
      const startIdx = this.currentQuestionIndexSignal.value;
      const currentCatIdx = (this.examScope === "section")
        ? this.sectionCategoryIndex
        : getCategoryIndexForQuestion(startIdx + 1, this.questions.length, this.categories.length);
      const { startNum, endNum } = getCategoryBounds(currentCatIdx, this.questions.length, this.categories.length);
      const pageEndIdx = Math.min(endNum, startIdx + 10);
      const pageQuestions = this.questions.slice(startIdx, pageEndIdx);

      const currentCatDef = this.categories[currentCatIdx] || {};
      const catTitle = currentCatDef.tab_title || currentCatDef.tabTitle || `Part ${currentCatIdx + 1}`;
      const catIcon = currentCatDef.icon_name || currentCatDef.iconName || "category";
      const catDisplayTitle = (this.examScope === "section")
        ? `${catTitle} (Section Exam)`
        : catTitle;

      // Question Cards Markup
      const cardsHtml = pageQuestions.map((q) => {
        const qCard = new QuestionCard({
          question: q,
          selectedAnswer: this.answers[q.number] || "",
          onSelectAnswer: (qNum, val) => handleSelectAnswer(qNum, val)
        });
        return qCard.toString();
      }).join("");

      // Live Timer Badge
      let timerBadgeHtml = "";
      if (this.isTimed) {
        const remaining = this.remainingSecondsSignal.value;
        timerBadgeHtml = `
          <div class="quiz-engine__timer-pill" aria-live="polite" aria-label="Remaining time">
            <span class="google-symbols notranslate" style="font-size: 1.125rem;">timer</span>
            <span id="quizEngineLiveTimer">${formatSecondsToTime(remaining)}</span>
          </div>
        `;
      }

      // Progress label
      const totalExamQuestions = (this.examScope === "section")
        ? this.sectionTotalQuestions
        : this.questions.length;
      const currentRelativeQ = (this.examScope === "section")
        ? (Math.min(pageEndIdx, endNum) - startNum + 1)
        : Math.min(pageEndIdx, this.questions.length);
      const progressLabel = `Question ${currentRelativeQ} of ${totalExamQuestions}`;

      // Navigation button labels
      const isFirstPageOfCategory = startIdx === startNum - 1;
      const isLastPageOfCategory = pageEndIdx >= endNum;
      const isLastCategory = (this.examScope === "section") || (currentCatIdx === this.categories.length - 1);

      const nextLabel = isLastPageOfCategory
        ? "Finish & Submit Exam"
        : (this.examScope === "section" ? "Next Page" : `Proceed to ${this.categories[currentCatIdx + 1]?.tab_title || "Next Category"}`);

      return `
        <div class="quiz-engine" role="region" aria-label="Questionnaire Engine">
          <!-- Progress Header Bar -->
          <div class="quiz-engine__header">
            <div class="quiz-engine__category-badge">
              <span class="google-symbols notranslate">${catIcon}</span>
              <span>${catDisplayTitle}</span>
            </div>

            <div style="display: flex; align-items: center; gap: 0.75rem;">
              ${timerBadgeHtml}
              <div class="quiz-engine__progress-counter" aria-label="Progress">
                <span class="google-symbols notranslate" style="font-size: 1.125rem;">format_list_numbered</span>
                <span>${progressLabel}</span>
              </div>
            </div>
          </div>

          <!-- 10 Questions Page Slice -->
          <div class="quiz-engine__questions-list">
            ${cardsHtml}
          </div>

          <!-- Pagination Controls -->
          <div class="quiz-engine__navigation-bar">
            <button
              type="button"
              id="buttonPrevPage"
              class="bright-squircle quiz-engine__nav-button"
              data-tooltip="Previous Questions"
              aria-label="Previous Questions"
              ${isFirstPageOfCategory ? "disabled" : ""}
            >
              <span class="google-symbols notranslate icon--arrow-back">arrow_back</span>
            </button>

            <span class="quiz-engine__page-indicator">
              Questions ${startIdx + 1}–${pageEndIdx} of ${endNum}
            </span>

            <button
              type="button"
              id="buttonNextPage"
              class="bright-squircle quiz-engine__nav-button"
              data-tooltip="${nextLabel}"
              aria-label="${nextLabel}"
            >
              <span class="google-symbols notranslate ${(isLastPageOfCategory && isLastCategory) ? "icon--check" : "icon--arrow-forward"}">${(isLastPageOfCategory && isLastCategory) ? "check" : "arrow_forward"}</span>
            </button>
          </div>
        </div>
      `;
    };

    this.template = html`
      <div id="quizEngineRoot" style="width: 100%;">
        ${this.buildContent()}
      </div>
    `;

    this.mounted = () => {
      this.attachListeners();

      // Setup Live Countdown Timer
      if (this.isTimed) {
        this.timerIntervalId = setInterval(() => {
          const remaining = calcRemainingSeconds();
          this.remainingSecondsSignal.value = remaining;

          const timerEl = document.getElementById("quizEngineLiveTimer");
          if (timerEl) {
            timerEl.textContent = formatSecondsToTime(remaining);
          }

          if (remaining <= 0) {
            clearInterval(this.timerIntervalId);
            finishQuiz();
          }
        }, 1000);
      }
    };

    this.attachListeners = () => {
      const root = document.getElementById("quizEngineRoot");
      if (!root) return;

      const resumebutton = root.querySelector("#buttonResumeCategory");
      if (resumebutton) {
        resumebutton.onclick = () => {
          handleResumeCategory();
        };
      }

      const nextbutton = root.querySelector("#buttonNextPage");
      if (nextbutton) {
        nextbutton.onclick = () => {
          handleNextPage();
        };
      }

      const prevbutton = root.querySelector("#buttonPrevPage");
      if (prevbutton) {
        prevbutton.onclick = () => {
          handlePrevPage();
        };
      }

      // Option selection delegation
      root.querySelectorAll(".question-card__option-button").forEach((button) => {
        button.onclick = (e) => {
          e.preventDefault();
          const card = button.closest(".question-card");
          const qNum = parseInt(card?.dataset.questionNumber, 10);
          const keyEl = button.querySelector(".question-card__option-key");
          const key = keyEl ? keyEl.textContent.trim() : "";
          if (qNum && key) {
            handleSelectAnswer(qNum, key);
          }
        };
      });

      // Text input delegation
      root.querySelectorAll(".question-card__text-input").forEach((input) => {
        input.oninput = (e) => {
          const card = input.closest(".question-card");
          const qNum = parseInt(card?.dataset.questionNumber, 10);
          if (qNum) {
            handleSelectAnswer(qNum, e.target.value);
          }
        };
      });
    };

    this.unmounted = () => {
      if (this.timerIntervalId) {
        clearInterval(this.timerIntervalId);
      }
    };
  }
}
