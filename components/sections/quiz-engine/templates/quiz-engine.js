import { Component, css, html, raw, signal } from "../../../../Component.js";
import { QuestionCard } from "../../../widgets/question-card/templates/question-card.js";
import { ContextDrawer } from "../../../widgets/context-drawer/templates/context-drawer.js";
import { ConfirmDialog } from "../../../widgets/confirm-dialog/templates/confirm-dialog.js";
import { formatSecondsToTime } from "../../../widgets/quiz-action-bar/templates/quiz-action-bar.js";
import { saveActiveSession, clearActiveSession, getCategoryBounds } from "../scripts/quiz-state-manager.js";

css(import.meta, ["../styles/quiz-engine.css"]);

/**
 * Maps question number to its category index (0-indexed).
 * Dynamically supports any total question count, category count, or explicit sectionBounds.
 * @param {number} questionNumber - 1-based question number.
 * @param {number} [totalQuestions=150] - Total questions count.
 * @param {number} [categoriesCount=4] - Total categories count.
 * @param {Array<{ startNum?: number, endNum?: number, startNumber?: number, endNumber?: number }>|null} [sectionBounds=null] - Explicit section bounds.
 * @returns {number} Category index (0-indexed).
 */
export function getCategoryIndexForQuestion(questionNumber, totalQuestions = 150, categoriesCount = 4, sectionBounds = null) {
  if (Array.isArray(sectionBounds) && sectionBounds.length > 0) {
    for (let index = 0; index < sectionBounds.length; index += 1) {
      /** @type {Object} */
      const boundEntry = sectionBounds[index] || {};
      /** @type {number} */
      const startNum = boundEntry.startNum ?? boundEntry.startNumber ?? 1;
      /** @type {number} */
      const endNum = boundEntry.endNum ?? boundEntry.endNumber ?? startNum;
      if (questionNumber >= startNum && questionNumber <= endNum) {
        return index;
      }
    }
    return Math.max(0, Math.min(sectionBounds.length - 1, categoriesCount - 1));
  }

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
  /** @type {number} */
  const perCategory = Math.max(1, Math.ceil(totalQuestions / Math.max(1, categoriesCount)));
  return Math.min(categoriesCount - 1, Math.floor((questionNumber - 1) / perCategory));
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
   * @param {string} configuration.quizId - Unique quiz identifier.
   * @param {Array<Object>} configuration.questions - Sanitized questions (no correct answers).
   * @param {Array<Object>} configuration.categories - Category list.
   * @param {Array<Object>|null} [configuration.sectionBounds=null] - Explicit section bounds list.
   * @param {Object|null} [configuration.savedSession=null] - Restored session from localStorage.
   * @param {boolean} [configuration.isTimed=false] - Whether timer is active.
   * @param {number} [configuration.totalTimeSeconds=0] - Countdown timer duration in seconds.
   * @param {number} [configuration.startTime=Date.now()] - Start timestamp.
   * @param {string} [configuration.examScope="full"] - "full" or "section".
   * @param {number} [configuration.sectionCategoryIndex=0] - Category index if examScope === "section".
   * @param {function(number): void} [configuration.onCategoryChange=()=>{}] - Callback when active section changes.
   * @param {function(Record<number, string>, Object): void} [configuration.onFinishExam=()=>{}] - Callback on completion.
   * @param {function(): void} [configuration.onStopExam=()=>{}] - Callback when active exam is stopped.
   */
  constructor({
    quizId,
    questions = [],
    categories = [],
    sectionBounds = null,
    savedSession = null,
    isTimed = false,
    totalTimeSeconds = 0,
    startTime = Date.now(),
    examScope = "full",
    sectionCategoryIndex = 0,
    tabsComponent = null,
    onCategoryChange = () => {},
    onFinishExam = () => {},
    onStopExam = () => {}
  } = {}) {
    super();

    /** @type {string} */
    this.quizId = quizId;
    /** @type {Array<Object>} */
    this.questions = questions;
    /** @type {Array<Object>} */
    this.categories = categories;
    /** @type {Array<Object>|null} */
    this.sectionBounds = sectionBounds;
    /** @type {Object|null} */
    this.tabsComponent = tabsComponent;
    /** @type {function(number): void} */
    this.onCategoryChange = onCategoryChange;
    /** @type {function(Record<number, string>, Object): void} */
    this.onFinishExam = onFinishExam;
    /** @type {function(): void} */
    this.onStopExam = onStopExam;

    /** @type {ContextDrawer} */
    this.contextDrawer = new ContextDrawer();

    /** @type {ConfirmDialog} */
    this.confirmDialog = new ConfirmDialog();

    /** @type {string} */
    this.examScope = savedSession?.examScope || examScope;
    /** @type {number} */
    this.sectionCategoryIndex = savedSession?.sectionCategoryIndex ?? sectionCategoryIndex;

    /** @type {{ startNum: number, endNum: number }} */
    const bounds = (this.examScope === "section")
      ? getCategoryBounds(this.sectionCategoryIndex, this.questions.length, this.categories.length, this.sectionBounds)
      : { startNum: 1, endNum: this.questions.length };
    this.activeScopeBounds = bounds;
    /** @type {number} */
    this.sectionTotalQuestions = bounds.endNum - bounds.startNum + 1;

    // Restore or initialize state
    /** @type {number} */
    const defaultInitialIndex = (this.examScope === "section") ? (bounds.startNum - 1) : 0;
    /** @type {number} */
    const initialQuestionIndex = savedSession?.currentQuestionIndex ?? defaultInitialIndex;
    /** @type {Record<number, string>} */
    const initialAnswers = savedSession?.answers || {};
    /** @type {number} */
    const initialCategoryIndex = (this.examScope === "section")
      ? this.sectionCategoryIndex
      : getCategoryIndexForQuestion(initialQuestionIndex + 1, this.questions.length, this.categories.length, this.sectionBounds);

    /** @type {boolean} */
    this.isTimed = savedSession?.isTimed ?? isTimed;
    /** @type {number} */
    this.totalTimeSeconds = savedSession?.totalTimeSeconds ?? totalTimeSeconds;
    /** @type {number} */
    this.startTime = savedSession?.startTime ?? startTime;

    /** @type {Record<number, string>} */
    this.answers = { ...initialAnswers };
    /** @type {import("../../../../Component.js").Signal<number>} */
    this.currentQuestionIndexSignal = signal(initialQuestionIndex);
    /** @type {import("../../../../Component.js").Signal<number>} */
    this.activeCategoryIndexSignal = signal(initialCategoryIndex);
    /** @type {import("../../../../Component.js").Signal<boolean>} */
    this.isTransitionSignal = signal(Boolean(this.examScope === "full" && savedSession?.status === "transition"));
    /** @type {import("../../../../Component.js").Signal<number>} */
    this.transitionNextCategorySignal = signal(savedSession?.transitionNextCategory || 1);

    // Timer signal
    /**
     * @returns {number}
     */
    const calcRemainingSeconds = () => {
      if (!this.isTimed || this.totalTimeSeconds <= 0) return 0;
      /** @type {number} */
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      return Math.max(0, this.totalTimeSeconds - elapsed);
    };

    /** @type {import("../../../../Component.js").Signal<number>} */
    this.remainingSecondsSignal = signal(calcRemainingSeconds());

    /**
     * @param {string} [status="in_progress"]
     * @returns {void}
     */
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
    /**
     * @param {number} questionNumber
     * @param {string} selectedValue
     * @returns {void}
     */
    const handleSelectAnswer = (questionNumber, selectedValue) => {
      this.answers[questionNumber] = selectedValue;
      persistCurrentState("in_progress");

      // Update active option style in DOM instantly
      /** @type {HTMLElement|null} */
      const questionCardElement = document.querySelector(`.question-card[data-question-number="${questionNumber}"]`);
      if (questionCardElement) {
        questionCardElement.querySelectorAll(".question-card__option-button").forEach((button) => {
          /** @type {HTMLElement|null} */
          const keyElement = button.querySelector(".question-card__option-key");
          /** @type {HTMLElement|null} */
          const radioIcon = button.querySelector(".question-card__radio-icon");
          /** @type {boolean} */
          const isSelected = Boolean(keyElement && keyElement.textContent.trim() === selectedValue);
          button.classList.toggle("question-card__option-button--selected", isSelected);
          button.setAttribute("aria-checked", isSelected ? "true" : "false");
          if (radioIcon) {
            radioIcon.textContent = isSelected ? "radio_button_checked" : "radio_button_unchecked";
          }
        });
      }
    };

    // Pagination handlers
    /**
     * @returns {void}
     */
    const handleNextPage = () => {
      /** @type {number} */
      const currentIndex = this.currentQuestionIndexSignal.value;
      /** @type {number} */
      const currentQuestionNumber = currentIndex + 1;
      /** @type {number} */
      const currentCategory = (this.examScope === "section")
        ? this.sectionCategoryIndex
        : getCategoryIndexForQuestion(currentQuestionNumber, this.questions.length, this.categories.length, this.sectionBounds);
      /** @type {{ startNum: number, endNum: number }} */
      const currentBounds = getCategoryBounds(currentCategory, this.questions.length, this.categories.length, this.sectionBounds);

      // Check if current page slice reaches the end of current category
      /** @type {number} */
      const nextPageFirstQuestionNumber = currentIndex + 11;
      if (this.examScope === "section") {
        if (nextPageFirstQuestionNumber > currentBounds.endNum) {
          finishQuiz();
          return;
        }
      } else {
        if (nextPageFirstQuestionNumber > currentBounds.endNum) {
          // At the end of this category
          if (currentCategory < this.categories.length - 1) {
            // Show category transition checkpoint!
            /** @type {number} */
            const nextCategory = currentCategory + 1;
            this.transitionNextCategorySignal.value = nextCategory;
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
      /** @type {number} */
      const maxIndex = (this.examScope === "section") ? currentBounds.endNum - 1 : this.questions.length - 1;
      /** @type {number} */
      const nextIndex = Math.min(maxIndex, currentIndex + 10);
      this.currentQuestionIndexSignal.value = nextIndex;
      persistCurrentState("in_progress");
      this.renderView();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    /**
     * @returns {void}
     */
    const handlePrevPage = () => {
      /** @type {number} */
      const currentIndex = this.currentQuestionIndexSignal.value;
      /** @type {number} */
      const currentQuestionNumber = currentIndex + 1;
      /** @type {number} */
      const currentCategory = (this.examScope === "section")
        ? this.sectionCategoryIndex
        : getCategoryIndexForQuestion(currentQuestionNumber, this.questions.length, this.categories.length, this.sectionBounds);
      /** @type {{ startNum: number, endNum: number }} */
      const currentBounds = getCategoryBounds(currentCategory, this.questions.length, this.categories.length, this.sectionBounds);

      // Go back 10 questions within this category
      /** @type {number} */
      const previousIndex = Math.max(currentBounds.startNum - 1, currentIndex - 10);
      this.currentQuestionIndexSignal.value = previousIndex;
      persistCurrentState("in_progress");
      this.renderView();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    /**
     * @returns {void}
     */
    const handleResumeCategory = () => {
      /** @type {number} */
      const nextCategory = this.transitionNextCategorySignal.value;
      /** @type {{ startNum: number, endNum: number }} */
      const nextBounds = getCategoryBounds(nextCategory, this.questions.length, this.categories.length, this.sectionBounds);
      this.currentQuestionIndexSignal.value = nextBounds.startNum - 1;
      this.activeCategoryIndexSignal.value = nextCategory;
      this.isTransitionSignal.value = false;
      persistCurrentState("in_progress");

      if (typeof this.onCategoryChange === "function") {
        this.onCategoryChange(nextCategory);
      }

      this.renderView();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    /**
     * @returns {void}
     */
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
          startTime: this.startTime,
          sectionBounds: this.sectionBounds
        });
      }
    };

    /**
     * Handles stopping the active examination after explicit user confirmation.
     * Discards active in-memory and persistent session states and returns to the initial view.
     * @returns {Promise<void>}
     */
    const handleStopExam = async () => {
      /** @type {boolean} */
      const userConfirmed = await this.confirmDialog.prompt({
        title: "Stop Examination?",
        description: "Are you sure you want to stop this examination? Your active progress will be discarded.",
        confirmLabel: "Stop Exam",
        cancelLabel: "Continue Exam",
        icon: "stop_circle",
        isDestructive: true
      });

      if (!userConfirmed) {
        return;
      }

      if (this.timerIntervalId) {
        clearInterval(this.timerIntervalId);
        this.timerIntervalId = null;
      }

      if (this.tabsComponent && typeof this.tabsComponent.detachStopButton === "function") {
        this.tabsComponent.detachStopButton();
      }

      clearActiveSession();

      if (typeof this.onStopExam === "function") {
        this.onStopExam();
      }
    };

    /** @type {function(): Promise<void>} */
    this.handleStopExam = handleStopExam;

    /**
     * @param {number} targetCategoryIndex
     * @returns {void}
     */
    this.jumpToCategory = (targetCategoryIndex) => {
      if (this.examScope === "section") {
        return; // Exam is locked to this tab's questions
      }
      if (targetCategoryIndex < 0 || targetCategoryIndex >= this.categories.length) {
        return;
      }
      /** @type {{ startNum: number, endNum: number }} */
      const targetBounds = getCategoryBounds(targetCategoryIndex, this.questions.length, this.categories.length, this.sectionBounds);
      this.currentQuestionIndexSignal.value = targetBounds.startNum - 1;
      this.activeCategoryIndexSignal.value = targetCategoryIndex;
      this.isTransitionSignal.value = false;
      persistCurrentState("in_progress");
      this.renderView();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    /**
     * Attaches the stop button to the active tab item.
     * @returns {void}
     */
    const attachTabStopButton = () => {
      if (this.tabsComponent && typeof this.tabsComponent.attachStopButton === "function") {
        this.tabsComponent.attachStopButton(() => {
          handleStopExam();
        });
        return;
      }

      if (typeof document === "undefined") {
        return;
      }

      /** @type {HTMLElement|null} */
      const activeTabElement = document.querySelector(".tabs__track .tabs__item--active");
      if (activeTabElement && !activeTabElement.querySelector("#buttonStopExamTab")) {
        /** @type {HTMLElement} */
        const stopButtonElement = document.createElement("span");
        stopButtonElement.id = "buttonStopExamTab";
        stopButtonElement.setAttribute("role", "button");
        stopButtonElement.tabIndex = 0;
        stopButtonElement.className = "bright-squircle quiz-engine__stop-button quiz-engine__stop-button--tab";
        stopButtonElement.setAttribute("data-tooltip", "Stop Examination");
        stopButtonElement.setAttribute("aria-label", "Stop Examination");
        stopButtonElement.innerHTML = `
          <svg class="quiz-engine__stop-icon-svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <rect x="5.5" y="5.5" width="13" height="13" rx="2.5" />
          </svg>
        `;
        stopButtonElement.onpointerdown = (pointerEvent) => {
          pointerEvent.stopPropagation();
        };
        stopButtonElement.onmousedown = (mouseEvent) => {
          mouseEvent.stopPropagation();
        };
        stopButtonElement.onclick = (event) => {
          event.stopPropagation();
          event.preventDefault();
          handleStopExam();
        };
        stopButtonElement.onkeydown = (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.stopPropagation();
            event.preventDefault();
            handleStopExam();
          }
        };
        activeTabElement.appendChild(stopButtonElement);
      }
    };

    /**
     * @returns {void}
     */
    this.renderView = () => {
      if (typeof document === "undefined" || typeof document.getElementById !== "function") {
        return;
      }
      /** @type {HTMLElement|null} */
      const containerElement = document.getElementById("quizEngineRoot");
      if (!containerElement) {
        return;
      }
      containerElement.innerHTML = this.buildContent();
      this.attachListeners();
      attachTabStopButton();
    };

    /**
     * @returns {string}
     */
    this.buildContent = () => {
      // 1. Transition Screen Checkpoint
      if (this.isTransitionSignal.value) {
        /** @type {number} */
        const nextCategoryIndex = this.transitionNextCategorySignal.value;
        /** @type {Object} */
        const nextCategoryDefinition = this.categories[nextCategoryIndex] || {};
        /** @type {string} */
        const categoryTitle = nextCategoryDefinition.tab_title || nextCategoryDefinition.tabTitle || `Category ${nextCategoryIndex + 1}`;
        /** @type {string} */
        const categoryIcon = nextCategoryDefinition.icon_name || nextCategoryDefinition.iconName || "school";
        /** @type {{ startNum: number, endNum: number }} */
        const nextBounds = getCategoryBounds(nextCategoryIndex, this.questions.length, this.categories.length, this.sectionBounds);
        /** @type {number} */
        const count = nextBounds.endNum - nextBounds.startNum + 1;

        return `
          <div class="quiz-engine__transition-view" role="region" aria-label="Section Transition">
            <div class="quiz-engine__transition-icon">
              <span class="google-symbols notranslate">${categoryIcon}</span>
            </div>
            <h2 class="quiz-engine__transition-headline">Proceed to ${categoryTitle}</h2>
            <p class="quiz-engine__transition-subtext">
              Part ${nextCategoryIndex + 1} of ${this.categories.length} • Questions ${nextBounds.startNum} to ${nextBounds.endNum} (${count} items).
              Take a breath and continue when you are ready.
            </p>
            <button
              type="button"
              id="buttonResumeCategory"
              class="bright-squircle quiz-engine__transition-play-button"
              data-tooltip="Start ${categoryTitle}"
              aria-label="Start ${categoryTitle}"
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
          <!-- Confirm Dialog Mount Point -->
          <div id="confirmDialogMountPoint">
            ${this.confirmDialog.toString()}
          </div>
        `;
      }

      // 2. Active 10 Questions Page
      /** @type {number} */
      const startIndex = this.currentQuestionIndexSignal.value;
      /** @type {number} */
      const currentCategoryIndex = (this.examScope === "section")
        ? this.sectionCategoryIndex
        : getCategoryIndexForQuestion(startIndex + 1, this.questions.length, this.categories.length, this.sectionBounds);
      /** @type {{ startNum: number, endNum: number }} */
      const activeBounds = getCategoryBounds(currentCategoryIndex, this.questions.length, this.categories.length, this.sectionBounds);
      /** @type {number} */
      const pageEndIndex = Math.min(activeBounds.endNum, startIndex + 10);
      /** @type {Array<Object>} */
      const pageQuestions = this.questions.slice(startIndex, pageEndIndex);

      /** @type {Object} */
      const currentCategoryDefinition = this.categories[currentCategoryIndex] || {};
      /** @type {string} */
      const categoryTitle = currentCategoryDefinition.tab_title || currentCategoryDefinition.tabTitle || `Part ${currentCategoryIndex + 1}`;
      /** @type {string} */
      const categoryIcon = currentCategoryDefinition.icon_name || currentCategoryDefinition.iconName || "category";
      /** @type {string} */
      const categoryDisplayTitle = (this.examScope === "section")
        ? `${categoryTitle} (Section Exam)`
        : categoryTitle;

      // Question Cards Markup
      /** @type {string} */
      const cardsHtml = pageQuestions.map((questionItem) => {
        /** @type {QuestionCard} */
        const questionCard = new QuestionCard({
          question: questionItem,
          selectedAnswer: this.answers[questionItem.number] || "",
          onSelectAnswer: (questionNumber, answerValue) => handleSelectAnswer(questionNumber, answerValue)
        });
        return questionCard.toString();
      }).join("");

      // Live Timer Badge
      /** @type {string} */
      let timerBadgeHtml = "";
      if (this.isTimed) {
        /** @type {number} */
        const remaining = this.remainingSecondsSignal.value;
        timerBadgeHtml = `
          <div class="quiz-engine__timer-pill" aria-live="polite" aria-label="Remaining time">
            <span class="google-symbols notranslate" style="font-size: 1.125rem;">timer</span>
            <span id="quizEngineLiveTimer">${formatSecondsToTime(remaining)}</span>
          </div>
        `;
      }

      // Progress label
      /** @type {number} */
      const totalExamQuestions = (this.examScope === "section")
        ? this.sectionTotalQuestions
        : this.questions.length;
      /** @type {number} */
      const currentRelativeQuestionNumber = (this.examScope === "section")
        ? (Math.min(pageEndIndex, activeBounds.endNum) - activeBounds.startNum + 1)
        : Math.min(pageEndIndex, this.questions.length);
      /** @type {string} */
      const progressLabel = `Question ${currentRelativeQuestionNumber} of ${totalExamQuestions}`;

      // Navigation button labels
      /** @type {boolean} */
      const isFirstPageOfCategory = startIndex === activeBounds.startNum - 1;
      /** @type {boolean} */
      const isLastPageOfCategory = pageEndIndex >= activeBounds.endNum;
      /** @type {boolean} */
      const isLastCategory = (this.examScope === "section") || (currentCategoryIndex === this.categories.length - 1);

      /** @type {string} */
      const nextLabel = isLastPageOfCategory
        ? "Finish & Submit Exam"
        : (this.examScope === "section" ? "Next Page" : `Proceed to ${this.categories[currentCategoryIndex + 1]?.tab_title || "Next Category"}`);

      return `
        <div class="quiz-engine" role="region" aria-label="Questionnaire Engine">
          <!-- Progress Header Bar -->
          <div class="quiz-engine__header">
            <div class="quiz-engine__category-badge">
              <span class="google-symbols notranslate">${categoryIcon}</span>
              <span>${categoryDisplayTitle}</span>
            </div>

            <div class="quiz-engine__header-controls" style="display: flex; align-items: center; gap: 0.75rem;">
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
              Questions ${startIndex + 1}–${pageEndIndex} of ${activeBounds.endNum}
            </span>

            <div class="quiz-engine__navigation-actions">
              <button
                type="button"
                id="buttonStopExamNav"
                class="bright-squircle quiz-engine__stop-button quiz-engine__stop-button--nav"
                data-tooltip="Stop Examination"
                aria-label="Stop Examination"
              >
                <svg class="quiz-engine__stop-icon-svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>

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

          <!-- Context Drawer Mount Point -->
          <div id="contextDrawerMountPoint">
            ${this.contextDrawer.toString()}
          </div>

          <!-- Confirm Dialog Mount Point -->
          <div id="confirmDialogMountPoint">
            ${this.confirmDialog.toString()}
          </div>
        </div>
      `;
    };

    this.template = html`
      <div id="quizEngineRoot" style="width: 100%;">
        ${raw(this.buildContent())}
      </div>
    `;

    this.mounted = () => {
      persistCurrentState("in_progress");
      this.renderView();

      // Setup Live Countdown Timer
      if (this.isTimed) {
        this.timerIntervalId = setInterval(() => {
          /** @type {number} */
          const remaining = calcRemainingSeconds();
          this.remainingSecondsSignal.value = remaining;

          /** @type {HTMLElement|null} */
          const timerElement = document.getElementById("quizEngineLiveTimer");
          if (timerElement) {
            timerElement.textContent = formatSecondsToTime(remaining);
          }

          if (remaining <= 0) {
            clearInterval(this.timerIntervalId);
            finishQuiz();
          }
        }, 1000);
      }
    };

    this.attachListeners = () => {
      if (typeof document === "undefined" || typeof document.getElementById !== "function") {
        return;
      }
      /** @type {HTMLElement|null} */
      const rootElement = document.getElementById("quizEngineRoot");
      if (!rootElement) {
        return;
      }

      /** @type {HTMLElement|null} */
      const resumeButton = rootElement.querySelector("#buttonResumeCategory");
      if (resumeButton) {
        resumeButton.onclick = () => {
          handleResumeCategory();
        };
      }

      /** @type {HTMLElement|null} */
      const stopExamNavButton = rootElement.querySelector("#buttonStopExamNav");
      if (stopExamNavButton) {
        stopExamNavButton.onclick = () => {
          handleStopExam();
        };
      }

      /** @type {HTMLElement|null} */
      const stopExamButton = rootElement.querySelector("#buttonStopExam");
      if (stopExamButton) {
        stopExamButton.onclick = () => {
          handleStopExam();
        };
      }

      /** @type {HTMLElement|null} */
      const nextButton = rootElement.querySelector("#buttonNextPage");
      if (nextButton) {
        nextButton.onclick = () => {
          handleNextPage();
        };
      }

      /** @type {HTMLElement|null} */
      const prevButton = rootElement.querySelector("#buttonPrevPage");
      if (prevButton) {
        prevButton.onclick = () => {
          handlePrevPage();
        };
      }

      // Context drawer trigger delegation
      rootElement.querySelectorAll(".question-card__context-trigger").forEach((triggerButton) => {
        /** @param {MouseEvent} event */
        triggerButton.onclick = (event) => {
          event.preventDefault();
          /** @type {HTMLElement|null} */
          const cardElement = triggerButton.closest(".question-card");
          /** @type {number} */
          const questionNumber = parseInt(cardElement?.dataset.questionNumber || "0", 10);
          /** @type {Object|undefined} */
          const matchedQuestion = this.questions.find((item) => item.number === questionNumber);
          if (matchedQuestion && matchedQuestion.context) {
            this.contextDrawer.open(matchedQuestion.context);
          }
        };
      });

      this.contextDrawer.attachListeners();
      this.confirmDialog.attachListeners();

      // Option selection delegation
      rootElement.querySelectorAll(".question-card__option-button").forEach((button) => {
        /** @param {MouseEvent} event */
        button.onclick = (event) => {
          event.preventDefault();
          /** @type {HTMLElement|null} */
          const cardElement = button.closest(".question-card");
          /** @type {number} */
          const questionNumber = parseInt(cardElement?.dataset.questionNumber || "0", 10);
          /** @type {HTMLElement|null} */
          const keyElement = button.querySelector(".question-card__option-key");
          /** @type {string} */
          const keyString = keyElement ? keyElement.textContent.trim() : "";
          if (questionNumber && keyString) {
            handleSelectAnswer(questionNumber, keyString);
          }
        };
      });

      // Text input delegation
      rootElement.querySelectorAll(".question-card__text-input").forEach((inputElement) => {
        /** @param {Event} event */
        inputElement.oninput = (event) => {
          /** @type {HTMLElement|null} */
          const cardElement = inputElement.closest(".question-card");
          /** @type {number} */
          const questionNumber = parseInt(cardElement?.dataset.questionNumber || "0", 10);
          /** @type {HTMLInputElement} */
          const targetInput = /** @type {HTMLInputElement} */ (event.target);
          if (questionNumber) {
            handleSelectAnswer(questionNumber, targetInput.value);
          }
        };
      });
    };

    this.unmounted = () => {
      if (this.timerIntervalId) {
        clearInterval(this.timerIntervalId);
      }
      if (this.contextDrawer && typeof this.contextDrawer.unmounted === "function") {
        this.contextDrawer.unmounted();
      }
      if (this.confirmDialog && typeof this.confirmDialog.unmounted === "function") {
        this.confirmDialog.unmounted();
      }
    };
  }
}
