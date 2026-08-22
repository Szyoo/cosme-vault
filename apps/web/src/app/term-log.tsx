/**
 * 运行日志终端窗（客户端部分）。
 *
 * 两个用户要求的行为：
 * 1. 复制按钮——整窗日志一键拷走（排查问题贴给别人用）。
 * 2. 贴底跟随——默认钉在最下（最新一条）；SSE 刷新追加新行时若正钉着就自动
 *    滚到底；用户往上翻旧日志则解除跟随，右下角浮出「回到最新」按钮，点击复位。
 *
 * 行数据由服务端组件格式化好传进来（时间已转 DISPLAY_TZ；字典函数不能跨界，
 * 文案用现成字符串 props）。
 */
"use client";

import { useEffect, useRef, useState } from "react";

export interface TermLine {
  key: number;
  time: string;
  level: string;
  text: string;
}

/** 距底多少像素以内都算「在底部」——留余量，免得一像素的抖动就解除跟随 */
const NEAR_BOTTOM_PX = 24;

export function TermLog({
  lines,
  live,
  title,
  emptyText,
  copyLabel,
  copiedLabel,
  toBottomLabel,
}: {
  lines: TermLine[];
  live: boolean;
  title: string;
  emptyText: string;
  copyLabel: string;
  copiedLabel: string;
  toBottomLabel: string;
}) {
  const body = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(true);
  const [copied, setCopied] = useState(false);

  // 新行进来时：钉着就跟到底（首帧也算，实现「默认在最下」）
  useEffect(() => {
    const el = body.current;
    if (el && pinned) el.scrollTop = el.scrollHeight;
  }, [lines, pinned]);

  function onScroll() {
    const el = body.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    setPinned(atBottom);
  }

  async function copyAll() {
    const text = lines.map((l) => `${l.time} [${l.level}] ${l.text}`).join("\n");
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
      </div>
      <div className="term-body-wrap">
        <div className="term-body" ref={body} onScroll={onScroll}>
          {lines.length === 0 && <div className="term-line debug">{emptyText}</div>}
          {lines.map((l) => (
            <div key={l.key} className={`term-line ${l.level}`}>
              <span className="term-time">{l.time}</span> {l.text}
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
