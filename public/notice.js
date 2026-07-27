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

  if (!noticeEl || !titleEl || !messageEl || !buttonEl || !closeBtn) return;

  let autoCloseTimer;

  function updateVoucherGuide(config) {
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
