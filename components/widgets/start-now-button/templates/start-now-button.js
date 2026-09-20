import { Component, css, html, Redirect } from "../../../../Component.js";

css(import.meta, ["../styles/start-now-button.css"]);

/**
 * Start Now Button Component
 * Replaces the badge-pills in the Dashboard hero banner with a prominent,
 * cohesive action control that navigates directly to the "/quizzes" catalog.
 * Follows the Bright Squircle composite card aesthetic with strictly no box shadows.
 */
export class StartNowButton extends Component {
  /**
   * @param {Object} [configuration]
   * @param {string} [configuration.label="Start Now"] - Button label text.
   * @param {function(): void} [configuration.onStart] - Navigation callback.
   */
  constructor({
    label = "Start Now",
    onStart
  } = {}) {
    super();

    this.label = label;
    this.onStart = onStart;

    const handleClick = (event) => {
      event?.preventDefault?.();
      if (typeof this.onStart === "function") {
        this.onStart();
      } else {
        window.location.hash = "#/quizzes";
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleClick(event);
      }
    };

    this.template = html`
      <div
        id="dashboardStartBtn"
        class="start-now-card"
        role="button"
        tabindex="0"
        aria-label="${this.label}"
        data-tooltip="Browse all available Queezes"
        onclick=${handleClick}
        onkeydown=${handleKeyDown}
      >
        <div class="bright-squircle start-now-card__button" aria-hidden="true">
          <span class="bright-squircle__icon-slot bright-squircle__icon-slot--play">
            <svg class="squircle-play-svg squircle-play-svg--main" viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
            </svg>
            <svg class="squircle-play-svg squircle-play-svg--incoming" viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
            </svg>
          </span>
        </div>
        <div class="start-now-card__text-widget">
          <span class="start-now-card__label">${this.label}</span>
          <span class="google-symbols notranslate start-now-card__arrow">arrow_forward</span>
        </div>
      </div>
    `;
  }
}