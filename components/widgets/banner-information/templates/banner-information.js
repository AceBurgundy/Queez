import { Component, html, css } from "../../../../Component.js";
import { BadgeList } from "../../badge-list/templates/badge-list.js";

css(import.meta, ["../styles/banner-information.css"]);

/**
 * Legacy class reference: .split-asset .primary-container
 * Represents the primary hero banner information container including title, description, and badges.
 */
export class BannerInformation extends Component {
  /**
   * @param {Object} configuration
   * @param {string} configuration.title - Main headline title text.
   * @param {string} configuration.description - Narrative description text.
   * @param {Array<Object>|Map<string, string>} [configuration.badges=[]] - List or Map of badge specifications.
   * @param {boolean} [configuration.isCompact=false] - Whether to render a compact title.
   * @param {boolean} [configuration.isDashboard=false] - Whether rendered in the main dashboard context.
   * @param {Component|null} [configuration.actionComponent=null] - Action component rendered where badge pills are located.
   */
  constructor({
    title,
    description,
    badges = [],
    isCompact = false,
    isDashboard = false,
    actionComponent = null
  }) {
    super();

    /** @type {string} */
    this.title = title;

    /** @type {string} */
    this.description = description;

    /** @type {Array<Object>|Map<string, string>} */
    this.badges = badges;

    /** @type {boolean} */
    this.isCompact = isCompact;

    /** @type {boolean} */
    this.isDashboard = isDashboard;

    /** @type {Component|null} */
    this.actionComponent = actionComponent;

    /** @type {BadgeList} */
    const badgeListComponent = new BadgeList({
      badges: this.badges
    });

    /** @type {Array<string>} */
    const titleClasses = ["banner-information__title"];
    if (this.isDashboard) {
      titleClasses.push("banner-information__title--dashboard");
    } else if (this.isCompact) {
      titleClasses.push("banner-information__title--compact");
    }
    const titleClassName = titleClasses.join(" ");

    const badgesContent = this.actionComponent
      ? this.actionComponent
      : badgeListComponent;

    this.template = html`
      <div class="banner-information" aria-label="Hero Overview">
        <div class="banner-information__wrapper">
          <div class="banner-information__title-group">
            <h1 tabindex="-1" class="${titleClassName}">
              ${this.title}
            </h1>
            <div class="banner-information__description">
              ${this.description}
            </div>
          </div>
          <div id="bannerBadgesContainer" class="banner-information__badges-container">
            ${badgesContent}
          </div>
        </div>
      </div>
    `;

    this.mounted = () => {
      if (this.actionComponent && typeof this.actionComponent.__mount === "function") {
        this.actionComponent.__mount();
      }
    };
  }
}
