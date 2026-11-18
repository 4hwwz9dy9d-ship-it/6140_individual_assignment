/* ============================================================
   小熊伙伴 · 温柔语音合成 bear-ai-backend/src/tts.js
   调用本机 Python 的 edge-tts，用「晓晓」温暖女声现场合成 MP3。
   参数与网站预置的温柔配音完全一致（rate -12% / pitch +8Hz），
   因此任何设备听到的都是同一个温柔声音，不再随浏览器/系统变化。
   ============================================================ */
'use strict';

var cp = require('child_process');
var os = require('os');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var PY = process.env.PYTHON_BIN || 'python';
var VOICE = 'zh-CN-XiaoxiaoNeural';
var RATE = '-12%';
var PITCH = '+8Hz';

// 缓存：同样的句子不重复合成，节省时间与额度
var CACHE_MAX = 120;
var cache = new Map();

// 用 stdin 传文本，避免命令行注入；edge-tts 结果写到临时文件
var PY_SCRIPT = [
  'import sys, asyncio, edge_tts',
  'text = sys.stdin.read()',
  'out = sys.argv[1]',
  'voice, rate, pitch = sys.argv[2], sys.argv[3], sys.argv[4]',
  'async def main():',
  '    await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(out)',
  'asyncio.run(main())'
].join('\n');

function synthesize(text) {
  text = String(text || '').trim().slice(0, 500);
  if (!text) return Promise.resolve(Buffer.alloc(0));

  var key = crypto.createHash('md5').update(VOICE + '|' + RATE + '|' + PITCH + '|' + text).digest('hex');
  if (cache.has(key)) return Promise.resolve(cache.get(key));

  return new Promise(function (resolve, reject) {
    var tmp = path.join(os.tmpdir(), 'ba_tts_' + key + '.mp3');
    var child = cp.spawn(PY, ['-c', PY_SCRIPT, tmp, VOICE, RATE, PITCH], { stdio: ['pipe', 'ignore', 'pipe'] });
    var err = '';
    child.stderr.on('data', function (d) { err += d.toString(); });
    child.on('error', function (e) { reject(e); });
    child.on('close', function (code) {
      if (code !== 0) return reject(new Error('edge-tts failed: ' + err.slice(0, 200)));
      try {
        var buf = fs.readFileSync(tmp);
        fs.unlinkSync(tmp);
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
        cache.set(key, buf);
        resolve(buf);
      } catch (e) { reject(e); }
    });
    child.stdin.end(text);
  });
}

module.exports = { synthesize: synthesize, available: true };
