import { Component, css, html } from "../../../../Component.js";
import { getImageViewer } from "../../image-viewer/templates/image-viewer.js";

css(import.meta, ["../styles/question-card.css"]);

/**
 * QuestionCard Component
 * Polymorphic question renderer supporting multiple-choice (text or visual images),
 * fill-in-the-blank text input, numbered diagram identification grids, image illustrations
 * with captions, and reference context triggers.
 * Security: NEVER renders the correct answer into HTML or DOM attributes.
 */
export class QuestionCard extends Component {
  /**
   * @param {Object} configuration
   * @param {Object} [configuration.questionData] - Sanitized question data.
   * @param {Object} [configuration.question] - Alias for questionData.
   * @param {any} [configuration.selectedAnswer=""] - Currently selected answer value.
   * @param {function(number, any): void} [configuration.onSelectAnswer] - Selection callback.
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
    /** @type {Array<Object>|null} */
    this.items = Array.isArray(questionPayload.items) ? questionPayload.items : null;
    /** @type {string|null} */
    this.answerImage = questionPayload.answer_image || null;
    /** @type {string|null} */
    this.rawImage = questionPayload.image || null;
    /** @type {string|null} */
    this.caption = questionPayload.caption || null;
    /** @type {Object|null} */
    this.context = questionPayload.context || null;
    /** @type {string|null} */
    this.optionsType = questionPayload.options_type || null;
    /** @type {string} */
    this.type = questionPayload.type || (this.items ? "multi_part_diagram" : (this.options ? "multiple_choice" : "identification"));
    /** @type {any} */
    this.selectedAnswer = selectedAnswer || (this.type === "multi_part_diagram" ? {} : (this.type === "reorder_cards" ? [] : ""));
    /** @type {function(number, any): void} */
    this.onSelectAnswer = onSelectAnswer;

    // Resolve asset path from quizzes/ prefix to data/ prefix if needed
    /** @type {string|null} */
    let resolvedImage = this.rawImage;
    if (resolvedImage && resolvedImage.startsWith("quizzes/")) {
      resolvedImage = "data/" + resolvedImage.slice("quizzes/".length);
    }
    /** @type {string|null} */
    this.image = resolvedImage;

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
            data-question-number="${String(this.number)}"
            aria-label="${`View Reference Context: ${contextTitle}`}"
          >
            <span class="google-symbols notranslate question-card__context-icon">menu_book</span>
            <span class="question-card__context-text">${contextTitle}</span>
            <span class="google-symbols notranslate question-card__context-arrow">open_in_new</span>
          </button>
        </div>
      `;
    }

    // Render illustration image if present with click-to-zoom
    /** @type {string} */
    const imageTemplate = this.image
      ? html`
        <div class="question-card__image-container">
          <img
            src="${this.image}"
            class="question-card__image"
            alt="${`Illustration for Question ${this.number}`}"
            loading="lazy"
            title="Click to view full screen"
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

    if (this.type === "reorder_cards" && this.items && Array.isArray(this.items) && this.items.length > 0) {
      /** @type {Array<Object>} */
      let orderedCards = [];
      if (Array.isArray(this.selectedAnswer) && this.selectedAnswer.length === this.items.length) {
        /** @type {Map<number, Object>} */
        const itemsById = new Map(this.items.map((subItem) => [subItem.id, subItem]));
        orderedCards = this.selectedAnswer
          .map((cardId) => itemsById.get(Number(cardId)))
          .filter(Boolean);
      }
      if (orderedCards.length !== this.items.length) {
        const itemsCopy = [...this.items];
        let seed = this.number * 997 + 13;
        for (let counter = itemsCopy.length - 1; counter > 0; counter--) {
          seed = (seed * 9301 + 49297) % 233280;
          const randomIndex = Math.floor((seed / 233280) * (counter + 1));
          const temporaryItem = itemsCopy[counter];
          itemsCopy[counter] = itemsCopy[randomIndex];
          itemsCopy[randomIndex] = temporaryItem;
        }
        orderedCards = itemsCopy;
      }

      /** @type {number} */
      const totalCardCount = orderedCards.length;
      /** @type {Array<string>} */
      const renderedCards = orderedCards.map((card, cardIndex) => {
        /** @type {boolean} */
        const isFirst = cardIndex === 0;
        /** @type {boolean} */
        const isLast = cardIndex === totalCardCount - 1;
        /** @type {string} */
        const cardTitle = card.text || card.answer || "";
        /** @type {string} */
        const slotNumber = String(cardIndex + 1);

        return html`
          <div
            class="question-card__reorder-card"
            draggable="true"
            data-reorder-card="true"
            data-card-id="${String(card.id)}"
            data-card-index="${String(cardIndex)}"
            aria-label="${`Position ${slotNumber}: ${cardTitle}`}"
          >
            <div class="question-card__reorder-drag-handle" aria-hidden="true" title="Drag to reorder">
              <span class="google-symbols notranslate">drag_indicator</span>
            </div>
            <div class="question-card__reorder-slot-badge">#${slotNumber}</div>
            <div class="question-card__reorder-card-text">${cardTitle}</div>
            <div class="question-card__reorder-card-actions">
              <button
                type="button"
                class="${isFirst ? "question-card__reorder-action-button question-card__reorder-action-button--disabled" : "question-card__reorder-action-button"}"
                data-action="move-up"
                data-card-index="${String(cardIndex)}"
                data-disabled="${isFirst ? "true" : "false"}"
                aria-label="${`Move ${cardTitle} up`}"
                title="Move up"
              >
                <span class="google-symbols notranslate">arrow_upward</span>
              </button>
              <button
                type="button"
                class="${isLast ? "question-card__reorder-action-button question-card__reorder-action-button--disabled" : "question-card__reorder-action-button"}"
                data-action="move-down"
                data-card-index="${String(cardIndex)}"
                data-disabled="${isLast ? "true" : "false"}"
                aria-label="${`Move ${cardTitle} down`}"
                title="Move down"
              >
                <span class="google-symbols notranslate">arrow_downward</span>
              </button>
            </div>
          </div>
        `;
      });

      bodyTemplate = html`
        <div
          class="question-card__reorder-container"
          role="list"
          aria-label="${`Reorderable Items for Question ${this.number}`}"
          data-question-number="${String(this.number)}"
        >
          <div class="question-card__reorder-instruction">
            <span class="google-symbols notranslate">swap_vert</span>
            <span>Drag items or use the arrows to arrange them in order matching circles 1 to ${String(totalCardCount)} in the diagram.</span>
          </div>
          <div class="question-card__reorder-list">
            ${renderedCards}
          </div>
        </div>
      `;
    } else if (hasOptions && this.options) {
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
              data-option-key="${key}"
            >
              <div class="question-card__visual-header">
                <span class="question-card__option-key">${key}</span>
                <span class="google-symbols notranslate question-card__radio-icon">${radioIcon}</span>
              </div>
              <div class="question-card__visual-image-wrapper">
                <img
                  src="${optionImageUrl}"
                  class="question-card__option-image"
                  alt="${`Option ${key}`}"
                  loading="lazy"
                />
              </div>
            </button>
          `;
        });

        bodyTemplate = html`
          <div class="question-card__options-list question-card__options-list--visual" role="radiogroup" aria-label="${`Visual Choices for Question ${this.number}`}">
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
              data-option-key="${key}"
            >
              <span class="question-card__option-key">${key}</span>
              <span class="question-card__option-text">${label}</span>
              <span class="google-symbols notranslate question-card__radio-icon">${radioIcon}</span>
            </button>
          `;
        });

        bodyTemplate = html`
          <div class="question-card__options-list" role="radiogroup" aria-label="${`Choices for Question ${this.number}`}">
            ${textOptionButtons}
          </div>
        `;
      }
    } else if (this.items && Array.isArray(this.items) && this.items.length > 0) {
      /** @type {Record<number, string>} */
      const userAnswersMap = (typeof this.selectedAnswer === "object" && this.selectedAnswer !== null)
        ? this.selectedAnswer
        : {};

      /** @type {Array<string>} */
      const diagramInputs = this.items.map((subItem) => {
        /** @type {string} */
        const itemVal = userAnswersMap[subItem.id] || "";
        /** @type {string} */
        const subItemIdentifier = String(subItem.label || subItem.id);
        return html`
          <div class="question-card__diagram-item">
            <span class="question-card__diagram-item-badge">${subItemIdentifier}</span>
            <input
              type="text"
              class="question-card__diagram-item-input"
              data-item-id="${String(subItem.id)}"
              placeholder="${`Enter name for #${subItemIdentifier}...`}"
              value="${itemVal}"
              aria-label="${`Answer for #${subItemIdentifier}`}"
            />
          </div>
        `;
      });

      bodyTemplate = html`
        <div class="question-card__diagram-inputs-grid" aria-label="Numbered Diagram Items">
          ${diagramInputs}
        </div>
      `;
    } else {
      /** @type {string} */
      const stringAnswer = typeof this.selectedAnswer === "string" ? this.selectedAnswer : "";
      bodyTemplate = html`
        <div class="question-card__input-container">
          <input
            type="text"
            class="question-card__text-input"
            placeholder="Type your answer here..."
            value="${stringAnswer}"
            aria-label="${`Answer for Question ${this.number}`}"
          />
        </div>
      `;
    }

    this.template = html`
      <article class="question-card" data-question-number="${String(this.number)}" aria-labelledby="${`q-stem-${this.number}`}">
        ${contextTemplate}
        <div class="question-card__header">
          <span class="question-card__number-badge">${this.number}</span>
          <p id="${`q-stem-${this.number}`}" class="question-card__text">${this.questionText}</p>
        </div>
        ${imageTemplate}
        ${captionTemplate}
        ${bodyTemplate}
      </article>
    `;
  }
}
