"use client";

import CryptoJS from "crypto-js";
import { useMemo, useState } from "react";

const DEFAULT_KEY = "keenon0123456789";

type Mode = "generate" | "verify";
type SourceMode = "fields" | "custom";

function encrypt(content: string, key: string) {
  const encrypted = CryptoJS.AES.encrypt(content, CryptoJS.enc.Utf8.parse(key), {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });

  return {
    hex: encrypted.ciphertext.toString(CryptoJS.enc.Hex),
    base64: encrypted.toString(),
  };
}

function decrypt(sign: string, key: string) {
  const normalized = sign.trim();
  const isHex = /^[0-9a-fA-F]+$/.test(normalized) && normalized.length % 2 === 0;
  const cipherText = isHex
    ? CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.enc.Hex.parse(normalized),
      })
    : normalized;
  const decrypted = CryptoJS.AES.decrypt(cipherText, CryptoJS.enc.Utf8.parse(key), {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });

  return CryptoJS.enc.Utf8.stringify(decrypted).trim();
}

function CopyButton({ value, label = "复制" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button className="copy-button" type="button" onClick={handleCopy} disabled={!value}>
      {copied ? "已复制 ✓" : label}
    </button>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("generate");
  const [sourceMode, setSourceMode] = useState<SourceMode>("fields");
  const [robotSn, setRobotSn] = useState("");
  const [date, setDate] = useState("");
  const [account, setAccount] = useState("");
  const [custom, setCustom] = useState("");
  const [key, setKey] = useState(DEFAULT_KEY);
  const [showKey, setShowKey] = useState(false);
  const [result, setResult] = useState<{ hex: string; base64: string } | null>(null);
  const [signToVerify, setSignToVerify] = useState("");
  const [plainText, setPlainText] = useState("");
  const [error, setError] = useState("");

  const source = useMemo(
    () => (sourceMode === "fields" ? `${robotSn.trim()}|${date.trim()}|${account.trim()}` : custom),
    [sourceMode, robotSn, date, account, custom],
  );

  function validateKey() {
    const byteLength = CryptoJS.enc.Utf8.parse(key).sigBytes;
    if (![16, 24, 32].includes(byteLength)) {
      setError("AES 密钥长度必须为 16、24 或 32 字节。");
      return false;
    }
    return true;
  }

  function handleGenerate() {
    setError("");
    if (!validateKey()) return;
    if (sourceMode === "fields" && (!robotSn.trim() || !date.trim() || !account.trim())) {
      setError("请完整填写 Robot SN、日期和账号。");
      return;
    }
    if (!source.trim()) {
      setError("请输入待签名原文。");
      return;
    }
    setResult(encrypt(source, key));
  }

  function handleVerify() {
    setError("");
    setPlainText("");
    if (!validateKey()) return;
    if (!signToVerify.trim()) {
      setError("请输入需要校验的 Sign。");
      return;
    }
    try {
      const decoded = decrypt(signToVerify, key);
      if (!decoded) throw new Error("empty");
      setPlainText(decoded);
    } catch {
      setError("解密失败，请检查 Sign 格式或密钥是否正确。");
    }
  }

  const activeSign = result?.hex ?? "";
  const encodedSign = activeSign ? encodeURIComponent(activeSign) : "";

  return (
    <main>
      <header className="topbar">
        <div className="brand-mark">S</div>
        <div className="brand-copy">
          <strong>Sign Lab</strong>
          <span>Portal 请求签名工具</span>
        </div>
        <div className="privacy-pill"><span />本地计算，不上传数据</div>
      </header>

      <section className="hero">
        <div className="eyebrow">AES SIGNATURE UTILITY</div>
        <h1>生成一个可直接使用的 <em>Sign</em></h1>
        <p>与 Portal 保持一致的 AES-ECB / PKCS7 规则。填写参数，立即获得请求头、Hex 和 Base64 结果。</p>
      </section>

      <section className="workspace" aria-label="Sign 工具">
        <div className="tab-list" role="tablist" aria-label="工具模式">
          <button className={mode === "generate" ? "active" : ""} onClick={() => setMode("generate")} role="tab" aria-selected={mode === "generate"}>生成 Sign</button>
          <button className={mode === "verify" ? "active" : ""} onClick={() => setMode("verify")} role="tab" aria-selected={mode === "verify"}>校验 Sign</button>
        </div>

        {mode === "generate" ? (
          <div className="tool-grid">
            <div className="panel input-panel">
              <div className="panel-heading">
                <div><span className="step">01</span><h2>输入签名参数</h2></div>
                <div className="segmented" aria-label="输入方式">
                  <button className={sourceMode === "fields" ? "active" : ""} onClick={() => setSourceMode("fields")} type="button">Portal 字段</button>
                  <button className={sourceMode === "custom" ? "active" : ""} onClick={() => setSourceMode("custom")} type="button">自定义原文</button>
                </div>
              </div>

              {sourceMode === "fields" ? (
                <div className="field-stack">
                  <label>Robot SN<input value={robotSn} onChange={(event) => setRobotSn(event.target.value)} placeholder="例如：R123456789" autoComplete="off" /></label>
                  <label>日期 / 时间<input value={date} onChange={(event) => setDate(event.target.value)} placeholder="例如：2026-10-26" autoComplete="off" /></label>
                  <label>账号<input value={account} onChange={(event) => setAccount(event.target.value)} placeholder="例如：user@example.com" autoComplete="off" /></label>
                  <div className="source-preview"><span>待签名原文</span><code>{source === "||" ? "robotSn|date|account" : source}</code></div>
                </div>
              ) : (
                <label className="textarea-label">待签名原文<textarea value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="输入任意需要加密的字符串" rows={8} /></label>
              )}

              <label className="key-label">AES 密钥<div className="key-control"><input type={showKey ? "text" : "password"} value={key} onChange={(event) => setKey(event.target.value)} autoComplete="off" /><button type="button" onClick={() => setShowKey((value) => !value)}>{showKey ? "隐藏" : "显示"}</button></div><small>默认读取 Portal 当前配置，可按环境手动替换。</small></label>

              {error && <div className="error-message" role="alert">{error}</div>}
              <button className="primary-button" type="button" onClick={handleGenerate}>生成 Sign <span>→</span></button>
            </div>

            <div className="panel result-panel">
              <div className="panel-heading"><div><span className="step">02</span><h2>复制结果</h2></div>{result && <span className="ready-badge">生成成功</span>}</div>

              <div className={`result-content ${result ? "has-result" : ""}`}>
                {!result ? (
                  <div className="empty-state"><div className="empty-icon">S</div><h3>等待生成</h3><p>结果会显示在这里，支持一键复制到请求头。</p></div>
                ) : (
                  <>
                    <div className="featured-result"><div className="result-label"><span>请求头</span><CopyButton value={`Sign: ${activeSign}`} label="复制整行" /></div><pre>Sign: {activeSign}</pre></div>
                    <div className="result-block"><div className="result-label"><span>Hex</span><CopyButton value={result.hex} /></div><pre>{result.hex}</pre></div>
                    <div className="result-block"><div className="result-label"><span>Base64</span><CopyButton value={result.base64} /></div><pre>{result.base64}</pre></div>
                    <div className="result-block"><div className="result-label"><span>URL 编码</span><CopyButton value={encodedSign} /></div><pre>{encodedSign}</pre></div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="verify-wrap panel">
            <div className="panel-heading"><div><span className="step">01</span><h2>解密并校验</h2></div><span className="format-note">自动识别 Hex / Base64</span></div>
            <div className="verify-grid">
              <div>
                <label className="textarea-label">Sign<textarea value={signToVerify} onChange={(event) => setSignToVerify(event.target.value)} placeholder="粘贴需要校验的 Sign" rows={8} /></label>
                <label className="key-label">AES 密钥<div className="key-control"><input type={showKey ? "text" : "password"} value={key} onChange={(event) => setKey(event.target.value)} /><button type="button" onClick={() => setShowKey((value) => !value)}>{showKey ? "隐藏" : "显示"}</button></div></label>
                {error && <div className="error-message" role="alert">{error}</div>}
                <button className="primary-button" type="button" onClick={handleVerify}>校验 Sign <span>→</span></button>
              </div>
              <div className={`decoded-result ${plainText ? "has-result" : ""}`}>
                <div className="result-label"><span>解密原文</span><CopyButton value={plainText} /></div>
                {plainText ? <pre>{plainText}</pre> : <div className="empty-state compact"><div className="empty-icon">✓</div><p>正确的 Sign 将在这里还原为原文。</p></div>}
              </div>
            </div>
          </div>
        )}
      </section>

      <footer><span>算法</span> AES · ECB · PKCS7 <i /> 与 Portal <code>cleanTaskReport</code> 实现对齐</footer>
    </main>
  );
}
