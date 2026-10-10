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
 * Creates the DOM element tree for the start exam modal dialog with side-by-side items and duration controls.
 * @param {Object} parameters
 * @param {string} parameters.title - Dialog title.
 * @param {string} parameters.subtitle - Dialog subtitle.
 * @param {number} parameters.minimumQuestionCount - Minimum allowed questions.
 * @param {number} parameters.maximumQuestionCount - Maximum available questions in pool.
 * @param {number} parameters.initialQuestionCount - Initially selected question count.
 * @returns {{ scrimElement: HTMLElement, wheelElement: HTMLElement, hoursInputElement: HTMLInputElement, minutesInputElement: HTMLInputElement, secondsInputElement: HTMLInputElement, linkCheckboxElement: HTMLInputElement, captionElement: HTMLElement, confirmButtonElement: HTMLButtonElement, cancelButtonElement: HTMLButtonElement, rowElements: Array<HTMLElement> }} References to key dialog elements.
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

  // Side-by-side row container for ITEMS and DURATION
  /** @type {HTMLDivElement} */
  const rowContainerElement = document.createElement("div");
  rowContainerElement.className = "start-exam-dialog__row";

  // Column 1: Items Selector
  /** @type {HTMLDivElement} */
  const itemsColumnElement = document.createElement("div");
  itemsColumnElement.className = "start-exam-dialog__col start-exam-dialog__col--items";

  /** @type {HTMLDivElement} */
  const itemLabelElement = document.createElement("div");
  itemLabelElement.className = "start-exam-dialog__section-label";
  itemLabelElement.textContent = "ITEMS";

  /** @type {HTMLDivElement} */
  const itemStepperWrapElement = document.createElement("div");
  itemStepperWrapElement.className = "item-stepper-wrap";

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

  /** @type {HTMLDivElement} */
  const stepperButtonsElement = document.createElement("div");
  stepperButtonsElement.className = "item-stepper-buttons";
  stepperButtonsElement.setAttribute("aria-label", "Items stepper");

  /** @type {HTMLButtonElement} */
  const stepperUpButtonElement = document.createElement("button");
  stepperUpButtonElement.type = "button";
  stepperUpButtonElement.className = "item-stepper-button item-stepper-button--up";
  stepperUpButtonElement.setAttribute("aria-label", "Previous item (scroll up)");
  stepperUpButtonElement.title = "Previous item (hold to scroll faster)";
  stepperUpButtonElement.innerHTML = `<span class="google-symbols notranslate" aria-hidden="true">keyboard_arrow_up</span>`;

  /** @type {HTMLButtonElement} */
  const stepperDownButtonElement = document.createElement("button");
  stepperDownButtonElement.type = "button";
  stepperDownButtonElement.className = "item-stepper-button item-stepper-button--down";
  stepperDownButtonElement.setAttribute("aria-label", "Next item (scroll down)");
  stepperDownButtonElement.title = "Next item (hold to scroll faster)";
  stepperDownButtonElement.innerHTML = `<span class="google-symbols notranslate" aria-hidden="true">keyboard_arrow_down</span>`;

  if (initialQuestionCount <= minimumQuestionCount) {
    stepperUpButtonElement.disabled = true;
  }
  if (initialQuestionCount >= maximumQuestionCount) {
    stepperDownButtonElement.disabled = true;
  }

  stepperButtonsElement.appendChild(stepperUpButtonElement);
  stepperButtonsElement.appendChild(stepperDownButtonElement);

  itemStepperWrapElement.appendChild(wheelElement);
  itemStepperWrapElement.appendChild(stepperButtonsElement);

  itemsColumnElement.appendChild(itemLabelElement);
  itemsColumnElement.appendChild(itemStepperWrapElement);

  // Column 2: Duration Controls
  /** @type {HTMLDivElement} */
  const durationColumnElement = document.createElement("div");
  durationColumnElement.className = "start-exam-dialog__col start-exam-dialog__col--duration";

  /** @type {HTMLDivElement} */
  const timeLabelElement = document.createElement("div");
  timeLabelElement.className = "start-exam-dialog__section-label";
  timeLabelElement.textContent = "DURATION";

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

  /** @type {HTMLDivElement} */
  const secondColonElement = document.createElement("div");
  secondColonElement.className = "time-picker-dialog__colon";
  secondColonElement.textContent = ":";

  /** @type {HTMLDivElement} */
  const secondsWrapElement = document.createElement("div");
  secondsWrapElement.className = "time-picker-dialog__input-wrap";

  /** @type {HTMLLabelElement} */
  const secondsLabelElement = document.createElement("label");
  secondsLabelElement.className = "time-picker-dialog__label";
  secondsLabelElement.setAttribute("for", "startExamSecondsInput");
  secondsLabelElement.textContent = "Seconds";

  /** @type {HTMLInputElement} */
  const secondsInputElement = document.createElement("input");
  secondsInputElement.type = "number";
  secondsInputElement.className = "time-picker-dialog__input-box";
  secondsInputElement.id = "startExamSecondsInput";
  secondsInputElement.min = "0";
  secondsInputElement.max = "59";
  secondsInputElement.value = "00";
  secondsInputElement.setAttribute("aria-label", "Seconds");

  secondsWrapElement.appendChild(secondsInputElement);
  secondsWrapElement.appendChild(secondsLabelElement);

  timeDisplayElement.appendChild(hoursWrapElement);
  timeDisplayElement.appendChild(colonElement);
  timeDisplayElement.appendChild(minutesWrapElement);
  timeDisplayElement.appendChild(secondColonElement);
  timeDisplayElement.appendChild(secondsWrapElement);

  durationColumnElement.appendChild(timeLabelElement);
  durationColumnElement.appendChild(timeDisplayElement);

  rowContainerElement.appendChild(itemsColumnElement);
  rowContainerElement.appendChild(durationColumnElement);

  // Caption describing duration
  /** @type {HTMLDivElement} */
  const captionElement = document.createElement("div");
  captionElement.className = "start-exam-dialog__caption";
  captionElement.textContent = "No time limit (untimed)";

  // Checkbox: "By number of items"
  /** @type {HTMLDivElement} */
  const checkboxWrapElement = document.createElement("div");
  checkboxWrapElement.className = "start-exam-dialog__checkbox-wrap";

  /** @type {HTMLInputElement} */
  const linkCheckboxElement = document.createElement("input");
  linkCheckboxElement.type = "checkbox";
  linkCheckboxElement.id = "startExamByItemCountCheckbox";
  linkCheckboxElement.className = "start-exam-dialog__checkbox";

  /** @type {HTMLLabelElement} */
  const checkboxLabelElement = document.createElement("label");
  checkboxLabelElement.htmlFor = "startExamByItemCountCheckbox";
  checkboxLabelElement.className = "start-exam-dialog__checkbox-label";
  checkboxLabelElement.textContent = "By number of items";

  checkboxWrapElement.appendChild(linkCheckboxElement);
  checkboxWrapElement.appendChild(checkboxLabelElement);

  // Dialog Action Buttons
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
  dialogElement.appendChild(rowContainerElement);
  dialogElement.appendChild(captionElement);
  dialogElement.appendChild(checkboxWrapElement);
  dialogElement.appendChild(actionsElement);
  scrimElement.appendChild(dialogElement);

  return {
    scrimElement,
    wheelElement,
    itemsColumnElement,
    itemStepperWrapElement,
    stepperUpButtonElement,
    stepperDownButtonElement,
    hoursInputElement,
    minutesInputElement,
    secondsInputElement,
    linkCheckboxElement,
    captionElement,
    confirmButtonElement,
    cancelButtonElement,
    rowElements
  };
};

/**
 * Updates caption text describing the current timer configuration.
 * @param {HTMLElement} captionElement - Target caption element.
 * @param {{ hours: number, minutes: number, seconds?: number, linked: boolean }} timeState - Active time state.
 * @param {number} questionCount - Current question count.
 * @returns {void}
 */
const updateCaption = (captionElement, timeState, questionCount) => {
  /** @type {number} */
  const currentSeconds = timeState.seconds ?? 0;
  if (timeState.hours === 0 && timeState.minutes === 0 && currentSeconds === 0) {
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
  if (currentSeconds > 0) {
    durationParts.push(
      `${currentSeconds} sec${currentSeconds > 1 ? "s" : ""}`
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
  defaultQuestionCount = 1,
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
  /** @type {{ hours: number, minutes: number, seconds: number, linked: boolean }} */
  let currentTimeState = createTimeState();

  const {
    scrimElement,
    wheelElement,
    itemsColumnElement,
    itemStepperWrapElement,
    stepperUpButtonElement,
    stepperDownButtonElement,
    hoursInputElement,
    minutesInputElement,
    secondsInputElement,
    linkCheckboxElement,
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
   * Updates visual row selection classes and stepper button states.
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
    if (stepperUpButtonElement) {
      stepperUpButtonElement.disabled = selectedCount <= safeMinimum;
    }
    if (stepperDownButtonElement) {
      stepperDownButtonElement.disabled = selectedCount >= safeMaximum;
    }
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
    secondsInputElement.value = String(currentTimeState.seconds ?? 0).padStart(
      2,
      "0"
    );
    linkCheckboxElement.checked = Boolean(currentTimeState.linked);
    updateCaption(captionElement, currentTimeState, currentQuestionCount);
  };

  // Initial scroll position setup (without smooth animation)
  requestAnimationFrame(() => {
    scrollWheelToCount(currentQuestionCount, false);
    updateRowVisuals(currentQuestionCount);
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

  // Handle mouse wheel scrolling across the entire items column and stepper container
  /**
   * Handles mouse wheel scrolling anywhere in the items column.
   * @param {WheelEvent} event
   * @returns {void}
   */
  const handleColumnMouseWheel = (event) => {
    event.preventDefault();
    /** @type {number} */
    const direction = event.deltaY > 0 ? 1 : -1;
    /** @type {number} */
    const nextCount = clampQuestionCount(
      currentQuestionCount + direction,
      safeMinimum,
      safeMaximum
    );
    if (nextCount !== currentQuestionCount) {
      scrollWheelToCount(nextCount, true);
    }
  };
  if (itemsColumnElement) {
    itemsColumnElement.addEventListener("wheel", handleColumnMouseWheel, { passive: false });
  }

  // Desktop pointer drag-to-scroll on the numbers wheel
  /** @type {boolean} */
  let isDraggingWheel = false;
  /** @type {number} */
  let dragStartY = 0;
  /** @type {number} */
  let dragStartScrollTop = 0;
  /** @type {boolean} */
  let hasDraggedDistance = false;

  /**
   * Starts pointer drag on wheel.
   * @param {PointerEvent} event
   * @returns {void}
   */
  const handleWheelPointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    isDraggingWheel = true;
    hasDraggedDistance = false;
    dragStartY = event.clientY;
    dragStartScrollTop = wheelElement.scrollTop;
    wheelElement.classList.add("item-wheel--dragging");
    if (typeof wheelElement.setPointerCapture === "function") {
      wheelElement.setPointerCapture(event.pointerId);
    }
  };

  /**
   * Updates scroll position during pointer drag.
   * @param {PointerEvent} event
   * @returns {void}
   */
  const handleWheelPointerMove = (event) => {
    if (!isDraggingWheel) {
      return;
    }
    const deltaY = event.clientY - dragStartY;
    if (Math.abs(deltaY) > 4) {
      hasDraggedDistance = true;
    }
    wheelElement.scrollTop = dragStartScrollTop - deltaY;
  };

  /**
   * Concludes pointer drag and snaps to nearest row.
   * @param {PointerEvent} event
   * @returns {void}
   */
  const handleWheelPointerUp = (event) => {
    if (!isDraggingWheel) {
      return;
    }
    isDraggingWheel = false;
    wheelElement.classList.remove("item-wheel--dragging");
    if (typeof wheelElement.releasePointerCapture === "function" && wheelElement.hasPointerCapture(event.pointerId)) {
      wheelElement.releasePointerCapture(event.pointerId);
    }
    if (hasDraggedDistance) {
      const nearestRowIndex = Math.round(wheelElement.scrollTop / WHEEL_ROW_HEIGHT_PIXELS);
      const targetCount = clampQuestionCount(safeMinimum + nearestRowIndex, safeMinimum, safeMaximum);
      scrollWheelToCount(targetCount, true);
    }
  };

  wheelElement.addEventListener("pointerdown", handleWheelPointerDown);
  wheelElement.addEventListener("pointermove", handleWheelPointerMove);
  wheelElement.addEventListener("pointerup", handleWheelPointerUp);
  wheelElement.addEventListener("pointercancel", handleWheelPointerUp);

  // Stepper Up/Down hold-to-accelerate controller
  /**
   * Sets up hold-to-accelerate stepper button behavior.
   * @param {HTMLButtonElement} buttonElement
   * @param {number} stepDirection - Direction to step (-1 for up, +1 for down).
   * @returns {void}
   */
  const setupStepperButton = (buttonElement, stepDirection) => {
    if (!buttonElement) {
      return;
    }
    /** @type {number|null} */
    let holdTimeoutId = null;
    /** @type {number|null} */
    let repeatTimeoutId = null;
    /** @type {number} */
    let repeatCount = 0;

    /**
     * Performs a single step in stepDirection.
     * @returns {void}
     */
    const performStep = () => {
      /** @type {number} */
      const nextCount = clampQuestionCount(
        currentQuestionCount + stepDirection,
        safeMinimum,
        safeMaximum
      );
      if (nextCount !== currentQuestionCount) {
        scrollWheelToCount(nextCount, repeatCount === 0);
      }
    };

    /**
     * Dynamically computes accelerating repeat interval.
     * @param {number} count
     * @returns {number} Interval in milliseconds.
     */
    const getRepeatInterval = (count) => {
      if (count > 20) return 15;
      if (count > 10) return 30;
      if (count > 4) return 60;
      return 110;
    };

    /**
     * Stops repeat timer and snaps cleanly.
     * @returns {void}
     */
    const stopHolding = () => {
      if (holdTimeoutId !== null) {
        clearTimeout(holdTimeoutId);
        holdTimeoutId = null;
      }
      if (repeatTimeoutId !== null) {
        clearTimeout(repeatTimeoutId);
        repeatTimeoutId = null;
      }
      if (repeatCount > 0) {
        scrollWheelToCount(currentQuestionCount, true);
      }
      repeatCount = 0;
    };

    /**
     * Schedules the next repeated step.
     * @returns {void}
     */
    const scheduleNextStep = () => {
      repeatCount += 1;
      performStep();
      repeatTimeoutId = setTimeout(scheduleNextStep, getRepeatInterval(repeatCount));
    };

    /**
     * Starts stepping and hold timer on pointerdown.
     * @param {PointerEvent} event
     * @returns {void}
     */
    const startHolding = (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      event.preventDefault();
      stopHolding();
      performStep();
      holdTimeoutId = setTimeout(scheduleNextStep, 260);
    };

    buttonElement.addEventListener("pointerdown", startHolding);
    buttonElement.addEventListener("pointerup", stopHolding);
    buttonElement.addEventListener("pointerleave", stopHolding);
    buttonElement.addEventListener("pointercancel", stopHolding);

    buttonElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        if (!event.repeat) {
          event.preventDefault();
          performStep();
        }
      }
    });
  };

  setupStepperButton(stepperUpButtonElement, -1);
  setupStepperButton(stepperDownButtonElement, 1);

  // Clicking a row centers it (ignored if dragged)
  rowElements.forEach((rowElement) => {
    rowElement.addEventListener("click", () => {
      if (hasDraggedDistance) {
        return;
      }
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

  // Checkbox change handler for "By number of items"
  linkCheckboxElement.addEventListener("change", () => {
    if (linkCheckboxElement.checked) {
      currentTimeState = applyByQuestionCount(
        currentTimeState,
        currentQuestionCount
      );
    } else {
      currentTimeState = {
        ...currentTimeState,
        linked: false
      };
    }
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
      minutesInputElement.value,
      secondsInputElement.value
    );
    syncTimeInputsFromState();
  };
  hoursInputElement.addEventListener("input", handleTimeInputEdited);
  minutesInputElement.addEventListener("input", handleTimeInputEdited);
  secondsInputElement.addEventListener("input", handleTimeInputEdited);

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
        document.activeElement !== linkCheckboxElement
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
