/**
 * @file quiz-state-manager.js
 * @description State manager, solution registry, localStorage persistence, and bounds calculation for quiz exams.
 */

/**
 * Storage key for active exam session persistence in localStorage.
 * @type {string}
 */
const QUIZ_SESSION_STORAGE_KEY = "queez_active_session";

/**
 * Storage key for active mock exam deck persistence in localStorage.
 * @type {string}
 */
const QUIZ_ACTIVE_MOCK_DECK_STORAGE_KEY = "queez_active_mock_deck";

/**
 * Isolated in-memory solution registry.
 * Strictly held in this module closure and NEVER exposed to window or DOM attributes.
 * Keyed by: `${quizId}::${questionNumber}` -> correct answer string.
 * @type {Map<string, string>}
 */
const solutionRegistry = new Map();

/**
 * Initializes the solution registry from raw question definitions,
 * returning sanitized questions stripped of all answer keys.
 *
 * @param {string} quizId - Unique quiz identifier.
 * @param {Array<Object>} [rawQuestions=[]] - List of raw question objects.
 * @returns {Array<Object>} Sanitized questions safe for DOM rendering.
 */
export function registerQuestionsAndSanitize(quizId, rawQuestions = []) {
  if (!Array.isArray(rawQuestions)) {
    return [];
  }

  return rawQuestions.map((questionItem) => {
    /** @type {number} */
    const questionNumber = questionItem.number;
    if (questionItem.answer) {
      solutionRegistry.set(`${quizId}::${questionNumber}`, String(questionItem.answer).trim().toUpperCase());
    }

    // Return sanitized question copy with zero answer data
    const { answer, ...sanitized } = questionItem;
    return sanitized;
  });
}

/**
 * Copies solution answers from a source quiz to a deck quiz under mapped question numbers.
 * @param {string} deckQuizId - Target deck quiz identifier.
 * @param {string} sourceQuizId - Source quiz identifier.
 * @param {Record<number, number>} numberMapping - Map of new question number to source question number.
 * @returns {void}
 */
export function registerDeckSolutions(deckQuizId, sourceQuizId, numberMapping = {}) {
  Object.entries(numberMapping).forEach(([newNumberString, sourceNumber]) => {
    /** @type {number} */
    const newNumber = Number(newNumberString);
    /** @type {string} */
    const sourceAnswer = solutionRegistry.get(`${sourceQuizId}::${sourceNumber}`) || "";
    if (sourceAnswer) {
      solutionRegistry.set(`${deckQuizId}::${newNumber}`, sourceAnswer);
    }
  });
}

/**
 * Retrieves the correct answer for an exam question strictly during completion or export.
 * @param {string} quizId - Unique quiz identifier.
 * @param {number} questionNumber - Question number.
 * @returns {string} Correct answer string.
 */
export function getSolutionAnswer(quizId, questionNumber) {
  return solutionRegistry.get(`${quizId}::${questionNumber}`) || "";
}

/**
 * Loads the active session from localStorage.
 * Detects abandonment timeout if elapsed time exceeds duration.
 *
 * @param {string} quizId - Unique quiz identifier.
 * @returns {{ session: Object|null, isAbandoned: boolean }} Loaded session or null.
 */
export function loadActiveSession(quizId) {
  if (typeof window === "undefined" || !window.localStorage) {
    return { session: null, isAbandoned: false };
  }

  try {
    /** @type {string|null} */
    const rawSessionJson = window.localStorage.getItem(QUIZ_SESSION_STORAGE_KEY);
    if (!rawSessionJson) {
      return { session: null, isAbandoned: false };
    }

    /** @type {Object} */
    const session = JSON.parse(rawSessionJson);
    /** @type {boolean} */
    const sessionMatches = Boolean(
      session && (
        session.quizId === quizId ||
        (session.quizId && quizId.startsWith(session.quizId)) ||
        (session.quizId && session.quizId.startsWith(quizId))
      )
    );
    if (!session || !sessionMatches) {
      return { session: null, isAbandoned: false };
    }

    // Check timeout / abandonment
    if (session.isTimed && session.totalTimeSeconds > 0 && session.startTime) {
      /** @type {number} */
      const elapsedSeconds = Math.floor((Date.now() - session.startTime) / 1000);
      if (elapsedSeconds >= session.totalTimeSeconds && session.status !== "completed") {
        // Abandoned past configured duration
        clearActiveSession();
        return { session: null, isAbandoned: true };
      }
    }

    return { session, isAbandoned: false };
  } catch (error) {
    console.warn("Could not parse saved quiz session:", error);
    return { session: null, isAbandoned: false };
  }
}

/**
 * Saves current session state to localStorage.
 * @param {Object} sessionState - State payload to persist.
 * @returns {void}
 */
export function saveActiveSession(sessionState) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    /** @type {Object} */
    const payload = {
      ...sessionState,
      lastActiveTime: Date.now()
    };
    window.localStorage.setItem(QUIZ_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist quiz session:", error);
  }
}

/**
 * Clears active session and stored active mock exam deck from localStorage.
 * @returns {void}
 */
export function clearActiveSession() {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(QUIZ_SESSION_STORAGE_KEY);
    window.localStorage.removeItem(QUIZ_ACTIVE_MOCK_DECK_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear quiz session:", error);
  }
}

/**
 * Returns question number bounds for a category index.
 * Dynamically distributes questions across categories or uses explicit sectionBounds if provided.
 * @param {number} categoryIndex - 0-indexed category index.
 * @param {number} [totalQuestions=150] - Total questions count.
 * @param {number} [categoriesCount=4] - Total categories count.
 * @param {Array<{ startNum?: number, endNum?: number, startNumber?: number, endNumber?: number }>|null} [sectionBounds=null] - Explicit section bounds.
 * @returns {{ startNum: number, endNum: number }} Question range bounds.
 */
export function getCategoryBounds(categoryIndex, totalQuestions = 150, categoriesCount = 4, sectionBounds = null) {
  if (Array.isArray(sectionBounds) && sectionBounds.length > 0) {
    /** @type {number} */
    const clampedIndex = Math.max(0, Math.min(sectionBounds.length - 1, categoryIndex));
    /** @type {Object} */
    const boundEntry = sectionBounds[clampedIndex] || {};
    /** @type {number} */
    const startNum = boundEntry.startNum ?? boundEntry.startNumber ?? 1;
    /** @type {number} */
    const endNum = boundEntry.endNum ?? boundEntry.endNumber ?? startNum;
    return { startNum, endNum: Math.max(startNum, endNum) };
  }

  if (totalQuestions === 2 && categoriesCount === 2) {
    return categoryIndex === 0 ? { startNum: 1, endNum: 1 } : { startNum: 2, endNum: 2 };
  }
  if (totalQuestions <= categoriesCount && totalQuestions > 0) {
    /** @type {number} */
    const questionNumber = categoryIndex + 1;
    return { startNum: questionNumber, endNum: Math.min(totalQuestions, questionNumber) };
  }
  if (categoriesCount === 4 && totalQuestions === 150) {
    if (categoryIndex === 0) return { startNum: 1, endNum: 45 };
    if (categoryIndex === 1) return { startNum: 46, endNum: 90 };
    if (categoryIndex === 2) return { startNum: 91, endNum: 135 };
    return { startNum: 136, endNum: 150 };
  }

  /** @type {number} */
  const perCategory = Math.max(1, Math.ceil(totalQuestions / Math.max(1, categoriesCount)));
  /** @type {number} */
  const startNum = categoryIndex * perCategory + 1;
  /** @type {number} */
  const endNum = (categoryIndex === categoriesCount - 1)
    ? totalQuestions
    : Math.min(totalQuestions, (categoryIndex + 1) * perCategory);

  return { startNum, endNum: Math.max(startNum, endNum) };
}

/**
 * Calculates score tally across answered questions against solutionRegistry.
 * Supports full exam scope (all items) or single section scope (locked to category).
 *
 * @param {string} quizId - Unique quiz identifier.
 * @param {Array<Object>} [questions=[]] - Question list.
 * @param {Record<number, string>} [answers={}] - User answers map.
 * @param {Array<Object>} [categories=[]] - Category definitions.
 * @param {string} [examScope="full"] - "full" or "section".
 * @param {number} [sectionCategoryIndex=0] - Category index if examScope === "section".
 * @param {Array<{ startNum?: number, endNum?: number, startNumber?: number, endNumber?: number }>|null} [sectionBounds=null] - Explicit bounds.
 * @returns {Object} Complete score tally object.
 */
export function evaluateScoreTally(
  quizId,
  questions = [],
  answers = {},
  categories = [],
  examScope = "full",
  sectionCategoryIndex = 0,
  sectionBounds = null
) {
  /** @type {boolean} */
  const isSection = examScope === "section";
  /** @type {number} */
  const categoryCount = (categories && categories.length > 0) ? categories.length : 4;
  /** @type {number} */
  const questionCount = questions.length || 150;
  /** @type {{ startNum: number, endNum: number }} */
  const bounds = isSection
    ? getCategoryBounds(sectionCategoryIndex, questionCount, categoryCount, sectionBounds)
    : { startNum: 1, endNum: questionCount };

  /** @type {Array<Object>} */
  const scopedQuestions = questions.filter((questionItem) => {
    return questionItem.number >= bounds.startNum && questionItem.number <= bounds.endNum;
  });

  /** @type {number} */
  let totalCorrect = 0;
  /** @type {number} */
  const totalQuestions = scopedQuestions.length;
  /** @type {Array<Object>} */
  const questionReviewList = [];

  scopedQuestions.forEach((questionItem) => {
    /** @type {number} */
    const questionNumber = questionItem.number;
    /** @type {string} */
    const userAnswer = (answers[questionNumber] || "").trim().toUpperCase();
    /** @type {string} */
    const correctAnswer = getSolutionAnswer(quizId, questionNumber);
    /** @type {boolean} */
    const isCorrect = Boolean(userAnswer && correctAnswer && userAnswer === correctAnswer);

    if (isCorrect) {
      totalCorrect += 1;
    }

    questionReviewList.push({
      number: questionNumber,
      question: questionItem.question,
      options: questionItem.options || {},
      userAnswer: userAnswer || "Unanswered",
      correctAnswer: correctAnswer || "N/A",
      isCorrect,
      ...(questionItem.image ? { image: questionItem.image } : {}),
      ...(questionItem.caption ? { caption: questionItem.caption } : {}),
      ...(questionItem.options_type ? { options_type: questionItem.options_type } : {}),
      ...(questionItem.explanation ? { explanation: questionItem.explanation } : {})
    });
  });

  /** @type {number} */
  const percentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  /** @type {boolean} */
  const isPassed = percentage >= 75; // Standard Philippine Civil Service / NAPOLCOM pass benchmark

  /** @type {Array<Object>} */
  let categoryBreakdown = [];

  if (isSection) {
    /** @type {Object} */
    const categoryDefinition = categories[sectionCategoryIndex] || {};
    categoryBreakdown = [{
      title: categoryDefinition.tab_title || categoryDefinition.tabTitle || `Part ${sectionCategoryIndex + 1}`,
      icon: categoryDefinition.icon_name || categoryDefinition.iconName || "category",
      total: totalQuestions,
      correct: totalCorrect,
      percentage
    }];
  } else {
    categoryBreakdown = categories.map((categoryDefinition, categoryIndex) => {
      /** @type {{ startNum: number, endNum: number }} */
      const catBounds = getCategoryBounds(categoryIndex, questions.length, categories.length, sectionBounds);
      /** @type {Array<Object>} */
      const categoryQuestions = questionReviewList.filter(
        (item) => item.number >= catBounds.startNum && item.number <= catBounds.endNum
      );
      /** @type {number} */
      const categoryCorrect = categoryQuestions.filter((item) => item.isCorrect).length;
      /** @type {number} */
      const categoryTotal = categoryQuestions.length;
      /** @type {number} */
      const categoryPercent = categoryTotal > 0 ? Math.round((categoryCorrect / categoryTotal) * 100) : 0;

      return {
        title: categoryDefinition.tab_title || categoryDefinition.tabTitle || `Part ${categoryIndex + 1}`,
        icon: categoryDefinition.icon_name || categoryDefinition.iconName || "category",
        total: categoryTotal,
        correct: categoryCorrect,
        percentage: categoryPercent
      };
    });
  }

  return {
    totalCorrect,
    totalQuestions,
    percentage,
    isPassed,
    categoryBreakdown,
    questionReviewList,
    examScope,
    sectionCategoryIndex
  };
}
