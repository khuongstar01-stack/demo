const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const AFFILIATE_ID = String(process.env.AFFILIATE_ID || "").trim();
const DEFAULT_SUB1 = String(process.env.DEFAULT_SUB1 || "addlivetag").trim();
const FACEBOOK_POST_URL = String(process.env.FACEBOOK_POST_URL || "").trim();
const SITE_DOMAIN_TEXT = String(process.env.SITE_DOMAIN_TEXT || "linkcuaban.vn").trim();
const VOUCHER_IMAGE_URL = String(process.env.VOUCHER_IMAGE_URL || "/images/voucher.jpg").trim();

if (!AFFILIATE_ID) {
  console.error("Thiếu AFFILIATE_ID trong file .env hoặc Railway Variables");
  process.exit(1);
}

app.use(express.static(path.join(__dirname, "public")));

function normalizeUrl(rawUrl) {
  if (!rawUrl) return "";
  let url = String(rawUrl).trim();

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  return url;
}

function parseUrlSafe(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isShopeeProductHost(hostname = "") {
  return /(^|\.)shopee\.vn$/i.test(hostname) && !/^s\.shopee\.vn$/i.test(hostname);
}

function isShopeeRedirectHost(hostname = "") {
  return /^s\.shopee\.vn$/i.test(hostname);
}

function isShopeeShortHost(hostname = "") {
  return /(^|\.)shp\.ee$/i.test(hostname);
}

function isAllowedShopeeInputUrl(url) {
  const parsed = parseUrlSafe(url);
  if (!parsed) return false;

  return (
    isShopeeProductHost(parsed.hostname) ||
    isShopeeRedirectHost(parsed.hostname) ||
    isShopeeShortHost(parsed.hostname)
  );
}

function buildSubId(sub1 = "", sub2 = "", sub3 = "", sub4 = "", sub5 = "") {
  return [sub1, sub2, sub3, sub4, sub5].join("-");
}

function buildAffiliateLink(originUrl, affiliateId, shareChannelCode, subId) {
  const params = new URLSearchParams({
    origin_link: originUrl,
    affiliate_id: affiliateId,
    sub_id: subId,
  });

  if (shareChannelCode) {
    params.set("share_channel_code", shareChannelCode);
  }

  return `https://s.shopee.vn/an_redir?${params.toString()}`;
}

async function resolveShopeeRedirectUrl(inputUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(inputUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        "accept-language": "vi,en-US;q=0.9,en;q=0.8",
      },
    });

    const finalUrl = response.url || inputUrl;

    if (response.body && typeof response.body.cancel === "function") {
      try {
        await response.body.cancel();
      } catch {}
    }

    return finalUrl;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveOriginUrl(inputUrl) {
  const parsed = parseUrlSafe(inputUrl);

  if (!parsed) {
    throw new Error("Link không hợp lệ.");
  }

  if (isShopeeProductHost(parsed.hostname)) {
    return inputUrl;
  }

  if (isShopeeRedirectHost(parsed.hostname) || isShopeeShortHost(parsed.hostname)) {
    const finalUrl = await resolveShopeeRedirectUrl(inputUrl);
    const finalParsed = parseUrlSafe(finalUrl);

    if (finalParsed && isShopeeProductHost(finalParsed.hostname)) {
      return finalUrl;
    }

    throw new Error("Không resolve được link Shopee đích.");
  }

  throw new Error("Chỉ hỗ trợ link từ shopee.vn, s.shopee.vn hoặc vn.shp.ee.");
}

function sanitizeOriginUrl(rawUrl) {
  const parsed = parseUrlSafe(rawUrl);

  if (!parsed) {
    return rawUrl;
  }

  parsed.search = "";
  parsed.hash = "";

  let pathname = parsed.pathname || "/";
  if (pathname.length > 1) {
    pathname = pathname.replace(/\/+$/, "");
  }

  return `${parsed.protocol}//${parsed.host}${pathname}`;
}

app.get("/api/config", (_req, res) => {
  res.json({
    success: true,
    facebookPostUrl: FACEBOOK_POST_URL,
    siteDomainText: SITE_DOMAIN_TEXT,
    voucherImageUrl: VOUCHER_IMAGE_URL,
  });
});

app.get("/api/create-link", async (req, res) => {
  try {
    const inputUrl = normalizeUrl(req.query.url);
    const sub1 = String(req.query.sub1 || DEFAULT_SUB1).trim();
    const sub2 = String(req.query.sub2 || "").trim();
    const sub3 = String(req.query.sub3 || "").trim();
    const sub4 = String(req.query.sub4 || "").trim();
    const sub5 = String(req.query.sub5 || "").trim();

    if (!inputUrl) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập link Shopee.",
      });
    }

    if (!isAllowedShopeeInputUrl(inputUrl)) {
      return res.status(400).json({
        success: false,
        message: "Chỉ hỗ trợ link từ shopee.vn, s.shopee.vn hoặc vn.shp.ee.",
      });
    }

    const resolvedUrl = await resolveOriginUrl(inputUrl);
    const originUrl = sanitizeOriginUrl(resolvedUrl);
    const subId = buildSubId(sub1, sub2, sub3, sub4, sub5);

    const affiliateLink = buildAffiliateLink(
      originUrl,
      AFFILIATE_ID,
      SHARE_CHANNEL_CODE,
      subId
    );

    return res.json({
      success: true,
      input_url: inputUrl,
      url: originUrl,
      affiliateLinks: [
        {
          affiliate_id: AFFILIATE_ID,
          affiliate_link: affiliateLink,
        },
      ],
      subids: { sub1, sub2, sub3, sub4, sub5 },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Có lỗi khi tạo link.",
    });
  }
});


const fs = require("fs/promises");

app.use(express.json());

const NOTICE_FILE =
  process.env.NOTICE_FILE || path.join(__dirname, "notice.json");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const DEFAULT_NOTICE = {
  enabled: true,
  title: "Thông báo",
  message: "Dán link Shopee để nhận mã giảm giá nhanh chóng.",
  buttonText: "Xem hướng dẫn",
  buttonUrl: "#guidePanelVideo",
  position: "bottom-right",
  showOncePerSession: false,
  version: "default"
};

async function readNotice() {
  try {
    const raw = await fs.readFile(NOTICE_FILE, "utf8");
    return {
      ...DEFAULT_NOTICE,
      ...JSON.parse(raw)
    };
  } catch {
    return DEFAULT_NOTICE;
  }
}

async function saveNotice(data) {
  await fs.mkdir(path.dirname(NOTICE_FILE), { recursive: true });

  const noticeData = {
    enabled: Boolean(data.enabled),
    title: String(data.title || "").trim(),
    message: String(data.message || "").trim(),
    buttonText: String(data.buttonText || "").trim(),
    buttonUrl: String(data.buttonUrl || "").trim(),
    position: data.position || "bottom-right",
    showOncePerSession: Boolean(data.showOncePerSession),
    version: String(Date.now())
  };

  await fs.writeFile(
    NOTICE_FILE,
    JSON.stringify(noticeData, null, 2),
    "utf8"
  );

  return noticeData;
}

function checkAdminPassword(req, res, next) {
  const password = req.headers["x-admin-password"];

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({
      message: "Chưa cấu hình ADMIN_PASSWORD"
    });
  }

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      message: "Sai mật khẩu quản trị"
    });
  }

  next();
}

app.get("/api/notice", async (req, res) => {
  const notice = await readNotice();
  res.json(notice);
});


app.post("/api/admin/notice", checkAdminPassword, async (req, res) => {
  const notice = await saveNotice(req.body);
  res.json({
    success: true,
    notice
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


app.get("/admin/notice", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-notice.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server đang chạy tại port ${PORT}`);
});
