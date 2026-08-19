import { chromium } from "playwright";
const ctx = await chromium.launchPersistentContext("./profile", {
  headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  locale: "ja-JP", timezoneId: "Asia/Tokyo",
});
const page = await ctx.newPage();
// 直接 GET 问卷页（只加载表单，不提交任何内容）
const url = "https://www.cosme.net/enquete/enq_id/27474/a_key/wF7RFy9HFtC.Ht8w0_EkRJCaFt9Hw_pf/brand_id/199?fav_brand_must=1&no_info=0";
const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 });
console.log("HTTP", resp?.status(), "\n最终地址:", page.url(), "\n标题:", await page.title(), "\n");

const info = await page.evaluate(() => {
  const out = {};
  out.hasRecaptcha = !!document.querySelector('[name*="recaptcha" i], script[src*="recaptcha"], .g-recaptcha, [class*="grecaptcha"]');
  out.recaptchaDetail = Array.from(document.querySelectorAll('[name*="recaptcha" i], script[src*="recaptcha"]')).map(e => e.tagName + ":" + (e.getAttribute("name") || e.getAttribute("src") || "").slice(0,80));
  out.forms = Array.from(document.querySelectorAll("form")).map(f => ({
    action: f.action, method: f.method, fields: f.querySelectorAll("input,select,textarea").length,
  }));
  // 问卷题目区块：找含 checkbox/radio 的容器
  const inputs = Array.from(document.querySelectorAll('input[type=checkbox], input[type=radio]'));
  out.optionCount = inputs.length;
  out.optionSample = inputs.slice(0, 8).map(i => ({
    type: i.type, name: i.name, value: i.value,
    labelText: (i.closest("label")?.innerText || i.parentElement?.innerText || "").trim().replace(/\s+/g," ").slice(0, 50),
  }));
  // 文本输入与下拉
  out.textInputs = Array.from(document.querySelectorAll('input[type=text]')).map(i => ({ name: i.name, id: i.id }));
  out.selects = Array.from(document.querySelectorAll('select')).map(s => ({ name: s.name, options: s.options.length }));
  // 送信按钮
  out.submits = Array.from(document.querySelectorAll('input[type=submit], button, input[type=image]')).map(b => ({
    tag: b.tagName, type: b.getAttribute("type"), name: b.getAttribute("name"),
    text: (b.value || b.textContent || b.getAttribute("alt") || "").trim().slice(0,40),
  }));
  return out;
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: "./artifacts/recon/enquete.png", fullPage: true }).catch(()=>{});
await ctx.close();
