import { Component, css, html, signal } from "../../../../Component.js";
import { BannerImageOption } from "./banner-image__option.js";
import { getAbstractImageUrl, getCachedCardImageUrl, cacheCardImageUrl } from "../../section-blocks/cards/scripts/abstract-image-service.js";

css(import.meta, ["../styles/banner-image.css"]);

/**
 * @typedef {Object} BannerImageSpecification
 * @property {string} [imagePath] - Image URL.
 * @property {string} [image_path] - Alias for imagePath.
 * @property {boolean} [shrink=false] - Whether to shrink image to 90% width with surrounding space.
 * @property {string} [mockupTitle="Overview"] - Legacy title for dialog card preview.
 * @property {Array<string>} [mockupOptions=[]] - Legacy selectable options.
 * @property {Array<string>} [mockupActionButtons=[]] - Legacy action buttons.
 */

/**
 * Legacy class reference: .split-asset-image, BannerMockup
 * Represents the hero banner graphic visual container hosting images (with shrink support) or interactive previews.
 */
export class BannerImage extends Component {
  /**
   * @param {Object} [configuration]
   * @param {string} [configuration.imagePath] - Direct image source path.
   * @param {boolean} [configuration.shrink=false] - Whether to restrict image to 90% width.
   * @param {BannerImageSpecification} [configuration.bannerImage] - Banner image specification object.
   * @param {BannerImageSpecification} [configuration.mockupCard] - Legacy fallback specification object.
   */
  constructor({
    imagePath,
    shrink = false,
    bannerImage = {},
    mockupCard = {}
  } = {}) {
    super();

    /** @type {string} */
    const rawImagePath =
      imagePath ||
      bannerImage.image_path ||
      bannerImage.imagePath ||
      mockupCard.mockup_image_path ||
      mockupCard.imagePath ||
      "";

    const bannerLookupKey = `banner-${bannerImage.key || bannerImage.title || mockupCard.mockup_title || "hero"}`;

    // Clean any logo or empty path so it always uses CDN image covering the container
    const isLogoImage = typeof rawImagePath === "string" && (
      rawImagePath.includes("icon.png") ||
      rawImagePath.includes("card-image.png") ||
      rawImagePath.includes("logo")
    );
    const cleanImagePath = (!rawImagePath || isLogoImage) ? "" : rawImagePath;

    // Generate deterministic seed for banner graphic so resolution can upgrade seamlessly
    const bannerSeed = (bannerImage && bannerImage.seed) || Math.floor(Math.random() * 100000) + 1;
    this.bannerSeed = bannerSeed;

    // Progressive resolution endpoints: fast lightweight initial load (600x300), crystal clear high resolution (1920x960)
    const lowResCdnUrl = getAbstractImageUrl(bannerSeed, 600, 300);
    const highResCdnUrl = getAbstractImageUrl(bannerSeed, 1920, 960);

    this.lowResUrl = cleanImagePath || lowResCdnUrl;
    this.highResUrl = cleanImagePath || highResCdnUrl;

    /** @type {string} */
    this.imagePath = this.lowResUrl;

    /** @type {boolean} */
    // Remove shrinks on banner images so CDN image covers entire container
    this.shrink = false;

    /** @type {string} */
    this.mockupTitle =
      bannerImage.mockup_title ||
      bannerImage.mockupTitle ||
      mockupCard.mockup_title ||
      mockupCard.mockupTitle ||
      "Overview";

    /** @type {Array<string>} */
    this.mockupOptions =
      bannerImage.mockup_options ||
      bannerImage.mockupOptions ||
      mockupCard.mockup_options ||
      mockupCard.mockupOptions ||
      [];

    /** @type {Array<string>} */
    this.mockupActionButtons =
      bannerImage.mockup_action_buttons ||
      bannerImage.mockupActionButtons ||
      mockupCard.mockup_action_buttons ||
      mockupCard.mockupActionButtons ||
      [];

    /** @type {import("../../../../Component.js").Signal<number>} */
    this.selectedOptionSignal = signal(0);

    this.bannerImageElementId = `banner-img-${Math.random().toString(36).slice(2, 9)}`;
    this.containerElementId = `banner-container-${Math.random().toString(36).slice(2, 9)}`;

    // Check if there is an existing active banner image from the previous route
    const previousActiveUrl = (typeof window !== "undefined" && window.__queezActiveBannerUrl)
      ? window.__queezActiveBannerUrl
      : "";
    const hasTransitionPair = Boolean(previousActiveUrl && previousActiveUrl !== this.imagePath);
    this.oldImageElementId = hasTransitionPair
      ? `banner-img-old-${Math.random().toString(36).slice(2, 9)}`
      : "";

    /** @type {TemplateResult|string} */
    let previewContentTemplate;

    if (this.imagePath) {
      /** @type {string} */
      const imageClassName = this.shrink
        ? "banner-image__image banner-image__image--shrink"
        : "banner-image__image";

      if (hasTransitionPair) {
        previewContentTemplate = html`
          <img
            id="${this.oldImageElementId}"
            class="${imageClassName} banner-image__image--old"
            src="${previousActiveUrl}"
            alt="Previous Hero Banner Visual"
          />
          <img
            id="${this.bannerImageElementId}"
            class="${imageClassName} banner-image__image--incoming"
            src="${this.imagePath}"
            alt="Hero Banner Visual"
            data-banner-key="${bannerLookupKey}"
            onerror="this.onerror=null; if (window.getAbstractImageUrl) { this.src = window.getAbstractImageUrl(); }"
          />
        `;
      } else {
        previewContentTemplate = html`
          <img
            id="${this.bannerImageElementId}"
            class="${imageClassName} banner-image__image--active"
            src="${this.imagePath}"
            alt="Hero Banner Visual"
            data-banner-key="${bannerLookupKey}"
            onerror="this.onerror=null; if (window.getAbstractImageUrl) { this.src = window.getAbstractImageUrl(); }"
          />
        `;
      }
    } else {
      /** @type {Array<BannerImageOption>} */
      const optionComponents = this.mockupOptions.map((optionString, index) => {
        return new BannerImageOption({
          optionLabel: optionString,
          optionIndex: index,
          selectedOptionSignal: this.selectedOptionSignal
        });
      });

      /** @type {Array<TemplateResult>} */
      const actionButtonTemplates = this.mockupActionButtons.map((buttonLabel) => {
        return html`<span class="banner-image__action-button">${buttonLabel}</span>`;
      });

      previewContentTemplate = html`
        <div class="banner-image__dialog-card" role="dialog" aria-modal="false">
          <div class="banner-image__title">${this.mockupTitle}</div>
          <div class="banner-image__options-list" role="radiogroup">
            ${optionComponents}
          </div>
          <div class="banner-image__footer-actions">
            ${actionButtonTemplates}
          </div>
        </div>
      `;
    }

    this.template = html`
      <div id="${this.containerElementId}" class="banner-image" aria-label="Visual Preview">
        ${previewContentTemplate}
      </div>
    `;

    this.mounted = () => {
      /** @type {HTMLImageElement|null} */
      const newImageElement = document.getElementById(this.bannerImageElementId);
      /** @type {HTMLImageElement|null} */
      const oldImageElement = this.oldImageElementId
        ? document.getElementById(this.oldImageElementId)
        : null;

      if (!newImageElement) {
        return;
      }

      // Upgrade to high resolution image in background
      const upgradeToHighResolution = () => {
        if (!cleanImagePath && this.highResUrl && this.highResUrl !== this.lowResUrl) {
          const highResPreloader = new Image();
          highResPreloader.src = this.highResUrl;
          highResPreloader.onload = () => {
            if (newImageElement && newImageElement.src !== this.highResUrl) {
              newImageElement.src = this.highResUrl;
              this.imagePath = this.highResUrl;
              if (typeof window !== "undefined") {
                window.__queezActiveBannerUrl = this.highResUrl;
              }
            }
          };
        }
      };

      const onImageSettled = () => {
        if (typeof window !== "undefined") {
          window.__queezActiveBannerUrl = this.imagePath;
        }

        if (oldImageElement && newImageElement) {
          // Force layout reflow before triggering smooth transition
          void newImageElement.offsetWidth;
          newImageElement.classList.add("banner-image__image--active");
          newImageElement.classList.remove("banner-image__image--incoming");
          oldImageElement.classList.add("banner-image__image--blurring");

          // When old image cannot be seen anymore, remove it from DOM
          const cleanupOldImage = () => {
            if (oldImageElement.parentElement) {
              oldImageElement.remove();
            }
            upgradeToHighResolution();
          };

          newImageElement.addEventListener("transitionend", cleanupOldImage, { once: true });
          setTimeout(cleanupOldImage, 700);
        } else {
          newImageElement.classList.add("banner-image__image--active");
          newImageElement.classList.remove("banner-image__image--incoming");
          upgradeToHighResolution();
        }
      };

      const onImageError = () => {
        const fallbackUrl = getAbstractImageUrl(this.bannerSeed, 800, 400);
        if (newImageElement.src !== fallbackUrl) {
          newImageElement.classList.remove("banner-image__image--shrink");
          newImageElement.src = fallbackUrl;
          newImageElement.addEventListener("load", onImageSettled, { once: true });
        }
      };

      if (newImageElement.complete && newImageElement.naturalWidth > 0) {
        requestAnimationFrame(() => {
          requestAnimationFrame(onImageSettled);
        });
      } else if (newImageElement.complete && newImageElement.naturalWidth === 0) {
        onImageError();
      } else {
        newImageElement.addEventListener("load", onImageSettled, { once: true });
        newImageElement.addEventListener("error", onImageError, { once: true });
      }
    };
  }

  /**
   * Refreshes the banner to a brand new random CDN image with smooth blur-overlay transition and progressive resolution upgrade.
   * @returns {void}
   */
  refreshBannerImage() {
    const containerElement = document.getElementById(this.containerElementId);
    if (!containerElement) {
      return;
    }

    const currentImageElement = containerElement.querySelector(
      ".banner-image__image:not(.banner-image__image--blurring)"
    );
    const newSeed = Math.floor(Math.random() * 100000) + 1;
    this.bannerSeed = newSeed;

    const lowResUrl = getAbstractImageUrl(newSeed, 600, 300);
    const highResUrl = getAbstractImageUrl(newSeed, 1920, 960);
    this.lowResUrl = lowResUrl;
    this.highResUrl = highResUrl;
    this.imagePath = lowResUrl;

    const newImageElement = document.createElement("img");
    const newElementId = `banner-img-${Math.random().toString(36).slice(2, 9)}`;
    this.bannerImageElementId = newElementId;
    newImageElement.id = newElementId;
    newImageElement.className = "banner-image__image banner-image__image--incoming";
    newImageElement.src = lowResUrl;
    newImageElement.alt = "Hero Banner Visual";
    newImageElement.onerror = () => {
      newImageElement.onerror = null;
      newImageElement.src = getAbstractImageUrl(newSeed, 800, 400);
    };

    containerElement.appendChild(newImageElement);

    const upgradeToHighResolution = () => {
      const highResPreloader = new Image();
      highResPreloader.src = highResUrl;
      highResPreloader.onload = () => {
        if (newImageElement && newImageElement.src !== highResUrl) {
          newImageElement.src = highResUrl;
          this.imagePath = highResUrl;
          if (typeof window !== "undefined") {
            window.__queezActiveBannerUrl = highResUrl;
          }
        }
      };
    };

    const performTransition = () => {
      void newImageElement.offsetWidth;
      newImageElement.classList.add("banner-image__image--active");
      newImageElement.classList.remove("banner-image__image--incoming");

      if (currentImageElement) {
        currentImageElement.classList.add("banner-image__image--blurring");
        currentImageElement.classList.remove(
          "banner-image__image--active",
          "banner-image__image--old"
        );

        const cleanupOldImage = () => {
          if (currentImageElement.parentElement) {
            currentImageElement.remove();
          }
          upgradeToHighResolution();
        };

        newImageElement.addEventListener("transitionend", cleanupOldImage, { once: true });
        setTimeout(cleanupOldImage, 700);
      } else {
        upgradeToHighResolution();
      }

      if (typeof window !== "undefined") {
        window.__queezActiveBannerUrl = lowResUrl;
      }
    };

    if (newImageElement.complete && newImageElement.naturalWidth > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(performTransition);
      });
    } else {
      newImageElement.addEventListener("load", performTransition, { once: true });
    }
  }
}
