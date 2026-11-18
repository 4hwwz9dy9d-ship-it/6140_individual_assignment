/* ============================================================
   本地开发服务器 bear-ai-backend/server.local.js
   用途：在你自己电脑上真实跑通前后端（Key 从环境变量读）。
   运行： BAILIAN_API_KEY=你的key node server.local.js
   然后浏览器打开 http://127.0.0.1:8787/index.html
   ============================================================ */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var core = require('./src/core');
var tts = require('./src/tts');

var ROOT = path.resolve(__dirname, '..');           // 项目根目录
var PORT = Number(process.env.PORT || 8787);
var ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

var MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
}

var server = http.createServer(async function (req, res) {
  var u = new URL(req.url, 'http://127.0.0.1');
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  if (u.pathname === '/api/chat' && req.method === 'POST') {
    var raw = '';
    try {
      raw = await new Promise(function (resolve, reject) {
        req.on('data', function (c) { raw += c; if (raw.length > 1e6) reject(new Error('too large')); });
        req.on('end', function () { resolve(raw); });
        req.on('error', reject);
      });
      var payload = JSON.parse(raw || '{}');
      var out = await core.handleChat(payload, clientIp(req));
      res.statusCode = out.status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify(out.body));
    } catch (e) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: '请求格式不太对' }));
    }
  }

  if (u.pathname === '/api/tts' && req.method === 'POST') {
    var traw = '';
    try {
      traw = await new Promise(function (resolve, reject) {
        req.on('data', function (c) { traw += c; if (traw.length > 1e5) reject(new Error('too large')); });
        req.on('end', function () { resolve(traw); });
        req.on('error', reject);
      });
      var tp = JSON.parse(traw || '{}');
      var buf = await tts.synthesize(tp.text || '');
      var payload = JSON.stringify({ audio: buf.toString('base64'), type: 'mp3' });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(payload));
      return res.end(payload);
    } catch (e) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: '语音合成失败' }));
    }
  }

  if (u.pathname === '/api/health') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: true, key: core.hasKey(), model: core.model, tts: true }));
  }

  // 静态文件
  var rel = decodeURIComponent(u.pathname);
  if (rel === '/' ) rel = '/index.html';
  var file = path.join(ROOT, rel.replace(/^\/+/, ''));
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end('forbidden'); }
  fs.readFile(file, function (err, data) {
    if (err) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', function () {
  console.log('小熊助手本地服务器已启动: http://127.0.0.1:' + PORT);
  console.log('API Key 已配置:', core.hasKey(), '| 模型:', core.model);
});
