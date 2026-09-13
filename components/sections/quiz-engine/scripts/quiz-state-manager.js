/**
 * Storage key for active exam session persistence in localStorage.
 * @type {string}
 */
const QUIZ_SESSION_STORAGE_KEY = "queez_active_session";

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
 * @param {string} quizId
 * @param {Array<Object>} rawQuestions
 * @returns {Array<Object>} Sanitized questions safe for DOM rendering.
 */
export function registerQuestionsAndSanitize(quizId, rawQuestions = []) {
  if (!Array.isArray(rawQuestions)) return [];

  return rawQuestions.map((q) => {
    const qNumber = q.number;
    if (q.answer) {
      solutionRegistry.set(`${quizId}::${qNumber}`, String(q.answer).trim().toUpperCase());
    }

    // Return sanitized question copy with zero answer data
    const { answer, ...sanitized } = q;
    return sanitized;
  });
}

/**
 * Retrieves the correct answer for an exam question strictly during completion or export.
 * @param {string} quizId
 * @param {number} questionNumber
 * @returns {string} Correct answer string.
 */
export function getSolutionAnswer(quizId, questionNumber) {
  return solutionRegistry.get(`${quizId}::${questionNumber}`) || "";
}

/**
 * Loads the active session from localStorage.
 * Detects abandonment timeout if elapsed time exceeds duration.
 *
 * @param {string} quizId
 * @returns {{ session: Object|null, isAbandoned: boolean }}
 */
export function loadActiveSession(quizId) {
  if (typeof window === "undefined" || !window.localStorage) {
    return { session: null, isAbandoned: false };
  }

  try {
    const raw = window.localStorage.getItem(QUIZ_SESSION_STORAGE_KEY);
    if (!raw) return { session: null, isAbandoned: false };

    const session = JSON.parse(raw);
    const sessionMatches = session && (
      session.quizId === quizId ||
      (session.quizId && quizId.startsWith(session.quizId)) ||
      (session.quizId && session.quizId.startsWith(quizId))
    );
    if (!session || !sessionMatches) {
      return { session: null, isAbandoned: false };
    }

    // Check timeout / abandonment
    if (session.isTimed && session.totalTimeSeconds > 0 && session.startTime) {
      const elapsedSeconds = Math.floor((Date.now() - session.startTime) / 1000);
      if (elapsedSeconds >= session.totalTimeSeconds && session.status !== "completed") {
        // Abandoned past configured duration
        clearActiveSession();
        return { session: null, isAbandoned: true };
      }
    }

    return { session, isAbandoned: false };
  } catch (err) {
    console.warn("Could not parse saved quiz session:", err);
    return { session: null, isAbandoned: false };
  }
}

/**
 * Saves current session state to localStorage.
 * @param {Object} sessionState
 * @returns {void}
 */
export function saveActiveSession(sessionState) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const payload = {
      ...sessionState,
      lastActiveTime: Date.now()
    };
    window.localStorage.setItem(QUIZ_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("Failed to persist quiz session:", err);
  }
}

/**
 * Clears active session from localStorage.
 * @returns {void}
 */
export function clearActiveSession() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(QUIZ_SESSION_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear quiz session:", err);
  }
}

/**
 * Returns question number bounds for a category index.
 * Dynamically distributes questions across categories (e.g. 2 questions / 2 categories, or 150 / 4).
 * @param {number} categoryIndex
 * @param {number} [totalQuestions=150]
 * @param {number} [categoriesCount=4]
 * @returns {{ startNum: number, endNum: number }}
 */
export function getCategoryBounds(categoryIndex, totalQuestions = 150, categoriesCount = 4) {
  if (totalQuestions === 2 && categoriesCount === 2) {
    return categoryIndex === 0 ? { startNum: 1, endNum: 1 } : { startNum: 2, endNum: 2 };
  }
  if (totalQuestions <= categoriesCount && totalQuestions > 0) {
    const num = categoryIndex + 1;
    return { startNum: num, endNum: Math.min(totalQuestions, num) };
  }
  if (categoriesCount === 4 && totalQuestions === 150) {
    if (categoryIndex === 0) return { startNum: 1, endNum: 45 };
    if (categoryIndex === 1) return { startNum: 46, endNum: 90 };
    if (categoryIndex === 2) return { startNum: 91, endNum: 135 };
    return { startNum: 136, endNum: 150 };
  }
  const perCat = Math.max(1, Math.ceil(totalQuestions / Math.max(1, categoriesCount)));
  const startNum = categoryIndex * perCat + 1;
  const endNum = (categoryIndex === categoriesCount - 1)
    ? totalQuestions
    : Math.min(totalQuestions, (categoryIndex + 1) * perCat);
  return { startNum, endNum: Math.max(startNum, endNum) };
}

/**
 * Calculates score tally across answered questions against solutionRegistry.
 * Supports full exam scope (all items) or single section scope (locked to category).
 *
 * @param {string} quizId
 * @param {Array<Object>} questions
 * @param {Record<number, string>} answers
 * @param {Array<Object>} [categories=[]]
 * @param {string} [examScope="full"] - "full" or "section"
 * @param {number} [sectionCategoryIndex=0] - category index if examScope === "section"
 * @returns {Object} Complete score tally object.
 */
export function evaluateScoreTally(
  quizId,
  questions = [],
  answers = {},
  categories = [],
  examScope = "full",
  sectionCategoryIndex = 0
) {
  const isSection = examScope === "section";
  const catCount = (categories && categories.length > 0) ? categories.length : 4;
  const qCount = questions.length || 150;
  const bounds = isSection ? getCategoryBounds(sectionCategoryIndex, qCount, catCount) : { startNum: 1, endNum: qCount };

  const scopedQuestions = questions.filter((q) => {
    return q.number >= bounds.startNum && q.number <= bounds.endNum;
  });

  let totalCorrect = 0;
  const totalQuestions = scopedQuestions.length;
  const questionReviewList = [];

  scopedQuestions.forEach((q) => {
    const qNumber = q.number;
    const userAnswer = (answers[qNumber] || "").trim().toUpperCase();
    const correctAnswer = getSolutionAnswer(quizId, qNumber);
    const isCorrect = Boolean(userAnswer && correctAnswer && userAnswer === correctAnswer);

    if (isCorrect) {
      totalCorrect += 1;
    }

    questionReviewList.push({
      number: qNumber,
      question: q.question,
      options: q.options || {},
      userAnswer: userAnswer || "Unanswered",
      correctAnswer: correctAnswer || "N/A",
      isCorrect
    });
  });

  const percentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const isPassed = percentage >= 75; // Standard Philippine Civil Service / NAPOLCOM pass benchmark

  let categoryBreakdown = [];

  if (isSection) {
    const catDef = categories[sectionCategoryIndex] || {};
    categoryBreakdown = [{
      title: catDef.tab_title || catDef.tabTitle || `Part ${sectionCategoryIndex + 1}`,
      icon: catDef.icon_name || catDef.iconName || "category",
      total: totalQuestions,
      correct: totalCorrect,
      percentage
    }];
  } else {
    categoryBreakdown = categories.map((cat, catIdx) => {
      const catBounds = getCategoryBounds(catIdx, questions.length, categories.length);
      const catQuestions = questionReviewList.filter(
        (item) => item.number >= catBounds.startNum && item.number <= catBounds.endNum
      );
      const catCorrect = catQuestions.filter((item) => item.isCorrect).length;
      const catTotal = catQuestions.length;
      const catPercent = catTotal > 0 ? Math.round((catCorrect / catTotal) * 100) : 0;

      return {
        title: cat.tab_title || cat.tabTitle || `Part ${catIdx + 1}`,
        icon: cat.icon_name || cat.iconName || "category",
        total: catTotal,
        correct: catCorrect,
        percentage: catPercent
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
