import { Component, css, html } from "../../../../Component.js";

css(import.meta, ["../styles/question-card.css"]);

/**
 * QuestionCard Component
 * Polymorphic question renderer that supports multiple-choice and text input.
 * Security: NEVER renders the correct answer into HTML or DOM attributes.
 */
export class QuestionCard extends Component {
  /**
   * @param {Object} configuration
   * @param {Object} configuration.questionData - Sanitized question data ({ number, question, options, type }).
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

    const qData = question || questionData || {};
    this.number = qData.number || 1;
    this.questionText = qData.question || "";
    this.options = qData.options || null;
    this.rawImage = qData.image || null;
    this.type = qData.type || (this.options ? "multiple_choice" : "fill-in-the-blank");
    this.selectedAnswer = selectedAnswer || "";
    this.onSelectAnswer = onSelectAnswer;

    // Resolve asset path from quizzes/ prefix to data/ prefix if needed
    let resolvedImage = this.rawImage;
    if (resolvedImage && resolvedImage.startsWith("quizzes/")) {
      resolvedImage = "data/" + resolvedImage.slice("quizzes/".length);
    }
    this.image = resolvedImage;

    const handleSelectOption = (optionKey) => {
      if (typeof this.onSelectAnswer === "function") {
        this.onSelectAnswer(this.number, optionKey);
      }
    };

    const handleTextInput = (e) => {
      if (typeof this.onSelectAnswer === "function") {
        this.onSelectAnswer(this.number, e.target.value);
      }
    };

    // Render image if present
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

    let bodyTemplate;

    const hasOptions = this.options && typeof this.options === "object" && Object.keys(this.options).length > 0;

    if (hasOptions) {
      const optionEntries = Object.entries(this.options);
      const optionButtons = optionEntries.map(([key, label]) => {
        const isSelected = this.selectedAnswer === key;
        const buttonClass = isSelected
          ? "question-card__option-button question-card__option-button--selected"
          : "question-card__option-button";
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
          ${optionButtons}
        </div>
      `;
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
        <div class="question-card__header">
          <span class="question-card__number-badge">${this.number}</span>
          <p id="q-stem-${this.number}" class="question-card__text">${this.questionText}</p>
        </div>
        ${imageTemplate}
        ${bodyTemplate}
      </article>
    `;
  }
}
