/**
 * @file Adapter for parsing portable educational quiz documents (quiz-data.v1).
 * Isolates UI presentation from raw examination datasets.
 */

/**
 * @typedef {Object} PortableQuestion
 * @property {number} number - Sequential question number (1-based).
 * @property {string} type - Question category (e.g., multiple_choice, identification, true_false).
 * @property {string} question - Question prompt text.
 * @property {Record<string, string>} options - Choice dictionary mapping option key to label.
 * @property {string} answer - Correct answer choice key.
 * @property {string} [image] - Optional relative image path.
 */

/**
 * @typedef {Object} PortableSection
 * @property {string} id - Canonical section identifier.
 * @property {string} title - Human-readable section heading.
 * @property {Array<PortableQuestion>} questions - Array of question items inside this section.
 */

/**
 * @typedef {Object} PortableQuizDocument
 * @property {string} schema_version - Schema specification version string ("quiz-data.v1").
 * @property {string} id - Unique quiz identifier.
 * @property {string} title - Primary title of the examination.
 * @property {string} [subtitle] - Optional subtitle or slogan.
 * @property {string} [publisher] - Optional publisher or author name.
 * @property {Array<string>} [instructions] - Optional array of exam instructions.
 * @property {Array<PortableSection>} sections - Section collections containing questions.
 */

/**
 * @typedef {Object} NavigationTabDefinition
 * @property {string} section_id - Identifier matching a section in the quiz document.
 * @property {string} icon_name - Google Material symbol icon name for the tab.
 */

/**
 * @typedef {Object} AdaptedSection
 * @property {string} id - Canonical section identifier.
 * @property {string} title - Section title text.
 * @property {string} [description] - Educational section description text.
 * @property {string} iconName - Material symbol icon name.
 * @property {number} startNumber - First question number in this section (1-based).
 * @property {number} endNumber - Final question number in this section (1-based).
 * @property {number} questionCount - Total number of questions in this section.
 * @property {string} tab_title - Legacy property alias for component compatibility.
 * @property {string} icon_name - Legacy property alias for component compatibility.
 */

/**
 * @typedef {Object} AdaptedQuiz
 * @property {Object} meta - Metadata regarding the quiz.
 * @property {string} meta.id - Quiz identifier.
 * @property {string} meta.title - Quiz title.
 * @property {string} meta.subtitle - Quiz subtitle.
 * @property {string} meta.publisher - Quiz publisher.
 * @property {Array<string>} meta.instructions - Quiz instructions list.
 * @property {Array<PortableQuestion>} questions - Flattened list of sanitized/raw questions with resolved image URLs.
 * @property {Array<AdaptedSection>} sections - Enriched section definitions with bounds and presentation icons.
 */

/**
 * Adapts a portable quiz document into an enriched format consumed by the examination application.
 *
 * @param {PortableQuizDocument} portableDocument - The raw parsed JSON quiz document.
 * @param {string} [dataPath=""] - Path from which the document was loaded, used to resolve asset URLs.
 * @param {Array<NavigationTabDefinition>} [tabDefinitions=[]] - UI presentation tab definitions mapping section_id to icons.
 * @returns {AdaptedQuiz} The adapted and verified quiz dataset ready for view mounting.
 * @throws {Error} If the document does not adhere to the quiz-data.v1 schema version.
 */
export const adaptQuizData = (portableDocument, dataPath = "", tabDefinitions = []) => {
  if (!portableDocument || typeof portableDocument !== "object") {
    throw new Error("Invalid quiz document provided: expected non-null object.");
  }

  if (portableDocument.schema_version !== "quiz-data.v1") {
    throw new Error(
      `Unsupported quiz schema version '${portableDocument.schema_version}'. Expected 'quiz-data.v1'.`
    );
  }

  /** @type {string} */
  const baseDirectory = dataPath.includes("/")
    ? dataPath.substring(0, dataPath.lastIndexOf("/"))
    : "";

  /** @type {Map<string, string>} */
  const iconLookupMap = new Map();
  if (Array.isArray(tabDefinitions)) {
    for (/** @type {NavigationTabDefinition} */ const tabDefinition of tabDefinitions) {
      if (tabDefinition && tabDefinition.section_id) {
        iconLookupMap.set(tabDefinition.section_id, tabDefinition.icon_name || "category");
      }
    }
  }

  /** @type {Array<PortableQuestion>} */
  const flattenedQuestions = [];

  /** @type {Array<AdaptedSection>} */
  const adaptedSections = [];

  /** @type {Array<PortableSection>} */
  const documentSections = Array.isArray(portableDocument.sections)
    ? portableDocument.sections
    : [];

  /** @type {number} */
  let currentRunningNumber = 1;

  for (/** @type {PortableSection} */ const currentSection of documentSections) {
    /** @type {Array<PortableQuestion>} */
    const sectionQuestions = Array.isArray(currentSection.questions)
      ? currentSection.questions
      : [];

    /** @type {number} */
    const sectionQuestionCount = sectionQuestions.length;

    /** @type {number} */
    const sectionStartNumber = sectionQuestionCount > 0 ? currentRunningNumber : currentRunningNumber;

    /** @type {number} */
    const sectionEndNumber = sectionQuestionCount > 0
      ? currentRunningNumber + sectionQuestionCount - 1
      : currentRunningNumber;

    if (sectionQuestionCount > 0) {
      currentRunningNumber += sectionQuestionCount;
    }

    /** @type {string} */
    const assignedIcon = iconLookupMap.get(currentSection.id) || "category";

    adaptedSections.push({
      id: currentSection.id,
      title: currentSection.title,
      description: currentSection.description || "",
      iconName: assignedIcon,
      startNumber: sectionStartNumber,
      endNumber: sectionEndNumber,
      questionCount: sectionQuestionCount,
      // Legacy compatibility aliases
      tab_title: currentSection.title,
      icon_name: assignedIcon
    });

    for (/** @type {PortableQuestion} */ const sourceQuestion of sectionQuestions) {
      /** @type {string|undefined} */
      let resolvedImagePath = undefined;

      if (sourceQuestion.image) {
        resolvedImagePath = baseDirectory
          ? `${baseDirectory}/${sourceQuestion.image}`
          : sourceQuestion.image;
      }

      flattenedQuestions.push({
        number: sourceQuestion.number,
        type: sourceQuestion.type || "multiple_choice",
        question: sourceQuestion.question,
        options: sourceQuestion.options,
        answer: sourceQuestion.answer,
        ...(resolvedImagePath ? { image: resolvedImagePath } : {})
      });
    }
  }

  return {
    meta: {
      id: portableDocument.id || "quiz",
      title: portableDocument.title || "Examination",
      subtitle: portableDocument.subtitle || "",
      publisher: portableDocument.publisher || "",
      instructions: Array.isArray(portableDocument.instructions)
        ? portableDocument.instructions
        : []
    },
    questions: flattenedQuestions,
    sections: adaptedSections
  };
}
