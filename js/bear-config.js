/* ============================================================
   小熊伙伴 · 连接配置 bear-config.js
   ⚠️ 这里绝不放 API Key。Key 只在后端服务的环境变量里。
   后端没部署时，聊天会自动降级为本地样例回复，页面照常可用。
   ============================================================ */
(function (global) {
  'use strict';

  var cfg = global.BearConfig || {};

  // 后端地址。留空 = 同源相对路径（本地调试 / 已配反向代理时）。
  // 部署到阿里云 FC 后，这里填 FC 的 HTTP 触发器公网地址，例如：
  //   apiBase: 'https://xxx.cn-hangzhou.fcapp.run'
  // 末尾不要带斜杠。
  if (typeof cfg.apiBase !== 'string') cfg.apiBase = '';

  // 接口路径
  if (typeof cfg.chatPath !== 'string') cfg.chatPath = '/api/chat';
  if (typeof cfg.healthPath !== 'string') cfg.healthPath = '/api/health';
  if (typeof cfg.ttsPath !== 'string') cfg.ttsPath = '/api/tts';

  function chatUrl() { return cfg.apiBase + cfg.chatPath; }
  function healthUrl() { return cfg.apiBase + cfg.healthPath; }

  /**
   * 调用后端要 AI 回复。
   * 成功：{ ok:true, reply, emotion }
   * 失败：{ ok:false, reason }  —— 由聊天层决定如何降级
   */
  async function ask(messages, mode, context) {
    if (!global.fetch) return { ok: false, reason: 'unsupported' };
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 25000);
    try {
      var r = await fetch(chatUrl(), {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages, mode: mode, context: context || null })
      });
      if (!r.ok) return { ok: false, reason: 'http_' + r.status };
      var data = await r.json();
      if (data && data.reply) return { ok: true, reply: data.reply, emotion: data.emotion };
      if (data && data.error) return { ok: false, reason: 'server', serverText: data.error };
      return { ok: false, reason: 'empty' };
    } catch (e) {
      return { ok: false, reason: (e && e.name === 'AbortError') ? 'timeout' : 'network' };
    } finally {
      clearTimeout(timer);
    }
  }

  /** 探测后端是否连得上（仅用于状态提示，失败不弹错） */
  async function health() {
    if (!global.fetch) return false;
    try {
      var r = await fetch(healthUrl(), { signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined });
      if (!r.ok) return false;
      var j = await r.json();
      return !!(j && j.ok && j.key);
    } catch (e) { return false; }
  }

  global.BearConfig = cfg;
  global.BearAI = {
    ask: ask,
    health: health,
    isConfigured: function () { return !!cfg.apiBase; }
  };
})(window);
