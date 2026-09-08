document.addEventListener("DOMContentLoaded", async () => {
  const voucherDefinitions = Array.isArray(window.VOUCHER_CONFIG)
    ? window.VOUCHER_CONFIG
    : [];
  const noticeEl = document.getElementById("floatingNotice");
  const titleEl = document.getElementById("floatingNoticeTitle");
  const messageEl = document.getElementById("floatingNoticeMessage");
  const buttonEl = document.getElementById("floatingNoticeButton");
  const imageEl = document.getElementById("floatingNoticeImage");
  const closeBtn = document.getElementById("floatingNoticeClose");
  const voucherGuideTitleEl = document.getElementById("voucherGuideTitle");
  const voucherGuideTextEl = document.getElementById("voucherGuideText");
  const voucherGuideImageEl = document.getElementById("voucherGuideImage");
  const voucherOptionsEl = document.getElementById("voucherOptions");
  const mainPageEl = document.querySelector("main");

  if (!noticeEl || !titleEl || !messageEl || !buttonEl || !closeBtn) return;

  let autoCloseTimer;
  let noticeIsOpen = false;
  let previouslyFocusedEl = null;
  const originalMainAriaHidden = mainPageEl?.getAttribute("aria-hidden");

  function renderVoucherBadge(element, text) {
    if (!element) return;

    if (typeof window.renderVoucherBadge === "function") {
      window.renderVoucherBadge(element, text);
      return;
    }

    const badgeText = String(text || "").trim();
    element.textContent = badgeText;
    element.classList.toggle("hidden", !badgeText);
  }

  function updateVoucherGuide(config) {
    const voucherOptions = voucherDefinitions.map((voucher) => {
      const option = document.getElementById(`voucherOption${voucher.slot}`);
      const name = document.getElementById(`voucherName${voucher.slot}`);
      const badge = document.getElementById(`voucherBadge${voucher.slot}`);
      const buyButton = document.getElementById(`buyNowBtn${voucher.slot}`);
      const configuredName = String(config[voucher.nameKey] || "").trim();
      const displayName = configuredName || voucher.defaultName;
      const visible = config[voucher.visibilityKey] !== false;

      if (name) {
        name.textContent = displayName;
      }

      buyButton?.setAttribute("aria-label", `Mua ngay với ${displayName}`);

      option?.classList.toggle("hidden", !visible);
      renderVoucherBadge(badge, config[voucher.badgeKey]);

      return { element: option, visible };
    });

    if (voucherOptionsEl) {
      const hasVisibleOption = voucherOptions.some(
        ({ element, visible }) => Boolean(element) && visible
      );
      voucherOptionsEl.classList.toggle("hidden", !hasVisibleOption);
    }

    if (voucherGuideTitleEl) {
      voucherGuideTitleEl.textContent = config.guideTitle || "";
      voucherGuideTitleEl.classList.toggle("hidden", !config.guideTitle);
    }

    if (voucherGuideTextEl) {
      voucherGuideTextEl.textContent = config.guideText || "";
      voucherGuideTextEl.classList.toggle("hidden", !config.guideText);
    }

    if (voucherGuideImageEl) {
      if (config.guideImageUrl) {
        voucherGuideImageEl.src = config.guideImageUrl;
        voucherGuideImageEl.classList.remove("hidden");
      } else {
        voucherGuideImageEl.removeAttribute("src");
        voucherGuideImageEl.classList.add("hidden");
      }
    }
  }

  function lockPageScroll() {
    document.documentElement.classList.add("notice-open");
    document.body.classList.add("notice-open");
  }

  function unlockPageScroll() {
    document.documentElement.classList.remove("notice-open");
    document.body.classList.remove("notice-open");
  }

  function setBackgroundUnavailable(unavailable) {
    if (!mainPageEl) return;

    if ("inert" in mainPageEl) {
      mainPageEl.inert = unavailable;
    }

    if (unavailable) {
      mainPageEl.setAttribute("aria-hidden", "true");
    } else if (originalMainAriaHidden === null) {
      mainPageEl.removeAttribute("aria-hidden");
    } else {
      mainPageEl.setAttribute("aria-hidden", originalMainAriaHidden);
    }
  }

  function getFocusableElements() {
    return [...noticeEl.querySelectorAll(
      'a[href]:not([tabindex="-1"]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((element) => !element.classList.contains("hidden"));
  }

  function handleModalKeyboard(event) {
    if (!noticeIsOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeNotice(activeConfig, activeStorageKey);
      return;
    }

    if (event.key !== "Tab") return;

    const focusableElements = getFocusableElements();
    if (!focusableElements.length) {
      event.preventDefault();
      noticeEl.querySelector(".floating-notice-card")?.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElementIndex = focusableElements.indexOf(document.activeElement);

    if (activeElementIndex === -1) {
      event.preventDefault();
      (event.shiftKey ? lastElement : firstElement).focus();
    } else if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    } else if (!noticeEl.contains(document.activeElement)) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  let activeConfig = null;
  let activeStorageKey = "";

  function closeNotice(config, storageKey) {
    if (!noticeIsOpen) return;
    noticeIsOpen = false;
    noticeEl.classList.remove("show");

    if (config?.showOncePerSession && storageKey) {
      sessionStorage.setItem(storageKey, "1");
    }

    clearTimeout(autoCloseTimer);
    unlockPageScroll();
    setBackgroundUnavailable(false);

    setTimeout(() => {
      noticeEl.classList.add("hidden");
      if (previouslyFocusedEl?.isConnected) {
        previouslyFocusedEl.focus({ preventScroll: true });
      }
    }, 250);
  }

  document.addEventListener("keydown", handleModalKeyboard);

  try {
    const pagePath = window.location.pathname.replace(/\/+$/, "");
    const isVoucherPage = pagePath === "" || pagePath === "/voucher";

    const noticeApiUrl = isVoucherPage
      ? "/api/voucher/notice"
      : "/api/notice";

    const response = await fetch(`${noticeApiUrl}?v=${Date.now()}`, {
      cache: "no-store"
    });

    if (!response.ok) return;

    const config = await response.json();

    if (isVoucherPage) {
      updateVoucherGuide(config);
    }

    if (!config.enabled) return;

    const noticeVersion = config.version || "default";
    const storageKey = `floating_notice_closed_${noticeVersion}`;
    activeConfig = config;
    activeStorageKey = storageKey;

    if (config.showOncePerSession && sessionStorage.getItem(storageKey)) {
      return;
    }

    titleEl.textContent = config.title || "Thông báo";
    messageEl.textContent = config.message || "";

    if (imageEl) {
      if (config.imageUrl) {
        imageEl.src = config.imageUrl;
        imageEl.classList.remove("hidden");
        noticeEl.classList.add("has-image");
      } else {
        imageEl.removeAttribute("src");
        imageEl.classList.add("hidden");
        noticeEl.classList.remove("has-image");
      }
    }

    if (config.buttonText && config.buttonUrl) {
      buttonEl.textContent = config.buttonText;
      buttonEl.href = config.buttonUrl;
      buttonEl.classList.remove("hidden");

      if (config.buttonUrl.startsWith("http")) {
        buttonEl.target = "_blank";
      } else {
        buttonEl.target = "_self";
      }
    } else {
      buttonEl.classList.add("hidden");
    }

    closeBtn.addEventListener("click", () => {
      closeNotice(config, storageKey);
    });

    noticeEl.addEventListener("click", (event) => {
      if (event.target === noticeEl) {
        closeNotice(config, storageKey);
      }
    });

    setTimeout(() => {
      previouslyFocusedEl = document.activeElement;
      noticeEl.classList.remove("hidden");
      noticeEl.classList.add("show");
      noticeIsOpen = true;
      lockPageScroll();
      closeBtn.focus({ preventScroll: true });
      setBackgroundUnavailable(true);

      const displaySeconds = Number(config.displaySeconds ?? 5);

      if (displaySeconds > 0) {
        autoCloseTimer = setTimeout(() => {
          closeNotice(config, storageKey);
        }, displaySeconds * 1000);
      }
    }, 600);
  } catch (error) {
    console.warn("Không tải được thông báo nổi:", error);
  }
});
