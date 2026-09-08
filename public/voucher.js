const voucherConfig = Array.isArray(window.VOUCHER_CONFIG)
  ? window.VOUCHER_CONFIG
  : [];

const voucherIconSvg = {
  fb: () => `
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="29" fill="#1877f2"></circle>
      <path d="M37.5 57V34.2h7.7l1.2-8.9h-8.9v-5.7c0-2.6.7-4.3 4.4-4.3h4.8V7.4c-.8-.1-3.7-.4-7-.4-6.9 0-11.7 4.2-11.7 12v6.3h-7.8v8.9H28V57h9.5Z" fill="#fff"></path>
    </svg>`,
  ig: (slot) => `
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="voucherGradient${slot}" x1="8" y1="58" x2="58" y2="4" gradientUnits="userSpaceOnUse">
          <stop stop-color="#ffb000"></stop>
          <stop offset="0.35" stop-color="#f7405f"></stop>
          <stop offset="0.7" stop-color="#c32aa3"></stop>
          <stop offset="1" stop-color="#6a3de8"></stop>
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="17" fill="url(#voucherGradient${slot})"></rect>
      <rect x="16" y="16" width="32" height="32" rx="11" fill="none" stroke="#fff" stroke-width="4"></rect>
      <circle cx="32" cy="32" r="8" fill="none" stroke="#fff" stroke-width="4"></circle>
      <circle cx="44" cy="20" r="3" fill="#fff"></circle>
    </svg>`,
  zalo: () => `
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="56" height="56" rx="16" fill="#0068ff"></rect>
      <path d="M15 20h34v24H15z" fill="#ffffff" opacity="0.14"></path>
      <text x="32" y="39" fill="#ffffff" font-family="Arial, sans-serif" font-size="17" font-weight="900" text-anchor="middle">Zalo</text>
    </svg>`
};

function renderVoucherBadge(element, text) {
  if (!element) return;

  const badgeText = String(text || "").trim().replace(/\s+/g, " ");
  element.replaceChildren();
  element.classList.remove("voucher-badge--schedule");
  element.classList.toggle("hidden", !badgeText);

  if (!badgeText) return;

  const statusMatch = badgeText.match(/(?:^|\s)(CÓ MÃ)$/i);
  const scheduleText = statusMatch
    ? badgeText.slice(0, statusMatch.index).replace(/⚡/g, "").trim()
    : "";
  const hasSchedule = (scheduleText.match(/\b\d{1,2}H\b/gi) || []).length >= 2;
  const lines = hasSchedule
    ? [scheduleText.replace(/\s+/g, "·"), statusMatch[1]]
    : [badgeText];

  element.classList.toggle("voucher-badge--schedule", hasSchedule);

  lines.forEach((line, index) => {
    const lineElement = document.createElement("span");
    lineElement.className = "voucher-badge-line";
    lineElement.classList.toggle("voucher-badge-schedule", hasSchedule && index === 0);
    lineElement.classList.toggle("voucher-badge-status", hasSchedule && index === 1);
    lineElement.textContent = line;
    element.appendChild(lineElement);
  });
}

window.renderVoucherBadge = renderVoucherBadge;

function renderVoucherOptions() {
  const container = document.getElementById("voucherOptions");
  const cardTemplate = document.getElementById("voucherOptionTemplate");

  if (!container || !cardTemplate) return;

  const cards = document.createDocumentFragment();

  voucherConfig.forEach((voucher) => {
    const cardFragment = cardTemplate.content.cloneNode(true);
    const option = cardFragment.querySelector(".affiliate-option");
    const iconContainer = cardFragment.querySelector(".affiliate-icon");
    const name = cardFragment.querySelector(".affiliate-title");
    const subtitle = cardFragment.querySelector(".affiliate-subtitle");
    const badge = cardFragment.querySelector(".voucher-badge");
    const buyButton = cardFragment.querySelector(".voucher-action");

    if (!option || !iconContainer || !name || !subtitle || !badge || !buyButton) {
      return;
    }

    option.id = `voucherOption${voucher.slot}`;
    option.dataset.voucherSlot = String(voucher.slot);
    option.dataset.voucherChannel = voucher.channel;
    option.classList.add(`affiliate-option--${voucher.theme}`);

    name.id = `voucherName${voucher.slot}`;
    name.textContent = voucher.defaultName;
    option.setAttribute("aria-labelledby", name.id);

    subtitle.textContent = voucher.subtitle;
    subtitle.classList.toggle("hidden", !voucher.subtitle);

    badge.id = `voucherBadge${voucher.slot}`;
    renderVoucherBadge(badge, voucher.defaultBadge);

    buyButton.id = `buyNowBtn${voucher.slot}`;
    buyButton.classList.add(`voucher-action--${voucher.theme}`);
    buyButton.setAttribute("aria-label", `Mua ngay với ${voucher.defaultName}`);

    iconContainer.innerHTML = voucherIconSvg[voucher.theme]?.(voucher.slot) || "";

    cards.appendChild(cardFragment);
  });

  container.replaceChildren(cards);
}

renderVoucherOptions();

const productCard = document.getElementById("productCard");
const productImage = document.getElementById("productImage");
const productName = document.getElementById("productName");
const productPrice = document.getElementById("productPrice");
const productOldPrice = document.getElementById("productOldPrice");
const productUrlInput = document.getElementById("productUrl");
const pasteBtn = document.getElementById("pasteBtn");
const createBtn = document.getElementById("createBtn");
const resultSection = document.getElementById("resultSection");
const alertBox = document.getElementById("alertBox");
const alertMessage = document.getElementById("alertMessage");
const alertClose = document.getElementById("alertClose");
const toastPopup = document.getElementById("toastPopup");
const toastMessage = document.getElementById("toastMessage");
const toastCheckMark = document.getElementById("toastCheckMark");
const pageLoader = document.getElementById("pageLoader");
const inputWrap = document.getElementById("inputWrap");
const voucherBuyButtons = new Map(
  voucherConfig.map((voucher) => [
    voucher.channel,
    document.getElementById(`buyNowBtn${voucher.slot}`)
  ])
);

let creating = false;
let toastTimer;
let toastHideTimer;
let pasteTimer;
let hasInputError = false;
const createBtnDefaultHtml = createBtn?.innerHTML || "Tạo Link Ngay";

function setAlert(type, message, { inputError = false } = {}) {
  if (!alertBox || !alertMessage) return;

  alertBox.className = `alert ${type}`;
  alertMessage.textContent = message;
  hasInputError = inputError;
  productUrlInput?.setAttribute("aria-invalid", String(inputError));
}

function clearAlert() {
  if (!alertBox || !alertMessage) return;

  alertBox.className = "alert hidden";
  alertMessage.textContent = "";
  hasInputError = false;
  productUrlInput?.setAttribute("aria-invalid", "false");
}

function setInputError(message) {
  setAlert("error", message, { inputError: true });
  productUrlInput?.focus();
}

function hideToast() {
  if (!toastPopup) return;

  toastPopup.classList.add("is-hiding");
  clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => {
    toastPopup.classList.add("hidden");
    toastPopup.classList.remove("is-hiding");
  }, 350);
}

function showToast(message, type = "success", durationMs) {
  if (!toastPopup || !toastMessage) return;

  const isError = type === "error";
  const visibleDuration = durationMs ?? (isError ? 5000 : 2000);

  toastPopup.setAttribute("role", isError ? "alert" : "status");
  toastPopup.setAttribute("aria-live", isError ? "assertive" : "polite");
  toastPopup.style.setProperty("--toast-duration", `${visibleDuration}ms`);
  toastMessage.textContent = message;

  toastPopup.classList.toggle("toast-error", isError);
  toastPopup.classList.toggle("toast-success", !isError);
  toastCheckMark?.setAttribute(
    "d",
    isError ? "M17 17 L35 35 M35 17 L17 35" : "M14 27 L22 35 L38 18"
  );

  toastPopup.classList.remove("hidden", "is-hiding");
  const toastProgress = toastPopup.querySelector(".toast-progress");
  if (toastProgress) {
    toastProgress.style.animation = "none";
    void toastProgress.offsetWidth;
    toastProgress.style.animation = "";
  }

  clearTimeout(toastTimer);
  clearTimeout(toastHideTimer);
  toastTimer = setTimeout(hideToast, visibleDuration);
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function setPageLoader(visible) {
  if (!pageLoader) return;

  pageLoader.classList.toggle("hidden", !visible);
  pageLoader.setAttribute("aria-hidden", String(!visible));
}

function stopInputHint() {
  inputWrap?.classList.remove("is-hinting");
}

function startInputHint() {
  const hasValue = Boolean(productUrlInput?.value.trim());
  inputWrap?.classList.toggle("is-hinting", !hasValue);
}

function setAffiliateOption(link, buyButton) {
  if (!buyButton) return;

  const hasLink = Boolean(link);
  buyButton.href = hasLink ? link : "#";
  buyButton.classList.toggle("disabled", !hasLink);
  buyButton.setAttribute("aria-disabled", String(!hasLink));
  if (hasLink) buyButton.removeAttribute("tabindex");
  else buyButton.setAttribute("tabindex", "-1");
}

function resetResult() {
  voucherBuyButtons.forEach((buyButton) => setAffiliateOption("", buyButton));
  resultSection?.classList.add("hidden");
  productCard?.classList.add("hidden");
  productImage?.removeAttribute("src");

  if (productName) productName.textContent = "";
  if (productPrice) productPrice.textContent = "";
  if (productOldPrice) productOldPrice.textContent = "";
}

function scrollToResult() {
  if (!resultSection) return;

  resultSection.classList.remove("hidden");
  setTimeout(() => {
    resultSection.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 220);
}

function formatVnd(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number <= 0) return "";

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND"
  }).format(number);
}

function renderProductInfo(productInfo) {
  if (!productCard) return;

  const info = productInfo || {};
  const hasImage = Boolean(info.image);

  productCard.classList.toggle("product-card--no-image", !hasImage);

  if (productImage) {
    if (hasImage) {
      productImage.src = info.image;
      productImage.alt = info.name || "Sản phẩm Shopee";
      productImage.parentElement?.classList.remove("hidden");
    } else {
      productImage.removeAttribute("src");
      productImage.alt = "Không lấy được ảnh sản phẩm";
      productImage.parentElement?.classList.add("hidden");
    }
  }

  if (productName) {
    productName.textContent =
      info.name || "Không lấy được thông tin sản phẩm, nhưng link mua đã tạo thành công.";
  }

  if (productPrice) productPrice.textContent = formatVnd(info.price);

  if (productOldPrice) {
    const oldPrice = Number(info.priceBeforeDiscount || 0);
    const price = Number(info.price || 0);
    const hasDiscount = oldPrice > price && price > 0;

    productOldPrice.textContent = hasDiscount ? formatVnd(oldPrice) : "";
    productOldPrice.classList.toggle("hidden", !hasDiscount);
  }

  productCard.classList.remove("hidden");
}

async function createLink() {
  if (creating) return;

  clearAlert();
  resetResult();
  stopInputHint();

  const inputUrl = normalizeUrl(productUrlInput?.value);

  if (!inputUrl) {
    setInputError("Vui lòng nhập link Shopee.");
    return;
  }

  creating = true;
  setPageLoader(true);

  if (createBtn) {
    createBtn.disabled = true;
    createBtn.textContent = "Đang tạo link...";
  }

  try {
    const response = await fetch("/api/voucher/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ url: inputUrl })
    });
    const data = await response.json();

    if (!response.ok || !data?.success) {
      const requestError = new Error(data?.message || "Không tạo được link.");
      requestError.status = response.status;
      throw requestError;
    }

    const affiliateLinksByChannel = new Map(
      (data.affiliateLinks || []).map((item) => [item.channel, item.affiliate_link || ""])
    );
    const activeChannels = new Set(
      Array.isArray(data.activeChannels)
        ? data.activeChannels
        : voucherConfig.map((voucher) => voucher.channel)
    );
    const activeVouchers = voucherConfig.filter((voucher) =>
      activeChannels.has(voucher.channel)
    );
    const missingVouchers = activeVouchers.filter(
      (voucher) => !affiliateLinksByChannel.get(voucher.channel)
    );

    if (affiliateLinksByChannel.size === 0) {
      throw new Error("Không nhận được link voucher nào.");
    }

    renderProductInfo(data.productInfo);
    voucherConfig.forEach((voucher) => {
      document
        .getElementById(`voucherOption${voucher.slot}`)
        ?.classList.toggle("hidden", !activeChannels.has(voucher.channel));
      setAffiliateOption(
        affiliateLinksByChannel.get(voucher.channel),
        voucherBuyButtons.get(voucher.channel)
      );
    });

    resultSection?.classList.remove("hidden");
    showToast(
      missingVouchers.length
        ? `Đã tạo ${affiliateLinksByChannel.size}/${activeVouchers.length} link. ${missingVouchers
            .map((voucher) => voucher.apiLabel)
            .join(", ")} đang tạm lỗi.`
        : "Tạo link thành công!"
    );

    setTimeout(() => {
      setPageLoader(false);
      scrollToResult();
    }, 450);
  } catch (error) {
    setPageLoader(false);

    if (error?.status === 400 || error?.status === 413) {
      setInputError(error.message || "Link Shopee không hợp lệ.");
    } else {
      clearAlert();
      showToast(error.message || "Tạo link không thành công!", "error");
    }
  } finally {
    creating = false;

    if (createBtn) {
      createBtn.disabled = false;
      createBtn.innerHTML = createBtnDefaultHtml;
    }
  }
}

async function pasteAndCreate() {
  clearAlert();
  stopInputHint();

  try {
    const text = await navigator.clipboard.readText();

    if (!text?.trim()) {
      showToast("Clipboard đang trống.", "error");
      return;
    }

    if (productUrlInput) productUrlInput.value = text.trim();
    showToast("Đã dán link!");
    await createLink();
  } catch {
    showToast("Trình duyệt không cho đọc clipboard. Hãy dán thủ công bằng Ctrl+V.", "error");
  }
}

createBtn?.addEventListener("click", createLink);
pasteBtn?.addEventListener("click", pasteAndCreate);
alertClose?.addEventListener("click", () => {
  clearAlert();
  productUrlInput?.focus();
});

productUrlInput?.addEventListener("paste", () => {
  clearTimeout(pasteTimer);
  pasteTimer = setTimeout(() => {
    stopInputHint();
    showToast("Đã dán link!");
    createLink();
  }, 120);
});

productUrlInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") createLink();
});

productUrlInput?.addEventListener("focus", stopInputHint);
productUrlInput?.addEventListener("input", () => {
  if (hasInputError) clearAlert();
  stopInputHint();
});
productUrlInput?.addEventListener("click", stopInputHint);

window.addEventListener("load", () => {
  setTimeout(startInputHint, 500);
});

resetResult();
