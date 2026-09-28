/* ============================================================
   IDERINAJA — AUTH OPENING
   SVG INTRO / BOOT SCREEN

   Responsibilities:
   - Control opening lifecycle
   - Enforce minimum display time
   - Support Skip
   - Respect reduced motion
   - Navigate to the existing account-type screen
   ============================================================ */

(() => {
  "use strict";

  const OPENING_CONFIG = Object.freeze({
    nextRoute: "account-type.html",
    minimumDisplayTime: 4200,
    reducedMotionDisplayTime: 900,
    exitDuration: 420,
  });

  const openingScreen = document.getElementById("openingScreen");
  const skipButton = document.getElementById("openingSkip");

  if (!openingScreen) {
    return;
  }

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const startedAt = performance.now();
  let navigationStarted = false;

  openingScreen.dataset.ready = "true";

  function navigateToNextScreen() {
    if (navigationStarted) {
      return;
    }

    navigationStarted = true;
    openingScreen.classList.add("is-exiting");

    window.setTimeout(() => {
      window.location.replace(OPENING_CONFIG.nextRoute);
    }, OPENING_CONFIG.exitDuration);
  }

  function continueAfterMinimumTime() {
    const minimumTime = prefersReducedMotion
      ? OPENING_CONFIG.reducedMotionDisplayTime
      : OPENING_CONFIG.minimumDisplayTime;

    const elapsed = performance.now() - startedAt;
    const remaining = Math.max(0, minimumTime - elapsed);

    window.setTimeout(navigateToNextScreen, remaining);
  }

  skipButton?.addEventListener("click", navigateToNextScreen);

  if (prefersReducedMotion) {
    continueAfterMinimumTime();
    return;
  }

  window.setTimeout(
    continueAfterMinimumTime,
    80
  );
})();
