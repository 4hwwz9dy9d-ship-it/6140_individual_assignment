/* ============================================================
   小熊伙伴 · 后端核心逻辑 bear-ai-backend/src/core.js
   被 FC 入口和本地服务器共用。API Key 只从 process.env 读取。
   ============================================================ */
'use strict';

var prompt = require('./prompt');

var API_KEY = process.env.BAILIAN_API_KEY || '';
var MODEL = process.env.BAILIAN_MODEL || 'qwen-plus';
var ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

/* ---------- 简易限流：按 IP 每分钟 N 次，防止公开接口被刷 ---------- */
var RATE_WINDOW = 60 * 1000;
var RATE_MAX = Number(process.env.RATE_LIMIT || 30);
var hits = {};
function rateOk(ip) {
  var now = Date.now();
  var arr = hits[ip] || [];
  arr = arr.filter(function (t) { return now - t < RATE_WINDOW; });
  if (arr.length >= RATE_MAX) { hits[ip] = arr; return false; }
  arr.push(now); hits[ip] = arr;
  return true;
}

/* ---------- 调用百炼 ---------- */
async function callBailian(messages) {
  if (!API_KEY) throw new Error('NO_KEY');
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 20000);
  try {
    var r = await fetch(ENDPOINT, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        max_tokens: 320,
        temperature: 0.75,
        top_p: 0.9
      })
    });
    var raw = await r.text();
    if (!r.ok) {
      var msg = raw;
      try { var j = JSON.parse(raw); msg = (j.message || j.error || raw); } catch (e) {}
      var err = new Error('UPSTREAM_' + r.status + ': ' + String(msg).slice(0, 200));
      err.status = r.status;
      throw err;
    }
    var data = JSON.parse(raw);
    var text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new Error('EMPTY_REPLY');
    return String(text).trim();
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- 统一入口：返回 {status, body} ---------- */
async function handleChat(payload, clientIp) {
  if (!rateOk(clientIp || 'unknown')) {
    return { status: 429, body: { error: '问得有点快啦，小熊需要歇一小会儿再回答哦。' } };
  }
  if (!API_KEY) {
    return { status: 503, body: { error: '小熊的大脑还没连上，请稍后再试。' } };
  }
  var p = payload || {};
  var messages = prompt.buildMessages(p.messages, p.mode, p.context);
  try {
    var reply = await callBailian(messages);
    return {
      status: 200,
      body: { reply: reply, emotion: prompt.detectEmotion(reply), model: MODEL }
    };
  } catch (e) {
    var status = e.status || 502;
    return { status: status, body: { error: '小熊刚才走神了，再说一次好不好？' } };
  }
}

module.exports = { handleChat: handleChat, hasKey: function () { return !!API_KEY; }, model: MODEL };
