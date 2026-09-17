import { Component, css, html, Redirect } from "../../../../Component.js";

css(import.meta, ["../styles/image-button.css"]);

/**
 * ImageButton Component
 * Literally a clickable image element (<img>), not a <button> containing an <img>.
 * Sized directly to match standard icon buttons with full accessibility and hover interactions.
 */
export class ImageButton extends Component {
  /**
   * @param {Object} configuration
   * @param {string} configuration.src - Image source URL.
   * @param {string} [configuration.alt=""] - Alt text for the image.
   * @param {string} [configuration.tooltip=""] - Tooltip text displayed on hover / native title.
   * @param {string} [configuration.ariaLabel=""] - Accessible label for screen readers.
   * @param {string} [configuration.size="2.75rem"] - Dimensions (width & height).
   * @param {string} [configuration.className=""] - Additional CSS classes.
   * @param {string} [configuration.navigationPath=""] - Navigation path target.
   * @param {function(MouseEvent|KeyboardEvent): void} [configuration.onClick] - Click handler.
   */
  constructor({
    src,
    alt = "",
    tooltip = "",
    ariaLabel = "",
    size = "2.75rem",
    className = "",
    navigationPath = "",
    onClick
  } = {}) {
    super();

    this.src = src;
    this.alt = alt;
    this.tooltip = tooltip;
    this.ariaLabel = ariaLabel || alt || tooltip;
    this.size = size;
    this.className = className;
    this.navigationPath = navigationPath;
    this.onClick = onClick;

    const combinedClasses = ["image-button", this.className].filter(Boolean).join(" ");
    const styleAttr = (this.size && this.size !== "2.75rem")
      ? `width: ${this.size}; height: ${this.size};`
      : "";

    const handleClick = (e) => {
      if (typeof this.onClick === "function") {
        this.onClick(e);
      } else if (this.navigationPath) {
        const routePath = this.navigationPath.includes("dashboard") ? "#/" : (this.navigationPath.includes("quizzes") ? "#/quizzes" : `#${this.navigationPath}`);
        window.location.hash = routePath;
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick(e);
      }
    };

    // Literally an <img> tag with role="button" and tabindex="0"
    this.template = html`
      <img
        src="${this.src}"
        alt="${this.alt}"
        title="${this.tooltip || this.alt || ''}"
        role="button"
        tabindex="0"
        class="${combinedClasses}"
        style="${styleAttr}"
        data-tooltip="${this.tooltip}"
        aria-label="${this.ariaLabel}"
        data-navigation-path="${this.navigationPath}"
        onclick=${handleClick}
        onkeydown=${handleKeyDown}
      />
    `;

    this.mounted = () => {
      const img = document.querySelector(`.image-button[data-navigation-path="${this.navigationPath}"]`);
      if (img) {
        img.onclick = handleClick;
        img.onkeydown = handleKeyDown;
      }
    };
  }
}
