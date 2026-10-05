/**
 * @file tabs__swipe-gesture.js
 * @description Tab carousel swipe, touch, and pointer drag gesture controller with 1:1 follow-finger translation and velocity snap.
 */

/**
 * Checks if the current viewport is in mobile mode or if carousel mode is active.
 * @returns {boolean} True if screen width is <= 768px, portrait orientation, or if carousel class/button is active.
 */
export function isMobileViewport() {
  if (typeof window === "undefined") {
    return false;
  }
  /** @type {boolean} */
  const isMobileLayout = Boolean(
    window.innerWidth <= 768 ||
    window.matchMedia("(orientation: portrait)").matches ||
    (window.matchMedia("(orientation: landscape)").matches && window.innerHeight <= 550)
  );

  if (isMobileLayout) {
    return true;
  }

  /** @type {HTMLElement|null} */
  const tabsContainerElement = document.querySelector(".tabs");
  if (tabsContainerElement && tabsContainerElement.classList.contains("tabs--carousel")) {
    return true;
  }

  /** @type {HTMLElement|null} */
  const carouselPreviousButton = document.querySelector(".tabs__carousel-button--previous");
  if (carouselPreviousButton && window.getComputedStyle(carouselPreviousButton).display !== "none") {
    return true;
  }
  return false;
}

/**
 * Attaches touch and pointer swipe gesture tracking to the mobile tab track container.
 * @param {Object} configuration
 * @param {HTMLElement} configuration.trackElement - Track container element housing tab items.
 * @param {function(): number} configuration.getActiveIndex - Getter returning current active tab index.
 * @param {function(number, ("previous"|"next"|"none")): void} configuration.onActivateIndex - Callback to switch active tab index.
 * @returns {function(): void} Cleanup function removing all attached event listeners.
 */
export function attachTabsSwipeGesture({ trackElement, getActiveIndex, onActivateIndex }) {
  if (!trackElement) {
    return () => {};
  }

  /** @type {number} */
  let touchStartX = 0;
  /** @type {number} */
  let touchStartY = 0;
  /** @type {number} */
  let touchStartTime = 0;
  /** @type {boolean} */
  let isDraggingGesture = false;
  /** @type {boolean} */
  let isTransitionAnimating = false;
  /** @type {boolean} */
  let preventNextClick = false;
  /** @type {number|null} */
  let dragResetTimer = null;
  /** @type {number|null} */
  let activePointerIdentifier = null;

  /** @type {HTMLElement|null} */
  let activeTabElement = null;
  /** @type {HTMLElement|null} */
  let nextTabElement = null;
  /** @type {HTMLElement|null} */
  let previousTabElement = null;
  /** @type {Array<HTMLElement>} */
  let allTabElements = [];
  /** @type {number} */
  let nextTabIndex = -1;
  /** @type {number} */
  let previousTabIndex = -1;

  /**
   * Resets temporary inline drag styling on all tab elements.
   * @param {number|null} [targetActiveIndex=null] - Tab index to activate upon cleanup.
   * @returns {void}
   */
  const cleanupDragStyles = (targetActiveIndex = null) => {
    /** @type {number} */
    const currentActiveIndex = targetActiveIndex !== null ? targetActiveIndex : getActiveIndex();

    if (allTabElements.length === 0) {
      allTabElements = Array.from(trackElement.querySelectorAll(".tabs__item"));
    }

    allTabElements.forEach((tabItemElement, elementIndex) => {
      tabItemElement.style.transition = "none";
      tabItemElement.style.position = "";
      tabItemElement.style.width = "";
      tabItemElement.style.height = "";
      tabItemElement.style.left = "";
      tabItemElement.style.top = "";
      tabItemElement.style.transform = "";
      tabItemElement.style.display = "";
      tabItemElement.style.zIndex = "";
      if (elementIndex === currentActiveIndex) {
        tabItemElement.classList.add("tabs__item--active");
        tabItemElement.setAttribute("aria-selected", "true");
      } else {
        tabItemElement.classList.remove("tabs__item--active");
        tabItemElement.setAttribute("aria-selected", "false");
      }
    });

    // Force layout flush while transition is none to prevent stylesheet transition reanimation
    void trackElement.offsetHeight;

    /** @type {Array<HTMLElement>} */
    const tabElementsToRestore = [...allTabElements];
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        tabElementsToRestore.forEach((tabItemElement) => {
          tabItemElement.style.transition = "";
        });
      });
    } else {
      tabElementsToRestore.forEach((tabItemElement) => {
        tabItemElement.style.transition = "";
      });
    }

    isDraggingGesture = false;
    activeTabElement = null;
    nextTabElement = null;
    previousTabElement = null;
    activePointerIdentifier = null;
  };

  /**
   * Initiates touch or pointer drag sequence.
   * @param {number} clientX - Current X coordinate.
   * @param {number} clientY - Current Y coordinate.
   * @param {number|null} [pointerIdentifier=null] - Pointer identifier.
   * @returns {boolean} True if drag sequence initiated.
   */
  const handleGestureStart = (clientX, clientY, pointerIdentifier = null) => {
    if (!isMobileViewport()) {
      return false;
    }
    if (isTransitionAnimating) {
      return false;
    }

    allTabElements = Array.from(trackElement.querySelectorAll(".tabs__item"));
    if (allTabElements.length <= 1) {
      return false;
    }

    /** @type {number} */
    const currentActiveIndex = getActiveIndex();
    touchStartX = clientX;
    touchStartY = clientY;
    touchStartTime = Date.now();
    isDraggingGesture = false;
    activePointerIdentifier = pointerIdentifier;

    activeTabElement = allTabElements[currentActiveIndex] || trackElement.querySelector(".tabs__item--active") || allTabElements[0];
    nextTabIndex = (currentActiveIndex + 1) % allTabElements.length;
    previousTabIndex = (currentActiveIndex - 1 + allTabElements.length) % allTabElements.length;
    nextTabElement = allTabElements[nextTabIndex];
    previousTabElement = allTabElements[previousTabIndex];
    return true;
  };

  /**
   * Performs 1:1 real-time translation following pointer movement.
   * @param {number} clientX - Current X coordinate.
   * @param {number} clientY - Current Y coordinate.
   * @returns {void}
   */
  const handleGestureMove = (clientX, clientY) => {
    if (!activeTabElement || isTransitionAnimating) {
      return;
    }

    /** @type {number} */
    const horizontalDelta = clientX - touchStartX;

    if (!isDraggingGesture) {
      if (Math.abs(horizontalDelta) > 4) {
        isDraggingGesture = true;
        preventNextClick = true;
      } else {
        return;
      }
    }

    activeTabElement.style.position = "absolute";
    activeTabElement.style.width = "100%";
    activeTabElement.style.height = "100%";
    activeTabElement.style.left = "0";
    activeTabElement.style.top = "0";
    activeTabElement.style.display = "inline-flex";
    activeTabElement.style.transition = "none";
    activeTabElement.style.transform = `translate3d(${horizontalDelta}px, 0, 0)`;
    activeTabElement.style.zIndex = "2";

    if (horizontalDelta < 0) {
      if (previousTabElement && previousTabElement !== nextTabElement) {
        previousTabElement.style.display = "none";
      }
      if (nextTabElement) {
        nextTabElement.style.position = "absolute";
        nextTabElement.style.width = "100%";
        nextTabElement.style.height = "100%";
        nextTabElement.style.left = "0";
        nextTabElement.style.top = "0";
        nextTabElement.style.display = "inline-flex";
        nextTabElement.style.transition = "none";
        nextTabElement.style.transform = `translate3d(calc(100% + ${horizontalDelta}px), 0, 0)`;
        nextTabElement.style.zIndex = "1";
      }
    } else if (horizontalDelta > 0) {
      if (nextTabElement && nextTabElement !== previousTabElement) {
        nextTabElement.style.display = "none";
      }
      if (previousTabElement) {
        previousTabElement.style.position = "absolute";
        previousTabElement.style.width = "100%";
        previousTabElement.style.height = "100%";
        previousTabElement.style.left = "0";
        previousTabElement.style.top = "0";
        previousTabElement.style.display = "inline-flex";
        previousTabElement.style.transition = "none";
        previousTabElement.style.transform = `translate3d(calc(-100% + ${horizontalDelta}px), 0, 0)`;
        previousTabElement.style.zIndex = "1";
      }
    } else {
      if (nextTabElement && nextTabElement !== activeTabElement) {
        nextTabElement.style.display = "none";
      }
      if (previousTabElement && previousTabElement !== activeTabElement) {
        previousTabElement.style.display = "none";
      }
    }
  };

  /**
   * Snaps to next or previous tab based on velocity and displacement threshold.
   * @param {number} clientX - Final X coordinate.
   * @returns {void}
   */
  const handleGestureEnd = (clientX) => {
    if (isTransitionAnimating) {
      return;
    }

    if (!activeTabElement) {
      cleanupDragStyles();
      return;
    }

    if (!isDraggingGesture) {
      cleanupDragStyles();
      return;
    }

    preventNextClick = true;
    if (typeof window !== "undefined") {
      /** @type {Object} */
      const windowObject = /** @type {*} */ (window);
      windowObject.__tabJustDragged = true;
      if (dragResetTimer !== null) {
        window.clearTimeout(dragResetTimer);
      }
      dragResetTimer = window.setTimeout(() => {
        windowObject.__tabJustDragged = false;
        preventNextClick = false;
        dragResetTimer = null;
      }, 500);
    }

    /** @type {number} */
    const horizontalDelta = clientX - touchStartX;
    /** @type {number} */
    const elapsedTime = Math.max(1, Date.now() - touchStartTime);
    /** @type {number} */
    const swipeVelocity = Math.abs(horizontalDelta) / elapsedTime;
    /** @type {number} */
    const trackWidth = trackElement.offsetWidth || 260;
    /** @type {number} */
    const displacementThreshold = trackWidth * 0.28;
    /** @type {boolean} */
    const isQuickSwipeGesture = swipeVelocity > 0.28 && Math.abs(horizontalDelta) > 15;

    /** @type {boolean} */
    const snapToNextTab = horizontalDelta < -displacementThreshold || (isQuickSwipeGesture && horizontalDelta < 0);
    /** @type {boolean} */
    const snapToPreviousTab = horizontalDelta > displacementThreshold || (isQuickSwipeGesture && horizontalDelta > 0);

    isTransitionAnimating = true;

    if (snapToNextTab && nextTabElement) {
      activeTabElement.style.transition = "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)";
      nextTabElement.style.transition = "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)";
      activeTabElement.style.transform = "translate3d(-100%, 0, 0)";
      nextTabElement.style.transform = "translate3d(0, 0, 0)";

      setTimeout(() => {
        cleanupDragStyles(nextTabIndex);
        isTransitionAnimating = false;
        if (typeof onActivateIndex === "function") {
          onActivateIndex(nextTabIndex, "none");
        }
      }, 220);
    } else if (snapToPreviousTab && previousTabElement) {
      activeTabElement.style.transition = "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)";
      previousTabElement.style.transition = "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)";
      activeTabElement.style.transform = "translate3d(100%, 0, 0)";
      previousTabElement.style.transform = "translate3d(0, 0, 0)";

      setTimeout(() => {
        cleanupDragStyles(previousTabIndex);
        isTransitionAnimating = false;
        if (typeof onActivateIndex === "function") {
          onActivateIndex(previousTabIndex, "none");
        }
      }, 220);
    } else {
      activeTabElement.style.transition = "transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1)";
      activeTabElement.style.transform = "translate3d(0, 0, 0)";

      if (horizontalDelta < 0 && nextTabElement) {
        nextTabElement.style.transition = "transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1)";
        nextTabElement.style.transform = "translate3d(100%, 0, 0)";
      } else if (horizontalDelta > 0 && previousTabElement) {
        previousTabElement.style.transition = "transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1)";
        previousTabElement.style.transform = "translate3d(-100%, 0, 0)";
      }

      setTimeout(() => {
        cleanupDragStyles();
        isTransitionAnimating = false;
      }, 200);
    }
  };

  /**
   * @param {PointerEvent} pointerEvent
   * @returns {void}
   */
  const onPointerDown = (pointerEvent) => {
    if (pointerEvent.pointerType === "mouse" && pointerEvent.button !== 0) {
      return;
    }
    /** @type {boolean} */
    const started = handleGestureStart(pointerEvent.clientX, pointerEvent.clientY, pointerEvent.pointerId);
    if (started && typeof trackElement.setPointerCapture === "function") {
      try {
        trackElement.setPointerCapture(pointerEvent.pointerId);
      } catch {
        // Ignored
      }
    }
  };

  /**
   * @param {PointerEvent} pointerEvent
   * @returns {void}
   */
  const onPointerMove = (pointerEvent) => {
    if (activePointerIdentifier !== null && pointerEvent.pointerId !== activePointerIdentifier) {
      return;
    }
    handleGestureMove(pointerEvent.clientX, pointerEvent.clientY);
  };

  /**
   * @param {PointerEvent} pointerEvent
   * @returns {void}
   */
  const onPointerUp = (pointerEvent) => {
    if (activePointerIdentifier !== null && pointerEvent.pointerId !== activePointerIdentifier) {
      return;
    }
    if (typeof trackElement.releasePointerCapture === "function") {
      try {
        trackElement.releasePointerCapture(pointerEvent.pointerId);
      } catch {
        // Ignored
      }
    }
    handleGestureEnd(pointerEvent.clientX);
  };

  /**
   * @param {PointerEvent} pointerEvent
   * @returns {void}
   */
  const onPointerCancel = (pointerEvent) => {
    if (activePointerIdentifier !== null && pointerEvent.pointerId !== activePointerIdentifier) {
      return;
    }
    cleanupDragStyles();
    isTransitionAnimating = false;
  };

  /**
   * @param {TouchEvent} touchEvent
   * @returns {void}
   */
  const onTouchStart = (touchEvent) => {
    if (activePointerIdentifier !== null) {
      return;
    }
    if (!touchEvent.touches || touchEvent.touches.length !== 1) {
      return;
    }
    handleGestureStart(touchEvent.touches[0].clientX, touchEvent.touches[0].clientY);
  };

  /**
   * @param {TouchEvent} touchEvent
   * @returns {void}
   */
  const onTouchMove = (touchEvent) => {
    if (activePointerIdentifier !== null) {
      return;
    }
    if (!touchEvent.touches || touchEvent.touches.length !== 1) {
      return;
    }
    if (isDraggingGesture && touchEvent.cancelable) {
      touchEvent.preventDefault();
    }
    handleGestureMove(touchEvent.touches[0].clientX, touchEvent.touches[0].clientY);
  };

  /**
   * @param {TouchEvent} touchEvent
   * @returns {void}
   */
  const onTouchEnd = (touchEvent) => {
    if (activePointerIdentifier !== null) {
      return;
    }
    /** @type {Touch|null} */
    const touch = (touchEvent.changedTouches && touchEvent.changedTouches[0]) || null;
    handleGestureEnd(touch ? touch.clientX : touchStartX);
  };

  /**
   * @returns {void}
   */
  const onTouchCancel = () => {
    if (activePointerIdentifier !== null) {
      return;
    }
    cleanupDragStyles();
    isTransitionAnimating = false;
  };

  /**
   * Captures and cancels any synthetic clicks emitted immediately after a swipe drag gesture.
   * @param {MouseEvent} clickEvent - Intercepted click event.
   * @returns {void}
   */
  const onClickCapture = (clickEvent) => {
    if (preventNextClick) {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      clickEvent.stopImmediatePropagation();
    }
  };

  /** @type {boolean} */
  const supportsPointerEvents = typeof window !== "undefined" && Boolean(window.PointerEvent);

  trackElement.addEventListener("click", onClickCapture, true);

  if (supportsPointerEvents) {
    trackElement.addEventListener("pointerdown", onPointerDown);
    trackElement.addEventListener("pointermove", onPointerMove);
    trackElement.addEventListener("pointerup", onPointerUp);
    trackElement.addEventListener("pointercancel", onPointerCancel);
  } else {
    trackElement.addEventListener("touchstart", onTouchStart, { passive: true });
    trackElement.addEventListener("touchmove", onTouchMove, { passive: false });
    trackElement.addEventListener("touchend", onTouchEnd, { passive: true });
    trackElement.addEventListener("touchcancel", onTouchCancel, { passive: true });
  }

  return () => {
    trackElement.removeEventListener("click", onClickCapture, true);
    if (dragResetTimer !== null) {
      window.clearTimeout(dragResetTimer);
      dragResetTimer = null;
    }

    if (supportsPointerEvents) {
      trackElement.removeEventListener("pointerdown", onPointerDown);
      trackElement.removeEventListener("pointermove", onPointerMove);
      trackElement.removeEventListener("pointerup", onPointerUp);
      trackElement.removeEventListener("pointercancel", onPointerCancel);
    } else {
      trackElement.removeEventListener("touchstart", onTouchStart);
      trackElement.removeEventListener("touchmove", onTouchMove);
      trackElement.removeEventListener("touchend", onTouchEnd);
      trackElement.removeEventListener("touchcancel", onTouchCancel);
    }
  };
}
