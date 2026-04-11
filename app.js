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
const voucherImage = document.getElementById("voucherImage");

let currentAffiliateLink = "";
let creating = false;
let facebookPostUrl = "";

function setAlert(type, message) {
  alertBox.className = `alert ${type}`;
  alertBox.textContent = message;
}

function clearAlert() {
  alertBox.className = "alert hidden";
  alertBox.textContent = "";
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function resetResult() {
  currentAffiliateLink = "";
  affiliateLinkValue.value = "";
  buyNowBtn.href = "#";
  buyNowBtn.classList.add("disabled");
  resultSection.classList.add("hidden");
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

      if (data.voucherImageUrl) {
        voucherImage.src = data.voucherImageUrl;
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
    setAlert("success", "Đã copy link.");
  } catch {
    setAlert("error", "Không thể copy tự động.");
  }
}

async function pasteAndCreate() {
  clearAlert();

  try {
    const text = await navigator.clipboard.readText();

    if (!text || !text.trim()) {
      setAlert("error", "Clipboard đang trống.");
      return;
    }

    productUrlInput.value = text.trim();
    await createLink();
  } catch {
    setAlert("error", "Trình duyệt không cho đọc clipboard. Hãy dán thủ công bằng Ctrl+V.");
  }
}

createBtn.addEventListener("click", createLink);
copyBtn.addEventListener("click", copyAffiliateLink);
pasteBtn.addEventListener("click", pasteAndCreate);

let pasteTimer;

productUrlInput.addEventListener("paste", () => {
  clearTimeout(pasteTimer);
  pasteTimer = setTimeout(() => {
    createLink();
  }, 120);
});
productUrlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    createLink();
  }
});

shareBtn.addEventListener("click", (event) => {
  if (!facebookPostUrl) {
    event.preventDefault();
    setAlert("error", "Chưa cấu hình link Facebook.");
  }
});

loadConfig();
resetResult();