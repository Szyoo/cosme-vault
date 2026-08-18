/**
 * 页面元素巡检：把页面上所有可交互元素连同「建议选择器」一起列出来。
 *
 * 这是校验 `@cosme/core` 里那批选择器的主力工具（借鉴 ledger-helper 的 inspect 模式）。
 * 2023 年的选择器几乎肯定已失效，靠它逐个核对比盲猜快一个数量级。
 */
import type { Page } from "playwright";
import type { InspectedElement } from "@cosme/contract";

/**
 * 在页面上下文里枚举可交互元素。
 * 选择器优先级：id > name > 稳定属性 > nth-of-type 兜底——越靠前越不易随改版失效。
 */
export async function inspectPage(page: Page): Promise<InspectedElement[]> {
  return page.evaluate(() => {
    const SELECTOR = "input, button, select, textarea, a[href], label, [role=button]";

    /** 为元素生成尽量稳定的选择器 */
    function suggest(el: Element): string {
      if (el.id) return `#${CSS.escape(el.id)}`;

      const name = el.getAttribute("name");
      if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;

      const type = el.getAttribute("type");
      if (type && el.tagName === "INPUT") {
        const sameType = Array.from(document.querySelectorAll(`input[type="${type}"]`));
        if (sameType.length === 1) return `input[type="${type}"]`;
        return `input[type="${type}"]:nth-of-type(${sameType.indexOf(el) + 1})`;
      }

      // a[href] 用 href 片段定位（@cosme 的 isauth 链接带回跳地址，取路径部分即可）
      if (el.tagName === "A") {
        const href = el.getAttribute("href") ?? "";
        const path = href.split("?")[0]?.slice(-48) ?? "";
        if (path) return `a[href*="${path}"]`;
      }

      // 兜底：同标签序号
      const siblings = Array.from(document.querySelectorAll(el.tagName.toLowerCase()));
      return `${el.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(el) + 1})`;
    }

    return Array.from(document.querySelectorAll(SELECTOR))
      .filter((el) => {
        // 跳过不可见元素（display:none 的隐藏域除外——它们对表单提交有意义）
        const style = window.getComputedStyle(el);
        const isHiddenInput = el.tagName === "INPUT" && el.getAttribute("type") === "hidden";
        return isHiddenInput || (style.display !== "none" && style.visibility !== "hidden");
      })
      .slice(0, 400) // 上限，避免超长页面塞爆回传
      .map((el) => {
        const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
        const placeholder = el.getAttribute("placeholder");
        return {
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute("type") ?? el.getAttribute("name") ?? null,
          text: text || placeholder || el.getAttribute("value") || "",
          selector: suggest(el),
        };
      });
  });
}

/** 只保留表单类元素（填表调试时噪音更少） */
export function formElementsOnly(elements: InspectedElement[]): InspectedElement[] {
  return elements.filter((e) => ["input", "select", "textarea", "button"].includes(e.tag));
}
