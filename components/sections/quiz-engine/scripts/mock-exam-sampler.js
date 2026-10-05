/**
 * @file mock-exam-sampler.js
 * @description Mock and section exam deck generators that sample questions per section with full-bank rotation coverage over repeated attempts.
 */

import { registerDeckSolutions } from "./quiz-state-manager.js";

/**
 * Default number of questions budgeted for a total mock exam.
 * @type {number}
 */
export const DEFAULT_MOCK_EXAM_QUESTION_COUNT = 100;

/**
 * Default number of questions budgeted for a section (tab) exam.
 * @type {number}
 */
export const DEFAULT_SECTION_EXAM_QUESTION_COUNT = 10;

/**
 * Storage key for rotation history across exam retakes.
 * Record shape: Record<quizId, Record<sectionIndex, Array<number>>>
 * @type {string}
 */
const MOCK_EXAM_HISTORY_STORAGE_KEY = "queez_mock_exam_history";

/**
 * Storage key for currently active exam deck definition (source numbers and scope only, no answers).
 * @type {string}
 */
const ACTIVE_MOCK_DECK_STORAGE_KEY = "queez_active_mock_deck";

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @template T
 * @param {Array<T>} items - Items array to shuffle.
 * @param {function(): number} [randomSource=Math.random] - Random number generator returning [0, 1).
 * @returns {Array<T>} Shuffled array reference.
 */
export const shuffleInPlace = (items, randomSource = Math.random) => {
  for (let index = items.length - 1; index > 0; index -= 1) {
    /** @type {number} */
    const targetIndex = Math.floor(randomSource() * (index + 1));
    /** @type {T} */
    const temporaryItem = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temporaryItem;
  }
  return items;
};

/**
 * Allocates question quotas across sections based on budget and section capacities.
 * @param {Array<number>} sectionCapacities - Question counts of each section.
 * @param {number} totalBudget - Total question count desired.
 * @returns {Array<number>} Allocated question counts per section.
 */
export const allocateSectionCounts = (sectionCapacities, totalBudget) => {
  if (!Array.isArray(sectionCapacities) || sectionCapacities.length === 0) {
    return [];
  }

  /** @type {number} */
  const sectionCount = sectionCapacities.length;
  /** @type {number} */
  const totalAvailable = sectionCapacities.reduce(
    (accumulator, count) => accumulator + count,
    0
  );
  /** @type {number} */
  const effectiveBudget = Math.min(totalBudget, totalAvailable);

  /** @type {number} */
  const baseAllocation = Math.floor(effectiveBudget / sectionCount);
  /** @type {Array<number>} */
  const allocations = sectionCapacities.map((capacity) =>
    Math.min(capacity, baseAllocation)
  );

  /** @type {number} */
  let allocatedSum = allocations.reduce(
    (accumulator, count) => accumulator + count,
    0
  );
  /** @type {number} */
  let remainingBudget = effectiveBudget - allocatedSum;

  /** @type {number} */
  let iterationGuard = 0;
  while (remainingBudget > 0 && iterationGuard < sectionCount * 2) {
    for (
      let index = 0;
      index < sectionCount && remainingBudget > 0;
      index += 1
    ) {
      if (allocations[index] < sectionCapacities[index]) {
        allocations[index] += 1;
        remainingBudget -= 1;
      }
    }
    iterationGuard += 1;
  }

  return allocations;
};

/**
 * Loads exam rotation history from localStorage.
 * @returns {Record<string, Record<string, Array<number>>>>}
 */
export const loadMockExamHistory = () => {
  if (typeof window === "undefined" || !window.localStorage) {
    return {};
  }
  try {
    /** @type {string|null} */
    const rawHistory = window.localStorage.getItem(
      MOCK_EXAM_HISTORY_STORAGE_KEY
    );
    return rawHistory ? JSON.parse(rawHistory) : {};
  } catch (error) {
    console.warn("Failed to load mock exam history:", error);
    return {};
  }
};

/**
 * Saves exam rotation history to localStorage.
 * @param {Record<string, Record<string, Array<number>>>>} historyObject - History payload.
 * @returns {void}
 */
export const saveMockExamHistory = (historyObject) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(
      MOCK_EXAM_HISTORY_STORAGE_KEY,
      JSON.stringify(historyObject)
    );
  } catch (error) {
    console.warn("Failed to persist mock exam history:", error);
  }
};

/**
 * Selects question numbers from a section pool, prioritizing unserved questions.
 * @param {Array<Object>} sectionQuestions - Questions in this section.
 * @param {number} countToSelect - Number of questions to pick.
 * @param {Array<number>} servedNumbers - Question numbers already served in past attempts.
 * @param {function(): number} [randomSource=Math.random] - Random source for test determinism.
 * @returns {{ selected: Array<Object>, updatedServed: Array<number> }} Selected questions and new served list.
 */
export const selectSectionQuestions = (
  sectionQuestions,
  countToSelect,
  servedNumbers,
  randomSource = Math.random
) => {
  /** @type {Array<Object>} */
  const availableQuestions = [...sectionQuestions];
  if (countToSelect >= availableQuestions.length) {
    return {
      selected: availableQuestions,
      updatedServed: availableQuestions.map((question) => question.number)
    };
  }

  /** @type {Set<number>} */
  const servedSet = new Set(servedNumbers);
  /** @type {Array<Object>} */
  let unservedQuestions = availableQuestions.filter(
    (question) => !servedSet.has(question.number)
  );

  /** @type {Array<Object>} */
  const selectedQuestions = [];
  /** @type {Array<number>} */
  let newServedList = [...servedNumbers];

  if (unservedQuestions.length < countToSelect) {
    selectedQuestions.push(...unservedQuestions);
    newServedList = [];
    /** @type {Set<number>} */
    const pickedNumbers = new Set(
      selectedQuestions.map((question) => question.number)
    );
    unservedQuestions = availableQuestions.filter(
      (question) => !pickedNumbers.has(question.number)
    );
  }

  shuffleInPlace(unservedQuestions, randomSource);
  /** @type {number} */
  const remainderNeeded = countToSelect - selectedQuestions.length;
  /** @type {Array<Object>} */
  const pickedRemainder = unservedQuestions.slice(0, remainderNeeded);
  selectedQuestions.push(...pickedRemainder);

  pickedRemainder.forEach((question) => {
    newServedList.push(question.number);
  });

  return {
    selected: selectedQuestions,
    updatedServed: newServedList
  };
};

/**
 * Builds a rotated mock exam deck from the full question bank.
 * @param {Object} configuration
 * @param {string} configuration.quizId - Unique quiz identifier.
 * @param {Array<Object>} configuration.questions - Sanitized question bank.
 * @param {Array<Object>} configuration.sectionBounds - Section bounds list.
 * @param {number} [configuration.questionBudget=DEFAULT_MOCK_EXAM_QUESTION_COUNT] - Total questions budget.
 * @param {function(): number} [configuration.randomSource=Math.random] - Random generator for shuffling.
 * @returns {Object} Deck result object.
 */
export const buildMockExamDeck = ({
  quizId,
  questions = [],
  sectionBounds = [],
  questionBudget = DEFAULT_MOCK_EXAM_QUESTION_COUNT,
  randomSource = Math.random
}) => {
  /** @type {number} */
  const totalQuestionsInBank = questions.length;
  if (totalQuestionsInBank <= questionBudget) {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(ACTIVE_MOCK_DECK_STORAGE_KEY);
      } catch (error) {
        console.warn("Failed to remove active mock deck:", error);
      }
    }
    return {
      deckQuizId: quizId,
      questions,
      sectionBounds,
      sourceNumbers: questions.map((question) => question.number),
      isSampled: false,
      examScope: "full"
    };
  }

  /** @type {string} */
  const deckQuizId = `${quizId}::mock`;
  /** @type {Record<string, Record<string, Array<number>>>>} */
  const historyStore = loadMockExamHistory();
  if (!historyStore[quizId]) {
    historyStore[quizId] = {};
  }
  /** @type {Record<string, Array<number>>} */
  const quizHistory = historyStore[quizId];

  /** @type {Array<Array<Object>>} */
  const sectionQuestionsList = sectionBounds.map((bound) => {
    /** @type {number} */
    const startNumber = bound.startNum ?? bound.startNumber ?? 1;
    /** @type {number} */
    const endNumber = bound.endNum ?? bound.endNumber ?? startNumber;
    return questions.filter(
      (question) =>
        question.number >= startNumber && question.number <= endNumber
    );
  });

  /** @type {Array<number>} */
  const sectionCapacities = sectionQuestionsList.map(
    (sectionList) => sectionList.length
  );
  /** @type {Array<number>} */
  const sectionAllocations = allocateSectionCounts(
    sectionCapacities,
    questionBudget
  );

  /** @type {Array<Object>} */
  const deckQuestions = [];
  /** @type {Array<Object>} */
  const deckBounds = [];
  /** @type {Record<number, number>} */
  const solutionNumberMapping = {};
  /** @type {Array<number>} */
  const sourceNumbers = [];

  /** @type {number} */
  let currentDeckQuestionNumber = 1;

  sectionQuestionsList.forEach((sectionQuestions, sectionIndex) => {
    /** @type {number} */
    const countForSection = sectionAllocations[sectionIndex] || 0;
    /** @type {Array<number>} */
    const pastServed = quizHistory[String(sectionIndex)] || [];

    const { selected, updatedServed } = selectSectionQuestions(
      sectionQuestions,
      countForSection,
      pastServed,
      randomSource
    );

    quizHistory[String(sectionIndex)] = updatedServed;

    /** @type {number} */
    const sectionStartDeckNumber = currentDeckQuestionNumber;

    selected.forEach((sourceQuestion) => {
      /** @type {number} */
      const assignedNumber = currentDeckQuestionNumber;
      solutionNumberMapping[assignedNumber] = sourceQuestion.number;
      sourceNumbers.push(sourceQuestion.number);

      deckQuestions.push({
        ...sourceQuestion,
        number: assignedNumber,
        sourceNumber: sourceQuestion.number
      });

      currentDeckQuestionNumber += 1;
    });

    /** @type {number} */
    const sectionEndDeckNumber = currentDeckQuestionNumber - 1;
    deckBounds.push({
      startNum: sectionStartDeckNumber,
      endNum: Math.max(sectionStartDeckNumber, sectionEndDeckNumber),
      startNumber: sectionStartDeckNumber,
      endNumber: Math.max(sectionStartDeckNumber, sectionEndDeckNumber)
    });
  });

  saveMockExamHistory(historyStore);
  registerDeckSolutions(deckQuizId, quizId, solutionNumberMapping);

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(
        ACTIVE_MOCK_DECK_STORAGE_KEY,
        JSON.stringify({ quizId, sourceNumbers, examScope: "full" })
      );
    } catch (error) {
      console.warn("Failed to persist active mock deck:", error);
    }
  }

  return {
    deckQuizId,
    questions: deckQuestions,
    sectionBounds: deckBounds,
    sourceNumbers,
    isSampled: true,
    examScope: "full"
  };
};

/**
 * Builds a rotated section exam deck for a single section with subset sampling.
 * @param {Object} configuration
 * @param {string} configuration.quizId - Unique quiz identifier.
 * @param {Array<Object>} configuration.questions - Sanitized question bank.
 * @param {Array<Object>} configuration.sectionBounds - Section bounds list.
 * @param {number} configuration.sectionIndex - Target section index.
 * @param {number} [configuration.questionCount=DEFAULT_SECTION_EXAM_QUESTION_COUNT] - Number of items requested.
 * @param {function(): number} [configuration.randomSource=Math.random] - Random generator for shuffling.
 * @returns {Object} Deck result object.
 */
export const buildSectionExamDeck = ({
  quizId,
  questions = [],
  sectionBounds = [],
  sectionIndex = 0,
  questionCount = DEFAULT_SECTION_EXAM_QUESTION_COUNT,
  randomSource = Math.random
}) => {
  /** @type {number} */
  const clampedSectionIndex = Math.max(
    0,
    Math.min(sectionIndex, Math.max(0, sectionBounds.length - 1))
  );
  /** @type {Object} */
  const targetBound = sectionBounds[clampedSectionIndex] || {
    startNumber: 1,
    endNumber: questions.length
  };
  /** @type {number} */
  const startNumber = targetBound.startNum ?? targetBound.startNumber ?? 1;
  /** @type {number} */
  const endNumber = targetBound.endNum ?? targetBound.endNumber ?? startNumber;

  /** @type {Array<Object>} */
  const pool = questions.filter(
    (question) =>
      question.number >= startNumber && question.number <= endNumber
  );

  /** @type {number} */
  const normalizedBudget = Math.floor(questionCount) || DEFAULT_SECTION_EXAM_QUESTION_COUNT;
  /** @type {number} */
  const effectiveCount = Math.max(1, Math.min(normalizedBudget, pool.length));

  if (effectiveCount >= pool.length) {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(ACTIVE_MOCK_DECK_STORAGE_KEY);
      } catch (error) {
        console.warn("Failed to clear active mock deck storage:", error);
      }
    }
    return {
      deckQuizId: quizId,
      questions,
      sectionBounds,
      sourceNumbers: pool.map((question) => question.number),
      isSampled: false,
      examScope: "section",
      sectionCategoryIndex: clampedSectionIndex
    };
  }

  /** @type {string} */
  const deckQuizId = `${quizId}::section${clampedSectionIndex}`;
  /** @type {Record<string, Record<string, Array<number>>>>} */
  const historyStore = loadMockExamHistory();
  if (!historyStore[quizId]) {
    historyStore[quizId] = {};
  }
  /** @type {Record<string, Array<number>>} */
  const quizHistory = historyStore[quizId];
  /** @type {Array<number>} */
  const pastServed = quizHistory[String(clampedSectionIndex)] || [];

  const { selected, updatedServed } = selectSectionQuestions(
    pool,
    effectiveCount,
    pastServed,
    randomSource
  );

  quizHistory[String(clampedSectionIndex)] = updatedServed;
  saveMockExamHistory(historyStore);

  // Preserve relative order of selected questions from the source section
  selected.sort(
    (firstQuestion, secondQuestion) =>
      firstQuestion.number - secondQuestion.number
  );

  /** @type {Array<Object>} */
  const deckQuestions = [];
  /** @type {Record<number, number>} */
  const solutionNumberMapping = {};
  /** @type {Array<number>} */
  const sourceNumbers = [];

  selected.forEach((sourceQuestion, itemIndex) => {
    /** @type {number} */
    const assignedNumber = itemIndex + 1;
    solutionNumberMapping[assignedNumber] = sourceQuestion.number;
    sourceNumbers.push(sourceQuestion.number);

    deckQuestions.push({
      ...sourceQuestion,
      number: assignedNumber,
      sourceNumber: sourceQuestion.number
    });
  });

  // Section bounds: same length as original; active section is {1..N}, others {1, 1}
  /** @type {Array<Object>} */
  const deckBounds = sectionBounds.map((bound, currentBoundIndex) => {
    if (currentBoundIndex === clampedSectionIndex) {
      return {
        startNum: 1,
        endNum: effectiveCount,
        startNumber: 1,
        endNumber: effectiveCount
      };
    }
    return {
      startNum: 1,
      endNum: 1,
      startNumber: 1,
      endNumber: 1
    };
  });

  registerDeckSolutions(deckQuizId, quizId, solutionNumberMapping);

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(
        ACTIVE_MOCK_DECK_STORAGE_KEY,
        JSON.stringify({
          quizId,
          sourceNumbers,
          examScope: "section",
          sectionCategoryIndex: clampedSectionIndex
        })
      );
    } catch (error) {
      console.warn("Failed to persist active section deck:", error);
    }
  }

  return {
    deckQuizId,
    questions: deckQuestions,
    sectionBounds: deckBounds,
    sourceNumbers,
    isSampled: true,
    examScope: "section",
    sectionCategoryIndex: clampedSectionIndex
  };
};

/**
 * Restores an active mock exam deck from stored source question numbers.
 * @param {string} quizId - Original quiz identifier.
 * @param {Array<Object>} bankQuestions - Sanitized questions from bank.
 * @param {Array<Object>} sectionBounds - Original section bounds.
 * @returns {Object|null} Restored deck object or null if none saved or not full scope.
 */
export const restoreMockExamDeck = (quizId, bankQuestions, sectionBounds) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    /** @type {string|null} */
    const rawDeckJson = window.localStorage.getItem(
      ACTIVE_MOCK_DECK_STORAGE_KEY
    );
    if (!rawDeckJson) {
      return null;
    }

    /** @type {Object} */
    const deckRecord = JSON.parse(rawDeckJson);
    if (
      !deckRecord ||
      deckRecord.quizId !== quizId ||
      !Array.isArray(deckRecord.sourceNumbers)
    ) {
      return null;
    }

    // Ignore section-scoped records when restoring full mock exam
    if (deckRecord.examScope && deckRecord.examScope !== "full") {
      return null;
    }

    /** @type {Array<number>} */
    const sourceNumbers = deckRecord.sourceNumbers;
    /** @type {Map<number, Object>} */
    const bankQuestionMap = new Map();
    bankQuestions.forEach((question) => {
      bankQuestionMap.set(question.number, question);
    });

    /** @type {string} */
    const deckQuizId = `${quizId}::mock`;
    /** @type {Array<Object>} */
    const deckQuestions = [];
    /** @type {Record<number, number>} */
    const solutionNumberMapping = {};

    sourceNumbers.forEach((sourceNumber, itemIndex) => {
      /** @type {number} */
      const assignedNumber = itemIndex + 1;
      /** @type {Object|undefined} */
      const sourceQuestion = bankQuestionMap.get(sourceNumber);
      if (sourceQuestion) {
        deckQuestions.push({
          ...sourceQuestion,
          number: assignedNumber,
          sourceNumber
        });
        solutionNumberMapping[assignedNumber] = sourceNumber;
      }
    });

    if (deckQuestions.length === 0) {
      return null;
    }

    /** @type {Array<Object>} */
    const deckBounds = [];
    /** @type {number} */
    let pointer = 1;

    sectionBounds.forEach((bound) => {
      /** @type {number} */
      const originalStart = bound.startNum ?? bound.startNumber ?? 1;
      /** @type {number} */
      const originalEnd = bound.endNum ?? bound.endNumber ?? originalStart;
      /** @type {number} */
      const sectionCount = sourceNumbers.filter(
        (number) => number >= originalStart && number <= originalEnd
      ).length;

      /** @type {number} */
      const deckStart = pointer;
      /** @type {number} */
      const deckEnd = Math.max(deckStart, pointer + sectionCount - 1);
      pointer += sectionCount;

      deckBounds.push({
        startNum: deckStart,
        endNum: deckEnd,
        startNumber: deckStart,
        endNumber: deckEnd
      });
    });

    registerDeckSolutions(deckQuizId, quizId, solutionNumberMapping);

    return {
      deckQuizId,
      questions: deckQuestions,
      sectionBounds: deckBounds,
      sourceNumbers,
      isSampled: true,
      examScope: "full"
    };
  } catch (error) {
    console.warn("Failed to restore mock exam deck:", error);
    return null;
  }
};

/**
 * Restores an active section exam deck from stored source question numbers.
 * @param {string} quizId - Original quiz identifier.
 * @param {Array<Object>} bankQuestions - Sanitized questions from bank.
 * @param {Array<Object>} sectionBounds - Original section bounds.
 * @param {number} sectionIndex - Target section index.
 * @returns {Object|null} Restored deck object or null if none saved or scope mismatch.
 */
export const restoreSectionExamDeck = (
  quizId,
  bankQuestions,
  sectionBounds,
  sectionIndex
) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    /** @type {string|null} */
    const rawDeckJson = window.localStorage.getItem(
      ACTIVE_MOCK_DECK_STORAGE_KEY
    );
    if (!rawDeckJson) {
      return null;
    }

    /** @type {Object} */
    const deckRecord = JSON.parse(rawDeckJson);
    if (
      !deckRecord ||
      deckRecord.quizId !== quizId ||
      deckRecord.examScope !== "section" ||
      deckRecord.sectionCategoryIndex !== sectionIndex ||
      !Array.isArray(deckRecord.sourceNumbers)
    ) {
      return null;
    }

    /** @type {Array<number>} */
    const sourceNumbers = deckRecord.sourceNumbers;
    /** @type {Map<number, Object>} */
    const bankQuestionMap = new Map();
    bankQuestions.forEach((question) => {
      bankQuestionMap.set(question.number, question);
    });

    /** @type {string} */
    const deckQuizId = `${quizId}::section${sectionIndex}`;
    /** @type {Array<Object>} */
    const deckQuestions = [];
    /** @type {Record<number, number>} */
    const solutionNumberMapping = {};

    sourceNumbers.forEach((sourceNumber, itemIndex) => {
      /** @type {number} */
      const assignedNumber = itemIndex + 1;
      /** @type {Object|undefined} */
      const sourceQuestion = bankQuestionMap.get(sourceNumber);
      if (sourceQuestion) {
        deckQuestions.push({
          ...sourceQuestion,
          number: assignedNumber,
          sourceNumber
        });
        solutionNumberMapping[assignedNumber] = sourceNumber;
      }
    });

    if (deckQuestions.length === 0) {
      return null;
    }

    /** @type {number} */
    const effectiveCount = deckQuestions.length;
    /** @type {Array<Object>} */
    const deckBounds = sectionBounds.map((bound, currentBoundIndex) => {
      if (currentBoundIndex === sectionIndex) {
        return {
          startNum: 1,
          endNum: effectiveCount,
          startNumber: 1,
          endNumber: effectiveCount
        };
      }
      return {
        startNum: 1,
        endNum: 1,
        startNumber: 1,
        endNumber: 1
      };
    });

    registerDeckSolutions(deckQuizId, quizId, solutionNumberMapping);

    return {
      deckQuizId,
      questions: deckQuestions,
      sectionBounds: deckBounds,
      sourceNumbers,
      isSampled: true,
      examScope: "section",
      sectionCategoryIndex: sectionIndex
    };
  } catch (error) {
    console.warn("Failed to restore section exam deck:", error);
    return null;
  }
};
