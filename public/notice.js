document.addEventListener("DOMContentLoaded", async () => {
  const noticeEl = document.getElementById("floatingNotice");
  const titleEl = document.getElementById("floatingNoticeTitle");
  const messageEl = document.getElementById("floatingNoticeMessage");
  const buttonEl = document.getElementById("floatingNoticeButton");
  const closeBtn = document.getElementById("floatingNoticeClose");

  if (!noticeEl || !titleEl || !messageEl || !buttonEl || !closeBtn) return;

  let autoCloseTimer;

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
    const response = await fetch(`/api/notice?v=${Date.now()}`, {
      cache: "no-store"
    });

    if (!response.ok) return;

    const config = await response.json();

    if (!config.enabled) return;

    const noticeVersion = config.version || "default";
    const storageKey = `floating_notice_closed_${noticeVersion}`;

    if (config.showOncePerSession && sessionStorage.getItem(storageKey)) {
      return;
    }

    titleEl.textContent = config.title || "Thông báo";
    messageEl.textContent = config.message || "";

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

    setTimeout(() => {
      noticeEl.classList.remove("hidden");
noticeEl.classList.add("show");
lockPageScroll();

      autoCloseTimer = setTimeout(() => {
        closeNotice(config, storageKey);
      }, 5000);
    }, 600);

    closeBtn.addEventListener("click", () => {
      closeNotice(config, storageKey);
    });

    noticeEl.addEventListener("click", (event) => {
      if (event.target === noticeEl) {
        closeNotice(config, storageKey);
      }
    });
  } catch (error) {
    console.warn("Không tải được thông báo nổi:", error);
  }
});