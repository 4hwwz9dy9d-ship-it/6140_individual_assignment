/* ============================================================
   阿里云函数计算 FC 3.0 入口 bear-ai-backend/src/index.js
   HTTP 触发器 -> handler(req, res)。CORS 放行 GitHub Pages。
   ============================================================ */
'use strict';

var core = require('./core');
var tts = require('./tts');

var ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

function cors(res) {
  res.setHeader && res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader && res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader && res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader && res.setHeader('Cache-Control', 'no-store');
}

function clientIp(req) {
  var h = req.headers || {};
  return (h['x-forwarded-for'] || '').split(',')[0].trim()
      || h['x-real-ip'] || (req.source && req.source.ip) || 'unknown';
}

function send(res, status, obj) {
  if (res.statusCode !== undefined) res.statusCode = status;
  var body = JSON.stringify(obj);
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(body));
  }
  if (res.send) return res.send(body);
  if (res.end) return res.end(body);
  return body;
}

exports.handler = async function (req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, {});

  // 温柔语音合成（若运行环境带 Python + edge-tts 则可用，否则前端自动回退浏览器朗读）
  var url = req.url || '';
  if (url.indexOf('/api/tts') > -1 && req.method === 'POST') {
    try {
      var traw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (!req.body && req.on) {
        traw = await new Promise(function (resolve, reject) {
          var b = ''; req.on('data', function (c) { b += c; }); req.on('end', function () { resolve(b); }); req.on('error', reject);
        });
      }
      var tp = JSON.parse(traw || '{}');
      var buf = await tts.synthesize(tp.text || '');
      var body = buf.toString('base64');
      if (res.setHeader) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return send(res, 200, { audio: body, type: 'mp3' });
    } catch (e) {
      return send(res, 502, { error: '语音合成不可用' });
    }
  }

  if (req.method !== 'POST') {
    return send(res, 405, { error: '只支持 POST 请求' });
  }

  try {
    var raw = '';
    if (typeof req.body === 'string') raw = req.body;
    else if (req.body && typeof req.body === 'object') raw = JSON.stringify(req.body);
    else if (req.on) {
      // 兼容标准 IncomingMessage：读取请求体
      raw = await new Promise(function (resolve, reject) {
        var buf = '';
        req.on('data', function (c) { buf += c; if (buf.length > 1e6) { reject(new Error('too large')); } });
        req.on('end', function () { resolve(buf); });
        req.on('error', reject);
      });
    }
    var payload = JSON.parse(raw || '{}');
    var out = await core.handleChat(payload, clientIp(req));
    return send(res, out.status, out.body);
  } catch (e) {
    return send(res, 400, { error: '请求格式不太对，请重试。' });
  }
};

// 便于本地服务器直接复用同一套逻辑
exports.core = core;
