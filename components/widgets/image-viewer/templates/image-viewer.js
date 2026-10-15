import { Component, css, html } from "../../../../Component.js";

css(import.meta, ["../styles/image-viewer.css"]);

/**
 * ImageViewer Component
 * Universal modal photo viewer with solid black backdrop, single-tap dismissal,
 * and double-tap / double-click zoom in and zoom out.
 */
export class ImageViewer extends Component {
  constructor() {
    super();

    /** @type {boolean} */
    this.isOpenState = false;
    /** @type {string} */
    this.currentImageSrc = "";
    /** @type {string} */
    this.currentAltText = "";
    /** @type {boolean} */
    this.isZoomedIn = false;
    /** @type {number} */
    this.lastTapTimestamp = 0;
    /** @type {number} */
    this.zoomOriginX = 50;
    /** @type {number} */
    this.zoomOriginY = 50;
    /** @type {((keyboardEvent: KeyboardEvent) => void)|null} */
    this.escapeKeyListener = null;

    /**
     * Opens the photo viewer with the given image source and caption/alt.
     * @param {string} imageSrc - URL or relative path of the image.
     * @param {string} [altText="Enlarged view"] - Accessible image label.
     * @returns {void}
     */
    this.open = (imageSrc, altText = "Enlarged view") => {
      if (!imageSrc) return;
      this.currentImageSrc = imageSrc;
      this.currentAltText = altText;
      this.isZoomedIn = false;
      this.zoomOriginX = 50;
      this.zoomOriginY = 50;
      this.isOpenState = true;
      this.renderOverlay();
      this.bindKeyboard();
    };

    /**
     * Closes the photo viewer and resets zoom.
     * @returns {void}
     */
    this.close = () => {
      this.isOpenState = false;
      this.isZoomedIn = false;
      this.renderOverlay();
      this.unbindKeyboard();
    };

    /**
     * Toggles zoom in / zoom out centered at tap coordinates.
     * @param {number} clientX
     * @param {number} clientY
     * @returns {void}
     */
    this.toggleZoom = (clientX, clientY) => {
      /** @type {HTMLImageElement|null} */
      const imageElement = document.getElementById("imageViewerModalImg");
      if (!imageElement) return;

      if (this.isZoomedIn) {
        this.isZoomedIn = false;
        imageElement.style.transform = "scale(1)";
        imageElement.style.transformOrigin = "center center";
        imageElement.classList.remove("image-viewer__img--zoomed");
      } else {
        this.isZoomedIn = true;
        const boundingBox = imageElement.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(boundingBox.width, clientX - boundingBox.left));
        const offsetY = Math.max(0, Math.min(boundingBox.height, clientY - boundingBox.top));
        this.zoomOriginX = (offsetX / boundingBox.width) * 100;
        this.zoomOriginY = (offsetY / boundingBox.height) * 100;
        imageElement.style.transformOrigin = `${this.zoomOriginX}% ${this.zoomOriginY}%`;
        imageElement.style.transform = "scale(2.5)";
        imageElement.classList.add("image-viewer__img--zoomed");
      }
    };

    /**
     * Handles single and double tap/click on the image.
     * Single tap closes the viewer; double tap toggles zoom in/out.
     * @param {MouseEvent|TouchEvent} event
     * @returns {void}
     */
    this.handleImageInteraction = (event) => {
      event.stopPropagation();
      const currentTimestamp = Date.now();
      const timeDifference = currentTimestamp - this.lastTapTimestamp;

      /** @type {number} */
      let clientX = 0;
      /** @type {number} */
      let clientY = 0;

      if ("clientX" in event) {
        clientX = event.clientX;
        clientY = event.clientY;
      } else if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      }

      if (timeDifference > 0 && timeDifference < 300) {
        // Double tap / double click detected
        this.lastTapTimestamp = 0;
        this.toggleZoom(clientX, clientY);
      } else {
        // First tap: register timestamp and close if single-tap confirmed
        this.lastTapTimestamp = currentTimestamp;
        setTimeout(() => {
          if (this.lastTapTimestamp === currentTimestamp && this.isOpenState) {
            this.close();
          }
        }, 320);
      }
    };

    /**
     * Binds Escape key to close modal.
     * @returns {void}
     */
    this.bindKeyboard = () => {
      this.unbindKeyboard();
      this.escapeKeyListener = (keyboardEvent) => {
        if (keyboardEvent.key === "Escape" && this.isOpenState) {
          keyboardEvent.preventDefault();
          this.close();
        }
      };
      window.addEventListener("keydown", this.escapeKeyListener);
    };

    /**
     * Unbinds keyboard listener.
     * @returns {void}
     */
    this.unbindKeyboard = () => {
      if (this.escapeKeyListener) {
        window.removeEventListener("keydown", this.escapeKeyListener);
        this.escapeKeyListener = null;
      }
    };

    /**
     * Renders or updates the overlay in the DOM.
     * @returns {void}
     */
    this.renderOverlay = () => {
      /** @type {HTMLElement|null} */
      let container = document.getElementById("imageViewerModalContainer");
      if (!container) {
        container = document.createElement("div");
        container.id = "imageViewerModalContainer";
        document.body.appendChild(container);
      }

      if (!this.isOpenState) {
        container.innerHTML = "";
        return;
      }

      container.innerHTML = `
        <div
          class="image-viewer-backdrop"
          id="imageViewerBackdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Image Photo Viewer"
        >
          <div class="image-viewer-toolbar">
            <span class="image-viewer-hint">Double tap to zoom • Tap once to close</span>
            <button
              type="button"
              class="image-viewer-close-button"
              id="imageViewerCloseButton"
              aria-label="Close photo viewer"
            >
              <span class="google-symbols notranslate">close</span>
            </button>
          </div>
          <div class="image-viewer-stage">
            <img
              src="${this.currentImageSrc}"
              id="imageViewerModalImg"
              class="image-viewer__img"
              alt="${this.currentAltText}"
            />
          </div>
        </div>
      `;

      /** @type {HTMLElement|null} */
      const backdropElement = container.querySelector("#imageViewerBackdrop");
      if (backdropElement) {
        backdropElement.onclick = () => this.close();
      }

      /** @type {HTMLElement|null} */
      const closeButtonElement = container.querySelector("#imageViewerCloseButton");
      if (closeButtonElement) {
        closeButtonElement.onclick = (clickEvent) => {
          clickEvent.stopPropagation();
          this.close();
        };
      }

      /** @type {HTMLImageElement|null} */
      const modalImageElement = container.querySelector("#imageViewerModalImg");
      if (modalImageElement) {
        modalImageElement.onclick = (clickEvent) => this.handleImageInteraction(clickEvent);
      }
    };

    this.template = html`<!-- Reusable ImageViewer Singleton -->`;
  }
}

/**
 * Global application singleton instance of ImageViewer.
 * @type {ImageViewer|null}
 */
let sharedImageViewerInstance = null;

/**
 * Returns or creates the global ImageViewer instance.
 * @returns {ImageViewer}
 */
export function getImageViewer() {
  if (!sharedImageViewerInstance) {
    sharedImageViewerInstance = new ImageViewer();
  }
  return sharedImageViewerInstance;
}
