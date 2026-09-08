const express = require("express");
const compression = require("compression");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const VOUCHER_CONFIG = require("./public/voucher-config");

require("dotenv").config();

function readDurationSetting(name, fallback, min = 100, max = 60000) {
  const value = Number(process.env[name]);
  return Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value)))
    : fallback;
}

const app = express();
const PORT = Number(process.env.PORT || 3000);
const APP_VERSION = String(
  process.env.RAILWAY_DEPLOYMENT_ID ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.APP_VERSION ||
    "local-development"
).trim();
const MAX_INPUT_URL_LENGTH = 4096;
const EXTERNAL_REQUEST_TIMEOUT_MS = readDurationSetting(
  "EXTERNAL_REQUEST_TIMEOUT_MS",
  8000
);
const PRODUCT_INFO_TIMEOUT_MS = readDurationSetting(
  "PRODUCT_INFO_TIMEOUT_MS",
  1000,
  100,
  1000
);
const VOUCHER_TOTAL_TIMEOUT_MS = readDurationSetting(
  "VOUCHER_TOTAL_TIMEOUT_MS",
  15000
);
const MAX_SHOPEE_REDIRECTS = 3;

const AFFILIATE_ID = String(process.env.AFFILIATE_ID || "").trim();
const SHARE_CHANNEL_CODE = String(process.env.SHARE_CHANNEL_CODE ?? "").trim();
const DEFAULT_SUB1 = String(process.env.DEFAULT_SUB1 || "addlivetag").trim();

const FACEBOOK_POST_URL = String(process.env.FACEBOOK_POST_URL || "").trim();
const SITE_DOMAIN_TEXT = String(process.env.SITE_DOMAIN_TEXT || "linkcuaban.vn").trim();
const VOUCHER_IMAGE_URL = String(process.env.VOUCHER_IMAGE_URL || "/images/voucher.jpg").trim();

const AFFIPAD_API_KEY = String(process.env.AFFIPAD_API_KEY || "").trim();
const AFFIPAD_TOOL_IDS = [
  String(process.env.AFFIPAD_TOOL_ID_1 || process.env.AFFIPAD_TOOL_ID || "").trim(),
  String(process.env.AFFIPAD_TOOL_ID_2 || "").trim(),
  String(process.env.AFFIPAD_TOOL_ID_3 || "").trim(),
  String(process.env.AFFIPAD_TOOL_ID_4 || "").trim()
];

const NOTICE_FILE =
  process.env.NOTICE_FILE || path.join(__dirname, "notice.json");
const VOUCHER_NOTICE_FILE =
  process.env.VOUCHER_NOTICE_FILE || path.join(__dirname, "voucher-notice.json");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_SESSION_SECRET = String(
  process.env.ADMIN_SESSION_SECRET || ADMIN_PASSWORD
).trim();
const ADMIN_SESSION_COOKIE = "admin_session";
const ADMIN_SESSION_TTL_MS = 60 * 60 * 1000;
const ADMIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_RATE_LIMIT_MAX = 120;
const ADMIN_LOGIN_FAILURE_MAX = 5;

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(compression({ threshold: 1024 }));

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);

  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: https:",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'"
  ];

  res.set({
    "Content-Security-Policy": contentSecurityPolicy.join("; "),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "0"
  });

  const forwardedProtocol = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();

  if (req.secure || forwardedProtocol === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000");
  }

  next();
});

function sendVoucherPage(_req, res) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.sendFile(path.join(__dirname, "public", "voucher.html"));
}

app.get(["/", "/voucher", "/voucher/"], sendVoucherPage);

app.get("/api/version", (_req, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Expires: "0",
    Pragma: "no-cache"
  });
  res.json({
    success: true,
    version: APP_VERSION
  });
});

// Vô hiệu hóa các service worker cũ từng được website sử dụng.
const legacyServiceWorkerPaths = [
  "/service-worker.js",
  "/sw.js",
  "/serviceWorker.js",
  "/workbox.js"
];

app.get(legacyServiceWorkerPaths, (_req, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Clear-Site-Data": '"cache"',
    "Service-Worker-Allowed": "/"
  });

  res.type("application/javascript");

  res.send(`
    self.addEventListener("install", () => {
      self.skipWaiting();
    });

    self.addEventListener("activate", event => {
      event.waitUntil(
        (async () => {
          const cacheNames = await caches.keys();

          await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );

          await self.registration.unregister();

          const clientList = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true
          });

          for (const client of clientList) {
            await client.navigate(client.url);
          }
        })()
      );
    });
  `);
});
app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders(res, filePath) {
      const extension = path.extname(filePath).toLowerCase();

      if (extension === ".html") {
        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, proxy-revalidate"
        );
        return;
      }

      res.setHeader("Cache-Control", "no-cache, must-revalidate");
    }
  })
);

app.use(express.json({ limit: "16kb", strict: true }));

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

function createHttpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.expose = statusCode < 500 || [502, 504].includes(statusCode);
  return error;
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

async function fetchWithTimeout(
  url,
  options = {},
  {
    timeoutMs = EXTERNAL_REQUEST_TIMEOUT_MS,
    parentSignal,
    serviceName = "Dịch vụ bên ngoài",
    consumeResponse
  } = {}
) {
  if (parentSignal?.aborted) {
    throw createHttpError(
      504,
      "TOTAL_TIMEOUT",
      "Yêu cầu tạo link đã vượt quá thời gian xử lý."
    );
  }

  const controller = new AbortController();
  let requestTimedOut = false;
  const timeout = setTimeout(() => {
    requestTimedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromParent = () => controller.abort(parentSignal.reason);

  parentSignal?.addEventListener("abort", abortFromParent, { once: true });

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    return typeof consumeResponse === "function"
      ? await consumeResponse(response)
      : response;
  } catch (error) {
    if (controller.signal.aborted) {
      if (parentSignal?.aborted && !requestTimedOut) {
        throw createHttpError(
          504,
          "TOTAL_TIMEOUT",
          "Yêu cầu tạo link đã vượt quá thời gian xử lý."
        );
      }

      throw createHttpError(
        504,
        "UPSTREAM_TIMEOUT",
        `${serviceName} phản hồi quá lâu.`
      );
    }

    throw createHttpError(
      502,
      "UPSTREAM_NETWORK_ERROR",
      `Không kết nối được tới ${serviceName}.`
    );
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}

function isShopeeProductHost(hostname = "") {
  return /(^|\.)shopee\.vn$/i.test(hostname) && !/^s\.shopee\.vn$/i.test(hostname);
}

function isShopeeRedirectHost(hostname = "") {
  return /^s\.shopee\.vn$/i.test(hostname);
}

function isShopeeShortHost(hostname = "") {
  return /^(vn\.)?shp\.ee$/i.test(hostname);
}

function isAllowedShopeeInputUrl(url) {
  const parsed = parseUrlSafe(url);
  if (!parsed) return false;

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port
  ) {
    return false;
  }

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
    sub_id: subId
  });

  if (shareChannelCode) {
    params.set("share_channel_code", shareChannelCode);
  }

  return `https://s.shopee.vn/an_redir?${params.toString()}`;
}

async function resolveShopeeRedirectUrl(inputUrl, parentSignal) {
  let currentUrl = inputUrl;

  for (let redirectCount = 0; redirectCount <= MAX_SHOPEE_REDIRECTS; redirectCount += 1) {
    if (!isAllowedShopeeInputUrl(currentUrl)) {
      throw createHttpError(
        400,
        "INVALID_REDIRECT_DOMAIN",
        "Link Shopee chuyển hướng tới domain hoặc protocol không được phép."
      );
    }

    const response = await fetchWithTimeout(currentUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        "accept-language": "vi,en-US;q=0.9,en;q=0.8"
      }
    }, {
      parentSignal,
      serviceName: "Shopee"
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");

      if (response.body && typeof response.body.cancel === "function") {
        try {
          await response.body.cancel();
        } catch {}
      }

      if (!location) {
        throw createHttpError(
          502,
          "INVALID_REDIRECT",
          "Shopee trả về chuyển hướng không hợp lệ."
        );
      }

      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    const finalUrl = response.url || currentUrl;

    if (response.body && typeof response.body.cancel === "function") {
      try {
        await response.body.cancel();
      } catch {}
    }

    return finalUrl;
  }

  throw createHttpError(
    400,
    "TOO_MANY_REDIRECTS",
    "Link Shopee chuyển hướng quá nhiều lần."
  );
}

async function resolveOriginUrl(inputUrl, parentSignal) {
  const parsed = parseUrlSafe(inputUrl);

  if (!parsed) {
    throw new Error("Link không hợp lệ.");
  }

  if (isShopeeProductHost(parsed.hostname)) {
    return inputUrl;
  }

  if (isShopeeRedirectHost(parsed.hostname) || isShopeeShortHost(parsed.hostname)) {
    const finalUrl = await resolveShopeeRedirectUrl(inputUrl, parentSignal);
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

function canonicalizeShopeeProductUrl(rawUrl) {
  const parsed = parseUrlSafe(rawUrl);

  if (!parsed) {
    return rawUrl;
  }

  const pathname = parsed.pathname || "";

  // Dạng chuẩn:
  // /product/76219330/43670888876
  const productMatch = pathname.match(/\/product\/(\d+)\/(\d+)/i);
  if (productMatch) {
    return `${parsed.protocol}//${parsed.host}/product/${productMatch[1]}/${productMatch[2]}`;
  }

  // Dạng Shopee SEO:
  // /ten-san-pham-i.76219330.43670888876
  const seoMatch = pathname.match(/-i\.(\d+)\.(\d+)/i);
  if (seoMatch) {
    return `${parsed.protocol}//${parsed.host}/product/${seoMatch[1]}/${seoMatch[2]}`;
  }

  // Dạng link rút gọn hoặc shop slug:
  // /opaanlp/76219330/43670888876
  // /ten-shop/76219330/43670888876
  const shopSlugMatch = pathname.match(/\/[^/]+\/(\d+)\/(\d+)\/?$/i);
  if (shopSlugMatch) {
    return `${parsed.protocol}//${parsed.host}/product/${shopSlugMatch[1]}/${shopSlugMatch[2]}`;
  }

  const shopId =
    parsed.searchParams.get("shopid") ||
    parsed.searchParams.get("shop_id");

  const itemId =
    parsed.searchParams.get("itemid") ||
    parsed.searchParams.get("item_id");

  if (
    shopId &&
    itemId &&
    /^\d+$/.test(shopId) &&
    /^\d+$/.test(itemId)
  ) {
    return `${parsed.protocol}//${parsed.host}/product/${shopId}/${itemId}`;
  }

  return sanitizeOriginUrl(rawUrl);
}

app.get("/api/config", (_req, res) => {
  res.json({
    success: true,
    facebookPostUrl: FACEBOOK_POST_URL,
    siteDomainText: SITE_DOMAIN_TEXT,
    voucherImageUrl: VOUCHER_IMAGE_URL
  });
});

/**
 * API cũ cho trang gốc shopeevn.net
 * Giữ nguyên cách tạo:
 * resolveOriginUrl -> canonicalizeShopeeProductUrl -> buildAffiliateLink
 */
app.get("/api/create-link", async (req, res, next) => {
  const totalController = new AbortController();
  const totalTimeout = setTimeout(
    () => totalController.abort(),
    VOUCHER_TOTAL_TIMEOUT_MS
  );

  try {
    const rawInputUrl = String(req.query.url || "").trim();

    if (rawInputUrl.length > MAX_INPUT_URL_LENGTH) {
      return res.status(400).json({
        success: false,
        code: "URL_TOO_LONG",
        message: "Link Shopee quá dài."
      });
    }

    const inputUrl = normalizeUrl(rawInputUrl);
    const sub1 = String(req.query.sub1 || DEFAULT_SUB1).trim();
    const sub2 = String(req.query.sub2 || "").trim();
    const sub3 = String(req.query.sub3 || "").trim();
    const sub4 = String(req.query.sub4 || "").trim();
    const sub5 = String(req.query.sub5 || "").trim();

    if (!inputUrl) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập link Shopee."
      });
    }

    if (!isAllowedShopeeInputUrl(inputUrl)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_SHOPEE_URL",
        message: "Chỉ hỗ trợ link HTTPS từ shopee.vn, s.shopee.vn hoặc vn.shp.ee."
      });
    }

    if (!AFFILIATE_ID) {
      return res.status(503).json({
        success: false,
        code: "LEGACY_API_NOT_CONFIGURED",
        message: "API tạo link cũ chưa được cấu hình."
      });
    }

    const resolvedUrl = await resolveOriginUrl(
      inputUrl,
      totalController.signal
    );
    const originUrl = canonicalizeShopeeProductUrl(resolvedUrl);
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
          affiliate_link: affiliateLink
        }
      ],
      subids: { sub1, sub2, sub3, sub4, sub5 }
    });
  } catch (error) {
    next(error);
  } finally {
    clearTimeout(totalTimeout);
  }
});

function getShopeeProductIds(rawUrl) {
  const parsed = parseUrlSafe(rawUrl);
  if (!parsed) return null;

  const pathname = parsed.pathname || "";

  // Dạng chuẩn: /product/SHOP_ID/ITEM_ID
  let match = pathname.match(/\/product\/(\d+)\/(\d+)/i);

  // Dạng SEO: /ten-san-pham-i.SHOP_ID.ITEM_ID
  if (!match) {
    match = pathname.match(/-i\.(\d+)\.(\d+)/i);
  }

  // Dạng shop slug: /ten-shop/SHOP_ID/ITEM_ID
  if (!match) {
    match = pathname.match(/\/[^/]+\/(\d+)\/(\d+)\/?$/i);
  }

  const shopId =
    parsed.searchParams.get("shopid") ||
    parsed.searchParams.get("shop_id");

  const itemId =
    parsed.searchParams.get("itemid") ||
    parsed.searchParams.get("item_id");

  if (!match && shopId && itemId && /^\d+$/.test(shopId) && /^\d+$/.test(itemId)) {
    return {
      shopId,
      itemId
    };
  }

  if (!match) return null;

  return {
    shopId: match[1],
    itemId: match[2]
  };
}

function isDirectShopeeProductUrl(rawUrl) {
  return Boolean(getShopeeProductIds(rawUrl));
}

async function convertVoucherWithAffipad(url, toolId, parentSignal) {
  const { response, data } = await fetchWithTimeout("https://api.affipad.com/v1/fb-convert", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AFFIPAD_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url,
      toolId,
      useCache: true,
      useShortLink: true
    })
  }, {
    parentSignal,
    serviceName: "AffiPad",
    consumeResponse: async (externalResponse) => ({
      response: externalResponse,
      data: await externalResponse.json()
    })
  });

  if (!response.ok || !data?.success) {
    throw new Error(data?.error?.message || "Không đổi được link AffiPad.");
  }

  return data.data;
}

async function fetchAffipadProductInfo(url, parentSignal) {
  try {
    const { response, data } = await fetchWithTimeout("https://api.affipad.com/v1/product-info", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AFFIPAD_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url
      })
    }, {
      timeoutMs: PRODUCT_INFO_TIMEOUT_MS,
      parentSignal,
      serviceName: "AffiPad",
      consumeResponse: async (externalResponse) => ({
        response: externalResponse,
        data: await externalResponse.json()
      })
    });

    if (!response.ok || !data?.success) {
      return null;
    }

    return normalizeAffipadProductInfo(data.data);
  } catch {
    return null;
  }
}

function fixVietnameseText(value = "") {
  const text = String(value || "");

  if (!text) return "";

  // Chỉ sửa khi có dấu hiệu lỗi mã hóa kiểu Ä, á»™, Ã¡...
  if (!/[ÃÄÂ]|áº|á»/.test(text)) {
    return text;
  }

  const win1252Map = {
    "€": 0x80,
    "‚": 0x82,
    "ƒ": 0x83,
    "„": 0x84,
    "…": 0x85,
    "†": 0x86,
    "‡": 0x87,
    "ˆ": 0x88,
    "‰": 0x89,
    "Š": 0x8a,
    "‹": 0x8b,
    "Œ": 0x8c,
    "Ž": 0x8e,
    "‘": 0x91,
    "’": 0x92,
    "“": 0x93,
    "”": 0x94,
    "•": 0x95,
    "–": 0x96,
    "—": 0x97,
    "˜": 0x98,
    "™": 0x99,
    "š": 0x9a,
    "›": 0x9b,
    "œ": 0x9c,
    "ž": 0x9e,
    "Ÿ": 0x9f
  };

  function badScore(str) {
    const replacementCount = (String(str).match(/ /g) || []).length;
    const mojibakeCount = (String(str).match(/[ÃÄÂ]|áº|á»/g) || []).length;

    return replacementCount * 1000 + mojibakeCount * 10;
  }

  try {
    const bytes = [];

    for (const char of text) {
      const code = char.charCodeAt(0);

      if (win1252Map[char] !== undefined) {
        bytes.push(win1252Map[char]);
      } else if (code <= 255) {
        bytes.push(code);
      } else {
        bytes.push(...Buffer.from(char, "utf8"));
      }
    }

    const fixed = Buffer.from(bytes).toString("utf8");

    return badScore(fixed) <= badScore(text) ? fixed : text;
  } catch {
    return text;
  }
}

function normalizeAffipadProductInfo(info) {
  if (!info) return null;

  return {
    itemId: String(info.itemId || ""),
    shopId: String(info.shopId || ""),
    name: fixVietnameseText(info.name || "Sản phẩm Shopee"),
    image: info.image || "",
    currency: info.currency || "VND",
    price: Number(info.price || info.priceMin || info.priceMax || 0),
    priceBeforeDiscount: Number(
      info.priceBeforeDiscount ||
      info.priceMinBeforeDiscount ||
      info.priceMaxBeforeDiscount ||
      0
    ),
    priceMin: Number(info.priceMin || info.price || 0),
    priceMax: Number(info.priceMax || info.price || 0),
    priceMinBeforeDiscount: Number(info.priceMinBeforeDiscount || 0),
    priceMaxBeforeDiscount: Number(info.priceMaxBeforeDiscount || 0)
  };
}

function getShopeeIdsFromProductUrl(rawUrl) {
  const parsed = parseUrlSafe(rawUrl);
  if (!parsed) return null;

  const pathname = parsed.pathname || "";

  let match = pathname.match(/\/product\/(\d+)\/(\d+)/i);

  if (!match) {
    match = pathname.match(/-i\.(\d+)\.(\d+)/i);
  }

  if (!match) {
    match = pathname.match(/\/[^/]+\/(\d+)\/(\d+)\/?$/i);
  }

  if (!match) return null;

  return {
    shopId: match[1],
    itemId: match[2]
  };
}

function normalizeShopeePrice(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return 0;

  if (number > 1000000) {
    return Math.round(number / 100000);
  }

  return Math.round(number);
}

function buildShopeeImageUrl(imageId) {
  if (!imageId) return "";
  if (/^https?:\/\//i.test(imageId)) return imageId;
  return `https://down-vn.img.susercontent.com/file/${imageId}`;
}

async function fetchShopeeProductInfo(originUrl, parentSignal) {
  const ids = getShopeeIdsFromProductUrl(originUrl);
  if (!ids) return null;

  try {
    const apiUrl =
      `https://shopee.vn/api/v4/item/get?shopid=${ids.shopId}&itemid=${ids.itemId}`;

    const { response, data } = await fetchWithTimeout(apiUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        accept: "application/json",
        referer: originUrl,
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145.0.0.0 Safari/537.36",
        "accept-language": "vi,en-US;q=0.9,en;q=0.8"
      }
    }, {
      timeoutMs: PRODUCT_INFO_TIMEOUT_MS,
      parentSignal,
      serviceName: "Shopee",
      consumeResponse: async (externalResponse) => ({
        response: externalResponse,
        data: externalResponse.ok ? await externalResponse.json() : null
      })
    });

    if (!response.ok) {
      return null;
    }

    const item = data?.data || data?.item || null;

    if (!item) return null;

    const imageId = item.image || item.images?.[0] || "";

    return {
      name: item.name || "Sản phẩm Shopee",
      image: buildShopeeImageUrl(imageId),
      price: normalizeShopeePrice(item.price_min || item.price || item.price_max),
      priceBeforeDiscount: normalizeShopeePrice(
        item.price_before_discount ||
        item.price_min_before_discount ||
        item.price_max_before_discount
      ),
      shopId: ids.shopId,
      itemId: ids.itemId
    };
  } catch {
    return null;
  }
}

function decodeHtmlEntities(text = "") {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getMetaContent(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${property}["'][^>]*>`, "i")
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }

  return "";
}

async function fetchShopeePageProductInfo(url, parentSignal) {
  if (!url) return null;

  try {
    const { response, html } = await fetchWithTimeout(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145.0.0.0 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "vi,en-US;q=0.9,en;q=0.8"
      }
    }, {
      timeoutMs: PRODUCT_INFO_TIMEOUT_MS,
      parentSignal,
      serviceName: "Shopee",
      consumeResponse: async (externalResponse) => ({
        response: externalResponse,
        html: externalResponse.ok ? await externalResponse.text() : ""
      })
    });

    if (!response.ok) {
      return null;
    }

    const name =
      getMetaContent(html, "og:title") ||
      getMetaContent(html, "twitter:title");

    const image =
      getMetaContent(html, "og:image") ||
      getMetaContent(html, "twitter:image");

    const description =
      getMetaContent(html, "og:description") ||
      getMetaContent(html, "description");

    if (!name && !image) {
      return null;
    }

    return {
      name: name || "Sản phẩm Shopee",
      image,
      price: 0,
      priceBeforeDiscount: 0,
      description
    };
  } catch {
    return null;
  }
}

/**
 * API mới cho shopeevn.net/voucher
 * Dùng AffiPad API và trả thêm productInfo.
 */
app.post("/api/voucher/convert", async (req, res, next) => {
  const totalController = new AbortController();
  const totalTimeout = setTimeout(
    () => totalController.abort(),
    VOUCHER_TOTAL_TIMEOUT_MS
  );

  try {
    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body) ||
      Object.keys(req.body).some((key) => key !== "url")
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_BODY",
        message: "Dữ liệu gửi lên không hợp lệ."
      });
    }

    const rawInputUrl = String(req.body.url || "").trim();

    if (rawInputUrl.length > MAX_INPUT_URL_LENGTH) {
      return res.status(400).json({
        success: false,
        code: "URL_TOO_LONG",
        message: "Link Shopee quá dài."
      });
    }

    const inputUrl = normalizeUrl(rawInputUrl);

    if (!inputUrl) {
      return res.status(400).json({
        success: false,
        code: "URL_REQUIRED",
        message: "Vui lòng nhập link Shopee."
      });
    }

    if (/\/video/i.test(inputUrl) || /smtt=/i.test(inputUrl)) {
      return res.status(400).json({
        success: false,
        code: "PRODUCT_URL_REQUIRED",
        message: "Vui lòng lấy link trực tiếp từ sản phẩm (không lấy link từ video)."
      });
    }

    if (!isAllowedShopeeInputUrl(inputUrl)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_SHOPEE_URL",
        message: "Chỉ hỗ trợ link HTTPS từ shopee.vn, s.shopee.vn hoặc vn.shp.ee."
      });
    }

    const voucherNotice = await readVoucherNotice();
    const activeVoucherConfigs = VOUCHER_CONFIG.filter(
      (voucher) => voucherNotice[voucher.visibilityKey] !== false
    );

    if (!activeVoucherConfigs.length) {
      return res.status(503).json({
        success: false,
        code: "NO_ACTIVE_VOUCHERS",
        message: "Hiện chưa có voucher nào được bật."
      });
    }

    const toolConfigs = activeVoucherConfigs.map((voucher) => ({
      ...voucher,
      toolId: AFFIPAD_TOOL_IDS[voucher.slot - 1] || ""
    }));
    const missingToolSlots = toolConfigs
      .filter(({ toolId }) => !toolId)
      .map(({ slot }) => `AFFIPAD_TOOL_ID_${slot}`);

    if (!AFFIPAD_API_KEY || missingToolSlots.length) {
      const missingVariables = [
        ...(!AFFIPAD_API_KEY ? ["AFFIPAD_API_KEY"] : []),
        ...missingToolSlots
      ];

      return res.status(500).json({
        success: false,
        code: "SERVER_NOT_CONFIGURED",
        message: `Chưa cấu hình ${missingVariables.join(", ")}.`
      });
    }

    const resolvedUrl = await resolveOriginUrl(
      inputUrl,
      totalController.signal
    );

    if (!isDirectShopeeProductUrl(resolvedUrl)) {
      return res.status(400).json({
        success: false,
        code: "PRODUCT_URL_REQUIRED",
        message: "Vui lòng lấy link trực tiếp từ sản phẩm (không lấy link từ video)."
      });
    }

    const originUrl = canonicalizeShopeeProductUrl(resolvedUrl);

    const conversionResults = await Promise.allSettled(
      toolConfigs.map(({ toolId }) =>
        convertVoucherWithAffipad(
          originUrl,
          toolId,
          totalController.signal
        )
      )
    );
    const affipadDataList = [];
    const affiliateLinks = [];
    const failedChannels = [];

    conversionResults.forEach((result, index) => {
      const voucher = toolConfigs[index];
      const data = result.status === "fulfilled" ? result.value : null;
      const item = Array.isArray(data?.results) ? data.results[0] : null;
      const affiliateLink = item?.shortUrl || item?.link || "";

      if (!data || !item || !affiliateLink) {
        const reason = result.status === "rejected" ? result.reason : null;
        const timeoutError = ["UPSTREAM_TIMEOUT", "TOTAL_TIMEOUT"].includes(
          reason?.code
        );

        failedChannels.push({
          channel: voucher.channel,
          label: voucher.apiLabel,
          code: timeoutError ? "TIMEOUT" : "UPSTREAM_ERROR",
          message: timeoutError
            ? "Kênh phản hồi quá lâu."
            : "Kênh tạm thời không khả dụng."
        });
        return;
      }

      affipadDataList.push(data);
      affiliateLinks.push({
        channel: voucher.channel,
        label: voucher.apiLabel,
        affiliate_id: item.affiliateId || "",
        affiliate_link: affiliateLink,
        raw_link: item.link || "",
        short_url: item.shortUrl || "",
        shop_id: item.shopId || "",
        item_id: item.itemId || "",
        group_name: item.groupName || ""
      });
    });

    if (!affiliateLinks.length) {
      const allTimedOut = failedChannels.every(
        ({ code }) => code === "TIMEOUT"
      );

      return res.status(allTimedOut ? 504 : 502).json({
        success: false,
        partial: false,
        code: allTimedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
        message: allTimedOut
          ? "Các kênh voucher phản hồi quá lâu. Vui lòng thử lại."
          : "Chưa tạo được link voucher. Vui lòng thử lại.",
        failedChannels
      });
    }

    let productInfo = affipadDataList
      .map((data) => normalizeAffipadProductInfo(data?.productInfo))
      .find(Boolean);

    if (!productInfo && !totalController.signal.aborted) {
      const pageUrls = [...new Set([resolvedUrl, originUrl])];
      const productInfoResults = await Promise.allSettled([
        fetchAffipadProductInfo(originUrl, totalController.signal),
        fetchShopeeProductInfo(originUrl, totalController.signal),
        ...pageUrls.map((url) =>
          fetchShopeePageProductInfo(url, totalController.signal)
        )
      ]);

      productInfo = productInfoResults
        .map((result) =>
          result.status === "fulfilled" ? result.value : null
        )
        .find(Boolean);
    }

    return res.json({
      success: true,
      partial: failedChannels.length > 0,
      input_url: inputUrl,
      url: originUrl,
      cached: affipadDataList.every((data) => Boolean(data.cached)),
      productInfo: productInfo || null,
      activeChannels: toolConfigs.map(({ channel }) => channel),
      affiliateLinks,
      failedChannels
    });
  } catch (error) {
    next(error);
  } finally {
    clearTimeout(totalTimeout);
  }
});

const DEFAULT_NOTICE = {
  enabled: true,
  title: "Thông báo",
  message: "Dán link Shopee để nhận mã giảm giá nhanh chóng.",
  buttonText: "Xem hướng dẫn",
  buttonUrl: "#guidePanelVideo",
  imageUrl: "",
  position: "bottom-right",
  showOncePerSession: false,
  displaySeconds: 5,
  version: "default"
};
const DEFAULT_VOUCHER_NOTICE = VOUCHER_CONFIG.reduce((notice, voucher) => ({
  ...notice,
  [voucher.nameKey]: voucher.defaultName,
  [voucher.visibilityKey]: true,
  [voucher.badgeKey]: voucher.defaultBadge
}), {
  enabled: true,
  title: "0H 9H 15H 20H ➡️ CÓ MÃ 22%",
  message: "MÃ 20% CÓ SẴN",
  buttonText: "Group FB",
  buttonUrl: "https://www.facebook.com/",
  imageUrl: "/images/2Ma.jpg",
  position: "bottom-right",
  showOncePerSession: false,
  displaySeconds: 10,
  guideTitle: "📌 Hướng dẫn nhận mã giảm giá",
  guideText: "Chỉ cần dán link Shopee ➡️ Tạo Link",
  guideImageUrl: "",
  version: "voucher-default-20260907"
});

const atomicWriteQueues = new Map();

async function writeJsonAtomic(filePath, data) {
  const previousWrite = atomicWriteQueues.get(filePath) || Promise.resolve();
  const currentWrite = previousWrite.catch(() => {}).then(async () => {
    const directory = path.dirname(filePath);
    const temporaryPath = path.join(
      directory,
      `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`
    );
    let fileHandle;

    await fs.mkdir(directory, { recursive: true });

    try {
      fileHandle = await fs.open(temporaryPath, "wx");
      await fileHandle.writeFile(JSON.stringify(data, null, 2), "utf8");
      await fileHandle.sync();
      await fileHandle.close();
      fileHandle = null;
      await fs.rename(temporaryPath, filePath);
    } catch (error) {
      if (fileHandle) {
        await fileHandle.close().catch(() => {});
      }

      await fs.unlink(temporaryPath).catch(() => {});
      throw error;
    }
  });

  atomicWriteQueues.set(filePath, currentWrite);

  try {
    await currentWrite;
  } finally {
    if (atomicWriteQueues.get(filePath) === currentWrite) {
      atomicWriteQueues.delete(filePath);
    }
  }
}

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
  const displaySeconds = Number(data.displaySeconds);

  const noticeData = {
    enabled: Boolean(data.enabled),
    title: String(data.title || "").trim(),
    message: String(data.message || "").trim(),
    buttonText: String(data.buttonText || "").trim(),
    buttonUrl: String(data.buttonUrl || "").trim(),
    imageUrl: String(data.imageUrl || "").trim(),
    position: data.position || "bottom-right",
    showOncePerSession: Boolean(data.showOncePerSession),
    displaySeconds: Number.isFinite(displaySeconds)
      ? Math.max(0, Math.min(300, Math.round(displaySeconds)))
      : DEFAULT_NOTICE.displaySeconds,
    version: String(Date.now())
  };

  await writeJsonAtomic(NOTICE_FILE, noticeData);

  return noticeData;
}
async function readVoucherNotice() {
  try {
    const raw = await fs.readFile(VOUCHER_NOTICE_FILE, "utf8");
    const savedNotice = JSON.parse(raw);

    // Chuyển khóa từ cấu hình cũ: slot 1 từng mang tên FB 25%, slot 3 từng mang tên FB 22%.
    if (
      Object.hasOwn(savedNotice, "showVoucherFb25") &&
      !Object.hasOwn(savedNotice, "showVoucherFb20")
    ) {
      savedNotice.showVoucherFb20 = savedNotice.showVoucherFb22;
      savedNotice.showVoucherFb22 = savedNotice.showVoucherFb25;
      savedNotice.voucherBadgeFb20 = savedNotice.voucherBadgeFb22;
      savedNotice.voucherBadgeFb22 = savedNotice.voucherBadgeFb25;
    }

    return {
      ...DEFAULT_VOUCHER_NOTICE,
      ...savedNotice
    };
  } catch {
    return DEFAULT_VOUCHER_NOTICE;
  }
}

async function saveVoucherNotice(data) {
  const displaySeconds = Number(data.displaySeconds);

  const voucherFields = VOUCHER_CONFIG.reduce((fields, voucher) => ({
    ...fields,
    [voucher.nameKey]:
      String(data[voucher.nameKey] || "").trim() || voucher.defaultName,
    [voucher.visibilityKey]: data[voucher.visibilityKey] !== false,
    [voucher.badgeKey]: String(data[voucher.badgeKey] || "").trim()
  }), {});

  const noticeData = {
    enabled: Boolean(data.enabled),
    title: String(data.title || "").trim(),
    message: String(data.message || "").trim(),
    buttonText: String(data.buttonText || "").trim(),
    buttonUrl: String(data.buttonUrl || "").trim(),
    imageUrl: String(data.imageUrl || "").trim(),
    position: data.position || "bottom-right",
    showOncePerSession: Boolean(data.showOncePerSession),
    displaySeconds: Number.isFinite(displaySeconds)
      ? Math.max(0, Math.min(300, Math.round(displaySeconds)))
      : DEFAULT_VOUCHER_NOTICE.displaySeconds,
    ...voucherFields,
    guideTitle: String(data.guideTitle || "").trim(),
    guideText: String(data.guideText || "").trim(),
    guideImageUrl: String(data.guideImageUrl || "").trim(),
    version: String(Date.now())
  };

  await writeJsonAtomic(VOUCHER_NOTICE_FILE, noticeData);

  return noticeData;
}

const adminRateLimitBuckets = new Map();
const adminLoginFailures = new Map();

function getClientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || "unknown");
}

function safeStringEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex < 0) return cookies;

      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();

      if (name) {
        try {
          cookies[name] = decodeURIComponent(value);
        } catch {
          cookies[name] = "";
        }
      }

      return cookies;
    }, {});
}

function signAdminSessionPayload(payload) {
  return crypto
    .createHmac("sha256", ADMIN_SESSION_SECRET)
    .update(payload)
    .digest("base64url");
}

function createAdminSession() {
  const session = {
    version: 1,
    expiresAt: Date.now() + ADMIN_SESSION_TTL_MS,
    csrfToken: crypto.randomBytes(24).toString("base64url")
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = signAdminSessionPayload(payload);

  return {
    session,
    token: `${payload}.${signature}`
  };
}

function verifyAdminSessionToken(token) {
  if (!ADMIN_SESSION_SECRET || !token) return null;

  const [payload, signature, extra] = String(token).split(".");
  if (!payload || !signature || extra) return null;

  const expectedSignature = signAdminSessionPayload(payload);
  if (!safeStringEqual(signature, expectedSignature)) return null;

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    if (
      session.version !== 1 ||
      !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= Date.now() ||
      typeof session.csrfToken !== "string" ||
      !session.csrfToken
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

function isSecureRequest(req) {
  const forwardedProtocol = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  return Boolean(req.secure || forwardedProtocol === "https");
}

function setAdminSessionCookie(req, res, token) {
  const parts = [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/api/admin",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}`
  ];

  if (isSecureRequest(req)) {
    parts.push("Secure");
  }

  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearAdminSessionCookie(req, res) {
  const parts = [
    `${ADMIN_SESSION_COOKIE}=`,
    "Path=/api/admin",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0"
  ];

  if (isSecureRequest(req)) {
    parts.push("Secure");
  }

  res.setHeader("Set-Cookie", parts.join("; "));
}

function adminRateLimit(req, res, next) {
  const now = Date.now();
  const key = getClientIp(req);
  let bucket = adminRateLimitBuckets.get(key);

  if (adminRateLimitBuckets.size > 5000) {
    for (const [storedKey, storedBucket] of adminRateLimitBuckets) {
      if (storedBucket.resetAt <= now) {
        adminRateLimitBuckets.delete(storedKey);
      }
    }
  }

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + ADMIN_RATE_LIMIT_WINDOW_MS };
  }

  bucket.count += 1;
  adminRateLimitBuckets.set(key, bucket);

  const remaining = Math.max(0, ADMIN_RATE_LIMIT_MAX - bucket.count);
  res.setHeader("RateLimit-Limit", String(ADMIN_RATE_LIMIT_MAX));
  res.setHeader("RateLimit-Remaining", String(remaining));
  res.setHeader(
    "RateLimit-Reset",
    String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)))
  );

  if (bucket.count > ADMIN_RATE_LIMIT_MAX) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({
      success: false,
      code: "ADMIN_RATE_LIMITED",
      message: "Thao tác admin quá nhiều. Vui lòng thử lại sau.",
      requestId: req.requestId
    });
  }

  next();
}

function getLoginFailureState(req) {
  const now = Date.now();
  const key = getClientIp(req);
  const current = adminLoginFailures.get(key);

  if (adminLoginFailures.size > 5000) {
    for (const [storedKey, storedState] of adminLoginFailures) {
      if (storedState.resetAt <= now) {
        adminLoginFailures.delete(storedKey);
      }
    }
  }

  if (!current || current.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + ADMIN_RATE_LIMIT_WINDOW_MS };
    adminLoginFailures.set(key, fresh);
    return { key, state: fresh };
  }

  return { key, state: current };
}

function requireAdminSession(req, res, next) {
  const token = parseCookies(req)[ADMIN_SESSION_COOKIE];
  const session = verifyAdminSessionToken(token);

  if (!session) {
    clearAdminSessionCookie(req, res);
    return res.status(401).json({
      success: false,
      code: "ADMIN_AUTH_REQUIRED",
      message: "Phiên đăng nhập admin không hợp lệ hoặc đã hết hạn.",
      requestId: req.requestId
    });
  }

  req.adminSession = session;
  next();
}

function requireAdminCsrf(req, res, next) {
  const csrfToken = String(req.headers["x-csrf-token"] || "");

  if (!csrfToken || !safeStringEqual(csrfToken, req.adminSession.csrfToken)) {
    return res.status(403).json({
      success: false,
      code: "INVALID_CSRF_TOKEN",
      message: "Yêu cầu admin không hợp lệ.",
      requestId: req.requestId
    });
  }

  const origin = String(req.headers.origin || "");
  const requestHost = String(req.headers.host || "");

  if (origin) {
    try {
      if (new URL(origin).host !== requestHost) {
        throw new Error("Origin không hợp lệ");
      }
    } catch {
      return res.status(403).json({
        success: false,
        code: "INVALID_ORIGIN",
        message: "Nguồn gửi yêu cầu admin không hợp lệ.",
        requestId: req.requestId
      });
    }
  }

  next();
}

app.use("/api/admin", adminRateLimit);

app.post("/api/admin/login", (req, res) => {
  if (!ADMIN_PASSWORD || !ADMIN_SESSION_SECRET) {
    return res.status(503).json({
      success: false,
      code: "ADMIN_NOT_CONFIGURED",
      message: "Chưa cấu hình xác thực admin.",
      requestId: req.requestId
    });
  }

  const { key, state } = getLoginFailureState(req);

  if (state.count >= ADMIN_LOGIN_FAILURE_MAX) {
    const retryAfter = Math.max(
      1,
      Math.ceil((state.resetAt - Date.now()) / 1000)
    );
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({
      success: false,
      code: "ADMIN_LOGIN_LOCKED",
      message: "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.",
      requestId: req.requestId
    });
  }

  const password = String(req.body?.password || "");

  if (!password || password.length > 256 || !safeStringEqual(password, ADMIN_PASSWORD)) {
    state.count += 1;
    adminLoginFailures.set(key, state);
    return res.status(401).json({
      success: false,
      code: "INVALID_ADMIN_CREDENTIALS",
      message: "Mật khẩu quản trị không đúng.",
      requestId: req.requestId
    });
  }

  adminLoginFailures.delete(key);
  const { session, token } = createAdminSession();
  setAdminSessionCookie(req, res, token);

  return res.json({
    success: true,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt
  });
});

app.get("/api/admin/session", requireAdminSession, (req, res) => {
  res.json({
    success: true,
    csrfToken: req.adminSession.csrfToken,
    expiresAt: req.adminSession.expiresAt
  });
});

app.post(
  "/api/admin/logout",
  requireAdminSession,
  requireAdminCsrf,
  (req, res) => {
    clearAdminSessionCookie(req, res);
    res.json({ success: true });
  }
);

app.get("/api/notice", async (_req, res) => {
  const notice = await readNotice();
  res.json(notice);
});

app.post(
  "/api/admin/notice",
  requireAdminSession,
  requireAdminCsrf,
  asyncHandler(async (req, res) => {
    const notice = await saveNotice(req.body);
    res.json({
      success: true,
      notice
    });
  })
);
app.get("/api/voucher/notice", async (_req, res) => {
  const notice = await readVoucherNotice();
  res.json(notice);
});

app.post(
  "/api/admin/voucher-notice",
  requireAdminSession,
  requireAdminCsrf,
  asyncHandler(async (req, res) => {
    const notice = await saveVoucherNotice(req.body);
    res.json({
      success: true,
      notice
    });
  })
);

app.get("/admin/notice", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-notice.html"));
});

app.use((req, res) => {
  const extension = path.extname(req.path).toLowerCase();

  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      code: "API_NOT_FOUND",
      message: "API không tồn tại.",
      requestId: req.requestId
    });
  }

  // File tài nguyên không tồn tại phải trả 404.
  if (extension || !["GET", "HEAD"].includes(req.method)) {
    return res.status(404).type("text/plain").send("Not found");
  }

  // Mọi đường dẫn trang không tồn tại đều quay về trang chính Voucher.
  res.redirect(302, "/");
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = Number(error?.statusCode || error?.status || 500);
  let code = error?.code || "INTERNAL_ERROR";
  let message = error?.message || "Có lỗi khi xử lý yêu cầu.";
  let expose = Boolean(error?.expose);

  if (error?.type === "entity.too.large") {
    statusCode = 413;
    code = "BODY_TOO_LARGE";
    message = "Dữ liệu gửi lên vượt quá giới hạn 16 KB.";
    expose = true;
  } else if (error instanceof SyntaxError && error?.type === "entity.parse.failed") {
    statusCode = 400;
    code = "INVALID_JSON";
    message = "JSON gửi lên không hợp lệ.";
    expose = true;
  }

  const requestId = req.requestId || crypto.randomUUID();

  const logDetails = {
    requestId,
    method: req.method,
    path: req.path,
    statusCode,
    code
  };

  if (statusCode >= 500) {
    console.error("Request failed", {
      ...logDetails,
      error: error?.stack || String(error)
    });
  } else {
    console.warn("Request rejected", logDetails);
  }

  return res.status(statusCode).json({
    success: false,
    code,
    message: expose ? message : "Có lỗi khi xử lý yêu cầu.",
    requestId
  });
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server đang chạy tại port ${PORT}`);
  });
}
