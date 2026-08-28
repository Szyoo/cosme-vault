/**
 * 运行日志终端窗（客户端部分）。
 *
 * 用户要求的行为：
 * 1. 复制按钮——整窗日志一键拷走（排查问题贴给别人用）。
 * 2. 贴底跟随——默认钉在最下（最新一条）；SSE 刷新追加新行时若正钉着就自动
 *    滚到底；用户往上翻旧日志则解除跟随，右下角浮出「回到最新」按钮，点击复位。
 * 3. 清空——**只清屏，不删数据**。记一个水位线（当前最新那条的 id），
 *    只隐藏 id ≤ 水位线的行，之后的新日志照常出现；库里一条都不动。
 *    水位线存 localStorage，刷新页面后仍然清着（否则一按 F5 就全回来了，
 *    等于没清）。清掉之后显示一条「已隐藏 N 条（仍保留在日志里）· 显示全部」，
 *    让人知道数据还在、也随时能恢复。
 *
 * 行数据由服务端组件格式化好传进来（时间已转 DISPLAY_TZ）；
 * ⚠️ **文案由本组件 useT() 自取，不走 props**——`hidden(n)` 这类是函数，
 * 函数不能从服务端组件传给客户端组件（Next 会当成 Server Action 报错）。
 * 与 present-list / account-matrix 的做法一致。
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/context.tsx";

export interface TermLine {
  key: number;
  time: string;
  level: string;
  text: string;
  /** 所属任务；换任务时终端插一条分隔线（控制面自己写的日志为 null，自成一组） */
  jobId: string | null;
}

/** 距底多少像素以内都算「在底部」——留余量，免得一像素的抖动就解除跟随 */
const NEAR_BOTTOM_PX = 24;

/** 清屏水位线存这里；换设备/换浏览器互不影响，本来就是「本机的视图偏好」 */
const FLOOR_KEY = "cosme.log.floor";

export function TermLog({ lines, live }: { lines: TermLine[]; live: boolean }) {
  const t = useT();
  const {
    title,
    empty: emptyText,
    copy: copyLabel,
    copied: copiedLabel,
    toBottom: toBottomLabel,
    clear: clearLabel,
    hidden: hiddenLabel,
    showAll: showAllLabel,
  } = t.log;
  const body = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(true);
  const [copied, setCopied] = useState(false);
  /** 清屏水位线：id ≤ 此值的行不显示。0 = 没清过 */
  const [floor, setFloor] = useState(0);

  // ⚠️ localStorage 只能在 effect 里读：渲染期读会让服务端与客户端首帧不一致（水合报错）
  useEffect(() => {
    const raw = window.localStorage.getItem(FLOOR_KEY);
    const n = raw ? Number(raw) : 0;
    if (Number.isFinite(n) && n > 0) setFloor(n);
  }, []);

  const shown = lines.filter((l) => l.key > floor);
  const hiddenCount = lines.length - shown.length;

  function clearView() {
    const newest = lines.length > 0 ? lines[lines.length - 1]!.key : 0;
    setFloor(newest);
    window.localStorage.setItem(FLOOR_KEY, String(newest));
    setPinned(true);
  }

  function showAll() {
    setFloor(0);
    window.localStorage.removeItem(FLOOR_KEY);
  }

  // 新行进来时：钉着就跟到底（首帧也算，实现「默认在最下」）
  useEffect(() => {
    const el = body.current;
    if (el && pinned) el.scrollTop = el.scrollHeight;
  }, [shown.length, pinned]);

  function onScroll() {
    const el = body.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    setPinned(atBottom);
  }

  async function copyAll() {
    // 复制出来的文本也带分隔，贴给别人时同样能看出任务边界
    const text = shown
      .map((l, i) => {
        const sep = i > 0 && l.jobId !== shown[i - 1]!.jobId ? "\n" + "═".repeat(48) + "\n" : "";
        return `${sep}${l.time} [${l.level}] ${l.text}`;
      })
      .join("\n");
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="term section">
      <div className="term-head">
        <span className="term-dot" data-live={live ? "1" : "0"} />
        <span className="term-title">{title}</span>
        <button type="button" className="term-tool-btn" onClick={() => void copyAll()}>
          {copied ? copiedLabel : copyLabel}
        </button>
        <button type="button" className="term-tool-btn" onClick={clearView} disabled={shown.length === 0}>
          {clearLabel}
        </button>
      </div>
      {hiddenCount > 0 && (
        <div className="term-hidden">
          {hiddenLabel(hiddenCount)}
          <button type="button" className="term-tool-btn" onClick={showAll}>
            {showAllLabel}
          </button>
        </div>
      )}
      <div className="term-body-wrap">
        <div className="term-body" ref={body} onScroll={onScroll}>
          {shown.length === 0 && <div className="term-line debug">{emptyText}</div>}
          {shown.map((l, i) => (
            <div key={l.key}>
              {/* 任务边界：换 jobId 就画一条双线，否则只能靠时间戳猜哪条属于哪次任务 */}
              {i > 0 && l.jobId !== shown[i - 1]!.jobId && <div className="term-sep" aria-hidden />}
              <div className={`term-line ${l.level}`}>
                <span className="term-time">{l.time}</span> {l.text}
              </div>
            </div>
          ))}
        </div>
        {!pinned && (
          <button
            type="button"
            className="term-follow"
            onClick={() => {
              setPinned(true);
              const el = body.current;
              if (el) el.scrollTop = el.scrollHeight;
            }}
          >
            ↓ {toBottomLabel}
          </button>
        )}
      </div>
    </section>
  );
}
