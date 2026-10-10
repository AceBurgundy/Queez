import { Component, css, html } from "../../../../Component.js";

css(import.meta, ["../styles/question-card.css"]);

/**
 * QuestionCard Component
 * Polymorphic question renderer supporting multiple-choice (text or visual images),
 * fill-in-the-blank text input, image illustrations with captions, and reference context triggers.
 * Security: NEVER renders the correct answer into HTML or DOM attributes.
 */
export class QuestionCard extends Component {
  /**
   * @param {Object} configuration
   * @param {Object} [configuration.questionData] - Sanitized question data.
   * @param {Object} [configuration.question] - Alias for questionData.
   * @param {string} [configuration.selectedAnswer=""] - Currently selected answer value.
   * @param {function(number, string): void} [configuration.onSelectAnswer] - Selection callback.
   */
  constructor({
    questionData = null,
    question = null,
    selectedAnswer = "",
    onSelectAnswer = () => {}
  } = {}) {
    super();

    /** @type {Object} */
    const questionPayload = question || questionData || {};
    /** @type {number} */
    this.number = questionPayload.number || 1;
    /** @type {string} */
    this.questionText = questionPayload.question || "";
    /** @type {Record<string, string>|null} */
    this.options = questionPayload.options || null;
    /** @type {string|null} */
    this.rawImage = questionPayload.image || null;
    /** @type {string|null} */
    this.caption = questionPayload.caption || null;
    /** @type {Object|null} */
    this.context = questionPayload.context || null;
    /** @type {string|null} */
    this.optionsType = questionPayload.options_type || null;
    /** @type {string} */
    this.type = questionPayload.type || (this.options ? "multiple_choice" : "fill-in-the-blank");
    /** @type {string} */
    this.selectedAnswer = selectedAnswer || "";
    /** @type {function(number, string): void} */
    this.onSelectAnswer = onSelectAnswer;

    // Resolve asset path from quizzes/ prefix to data/ prefix if needed
    /** @type {string|null} */
    let resolvedImage = this.rawImage;
    if (resolvedImage && resolvedImage.startsWith("quizzes/")) {
      resolvedImage = "data/" + resolvedImage.slice("quizzes/".length);
    }
    /** @type {string|null} */
    this.image = resolvedImage;

    /**
     * @param {string} optionKey
     * @returns {void}
     */
    const handleSelectOption = (optionKey) => {
      if (typeof this.onSelectAnswer === "function") {
        this.onSelectAnswer(this.number, optionKey);
      }
    };

    /**
     * @param {Event} inputEvent
     * @returns {void}
     */
    const handleTextInput = (inputEvent) => {
      if (typeof this.onSelectAnswer === "function") {
        /** @type {HTMLInputElement} */
        const targetInput = /** @type {HTMLInputElement} */ (inputEvent.target);
        this.onSelectAnswer(this.number, targetInput.value);
      }
    };

    // Render shared context trigger button if question links to a context
    /** @type {string} */
    let contextTemplate = "";
    if (this.context) {
      /** @type {string} */
      const contextTitle = this.context.title || "Reference Context / Diagram";
      contextTemplate = html`
        <div class="question-card__context-banner">
          <button
            type="button"
            class="question-card__context-trigger"
            data-context-id="${this.context.id || ""}"
            data-question-number="${this.number}"
            aria-label="View Reference Context: ${contextTitle}"
          >
            <span class="google-symbols notranslate question-card__context-icon">menu_book</span>
            <span class="question-card__context-text">${contextTitle}</span>
            <span class="google-symbols notranslate question-card__context-arrow">open_in_new</span>
          </button>
        </div>
      `;
    }

    // Render illustration image if present
    /** @type {string} */
    const imageTemplate = this.image
      ? html`
        <div class="question-card__image-container">
          <img
            src="${this.image}"
            class="question-card__image"
            alt="Illustration for Question ${this.number}"
            loading="lazy"
          />
        </div>
      `
      : "";

    // Render caption if present
    /** @type {string} */
    const captionTemplate = this.caption
      ? html`
        <p class="question-card__caption">${this.caption}</p>
      `
      : "";

    /** @type {string} */
    let bodyTemplate = "";

    /** @type {boolean} */
    const hasOptions = Boolean(this.options && typeof this.options === "object" && Object.keys(this.options).length > 0);

    if (hasOptions && this.options) {
      /** @type {Array<[string, string]>} */
      const optionEntries = Object.entries(this.options);

      /** @type {boolean} */
      const isVisualOptions = this.optionsType === "image" || optionEntries.some(([, optionValue]) => {
        return typeof optionValue === "string" && (
          /\.(png|jpe?g|svg|webp)$/i.test(optionValue) ||
          optionValue.startsWith("data/") ||
          optionValue.startsWith("quizzes/")
        );
      });

      if (isVisualOptions) {
        /** @type {Array<string>} */
        const visualOptionButtons = optionEntries.map(([key, rawOptionLabel]) => {
          /** @type {boolean} */
          const isSelected = this.selectedAnswer === key;
          /** @type {string} */
          const buttonClass = isSelected
            ? "question-card__option-button question-card__option-button--visual question-card__option-button--selected"
            : "question-card__option-button question-card__option-button--visual";
          /** @type {string} */
          const radioIcon = isSelected ? "radio_button_checked" : "radio_button_unchecked";

          /** @type {string} */
          let optionImageUrl = rawOptionLabel;
          if (typeof optionImageUrl === "string" && optionImageUrl.startsWith("quizzes/")) {
            optionImageUrl = "data/" + optionImageUrl.slice("quizzes/".length);
          }

          return html`
            <button
              type="button"
              class="${buttonClass}"
              role="radio"
              aria-checked="${isSelected ? "true" : "false"}"
              onclick=${() => handleSelectOption(key)}
            >
              <div class="question-card__visual-header">
                <span class="question-card__option-key">${key}</span>
                <span class="google-symbols notranslate question-card__radio-icon">${radioIcon}</span>
              </div>
              <div class="question-card__visual-image-wrapper">
                <img
                  src="${optionImageUrl}"
                  class="question-card__option-image"
                  alt="Option ${key}"
                  loading="lazy"
                />
              </div>
            </button>
          `;
        });

        bodyTemplate = html`
          <div class="question-card__options-list question-card__options-list--visual" role="radiogroup" aria-label="Visual Choices for Question ${this.number}">
            ${visualOptionButtons}
          </div>
        `;
      } else {
        /** @type {Array<string>} */
        const textOptionButtons = optionEntries.map(([key, label]) => {
          /** @type {boolean} */
          const isSelected = this.selectedAnswer === key;
          /** @type {string} */
          const buttonClass = isSelected
            ? "question-card__option-button question-card__option-button--selected"
            : "question-card__option-button";
          /** @type {string} */
          const radioIcon = isSelected ? "radio_button_checked" : "radio_button_unchecked";

          return html`
            <button
              type="button"
              class="${buttonClass}"
              role="radio"
              aria-checked="${isSelected ? "true" : "false"}"
              onclick=${() => handleSelectOption(key)}
            >
              <span class="question-card__option-key">${key}</span>
              <span class="question-card__option-text">${label}</span>
              <span class="google-symbols notranslate question-card__radio-icon">${radioIcon}</span>
            </button>
          `;
        });

        bodyTemplate = html`
          <div class="question-card__options-list" role="radiogroup" aria-label="Choices for Question ${this.number}">
            ${textOptionButtons}
          </div>
        `;
      }
    } else {
      bodyTemplate = html`
        <div class="question-card__input-container">
          <input
            type="text"
            class="question-card__text-input"
            placeholder="Type your answer here..."
            value="${this.selectedAnswer}"
            aria-label="Answer for Question ${this.number}"
            oninput=${handleTextInput}
          />
        </div>
      `;
    }

    this.template = html`
      <article class="question-card" data-question-number="${this.number}" aria-labelledby="q-stem-${this.number}">
        ${contextTemplate}
        <div class="question-card__header">
          <span class="question-card__number-badge">${this.number}</span>
          <p id="q-stem-${this.number}" class="question-card__text">${this.questionText}</p>
        </div>
        ${imageTemplate}
        ${captionTemplate}
        ${bodyTemplate}
      </article>
    `;
  }
}
