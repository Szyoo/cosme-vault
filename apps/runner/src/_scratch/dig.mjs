import { chromium } from "playwright";
const ctx = await chromium.launchPersistentContext("./profile", {
  headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  locale: "ja-JP", timezoneId: "Asia/Tokyo",
});
const page = await ctx.newPage();
await page.goto("https://www.cosme.net/brandcollection/present/detail/present_id/12057", { waitUntil: "domcontentloaded" });

const info = await page.evaluate(() => {
  const out = {};
  // 找「応募する」锚点
  const anchors = Array.from(document.querySelectorAll("a")).filter(a => (a.textContent||"").includes("応募"));
  out.applyAnchors = anchors.map(a => ({
    outerHTML: a.outerHTML.slice(0, 400),
    onclick: a.getAttribute("onclick"),
    id: a.id, className: a.className,
    parentForm: a.closest("form") ? { action: a.closest("form").action, method: a.closest("form").method, name: a.closest("form").name } : null,
  }));
  // 页面上所有 form 的 action
  out.forms = Array.from(document.querySelectorAll("form")).map(f => ({
    name: f.name, id: f.id, action: f.action, method: f.method,
    fieldCount: f.querySelectorAll("input,select,textarea").length,
  }));
  // 是否已募集之类的状态文字
  const bodyText = document.body.innerText;
  out.statusHints = ["応募済","募集終了","受付終了","当選","応募する","応募受付"].filter(k => bodyText.includes(k));
  return out;
});
console.log(JSON.stringify(info, null, 2));
await ctx.close();
