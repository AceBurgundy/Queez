/**
 * @file mock-exam-sampler.js
 * @description Mock exam deck generator that samples questions per section with full-bank rotation coverage over repeated attempts.
 */

import { registerDeckSolutions } from "./quiz-state-manager.js";

/**
 * Default number of questions budgeted for a mock exam (~1 hour test).
 * @type {number}
 */
export const DEFAULT_MOCK_EXAM_QUESTION_COUNT = 60;

/**
 * Storage key for rotation history across mock exam retakes.
 * Record shape: Record<quizId, Record<sectionIndex, Array<number>>>
 * @type {string}
 */
const MOCK_EXAM_HISTORY_STORAGE_KEY = "queez_mock_exam_history";

/**
 * Storage key for currently active mock exam deck definition (question numbers only, no answers).
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
export function shuffleInPlace(items, randomSource = Math.random) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    /** @type {number} */
    const targetIndex = Math.floor(randomSource() * (index + 1));
    /** @type {T} */
    const temporaryItem = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temporaryItem;
  }
  return items;
}

/**
 * Allocates question quotas across sections based on budget and section capacities.
 * @param {Array<number>} sectionCapacities - Question counts of each section.
 * @param {number} totalBudget - Total question count desired.
 * @returns {Array<number>} Allocated question counts per section.
 */
export function allocateSectionCounts(sectionCapacities, totalBudget) {
  if (!Array.isArray(sectionCapacities) || sectionCapacities.length === 0) {
    return [];
  }

  /** @type {number} */
  const sectionCount = sectionCapacities.length;
  /** @type {number} */
  const totalAvailable = sectionCapacities.reduce((accumulator, count) => accumulator + count, 0);
  /** @type {number} */
  const effectiveBudget = Math.min(totalBudget, totalAvailable);

  /** @type {number} */
  const baseAllocation = Math.floor(effectiveBudget / sectionCount);
  /** @type {Array<number>} */
  const allocations = sectionCapacities.map((capacity) => Math.min(capacity, baseAllocation));

  /** @type {number} */
  let allocatedSum = allocations.reduce((accumulator, count) => accumulator + count, 0);
  /** @type {number} */
  let remainingBudget = effectiveBudget - allocatedSum;

  // Distribute remaining quota round-robin to sections with remaining capacity
  /** @type {number} */
  let iterationGuard = 0;
  while (remainingBudget > 0 && iterationGuard < sectionCount * 2) {
    for (let index = 0; index < sectionCount && remainingBudget > 0; index += 1) {
      if (allocations[index] < sectionCapacities[index]) {
        allocations[index] += 1;
        remainingBudget -= 1;
      }
    }
    iterationGuard += 1;
  }

  return allocations;
}

/**
 * Loads mock exam rotation history from localStorage.
 * @returns {Record<string, Record<string, Array<number>>>}
 */
export function loadMockExamHistory() {
  if (typeof window === "undefined" || !window.localStorage) {
    return {};
  }
  try {
    /** @type {string|null} */
    const rawHistory = window.localStorage.getItem(MOCK_EXAM_HISTORY_STORAGE_KEY);
    return rawHistory ? JSON.parse(rawHistory) : {};
  } catch (error) {
    console.warn("Failed to load mock exam history:", error);
    return {};
  }
}

/**
 * Saves mock exam rotation history to localStorage.
 * @param {Record<string, Record<string, Array<number>>>>} historyObject - History payload.
 * @returns {void}
 */
export function saveMockExamHistory(historyObject) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(MOCK_EXAM_HISTORY_STORAGE_KEY, JSON.stringify(historyObject));
  } catch (error) {
    console.warn("Failed to persist mock exam history:", error);
  }
}

/**
 * Selects question numbers from a section pool, prioritizing unserved questions.
 * @param {Array<Object>} sectionQuestions - Questions in this section.
 * @param {number} countToSelect - Number of questions to pick.
 * @param {Array<number>} servedNumbers - Question numbers already served in past attempts.
 * @param {function(): number} [randomSource=Math.random] - Random source for test determinism.
 * @returns {{ selected: Array<Object>, updatedServed: Array<number> }} Selected questions and new served list.
 */
export function selectSectionQuestions(sectionQuestions, countToSelect, servedNumbers, randomSource = Math.random) {
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
  let unservedQuestions = availableQuestions.filter((question) => !servedSet.has(question.number));

  /** @type {Array<Object>} */
  const selectedQuestions = [];
  /** @type {Array<number>} */
  let newServedList = [...servedNumbers];

  // If unserved pool is smaller than needed count, take all unserved, then reset cycle
  if (unservedQuestions.length < countToSelect) {
    selectedQuestions.push(...unservedQuestions);
    newServedList = [];
    /** @type {Set<number>} */
    const pickedNumbers = new Set(selectedQuestions.map((question) => question.number));
    unservedQuestions = availableQuestions.filter((question) => !pickedNumbers.has(question.number));
  }

  // Shuffle remaining candidate pool and pick required remainder
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
}

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
export function buildMockExamDeck({
  quizId,
  questions = [],
  sectionBounds = [],
  questionBudget = DEFAULT_MOCK_EXAM_QUESTION_COUNT,
  randomSource = Math.random
}) {
  /** @type {number} */
  const totalQuestionsInBank = questions.length;
  if (totalQuestionsInBank <= questionBudget) {
    return {
      deckQuizId: quizId,
      questions,
      sectionBounds,
      sourceNumbers: questions.map((question) => question.number),
      isSampled: false
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

  // Slice bank questions by section bounds
  /** @type {Array<Array<Object>>} */
  const sectionQuestionsList = sectionBounds.map((bound) => {
    /** @type {number} */
    const startNum = bound.startNum ?? bound.startNumber ?? 1;
    /** @type {number} */
    const endNum = bound.endNum ?? bound.endNumber ?? startNum;
    return questions.filter((question) => question.number >= startNum && question.number <= endNum);
  });

  /** @type {Array<number>} */
  const sectionCapacities = sectionQuestionsList.map((sectionList) => sectionList.length);
  /** @type {Array<number>} */
  const sectionAllocations = allocateSectionCounts(sectionCapacities, questionBudget);

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

  // Register solutions into solutionRegistry for the deck quiz ID
  registerDeckSolutions(deckQuizId, quizId, solutionNumberMapping);

  // Persist active deck description (source question numbers only) to localStorage
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(
        ACTIVE_MOCK_DECK_STORAGE_KEY,
        JSON.stringify({ quizId, sourceNumbers })
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
    isSampled: true
  };
}

/**
 * Restores an active mock exam deck from stored source question numbers.
 * @param {string} quizId - Original quiz identifier.
 * @param {Array<Object>} bankQuestions - Sanitized questions from bank.
 * @param {Array<Object>} sectionBounds - Original section bounds.
 * @returns {Object|null} Restored deck object or null if none saved.
 */
export function restoreMockExamDeck(quizId, bankQuestions, sectionBounds) {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    /** @type {string|null} */
    const rawDeckJson = window.localStorage.getItem(ACTIVE_MOCK_DECK_STORAGE_KEY);
    if (!rawDeckJson) {
      return null;
    }

    /** @type {Object} */
    const deckRecord = JSON.parse(rawDeckJson);
    if (!deckRecord || deckRecord.quizId !== quizId || !Array.isArray(deckRecord.sourceNumbers)) {
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

    sourceNumbers.forEach((sourceNumber, index) => {
      /** @type {number} */
      const assignedNumber = index + 1;
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

    // Reconstruct deckBounds matching original section proportions
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
      isSampled: true
    };
  } catch (error) {
    console.warn("Failed to restore mock exam deck:", error);
    return null;
  }
}
