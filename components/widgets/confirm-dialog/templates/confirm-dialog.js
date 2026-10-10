import { Component, css, html, raw } from "../../../../Component.js";

css(import.meta, ["../styles/confirm-dialog.css"]);

/**
 * Material Design 3 / Google Gemini Confirmation Dialog Component.
 * Accessible modal alert dialog that returns a Promise resolving to boolean user intent.
 */
export class ConfirmDialog extends Component {
  /**
   * Initializes the ConfirmDialog instance.
   */
  constructor() {
    super();

    /** @type {boolean} */
    this.isOpenState = false;

    /** @type {string} */
    this.dialogTitle = "Confirmation";

    /** @type {string} */
    this.dialogDescription = "Are you sure you want to proceed?";

    /** @type {string} */
    this.confirmButtonLabel = "Confirm";

    /** @type {string} */
    this.cancelButtonLabel = "Cancel";

    /** @type {string} */
    this.iconName = "warning";

    /** @type {boolean} */
    this.isDestructiveAction = true;

    /** @type {((userConfirmed: boolean) => void)|null} */
    this.pendingPromiseResolver = null;

    /** @type {((keyboardEvent: KeyboardEvent) => void)|null} */
    this.escapeKeyEventListener = null;

    /**
     * Prompts the user with a confirmation modal and returns a Promise resolving to true or false.
     * @param {Object} [options={}]
     * @param {string} [options.title="Confirmation"] - Headline title text.
     * @param {string} [options.description="Are you sure you want to proceed?"] - Supporting description text.
     * @param {string} [options.confirmLabel="Confirm"] - Confirm button label.
     * @param {string} [options.cancelLabel="Cancel"] - Cancel button label.
     * @param {string} [options.icon="warning"] - Google Symbols icon name.
     * @param {boolean} [options.isDestructive=true] - Whether the confirm action is destructive (error color).
     * @returns {Promise<boolean>} Resolves true when confirmed, false when dismissed.
     */
    this.prompt = ({
      title = "Confirmation",
      description = "Are you sure you want to proceed?",
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      icon = "warning",
      isDestructive = true
    } = {}) => {
      if (this.pendingPromiseResolver) {
        this.pendingPromiseResolver(false);
        this.pendingPromiseResolver = null;
      }

      this.dialogTitle = title;
      this.dialogDescription = description;
      this.confirmButtonLabel = confirmLabel;
      this.cancelButtonLabel = cancelLabel;
      this.iconName = icon;
      this.isDestructiveAction = isDestructive;
      this.isOpenState = true;

      return new Promise((resolve) => {
        this.pendingPromiseResolver = resolve;
        this.renderDialog();
      });
    };

    /**
     * Closes the dialog and resolves the active Promise.
     * @param {boolean} userConfirmed - Whether the user confirmed or dismissed.
     * @returns {void}
     */
    this.close = (userConfirmed) => {
      this.isOpenState = false;
      this.renderDialog();

      if (typeof this.pendingPromiseResolver === "function") {
        const resolveFunction = this.pendingPromiseResolver;
        this.pendingPromiseResolver = null;
        resolveFunction(userConfirmed);
      }
    };

    /**
     * Checks if the dialog is currently visible.
     * @returns {boolean}
     */
    this.isOpen = () => {
      return this.isOpenState;
    };

    /**
     * Builds the dialog HTML markup.
     * @returns {string}
     */
    this.buildContent = () => {
      /** @type {string} */
      const scrimVisibilityClass = this.isOpenState ? "m3-confirm-scrim--visible" : "";
      /** @type {string} */
      const ariaHiddenAttribute = this.isOpenState ? "false" : "true";
      /** @type {string} */
      const iconBadgeClass = this.isDestructiveAction
        ? "m3-confirm-dialog__icon-badge"
        : "m3-confirm-dialog__icon-badge m3-confirm-dialog__icon-badge--info";
      /** @type {string} */
      const confirmButtonClass = this.isDestructiveAction
        ? "m3-confirm-dialog__button m3-confirm-dialog__button--confirm-destructive"
        : "m3-confirm-dialog__button m3-confirm-dialog__button--confirm-primary";

      return `
        <div
          id="m3ConfirmDialogScrim"
          class="m3-confirm-scrim ${scrimVisibilityClass}"
          role="alertdialog"
          aria-modal="true"
          aria-hidden="${ariaHiddenAttribute}"
          aria-labelledby="m3ConfirmDialogTitle"
          aria-describedby="m3ConfirmDialogDescription"
        >
          <div class="m3-confirm-dialog" id="m3ConfirmDialogCard">
            <div class="m3-confirm-dialog__header">
              <div class="${iconBadgeClass}">
                <span class="google-symbols notranslate">${this.iconName}</span>
              </div>
              <h2 id="m3ConfirmDialogTitle" class="m3-confirm-dialog__title">
                ${this.dialogTitle}
              </h2>
            </div>

            <p id="m3ConfirmDialogDescription" class="m3-confirm-dialog__description">
              ${this.dialogDescription}
            </p>

            <div class="m3-confirm-dialog__actions">
              <button
                type="button"
                id="m3ConfirmCancelButton"
                class="m3-confirm-dialog__button m3-confirm-dialog__button--cancel"
              >
                ${this.cancelButtonLabel}
              </button>
              <button
                type="button"
                id="m3ConfirmActionButton"
                class="${confirmButtonClass}"
              >
                ${this.confirmButtonLabel}
              </button>
            </div>
          </div>
        </div>
      `;
    };

    /**
     * Renders the dialog into its host element.
     * @returns {void}
     */
    this.renderDialog = () => {
      if (typeof document === "undefined" || typeof document.getElementById !== "function") {
        return;
      }
      /** @type {HTMLElement|null} */
      const hostElement = document.getElementById("confirmDialogHost");
      if (!hostElement) {
        return;
      }
      hostElement.innerHTML = this.buildContent();
      this.attachListeners();

      if (this.isOpenState) {
        /** @type {HTMLButtonElement|null} */
        const cancelButton = document.getElementById("m3ConfirmCancelButton");
        cancelButton?.focus();
      }
    };

    /**
     * Attaches interactive event listeners.
     * @returns {void}
     */
    this.attachListeners = () => {
      if (typeof document === "undefined" || typeof document.getElementById !== "function") {
        return;
      }

      if (this.escapeKeyEventListener) {
        document.removeEventListener("keydown", this.escapeKeyEventListener);
        this.escapeKeyEventListener = null;
      }

      if (!this.isOpenState) {
        return;
      }

      /** @type {HTMLElement|null} */
      const scrimElement = document.getElementById("m3ConfirmDialogScrim");
      if (scrimElement) {
        scrimElement.onclick = (event) => {
          if (event.target === scrimElement) {
            this.close(false);
          }
        };
      }

      /** @type {HTMLElement|null} */
      const cancelButton = document.getElementById("m3ConfirmCancelButton");
      if (cancelButton) {
        cancelButton.onclick = () => {
          this.close(false);
        };
      }

      /** @type {HTMLElement|null} */
      const confirmButton = document.getElementById("m3ConfirmActionButton");
      if (confirmButton) {
        confirmButton.onclick = () => {
          this.close(true);
        };
      }

      /** @param {KeyboardEvent} keyboardEvent */
      this.escapeKeyEventListener = (keyboardEvent) => {
        if (keyboardEvent.key === "Escape" && this.isOpenState) {
          this.close(false);
        }
      };
      document.addEventListener("keydown", this.escapeKeyEventListener);
    };

    this.template = html`
      <div id="confirmDialogHost">
        ${raw(this.buildContent())}
      </div>
    `;

    this.unmounted = () => {
      if (typeof document !== "undefined" && this.escapeKeyEventListener) {
        document.removeEventListener("keydown", this.escapeKeyEventListener);
        this.escapeKeyEventListener = null;
      }
      if (typeof this.pendingPromiseResolver === "function") {
        this.pendingPromiseResolver(false);
        this.pendingPromiseResolver = null;
      }
    };
  }
}
