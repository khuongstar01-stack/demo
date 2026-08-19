const express = require("express");
const path = require("path");
const fs = require("fs/promises");

require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const AFFILIATE_ID = String(process.env.AFFILIATE_ID || "").trim();
const SHARE_CHANNEL_CODE = String(process.env.SHARE_CHANNEL_CODE ?? "").trim();
const DEFAULT_SUB1 = String(process.env.DEFAULT_SUB1 || "addlivetag").trim();

const FACEBOOK_POST_URL = String(process.env.FACEBOOK_POST_URL || "").trim();
const SITE_DOMAIN_TEXT = String(process.env.SITE_DOMAIN_TEXT || "linkcuaban.vn").trim();
const VOUCHER_IMAGE_URL = String(process.env.VOUCHER_IMAGE_URL || "/images/voucher.jpg").trim();

const AFFIPAD_API_KEY = String(process.env.AFFIPAD_API_KEY || "").trim();
const AFFIPAD_TOOL_ID_1 = String(
  process.env.AFFIPAD_TOOL_ID_1 || process.env.AFFIPAD_TOOL_ID || ""
).trim();
const AFFIPAD_TOOL_ID_2 = String(process.env.AFFIPAD_TOOL_ID_2 || "").trim();
const AFFIPAD_TOOL_ID_3 = String(process.env.AFFIPAD_TOOL_ID_3 || "").trim();
const AFFIPAD_TOOL_ID_4 = String(process.env.AFFIPAD_TOOL_ID_4 || "").trim();

const NOTICE_FILE =
  process.env.NOTICE_FILE || path.join(__dirname, "notice.json");
const VOUCHER_NOTICE_FILE =
  process.env.VOUCHER_NOTICE_FILE || path.join(__dirname, "voucher-notice.json");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

if (!AFFILIATE_ID) {
  console.error("Thiếu AFFILIATE_ID trong file .env hoặc Railway Variables");
  process.exit(1);
}

app.get("/", (_req, res) => {
  res.redirect(302, "/voucher");
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

      if ([".js", ".css", ".json"].includes(extension)) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      }
    }
  })
);

app.use(express.json());

app.get(["/voucher", "/voucher/"], (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "voucher.html"));
});

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
    sub_id: subId
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
        "accept-language": "vi,en-US;q=0.9,en;q=0.8"
      }
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
        message: "Vui lòng nhập link Shopee."
      });
    }

    if (!isAllowedShopeeInputUrl(inputUrl)) {
      return res.status(400).json({
        success: false,
        message: "Chỉ hỗ trợ link từ shopee.vn, s.shopee.vn hoặc vn.shp.ee."
      });
    }

    const resolvedUrl = await resolveOriginUrl(inputUrl);
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
    return res.status(500).json({
      success: false,
      message: error?.message || "Có lỗi khi tạo link."
    });
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

async function convertVoucherWithAffipad(url, toolId) {
  const response = await fetch("https://api.affipad.com/v1/fb-convert", {
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
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.error?.message || "Không đổi được link AffiPad.");
  }

  return data.data;
}

async function fetchAffipadProductInfo(url) {
  try {
    const response = await fetch("https://api.affipad.com/v1/product-info", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AFFIPAD_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url
      })
    });

    const data = await response.json();

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

async function fetchShopeeProductInfo(originUrl) {
  const ids = getShopeeIdsFromProductUrl(originUrl);
  if (!ids) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const apiUrl =
      `https://shopee.vn/api/v4/item/get?shopid=${ids.shopId}&itemid=${ids.itemId}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        referer: originUrl,
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145.0.0.0 Safari/537.36",
        "accept-language": "vi,en-US;q=0.9,en;q=0.8"
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
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
  } finally {
    clearTimeout(timeout);
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

async function fetchShopeePageProductInfo(url) {
  if (!url) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145.0.0.0 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "vi,en-US;q=0.9,en;q=0.8"
      }
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

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
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * API mới cho shopeevn.net/voucher
 * Dùng AffiPad API và trả thêm productInfo.
 */
app.post("/api/voucher/convert", async (req, res) => {
  try {
    const inputUrl = normalizeUrl(req.body?.url);

    if (!inputUrl) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập link Shopee."
      });
    }

    if (/\/video/i.test(inputUrl) || /smtt=/i.test(inputUrl)) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng lấy link trực tiếp từ sản phẩm (không lấy link từ video)."
      });
    }

    if (!isAllowedShopeeInputUrl(inputUrl)) {
      return res.status(400).json({
        success: false,
        message: "Chỉ hỗ trợ link Shopee."
      });
    }

    if (
      !AFFIPAD_API_KEY ||
      !AFFIPAD_TOOL_ID_1 ||
      !AFFIPAD_TOOL_ID_2 ||
      !AFFIPAD_TOOL_ID_3
    ) {
      return res.status(500).json({
        success: false,
        message:
          "Chưa cấu hình AFFIPAD_API_KEY, AFFIPAD_TOOL_ID_1, AFFIPAD_TOOL_ID_2 hoặc AFFIPAD_TOOL_ID_3."
      });
    }

    if (!AFFIPAD_TOOL_ID_4) {
      return res.status(500).json({
        success: false,
        message: "Chưa cấu hình AFFIPAD_TOOL_ID_4 cho Voucher Zalo 25%."
      });
    }

    const resolvedUrl = await resolveOriginUrl(inputUrl);

    if (!isDirectShopeeProductUrl(resolvedUrl)) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng lấy link trực tiếp từ sản phẩm (không lấy link từ video)."
      });
    }

    const originUrl = canonicalizeShopeeProductUrl(resolvedUrl);

    const toolConfigs = [
      {
        channel: "fb25",
        label: "Mã FB 25%",
        toolId: AFFIPAD_TOOL_ID_1
      },
      {
        channel: "ig22",
        label: "Mã IG 22%",
        toolId: AFFIPAD_TOOL_ID_2
      },
      {
        channel: "fb22",
        label: "Mã FB 22%",
        toolId: AFFIPAD_TOOL_ID_3
      }
    ];

    toolConfigs.push({
      channel: "zalo25",
      label: "Mã Zalo 25%",
      toolId: AFFIPAD_TOOL_ID_4
    });

    const affipadDataList = await Promise.all(
      toolConfigs.map(({ toolId }) =>
        convertVoucherWithAffipad(originUrl, toolId)
      )
    );

    const results = affipadDataList.map((data) =>
      Array.isArray(data.results) ? data.results[0] : null
    );

    if (!results[3]) {
      return res.status(502).json({
        success: false,
        message: "AffiPad không trả về link Voucher Zalo 25%."
      });
    }

    if (results.some((item) => !item)) {
      return res.status(502).json({
        success: false,
        message: "AffiPad không trả về đủ ba link FB 25%, IG 22% và FB 22%."
      });
    }

    const productInfo =
      normalizeAffipadProductInfo(affipadDataList[0]?.productInfo) ||
      normalizeAffipadProductInfo(affipadDataList[1]?.productInfo) ||
      normalizeAffipadProductInfo(affipadDataList[2]?.productInfo) ||
      (await fetchAffipadProductInfo(originUrl)) ||
      (await fetchShopeeProductInfo(originUrl)) ||
      (await fetchShopeePageProductInfo(resolvedUrl)) ||
      (await fetchShopeePageProductInfo(originUrl)) ||
      null;

    return res.json({
      success: true,
      input_url: inputUrl,
      url: originUrl,
      cached: affipadDataList.every((data) => Boolean(data.cached)),
      productInfo,

      affiliateLinks: results.map((item, index) => ({
        channel: toolConfigs[index].channel,
        label: toolConfigs[index].label,
        affiliate_id: item.affiliateId || "",
        affiliate_link: item.shortUrl || item.link,
        raw_link: item.link || "",
        short_url: item.shortUrl || "",
        shop_id: item.shopId || "",
        item_id: item.itemId || "",
        group_name: item.groupName || ""
      }))
    });
  } catch (error) {
    console.error("Voucher convert error:", error);

    return res.status(500).json({
      success: false,
      message: error?.message || "Có lỗi khi tạo link voucher."
    });
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
const DEFAULT_VOUCHER_NOTICE = {
  enabled: true,
  title: "0H 3H 9H 12H 15H 20H ➡️ CÓ MÃ 22%",
  message: "MÃ 20% CÓ SẴN",
  buttonText: "Group FB",
  buttonUrl: "https://www.facebook.com/",
  imageUrl: "",
  position: "bottom-right",
  showOncePerSession: false,
  displaySeconds: 5,
  voucherName1: "Voucher FB 22%",
  voucherName2: "Voucher IG 22%",
  voucherName3: "Voucher FB 20%",
  voucherName4: "Voucher Zalo 25%",
  showVoucherFb25: true,
  showVoucherIg22: true,
  showVoucherFb22: true,
  showVoucherZalo25: true,
  voucherBadgeFb25: "⚡ 0H 3H 9H 12H 15H 20H CÓ MÃ",
  voucherBadgeIg22: "⚡ 0H 3H 9H 12H 15H 20H CÓ MÃ",
  voucherBadgeFb22: "⚡ CÓ MÃ",
  voucherBadgeZalo25: "Đơn tối thiểu 200k",
  guideTitle: "📌 Hướng dẫn nhận mã giảm giá",
  guideText:
    "Chỉ cần dán link Shopee ➡️ Tạo Link ",
  guideImageUrl: "",
  version: "voucher-default"
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

  await fs.writeFile(
    NOTICE_FILE,
    JSON.stringify(noticeData, null, 2),
    "utf8"
  );

  return noticeData;
}
async function readVoucherNotice() {
  try {
    const raw = await fs.readFile(VOUCHER_NOTICE_FILE, "utf8");
    return {
      ...DEFAULT_VOUCHER_NOTICE,
      ...JSON.parse(raw)
    };
  } catch {
    return DEFAULT_VOUCHER_NOTICE;
  }
}

async function saveVoucherNotice(data) {
  await fs.mkdir(path.dirname(VOUCHER_NOTICE_FILE), { recursive: true });

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
      : DEFAULT_VOUCHER_NOTICE.displaySeconds,
    voucherName1:
      String(data.voucherName1 || "").trim() || DEFAULT_VOUCHER_NOTICE.voucherName1,
    voucherName2:
      String(data.voucherName2 || "").trim() || DEFAULT_VOUCHER_NOTICE.voucherName2,
    voucherName3:
      String(data.voucherName3 || "").trim() || DEFAULT_VOUCHER_NOTICE.voucherName3,
    voucherName4:
      String(data.voucherName4 || "").trim() || DEFAULT_VOUCHER_NOTICE.voucherName4,
    showVoucherFb25: data.showVoucherFb25 !== false,
    showVoucherIg22: data.showVoucherIg22 !== false,
    showVoucherFb22: data.showVoucherFb22 !== false,
    showVoucherZalo25: data.showVoucherZalo25 !== false,
    voucherBadgeFb25: String(data.voucherBadgeFb25 || "").trim(),
    voucherBadgeIg22: String(data.voucherBadgeIg22 || "").trim(),
    voucherBadgeFb22: String(data.voucherBadgeFb22 || "").trim(),
    voucherBadgeZalo25: String(data.voucherBadgeZalo25 || "").trim(),
    guideTitle: String(data.guideTitle || "").trim(),
    guideText: String(data.guideText || "").trim(),
    guideImageUrl: String(data.guideImageUrl || "").trim(),
    version: String(Date.now())
  };

  await fs.writeFile(
    VOUCHER_NOTICE_FILE,
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

app.get("/api/notice", async (_req, res) => {
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
app.get("/api/voucher/notice", async (_req, res) => {
  const notice = await readVoucherNotice();
  res.json(notice);
});

app.post("/api/admin/voucher-notice", checkAdminPassword, async (req, res) => {
  try {
    const notice = await saveVoucherNotice(req.body);
    res.json({
      success: true,
      notice
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error?.message || "Không lưu được cấu hình Voucher."
    });
  }
});

app.get("/admin/notice", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-notice.html"));
});

app.get("*", (req, res) => {
  const extension = path.extname(req.path).toLowerCase();

  // File tài nguyên không tồn tại phải trả 404.
  if (extension) {
    return res.status(404).type("text/plain").send("Not found");
  }

  // Mọi đường dẫn trang không tồn tại đều quay về trang Voucher mới.
  res.redirect(302, "/voucher");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server đang chạy tại port ${PORT}`);
});
