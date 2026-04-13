const productUrlInput = document.getElementById("productUrl");
const pasteBtn = document.getElementById("pasteBtn");
const createBtn = document.getElementById("createBtn");
const resultSection = document.getElementById("resultSection");
const buyNowBtn = document.getElementById("buyNowBtn");
const shareBtn = document.getElementById("shareBtn");
const copyBtn = document.getElementById("copyBtn");
const alertBox = document.getElementById("alertBox");
const affiliateLinkValue = document.getElementById("affiliateLinkValue");
const facebookPostBtn = document.getElementById("facebookPostBtn");
const siteDomainText = document.getElementById("siteDomainText");
const voucherImages = document.querySelectorAll(".voucher-sync-image");
const toastPopup = document.getElementById("toastPopup");
const toastMessage = document.getElementById("toastMessage");

const inputWrap = document.getElementById("inputWrap");
const resultBoxCard = document.getElementById("resultBoxCard");
const copyHint = document.getElementById("copyHint");

let currentAffiliateLink = "";
let creating = false;
let facebookPostUrl = "";
let toastTimer;
let pasteTimer;

function setAlert(type, message) {
  alertBox.className = `alert ${type}`;
  alertBox.textContent = message;
}

function clearAlert() {
  alertBox.className = "alert hidden";
  alertBox.textContent = "";
}

function showToast(message) {
  if (!toastPopup || !toastMessage) return;

  toastMessage.textContent = message;
  toastPopup.classList.remove("hidden");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastPopup.classList.add("hidden");
  }, 1800);
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function showCopyHintWaiting() {
  if (!resultBoxCard || !copyHint) return;
  resultBoxCard.classList.add("show-copy-hint", "is-created");
  copyHint.classList.remove("is-copied");
  copyHint.textContent = "👉 Copy link này để lấy mã";
}

function showCopyHintCopied() {
  if (!resultBoxCard || !copyHint) return;
  resultBoxCard.classList.add("show-copy-hint");
  resultBoxCard.classList.remove("is-created");
  copyHint.classList.add("is-copied");
  copyHint.textContent = "✅ Đã copy link, giờ bấm Chia sẻ lấy mã";
}

function clearResultEffect() {
  if (resultBoxCard) {
    resultBoxCard.classList.remove("is-created", "show-copy-hint");
  }

  if (copyBtn) {
    copyBtn.classList.remove("attention");
  }

  if (copyHint) {
    copyHint.classList.remove("is-copied");
    copyHint.textContent = "👉 Copy link này để lấy mã";
  }
}

function playCreatedResultEffect() {
  if (resultBoxCard) {
    resultBoxCard.classList.add("is-created");
  }

  if (copyBtn) {
    copyBtn.classList.add("attention");
  }

  showCopyHintWaiting();
}

function resetResult() {
  currentAffiliateLink = "";
  affiliateLinkValue.value = "";
  buyNowBtn.href = "#";
  buyNowBtn.classList.add("disabled");
  resultSection.classList.add("hidden");
  clearResultEffect();
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config", {
      headers: { Accept: "application/json" }
    });
    const data = await res.json();

    if (data?.success) {
      if (data.siteDomainText) {
        siteDomainText.textContent = data.siteDomainText;
      }

      if (data.facebookPostUrl) {
        facebookPostUrl = data.facebookPostUrl;
        facebookPostBtn.href = data.facebookPostUrl;
        facebookPostBtn.classList.remove("hidden");
        shareBtn.href = data.facebookPostUrl;
      }

      if (data.voucherImageUrl && voucherImages.length) {
        voucherImages.forEach((img) => {
          img.src = data.voucherImageUrl;
        });
      }
    }
  } catch {}
}

async function createLink() {
  if (creating) return;

  clearAlert();
  resetResult();

  const inputUrl = normalizeUrl(productUrlInput.value);

  if (!inputUrl) {
    setAlert("error", "Vui lòng nhập link Shopee.");
    return;
  }

  creating = true;
  createBtn.disabled = true;
  createBtn.textContent = "Đang tạo link...";

  try {
    const params = new URLSearchParams({ url: inputUrl });

    const res = await fetch(`/api/create-link?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" }
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Không tạo được link.");
    }

    const affiliateLink = data?.affiliateLinks?.[0]?.affiliate_link || "";

    if (!affiliateLink) {
      throw new Error("Không nhận được affiliate link.");
    }

    currentAffiliateLink = affiliateLink;
    affiliateLinkValue.value = affiliateLink;
    buyNowBtn.href = affiliateLink;
    buyNowBtn.classList.remove("disabled");
    resultSection.classList.remove("hidden");

    playCreatedResultEffect();
    showToast("Tạo 1 link thành công!");
  } catch (error) {
    setAlert("error", error.message || "Đã có lỗi xảy ra.");
  } finally {
    creating = false;
    createBtn.disabled = false;
    createBtn.textContent = "✏️ Tạo Link Ngay";
  }
}

async function copyAffiliateLink() {
  if (!affiliateLinkValue.value) {
    setAlert("error", "Chưa có link để copy.");
    return;
  }

  try {
    await navigator.clipboard.writeText(affiliateLinkValue.value);
    showCopyHintCopied();

    if (copyBtn) {
      copyBtn.classList.remove("attention");
    }

    showToast("Đã copy link!");
    setAlert("success", "Đã copy link.");
  } catch {
    setAlert("error", "Không thể copy tự động.");
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

    productUrlInput.value = text.trim();
    updateInputState();
    showToast("Đã dán link!");
    await createLink();
  } catch {
    setAlert("error", "Trình duyệt không cho đọc clipboard. Hãy dán thủ công bằng Ctrl+V.");
  }
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

createBtn.addEventListener("click", () => {
  stopInputHint();
  createLink();
});

copyBtn.addEventListener("click", copyAffiliateLink);

pasteBtn.addEventListener("click", () => {
  stopInputHint();
  pasteAndCreate();
});

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

shareBtn.addEventListener("click", (event) => {
  if (!facebookPostUrl) {
    event.preventDefault();
    setAlert("error", "Chưa cấu hình link Facebook.");
  }
});

window.addEventListener("load", () => {
  setTimeout(() => {
    startInputHint();
    updateInputState();
  }, 500);
});

loadConfig();
resetResult();
updateInputState();
