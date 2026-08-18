document.addEventListener("DOMContentLoaded", async () => {
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
  const voucherOptionFb25El = document.getElementById("voucherOptionFb25");
  const voucherOptionIg22El = document.getElementById("voucherOptionIg22");
  const voucherOptionFb22El = document.getElementById("voucherOptionFb22");
  const voucherName1El = document.getElementById("voucherName1");
  const voucherName2El = document.getElementById("voucherName2");
  const voucherName3El = document.getElementById("voucherName3");
  const voucherName4El = document.getElementById("voucherName4");
  const voucherBadgeFb25El = document.getElementById("voucherBadgeFb25");
  const voucherBadgeIg22El = document.getElementById("voucherBadgeIg22");
  const voucherBadgeFb22El = document.getElementById("voucherBadgeFb22");

  if (!noticeEl || !titleEl || !messageEl || !buttonEl || !closeBtn) return;

  let autoCloseTimer;

  function renderVoucherBadge(element, text) {
    if (!element) return;

    const badgeText = String(text || "").trim();
    element.replaceChildren();
    element.classList.toggle("hidden", !badgeText);

    if (!badgeText) return;

    const upperText = badgeText.toUpperCase();
    const hasFullSchedule = ["0H", "3H", "9H", "12H", "15H", "20H"].every(
      (time) => new RegExp(`(^|\\s)${time}(?=\\s|$)`).test(upperText)
    );

    const lines = hasFullSchedule
      ? ["⚡ 0H·3H·9H", "12H·15H·20H CÓ MÃ"]
      : [badgeText];

    lines.forEach((line) => {
      const lineElement = document.createElement("span");
      lineElement.className = "voucher-badge-line";
      lineElement.textContent = line;
      element.appendChild(lineElement);
    });
  }

  function updateVoucherGuide(config) {
    const voucherNames = [
      { element: voucherName1El, text: config.voucherName1 },
      { element: voucherName2El, text: config.voucherName2 },
      { element: voucherName3El, text: config.voucherName3 },
      { element: voucherName4El, text: config.voucherName4 }
    ];

    voucherNames.forEach(({ element, text }) => {
      const name = String(text || "").trim();
      if (element && name) element.textContent = name;
    });

    const voucherOptions = [
      {
        element: voucherOptionFb25El,
        visible: config.showVoucherFb25 !== false
      },
      {
        element: voucherOptionIg22El,
        visible: config.showVoucherIg22 !== false
      },
      {
        element: voucherOptionFb22El,
        visible: config.showVoucherFb22 !== false
      }
    ];

    voucherOptions.forEach(({ element, visible }) => {
      element?.classList.toggle("hidden", !visible);
    });

    const voucherBadges = [
      { element: voucherBadgeFb25El, text: config.voucherBadgeFb25 },
      { element: voucherBadgeIg22El, text: config.voucherBadgeIg22 },
      { element: voucherBadgeFb22El, text: config.voucherBadgeFb22 }
    ];

    voucherBadges.forEach(({ element, text }) => {
      renderVoucherBadge(element, text);
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

  function closeNotice(config, storageKey) {
    noticeEl.classList.remove("show");

    if (config?.showOncePerSession && storageKey) {
      sessionStorage.setItem(storageKey, "1");
    }

    clearTimeout(autoCloseTimer);
    unlockPageScroll();

    setTimeout(() => {
      noticeEl.classList.add("hidden");
    }, 250);
  }

  try {
    const isVoucherPage =
      window.location.pathname.replace(/\/+$/, "") === "/voucher";

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
      noticeEl.classList.remove("hidden");
      noticeEl.classList.add("show");
      lockPageScroll();

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
