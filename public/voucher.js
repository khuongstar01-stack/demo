const productCard = document.getElementById("productCard");
const productImage = document.getElementById("productImage");
const productName = document.getElementById("productName");
const productPrice = document.getElementById("productPrice");
const productOldPrice = document.getElementById("productOldPrice");
const copyArrow = document.getElementById("copyArrow");
const copyGuideText = document.getElementById("copyGuideText");
const COPY_GUIDE_DEFAULT = "📋 Copy link trước, rồi bấm chia sẻ để lấy mã";
const toastCard = document.querySelector("#toastPopup .toast-card");
const toastIcon = document.querySelector("#toastPopup .toast-icon");
const productUrlInput = document.getElementById("productUrl");
const pasteBtn = document.getElementById("pasteBtn");
const createBtn = document.getElementById("createBtn");
const resultSection = document.getElementById("resultSection");
const resultBox = document.getElementById("resultBox");
const buyNowBtn1 = document.getElementById("buyNowBtn1");
const buyNowBtn2 = document.getElementById("buyNowBtn2");
const shareBtn = document.getElementById("shareBtn");
const copyBtn = null;
const alertBox = document.getElementById("alertBox");
const facebookPostBtn = document.getElementById("facebookPostBtn");
const facebookPostQuickBtn = document.getElementById("facebookPostQuickBtn");
const siteDomainText = document.getElementById("siteDomainText");
const toastPopup = document.getElementById("toastPopup");
const toastMessage = document.getElementById("toastMessage");
const pageLoader = document.getElementById("pageLoader");
const inputWrap = document.querySelector(".input-wrap");
const copyHint = document.getElementById("copyHint");
const voucherImages = document.querySelectorAll("[data-voucher-image]");

let currentAffiliateLink = "";
let facebookPostUrl = "";
let creating = false;
let toastTimer;
let pasteTimer;
let createBtnDefaultHtml = createBtn ? createBtn.innerHTML : "✏️ Tạo Link Ngay";

function setAlert(type, message) {
  if (!alertBox) return;
  alertBox.className = `alert ${type}`;
  alertBox.textContent = message;
}

function clearAlert() {
  if (!alertBox) return;
  alertBox.className = "alert hidden";
  alertBox.textContent = "";
}

function showToast(message, type = "success") {
  if (!toastPopup || !toastMessage) return;

  const isError = type === "error";
  const toastCheckMark = document.getElementById("toastCheckMark");

  toastMessage.textContent = message;

  if (toastCard) {
    toastCard.classList.remove("success", "error");
    toastCard.classList.add(isError ? "error" : "success");
  }

  if (toastIcon) {
    toastIcon.classList.remove("success", "error");
    toastIcon.classList.add(isError ? "error" : "success");
  }

  if (toastCheckMark) {
    toastCheckMark.setAttribute(
      "d",
      isError ? "M17 17 L35 35 M35 17 L17 35" : "M14 27 L22 35 L38 18"
    );
  }

  toastPopup.classList.remove("hidden", "is-hiding");

  const animatedItems = toastPopup.querySelectorAll(
    ".toast-card, .toast-wave, .toast-check-icon, .toast-check-circle, .toast-check-mark, .toast-progress"
  );

  animatedItems.forEach((item) => {
    item.style.animation = "none";
    void item.offsetWidth;
    item.style.animation = "";
  });

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toastPopup.classList.add("is-hiding");

    setTimeout(() => {
      toastPopup.classList.add("hidden");
      toastPopup.classList.remove("is-hiding");
    }, 350);
  }, 1500);
}
function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function showPageLoader() {
  if (!pageLoader) return;
  pageLoader.classList.remove("hidden");
  pageLoader.setAttribute("aria-hidden", "false");
}

function hidePageLoader() {
  if (!pageLoader) return;
  pageLoader.classList.add("hidden");
  pageLoader.setAttribute("aria-hidden", "true");
}

function stopInputHint() {
  if (!inputWrap) return;
  inputWrap.classList.remove("is-hinting");
}

function updateInputState() {
  if (!inputWrap || !productUrlInput) return;
  const hasValue = Boolean(productUrlInput.value.trim());
  inputWrap.classList.toggle("is-filled", hasValue);
}

function startInputHint() {
  if (!inputWrap || !productUrlInput) return;

  const hasValue = Boolean(productUrlInput.value.trim());
  if (hasValue) {
    inputWrap.classList.add("is-filled");
    inputWrap.classList.remove("is-hinting");
    return;
  }

  inputWrap.classList.add("is-hinting");
}

function showCopyHintWaiting() {
  if (!copyHint) return;
  copyHint.textContent = "📋 Copy link trước, rồi bấm chia sẻ để lấy mã";
  copyHint.classList.remove("is-copied");
}

function resetCopyHint() {
  if (!copyHint) return;
  copyHint.textContent = "📋 Copy link trước, rồi bấm chia sẻ để lấy mã";
  copyHint.classList.remove("is-copied");
}

function clearResultEffect() {
  if (!resultBox) return;
  resultBox.classList.remove("is-created", "result-focus");
}
function lockShareBtn() {
  if (!shareBtn) return;

  shareBtn.classList.add("disabled");
  shareBtn.setAttribute("aria-disabled", "true");
  shareBtn.setAttribute("tabindex", "-1");
  shareBtn.href = "#";
}

function unlockShareBtn() {
  if (!shareBtn) return;

  if (!facebookPostUrl || !currentAffiliateLink) {
    lockShareBtn();
    return;
  }

  shareBtn.classList.remove("disabled");
  shareBtn.setAttribute("aria-disabled", "false");
  shareBtn.removeAttribute("tabindex");
  shareBtn.href = facebookPostUrl;
}

function playCreatedResultEffect() {
  if (!resultBox) return;

  resultBox.classList.remove("is-created");
  void resultBox.offsetWidth;
  resultBox.classList.add("is-created");

  showCopyHintWaiting();
}
function scrollToResultBox() {
  if (!resultSection) return;

  resultSection.classList.remove("hidden");

  setTimeout(() => {
    const target = resultBox || resultSection;
    target.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    if (resultBox) {
      resultBox.classList.remove("result-focus");
      void resultBox.offsetWidth;
      resultBox.classList.add("result-focus");
    }
  }, 220);
}

function resetResult() {
  currentAffiliateLink = "";
  lockShareBtn();

  setAffiliateOption({
    link: "",
    buyButton: buyNowBtn1
  });
  setAffiliateOption({
    link: "",
    buyButton: buyNowBtn2
  });

  if (resultSection) {
    resultSection.classList.add("hidden");
  }
if (productCard) {
  productCard.classList.add("hidden");
}

if (productImage) {
  productImage.removeAttribute("src");
}

if (productName) {
  productName.textContent = "";
}

if (productPrice) {
  productPrice.textContent = "";
}

if (productOldPrice) {
  productOldPrice.textContent = "";
}
  resetCopyHint();
  clearResultEffect();
}
async function loadConfig() {
  try {
    const res = await fetch("/api/config", {
      headers: { Accept: "application/json" }
    });

    const data = await res.json();

    if (!data?.success) return;

    if (data.siteDomainText && siteDomainText) {
      siteDomainText.textContent = data.siteDomainText;
    }

    if (data.facebookPostUrl) {
      facebookPostUrl = data.facebookPostUrl;

      if (facebookPostBtn) {
        facebookPostBtn.href = data.facebookPostUrl;
        facebookPostBtn.classList.remove("hidden");
      }

      if (facebookPostQuickBtn) {
        facebookPostQuickBtn.href = data.facebookPostUrl;
        facebookPostQuickBtn.classList.remove("hidden");
      }

      unlockShareBtn();
    }

    if (data.voucherImageUrl && voucherImages.length) {
      voucherImages.forEach((img) => {
        img.src = data.voucherImageUrl;
      });
    }
  } catch {}
}
async function createLink() {
  if (creating) return;

  clearAlert();
  resetResult();
  stopInputHint();
  updateInputState();

  const inputUrl = normalizeUrl(productUrlInput?.value);

  if (!inputUrl) {
    setAlert("error", "Vui lòng nhập link Shopee.");
    productUrlInput?.focus();
    return;
  }

  creating = true;

  if (createBtn) {
    createBtn.disabled = true;
    createBtn.innerHTML = "Đang tạo link...";
  }

  showPageLoader();

    try {
    const res = await fetch("/api/voucher/convert", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json"
  },
  body: JSON.stringify({
    url: inputUrl
  })
});

    const data = await res.json();

    if (!res.ok || !data?.success) {
      throw new Error(data?.message || "Không tạo được link.");
    }

    const affiliateLink1 = data?.affiliateLinks?.[0]?.affiliate_link || "";
    const affiliateLink2 = data?.affiliateLinks?.[1]?.affiliate_link || "";

    if (!affiliateLink1) {
      throw new Error("Không nhận được affiliate link.");
    }

    currentAffiliateLink = affiliateLink1;
    renderProductInfo(data.productInfo);

    setAffiliateOption({
      link: affiliateLink1,
      buyButton: buyNowBtn1
    });
    setAffiliateOption({
      link: affiliateLink2,
      buyButton: buyNowBtn2
    });

    unlockShareBtn();

    if (resultSection) {
      resultSection.classList.remove("hidden");
    }

    playCreatedResultEffect();
    showToast("Tạo link thành công!");

    setTimeout(() => {
      hidePageLoader();
      scrollToResultBox();
    }, 450);
  } catch (error) {
    hidePageLoader();
    clearAlert();
    showToast(error.message || "Tạo link không thành công!", "error");
  } finally {
    creating = false;

    if (createBtn) {
      createBtn.disabled = false;
      createBtn.innerHTML = createBtnDefaultHtml;
    }
  }
}
function setAffiliateOption({ link, buyButton }) {
  const hasLink = Boolean(link);

  if (buyButton) {
    buyButton.href = hasLink ? link : "#";
    buyButton.classList.toggle("disabled", !hasLink);
    buyButton.setAttribute("aria-disabled", String(!hasLink));
  }
}
async function pasteAndCreate() {
  clearAlert();
  stopInputHint();

  try {
    const text = await navigator.clipboard.readText();

    if (!text || !text.trim()) {
      setAlert("error", "Clipboard đang trống.");
      return;
    }

    if (productUrlInput) {
      productUrlInput.value = text.trim();
    }

    updateInputState();
    showToast("Đã dán link!");
    await createLink();
  } catch {
    setAlert("error", "Trình duyệt không cho đọc clipboard. Hãy dán thủ công bằng Ctrl+V.");
  }
}

if (createBtn) {
  createBtn.addEventListener("click", () => {
    stopInputHint();
    createLink();
  });
}

if (pasteBtn) {
  pasteBtn.addEventListener("click", () => {
    stopInputHint();
    pasteAndCreate();
  });
}

if (productUrlInput) {
  productUrlInput.addEventListener("paste", () => {
    clearTimeout(pasteTimer);
    pasteTimer = setTimeout(() => {
      stopInputHint();
      updateInputState();
      showToast("Đã dán link!");
      createLink();
    }, 120);
  });

  productUrlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      stopInputHint();
      createLink();
    }
  });

  productUrlInput.addEventListener("focus", () => {
    if (inputWrap) inputWrap.classList.add("is-focused");
    stopInputHint();
  });

  productUrlInput.addEventListener("blur", () => {
    if (inputWrap) inputWrap.classList.remove("is-focused");
    updateInputState();
  });

  productUrlInput.addEventListener("input", () => {
    stopInputHint();
    updateInputState();
  });

  productUrlInput.addEventListener("click", stopInputHint);
}

if (shareBtn) {
  shareBtn.addEventListener("click", (event) => {
    if (!currentAffiliateLink) {
      event.preventDefault();
      showToast("Bạn cần tạo link trước!", "error");
      return;
    }

    if (!facebookPostUrl) {
      event.preventDefault();
      showToast("Chưa cấu hình link Facebook.", "error");
      return;
    }
  });
}

window.addEventListener("load", () => {
  setTimeout(() => {
    startInputHint();
    updateInputState();
  }, 500);
});

loadConfig();
resetResult();
updateInputState();

function showCopyGuide() {
  resultBox?.classList.remove("copy-popup-open");

  copyArrow?.classList.remove("hidden");
  copyGuideText?.classList.remove("hidden");
  copyGuideText?.classList.remove("is-after-copy", "is-popup", "is-popup-overlay");

  if (copyGuideText) {
    copyGuideText.textContent = COPY_GUIDE_DEFAULT;
  }

  copyBtn?.classList.add("is-attention");
}

function hideCopyGuide() {
  resultBox?.classList.remove("copy-popup-open");

  copyArrow?.classList.add("hidden");
  copyGuideText?.classList.add("hidden");
  copyGuideText?.classList.remove("is-after-copy", "is-popup", "is-popup-overlay");

  if (copyGuideText) {
    copyGuideText.textContent = COPY_GUIDE_DEFAULT;
  }

  copyBtn?.classList.remove("is-attention");
}
function formatVnd(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number <= 0) {
    return "";
  }

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND"
  }).format(number);
}

function renderProductInfo(productInfo) {
  if (!productCard) return;

  const info = productInfo || {};

  if (productImage) {
    if (info.image) {
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
      info.name ||
      "Không lấy được thông tin sản phẩm, nhưng link mua đã tạo thành công.";
  }

  if (productPrice) {
    productPrice.textContent = formatVnd(info.price);
  }

  if (productOldPrice) {
    const oldPrice = Number(info.priceBeforeDiscount || 0);
    const price = Number(info.price || 0);

    if (oldPrice > price && price > 0) {
      productOldPrice.textContent = formatVnd(oldPrice);
      productOldPrice.classList.remove("hidden");
    } else {
      productOldPrice.textContent = "";
      productOldPrice.classList.add("hidden");
    }
  }

  productCard.classList.remove("hidden");
}
function bindBuyButtonAnimation(button) {
  if (!button) return;

  button.addEventListener("click", () => {
    button.classList.remove("is-buying");
    void button.offsetWidth;
    button.classList.add("is-buying");

    setTimeout(() => {
      button.classList.remove("is-buying");
    }, 1200);
  });
}

bindBuyButtonAnimation(buyNowBtn1);
bindBuyButtonAnimation(buyNowBtn2);
