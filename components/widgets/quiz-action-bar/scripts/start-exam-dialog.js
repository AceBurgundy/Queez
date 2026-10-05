/**
 * @file start-exam-dialog.js
 * @description Accessible start-exam modal dialog featuring an item-count scroll wheel and linked timer.
 */

import {
  clampQuestionCount,
  resolveDefaultQuestionCount,
  createTimeState,
  applyByQuestionCount,
  onQuestionCountChanged,
  onTimeEdited,
  buildStartResult
} from "./start-exam-options.js";

/**
 * Height in pixels of a single row in the item count wheel.
 * @type {number}
 */
const WHEEL_ROW_HEIGHT_PIXELS = 44;

/**
 * SVG markup for the dialog header timer/play icon.
 * @type {string}
 */
const CLOCK_HEADER_ICON_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="10"></circle>
  <polyline points="12 6 12 12 16 14"></polyline>
</svg>
`;

/**
 * Creates the DOM element tree for the start exam modal dialog.
 * @param {Object} parameters
 * @param {string} parameters.title - Dialog title.
 * @param {string} parameters.subtitle - Dialog subtitle.
 * @param {number} parameters.minimumQuestionCount - Minimum allowed questions.
 * @param {number} parameters.maximumQuestionCount - Maximum available questions in pool.
 * @param {number} parameters.initialQuestionCount - Initially selected question count.
 * @returns {{ scrimElement: HTMLElement, wheelElement: HTMLElement, hoursInputElement: HTMLInputElement, minutesInputElement: HTMLInputElement, linkButtonElement: HTMLButtonElement, captionElement: HTMLElement, confirmButtonElement: HTMLButtonElement, cancelButtonElement: HTMLButtonElement, rowElements: Array<HTMLElement> }} References to key dialog elements.
 */
const createDialogDom = ({
  title,
  subtitle,
  minimumQuestionCount,
  maximumQuestionCount,
  initialQuestionCount
}) => {
  /** @type {HTMLDivElement} */
  const scrimElement = document.createElement("div");
  scrimElement.className = "time-picker-scrim start-exam-scrim";
  scrimElement.id = "queezStartExamModal";
  scrimElement.setAttribute("role", "dialog");
  scrimElement.setAttribute("aria-modal", "true");
  scrimElement.setAttribute("aria-labelledby", "startExamDialogTitle");

  /** @type {HTMLDivElement} */
  const dialogElement = document.createElement("div");
  dialogElement.className = "time-picker-dialog start-exam-dialog";

  /** @type {HTMLDivElement} */
  const headerElement = document.createElement("div");
  headerElement.className = "time-picker-dialog__header";

  /** @type {HTMLDivElement} */
  const iconElement = document.createElement("div");
  iconElement.className = "time-picker-dialog__icon";
  iconElement.innerHTML = CLOCK_HEADER_ICON_SVG;

  /** @type {HTMLDivElement} */
  const titleGroupElement = document.createElement("div");

  /** @type {HTMLHeadingElement} */
  const titleElement = document.createElement("h2");
  titleElement.className = "time-picker-dialog__title";
  titleElement.id = "startExamDialogTitle";
  titleElement.textContent = title;

  /** @type {HTMLParagraphElement} */
  const subtitleElement = document.createElement("p");
  subtitleElement.className = "time-picker-dialog__subtitle";
  subtitleElement.textContent = subtitle;

  titleGroupElement.appendChild(titleElement);
  titleGroupElement.appendChild(subtitleElement);
  headerElement.appendChild(iconElement);
  headerElement.appendChild(titleGroupElement);

  /** @type {HTMLDivElement} */
  const itemSectionElement = document.createElement("div");
  itemSectionElement.className = "start-exam-dialog__section";

  /** @type {HTMLDivElement} */
  const itemLabelElement = document.createElement("div");
  itemLabelElement.className = "start-exam-dialog__section-label";
  itemLabelElement.textContent = "Number of Items";

  /** @type {HTMLDivElement} */
  const wheelElement = document.createElement("div");
  wheelElement.className = "item-wheel";
  wheelElement.setAttribute("role", "spinbutton");
  wheelElement.setAttribute("tabindex", "0");
  wheelElement.setAttribute("aria-label", "Number of items");
  wheelElement.setAttribute("aria-valuemin", String(minimumQuestionCount));
  wheelElement.setAttribute("aria-valuemax", String(maximumQuestionCount));
  wheelElement.setAttribute("aria-valuenow", String(initialQuestionCount));

  /** @type {HTMLDivElement} */
  const highlightElement = document.createElement("div");
  highlightElement.className = "item-wheel__highlight";
  highlightElement.setAttribute("aria-hidden", "true");
  wheelElement.appendChild(highlightElement);

  /** @type {HTMLDivElement} */
  const topSpacer = document.createElement("div");
  topSpacer.className = "item-wheel__spacer";
  topSpacer.setAttribute("aria-hidden", "true");
  wheelElement.appendChild(topSpacer);

  /** @type {Array<HTMLElement>} */
  const rowElements = [];
  /** @type {DocumentFragment} */
  const fragment = document.createDocumentFragment();

  for (
    let count = minimumQuestionCount;
    count <= maximumQuestionCount;
    count += 1
  ) {
    /** @type {HTMLDivElement} */
    const rowElement = document.createElement("div");
    rowElement.className = "item-wheel__row";
    rowElement.textContent = String(count);
    rowElement.dataset.count = String(count);
    if (count === initialQuestionCount) {
      rowElement.classList.add("item-wheel__row--selected");
    }
    rowElements.push(rowElement);
    fragment.appendChild(rowElement);
  }
  wheelElement.appendChild(fragment);

  /** @type {HTMLDivElement} */
  const bottomSpacer = document.createElement("div");
  bottomSpacer.className = "item-wheel__spacer";
  bottomSpacer.setAttribute("aria-hidden", "true");
  wheelElement.appendChild(bottomSpacer);

  itemSectionElement.appendChild(itemLabelElement);
  itemSectionElement.appendChild(wheelElement);

  /** @type {HTMLDivElement} */
  const timeSectionElement = document.createElement("div");
  timeSectionElement.className = "start-exam-dialog__section";

  /** @type {HTMLDivElement} */
  const timeLabelElement = document.createElement("div");
  timeLabelElement.className = "start-exam-dialog__section-label";
  timeLabelElement.textContent = "Duration";

  /** @type {HTMLDivElement} */
  const timeDisplayElement = document.createElement("div");
  timeDisplayElement.className = "time-picker-dialog__time-display";

  /** @type {HTMLDivElement} */
  const hoursWrapElement = document.createElement("div");
  hoursWrapElement.className = "time-picker-dialog__input-wrap";

  /** @type {HTMLLabelElement} */
  const hoursLabelElement = document.createElement("label");
  hoursLabelElement.className = "time-picker-dialog__label";
  hoursLabelElement.setAttribute("for", "startExamHoursInput");
  hoursLabelElement.textContent = "Hours";

  /** @type {HTMLInputElement} */
  const hoursInputElement = document.createElement("input");
  hoursInputElement.type = "number";
  hoursInputElement.className = "time-picker-dialog__input-box";
  hoursInputElement.id = "startExamHoursInput";
  hoursInputElement.min = "0";
  hoursInputElement.max = "23";
  hoursInputElement.value = "00";
  hoursInputElement.setAttribute("aria-label", "Hours");

  hoursWrapElement.appendChild(hoursInputElement);
  hoursWrapElement.appendChild(hoursLabelElement);

  /** @type {HTMLDivElement} */
  const colonElement = document.createElement("div");
  colonElement.className = "time-picker-dialog__colon";
  colonElement.textContent = ":";

  /** @type {HTMLDivElement} */
  const minutesWrapElement = document.createElement("div");
  minutesWrapElement.className = "time-picker-dialog__input-wrap";

  /** @type {HTMLLabelElement} */
  const minutesLabelElement = document.createElement("label");
  minutesLabelElement.className = "time-picker-dialog__label";
  minutesLabelElement.setAttribute("for", "startExamMinutesInput");
  minutesLabelElement.textContent = "Minutes";

  /** @type {HTMLInputElement} */
  const minutesInputElement = document.createElement("input");
  minutesInputElement.type = "number";
  minutesInputElement.className = "time-picker-dialog__input-box";
  minutesInputElement.id = "startExamMinutesInput";
  minutesInputElement.min = "0";
  minutesInputElement.max = "59";
  minutesInputElement.value = "00";
  minutesInputElement.setAttribute("aria-label", "Minutes");

  minutesWrapElement.appendChild(minutesInputElement);
  minutesWrapElement.appendChild(minutesLabelElement);

  timeDisplayElement.appendChild(hoursWrapElement);
  timeDisplayElement.appendChild(colonElement);
  timeDisplayElement.appendChild(minutesWrapElement);

  /** @type {HTMLDivElement} */
  const captionElement = document.createElement("div");
  captionElement.className = "start-exam-dialog__caption";
  captionElement.textContent = "No time limit (untimed)";

  /** @type {HTMLDivElement} */
  const linkButtonWrapElement = document.createElement("div");
  linkButtonWrapElement.className = "start-exam-dialog__link-wrap";

  /** @type {HTMLButtonElement} */
  const linkButtonElement = document.createElement("button");
  linkButtonElement.type = "button";
  linkButtonElement.className = "start-exam-dialog__link-button";
  linkButtonElement.textContent = "By question count (1 min/item)";

  linkButtonWrapElement.appendChild(linkButtonElement);

  timeSectionElement.appendChild(timeLabelElement);
  timeSectionElement.appendChild(timeDisplayElement);
  timeSectionElement.appendChild(captionElement);
  timeSectionElement.appendChild(linkButtonWrapElement);

  /** @type {HTMLDivElement} */
  const actionsElement = document.createElement("div");
  actionsElement.className = "time-picker-dialog__actions";

  /** @type {HTMLButtonElement} */
  const cancelButtonElement = document.createElement("button");
  cancelButtonElement.type = "button";
  cancelButtonElement.className = "time-picker-dialog__button time-picker-dialog__button--cancel";
  cancelButtonElement.textContent = "Cancel";

  /** @type {HTMLButtonElement} */
  const confirmButtonElement = document.createElement("button");
  confirmButtonElement.type = "button";
  confirmButtonElement.className = "time-picker-dialog__button time-picker-dialog__button--confirm";
  confirmButtonElement.textContent = "Start";

  actionsElement.appendChild(cancelButtonElement);
  actionsElement.appendChild(confirmButtonElement);

  dialogElement.appendChild(headerElement);
  dialogElement.appendChild(itemSectionElement);
  dialogElement.appendChild(timeSectionElement);
  dialogElement.appendChild(actionsElement);
  scrimElement.appendChild(dialogElement);

  return {
    scrimElement,
    wheelElement,
    hoursInputElement,
    minutesInputElement,
    linkButtonElement,
    captionElement,
    confirmButtonElement,
    cancelButtonElement,
    rowElements
  };
};

/**
 * Updates caption text describing the current timer configuration.
 * @param {HTMLElement} captionElement - Target caption element.
 * @param {{ hours: number, minutes: number, linked: boolean }} timeState - Active time state.
 * @param {number} questionCount - Current question count.
 * @returns {void}
 */
const updateCaption = (captionElement, timeState, questionCount) => {
  if (timeState.hours === 0 && timeState.minutes === 0) {
    captionElement.textContent = "No time limit (untimed)";
    return;
  }
  /** @type {Array<string>} */
  const durationParts = [];
  if (timeState.hours > 0) {
    durationParts.push(`${timeState.hours} hr${timeState.hours > 1 ? "s" : ""}`);
  }
  if (timeState.minutes > 0) {
    durationParts.push(
      `${timeState.minutes} min${timeState.minutes > 1 ? "s" : ""}`
    );
  }
  /** @type {string} */
  const durationSummary = durationParts.join(" ");
  if (timeState.linked) {
    captionElement.textContent = `${durationSummary} (linked: 1 min per item)`;
  } else {
    captionElement.textContent = `${durationSummary} limit`;
  }
};

/**
 * Opens the start exam configuration modal dialog.
 * @param {Object} options
 * @param {string} [options.title="Start Mock Exam"] - Dialog title.
 * @param {string} [options.subtitle="Choose items and duration"] - Dialog subtitle.
 * @param {number} [options.minimumQuestionCount=1] - Minimum allowed items.
 * @param {number} [options.maximumQuestionCount=100] - Total pool size.
 * @param {number} [options.defaultQuestionCount=100] - Initial default items.
 * @param {function(Object): void} [options.onConfirm] - Callback on confirmation.
 * @param {function(): void} [options.onCancel] - Callback on cancellation.
 * @returns {void}
 */
export const openStartExamDialog = ({
  title = "Start Mock Exam",
  subtitle = "Choose items and duration",
  minimumQuestionCount = 1,
  maximumQuestionCount = 100,
  defaultQuestionCount = 100,
  onConfirm,
  onCancel
}) => {
  if (typeof document === "undefined") {
    return;
  }

  /** @type {HTMLElement|null} */
  const existingModal = document.getElementById("queezStartExamModal");
  if (existingModal && existingModal.parentNode) {
    existingModal.parentNode.removeChild(existingModal);
  }

  /** @type {HTMLElement|null} */
  const openerElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  /** @type {number} */
  const safeMinimum = Math.max(1, Math.floor(minimumQuestionCount) || 1);
  /** @type {number} */
  const safeMaximum = Math.max(
    safeMinimum,
    Math.floor(maximumQuestionCount) || safeMinimum
  );
  /** @type {number} */
  let currentQuestionCount = resolveDefaultQuestionCount(
    defaultQuestionCount,
    safeMaximum
  );
  /** @type {{ hours: number, minutes: number, linked: boolean }} */
  let currentTimeState = createTimeState();

  const {
    scrimElement,
    wheelElement,
    hoursInputElement,
    minutesInputElement,
    linkButtonElement,
    captionElement,
    confirmButtonElement,
    cancelButtonElement,
    rowElements
  } = createDialogDom({
    title,
    subtitle,
    minimumQuestionCount: safeMinimum,
    maximumQuestionCount: safeMaximum,
    initialQuestionCount: currentQuestionCount
  });

  document.body.appendChild(scrimElement);

  // Trigger enter transition
  requestAnimationFrame(() => {
    scrimElement.classList.add("time-picker-scrim--visible");
  });

  /**
   * Scrolls the item wheel to center the specified count.
   * @param {number} targetCount - Question count to center.
   * @param {boolean} [animate=true] - Whether to use smooth scrolling.
   * @returns {void}
   */
  const scrollWheelToCount = (targetCount, animate = true) => {
    /** @type {number} */
    const rowIndex = targetCount - safeMinimum;
    /** @type {number} */
    const targetScrollTop = rowIndex * WHEEL_ROW_HEIGHT_PIXELS;
    wheelElement.scrollTo({
      top: targetScrollTop,
      behavior: animate ? "smooth" : "auto"
    });
  };

  /**
   * Updates visual row selection classes in the item wheel.
   * @param {number} selectedCount - Currently selected question count.
   * @returns {void}
   */
  const updateRowVisuals = (selectedCount) => {
    wheelElement.setAttribute("aria-valuenow", String(selectedCount));
    rowElements.forEach((rowElement) => {
      /** @type {boolean} */
      const isSelected = rowElement.dataset.count === String(selectedCount);
      if (isSelected) {
        rowElement.classList.add("item-wheel__row--selected");
      } else {
        rowElement.classList.remove("item-wheel__row--selected");
      }
    });
  };

  /**
   * Synchronizes inputs and UI elements to match currentTimeState.
   * @returns {void}
   */
  const syncTimeInputsFromState = () => {
    hoursInputElement.value = String(currentTimeState.hours).padStart(2, "0");
    minutesInputElement.value = String(currentTimeState.minutes).padStart(
      2,
      "0"
    );
    if (currentTimeState.linked) {
      linkButtonElement.classList.add(
        "start-exam-dialog__link-button--active"
      );
    } else {
      linkButtonElement.classList.remove(
        "start-exam-dialog__link-button--active"
      );
    }
    updateCaption(captionElement, currentTimeState, currentQuestionCount);
  };

  // Initial scroll position setup (without smooth animation)
  requestAnimationFrame(() => {
    scrollWheelToCount(currentQuestionCount, false);
  });

  // Handle wheel scroll with requestAnimationFrame throttling
  /** @type {number|null} */
  let scrollAnimationFrameId = null;
  /**
   * Handles wheel scrolling event.
   * @returns {void}
   */
  const handleWheelScroll = () => {
    if (scrollAnimationFrameId !== null) {
      return;
    }
    scrollAnimationFrameId = requestAnimationFrame(() => {
      scrollAnimationFrameId = null;
      /** @type {number} */
      const rawRowIndex = Math.round(
        wheelElement.scrollTop / WHEEL_ROW_HEIGHT_PIXELS
      );
      /** @type {number} */
      const calculatedCount = clampQuestionCount(
        safeMinimum + rawRowIndex,
        safeMinimum,
        safeMaximum
      );

      if (calculatedCount !== currentQuestionCount) {
        currentQuestionCount = calculatedCount;
        updateRowVisuals(currentQuestionCount);

        if (currentTimeState.linked) {
          currentTimeState = onQuestionCountChanged(
            currentTimeState,
            currentQuestionCount
          );
          syncTimeInputsFromState();
        }
      }
    });
  };
  wheelElement.addEventListener("scroll", handleWheelScroll, { passive: true });

  // Clicking a row centers it
  rowElements.forEach((rowElement) => {
    rowElement.addEventListener("click", () => {
      /** @type {number} */
      const rowCount = clampQuestionCount(
        Number(rowElement.dataset.count),
        safeMinimum,
        safeMaximum
      );
      scrollWheelToCount(rowCount, true);
    });
  });

  // Wheel keyboard navigation
  wheelElement.addEventListener("keydown", (event) => {
    /** @type {number} */
    let nextCount = currentQuestionCount;
    if (event.key === "ArrowUp") {
      nextCount = clampQuestionCount(
        currentQuestionCount - 1,
        safeMinimum,
        safeMaximum
      );
      event.preventDefault();
    } else if (event.key === "ArrowDown") {
      nextCount = clampQuestionCount(
        currentQuestionCount + 1,
        safeMinimum,
        safeMaximum
      );
      event.preventDefault();
    } else if (event.key === "PageUp") {
      nextCount = clampQuestionCount(
        currentQuestionCount - 10,
        safeMinimum,
        safeMaximum
      );
      event.preventDefault();
    } else if (event.key === "PageDown") {
      nextCount = clampQuestionCount(
        currentQuestionCount + 10,
        safeMinimum,
        safeMaximum
      );
      event.preventDefault();
    } else if (event.key === "Home") {
      nextCount = safeMinimum;
      event.preventDefault();
    } else if (event.key === "End") {
      nextCount = safeMaximum;
      event.preventDefault();
    }

    if (nextCount !== currentQuestionCount) {
      scrollWheelToCount(nextCount, true);
    }
  });

  // "By question count" button handler
  linkButtonElement.addEventListener("click", () => {
    currentTimeState = applyByQuestionCount(
      currentTimeState,
      currentQuestionCount
    );
    syncTimeInputsFromState();
  });

  // Manual editing in time inputs unlinks
  /**
   * Handles user manual edits to time input boxes.
   * @returns {void}
   */
  const handleTimeInputEdited = () => {
    currentTimeState = onTimeEdited(
      currentTimeState,
      hoursInputElement.value,
      minutesInputElement.value
    );
    syncTimeInputsFromState();
  };
  hoursInputElement.addEventListener("input", handleTimeInputEdited);
  minutesInputElement.addEventListener("input", handleTimeInputEdited);

  /**
   * Closes the dialog with transition and restores opener focus.
   * @returns {void}
   */
  const closeDialog = () => {
    scrimElement.classList.remove("time-picker-scrim--visible");
    setTimeout(() => {
      if (scrimElement.parentNode) {
        scrimElement.parentNode.removeChild(scrimElement);
      }
      if (openerElement && typeof openerElement.focus === "function") {
        openerElement.focus();
      }
    }, 250);
  };

  // Actions
  confirmButtonElement.addEventListener("click", () => {
    /** @type {Object} */
    const startResult = buildStartResult(currentQuestionCount, currentTimeState);
    closeDialog();
    if (typeof onConfirm === "function") {
      onConfirm(startResult);
    }
  });

  cancelButtonElement.addEventListener("click", () => {
    closeDialog();
    if (typeof onCancel === "function") {
      onCancel();
    }
  });

  // Scrim click to dismiss
  scrimElement.addEventListener("click", (event) => {
    if (event.target === scrimElement) {
      closeDialog();
      if (typeof onCancel === "function") {
        onCancel();
      }
    }
  });

  // Global dialog keys (Enter confirms, Escape cancels)
  /**
   * Handles keydown inside modal dialog.
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  const handleDialogKeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      if (typeof onCancel === "function") {
        onCancel();
      }
    } else if (event.key === "Enter") {
      if (
        document.activeElement !== cancelButtonElement &&
        document.activeElement !== linkButtonElement
      ) {
        event.preventDefault();
        confirmButtonElement.click();
      }
    }
  };
  scrimElement.addEventListener("keydown", handleDialogKeydown);

  // Set focus on wheel
  wheelElement.focus();
};
