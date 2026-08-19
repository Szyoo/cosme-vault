import { chromium } from "playwright";
const ctx = await chromium.launchPersistentContext("./profile", {
  headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  locale: "ja-JP", timezoneId: "Asia/Tokyo",
});
const page = await ctx.newPage();
await page.goto("https://www.cosme.net/enquete/enq_id/27474/a_key/wF7RFy9HFtC.Ht8w0_EkRJCaFt9Hw_pf/brand_id/199?fav_brand_must=1&no_info=0", { waitUntil: "domcontentloaded", timeout: 40000 });

const info = await page.evaluate(() => {
  const f = Array.from(document.querySelectorAll("form")).find(x => x.action.includes("/enquete/confirm"));
  if (!f) return { error: "未找到 confirm 表单" };
  return {
    action: f.action, method: f.method,
    fields: Array.from(f.querySelectorAll("input,select,textarea")).map(i => ({
      tag: i.tagName, type: i.getAttribute("type"), name: i.name, id: i.id,
      value: (i.value||"").slice(0,60),
      checkedByDefault: i.type === "checkbox" || i.type === "radio" ? i.checked : undefined,
    })),
    submitValue: f.querySelector('input[type=submit]')?.value,
    // 页面正文摘要，判断这一步在要求什么
    bodyExcerpt: document.body.innerText.replace(/\s+/g," ").slice(0, 700),
  };
});
console.log(JSON.stringify(info, null, 2));
await ctx.close();
