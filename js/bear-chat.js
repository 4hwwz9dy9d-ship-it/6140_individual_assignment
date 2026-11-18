/* ============================================================
   小熊伙伴 · 聊天 UI bear-chat.js
   优先走后端真实 AI（百炼），后端不可用时自动降级为本地样例回复。
   医疗安全护栏在服务端 system prompt 里，前端无法绕过。
   ============================================================ */
(function (global) {
  'use strict';

  var panel, msgs, input, quickBox, modeBtns, overlayMood, overlayBreath, mode = 'child';
  var breathTimer = null;
  var breathStep = 0;
  var history = [];          // 会话上下文（只存内存，不落盘、不上传）
  var online = false;        // 后端是否可用
  var busy = false;
  var typeTimers = [];       // 正在运行的打字机定时器，切换模式/清空时统一取消
  var sessionToken = 0;      // 会话代次：切换模式/清空后，旧请求结果作废

  var QUICK = {
    child: ['手术那天会怎样？', '我害怕怎么办？', '为什么要禁食呀？', '能带玩具吗？'],
    parent: ['术前禁食怎么做？', '孩子害怕怎么安抚？', '流程大概多久？', '术后要注意什么？']
  };

  /* —— 降级样例回复：仅在后端连不上时使用，界面会明确标注 —— */
  var TEST_REPLIES = {
    child: [
      { k: ['害怕', '紧张', '哭', '不想'], a: '害怕很正常呀。小熊陪你先做三次深呼吸：吸气——慢慢呼出来。也可以点下面的「呼吸练习」一起做。真正担心的事，一定要告诉爸爸妈妈和医生哦。', e: 'comforting' },
      { k: ['禁食', '吃东西', '吃饭', '饿'], a: '手术前要暂时让小肚子空下来，这样麻醉才安全。具体从几点开始不吃不喝，要听医生和护士的安排，小熊不能替他们决定哦。', e: 'thinking' },
      { k: ['疼', '痛', '麻药'], a: '医生会用办法让你舒服一些，有不舒服要马上告诉大人。小熊答应你，有什么不懂的都可以问我，也可以问医生。', e: 'comforting' },
      { k: ['玩具', '玩偶', '带走'], a: '可以问问护士阿姨能不能带上你最喜欢的玩具，很多医院都允许带一个小伙伴陪你呢。', e: 'happy' },
      { k: ['你好', 'hi', 'hello', '是谁'], a: '你好呀！我是小熊，陪你认识身体、认识手术。你现在在看哪一页呀？', e: 'wave' },
      { k: ['器官', '心脏', '胃', '喉咙', '肺', '大脑', '肚子'], a: '你正在看的这个部位很重要哦。点一点画面上的小圆点，我会告诉你它叫什么、在哪里、医生为什么会讲到它。', e: 'happy' },
      { k: ['手术', '流程', '那天'], a: '手术那天大概是这样：先核对名字、换好衣服，然后麻醉、手术、苏醒。每一步都有医生和护士陪着你。想看动画的话，去「AR 手册」页看那一段小视频吧。', e: 'thinking' },
      { k: ['妈妈', '爸爸', '家长'], a: '爸爸妈妈会一直在你身边。要是你有问题不敢说，也可以让小熊帮你把问题写下来给医生看。', e: 'comforting' }
    ],
    parent: [
      { k: ['禁食', '不吃', '喝水', '几点'], a: '页面里有「禁食时间计算器」，按手术时间倒推即可。但请务必以所在医院下发的禁食通知为准——本页内容不能替代医嘱。', e: 'thinking' },
      { k: ['害怕', '安抚', '焦虑', '情绪'], a: '可以先用孩子能听懂的比喻讲流程，让孩子亲手点一点器官模型；回答不了的问题就一起记下来问医生。避免用"不疼""没事"这类承诺。', e: 'comforting' },
      { k: ['多久', '时间', '流程'], a: 'AR 手册里有 30 秒演示动画和六步流程。实际时间因术式和医院安排差异很大，请以病区通知为准。', e: 'thinking' },
      { k: ['术后', '护理', '恢复'], a: '家长专区有术后护理和 7 项准备清单。具体用药、饮食恢复与复查安排，请严格遵从主刀和麻醉团队。', e: 'thinking' },
      { k: ['你好', 'hi', 'hello'], a: '您好，我是小熊助手。目前未能连接 AI 服务，先由本地样例为您解答，请以医护告知为准。', e: 'wave' }
    ]
  };
  var FALLBACK = {
    child: '这个问题小熊还想再学一学。不如我们一起去「AR 手册」看看？如果很担心，记得告诉爸爸妈妈和医生哦。',
    parent: '这个问题超出可回答范围。本页内容不能替代医护告知，请向主刀或麻醉团队确认。'
  };

  var MOOD_REPLY = {
   开心: '太好啦！小熊也替你开心！',
   平静: '平静的时候最适合认识新东西，我们慢慢来。',
   紧张: '紧张很正常。来，和我一起做三次深呼吸好不好？',
   难过: '小熊想抱抱你。难过可以说出来，大人会帮你。',
   生气: '生气也可以说出来。你愿意告诉小熊是为什么吗？',
   困困: '那就先休息一下吧，小熊一直在这儿。'
  };

  function now() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /* 真正要朗读的纯文字：去掉标签、时间、表情，和 bear-voice 的 clean 保持一致 */
  function speakable(text) {
    return (global.BearVoice && global.BearVoice.clean)
      ? global.BearVoice.clean(text)
      : String(text || '').trim();
  }

  function removeTimer(t) {
    var i = typeTimers.indexOf(t);
    if (i > -1) typeTimers.splice(i, 1);
  }

  /* 打字机逐字出现；结束后回调（用于自动朗读） */
  function typeInto(node, text, done) {
    var i = 0, len = text.length;
    var stepMs = len > 140 ? 10 : (len > 70 ? 14 : 20);
    var timer = setInterval(function () {
      i += 1;
      node.textContent = text.slice(0, i);
      msgs.scrollTop = msgs.scrollHeight;
      if (i >= len) { clearInterval(timer); removeTimer(timer); if (done) done(); }
    }, stepMs);
    typeTimers.push(timer);
  }

  /* 小熊自动朗读：先停掉上一条，再念纯文字，避免叠音 */
  function autoSpeak(text) {
    var pure = speakable(text);
    if (!pure) return;
    if (global.BearVoice) {
      global.BearVoice.stopSpeak();
      function done() {
        if (global.BearChat && global.BearChat.setSpeakBtn) global.BearChat.setSpeakBtn('idle');
        global.BearEmotion.flash('idle', 900);
      }
      var ok = global.BearVoice.speak(pure, done);
      if (ok) {
        if (global.BearChat && global.BearChat.setSpeakBtn) global.BearChat.setSpeakBtn('playing');
        global.BearEmotion.flash('speaking', Math.min(8000, 2000 + pure.length * 90));
      }
    }
  }

  function addMessage(text, who, opts) {
    opts = opts || {};
    var wrap = document.createElement('div');
    wrap.className = 'ba-msg' + (who === 'mine' ? ' mine' : '');
    var av = document.createElement('div'); av.className = 'ba-av';
    var img = document.createElement('img');
    img.src = 'assets/bear/bear-idle.webp'; img.alt = ''; av.appendChild(img);
    var bub = document.createElement('div'); bub.className = 'ba-bubble';
    if (who !== 'mine' && opts.tag) {
      var tag = document.createElement('span'); tag.className = 'ba-tag';
      tag.textContent = opts.tag;
      bub.appendChild(tag);
      bub.appendChild(document.createElement('br'));
    }
    var t = document.createElement('span'); t.className = 'ba-bubble-text'; bub.appendChild(t);
    var time = document.createElement('span'); time.className = 'ba-time'; time.textContent = now(); bub.appendChild(time);
    wrap.appendChild(av); wrap.appendChild(bub);
    msgs.appendChild(wrap);
    wrap._pureText = speakable(text);   // 只存纯文字，朗读按钮/自动朗读都用它
    wrap._who = who;
    if (opts.typewriter && who !== 'mine') {
      typeInto(t, String(text || ''), opts.onDone);   // 画面保留原文/表情，朗读只用纯文字
    } else {
      t.textContent = text;
      if (opts.onDone) opts.onDone();
    }
    msgs.scrollTop = msgs.scrollHeight;
    return wrap;
  }

  function setStatus(text) {
    var s = panel && panel.querySelector('.ba-statebar span:last-child');
    if (s) s.textContent = text;
  }

  function localReply(text) {
    var list = TEST_REPLIES[mode] || TEST_REPLIES.child;
    var lower = String(text).toLowerCase();
    var found = null;
    for (var i = 0; i < list.length; i++) {
      for (var j = 0; j < list[i].k.length; j++) {
        if (lower.indexOf(list[i].k[j].toLowerCase()) > -1) { found = list[i]; break; }
      }
      if (found) break;
    }
    return { text: found ? found.a : FALLBACK[mode], emotion: found ? found.e : 'thinking' };
  }

  function pageContext() {
    var ctx = (global.BearAssistant && global.BearAssistant.context) || {};
    return { page: ctx.page || '', organ: ctx.organ || '' };
  }

  /* —— 核心回复：真实 AI 优先，失败降级 —— */
  async function reply(text) {
    if (busy) return;
    busy = true;
    var myToken = sessionToken;   // 记录本次请求代次
    // 发新问题先停掉上一条朗读，避免旧语音和新回复叠音
    if (global.BearVoice) global.BearVoice.stopSpeak();
    if (global.BearChat && global.BearChat.setSpeakBtn) global.BearChat.setSpeakBtn('idle');
    global.BearEmotion.set('thinking');
    setStatus('小熊正在认真想……');

    // 追加到会话历史
    history.push({ role: 'user', content: String(text).slice(0, 2000) });
    if (history.length > 12) history = history.slice(-12);

    var AI = global.BearAI;
    if (AI && online) {
      var res = await AI.ask(history.slice(), mode, pageContext());
      if (myToken !== sessionToken) return;   // 期间切换了模式/清空，丢弃旧结果
      if (res.ok) {
        history.push({ role: 'assistant', content: res.reply });
        addMessage(res.reply, 'bear', {
          tag: 'AI 生成 · 请以医护告知为准',
          typewriter: true,
          onDone: function () { autoSpeak(res.reply); }
        });
        global.BearEmotion.flash(res.emotion || 'idle', 2800);
        setStatus('小熊在线 · 随时可以问我');
        busy = false;
        return;
      }
      // 后端调用失败：自动降级
      addMessage('（网络开小差了，先用离线小知识回答你）', 'bear', { tag: '离线样例 · 非实时 AI' });
    }

    // 本地样例降级
    var l = localReply(text);
    setTimeout(function () {
      if (myToken !== sessionToken) return;   // 期间切换了模式/清空，丢弃旧结果
      addMessage(l.text, 'bear', {
        tag: '离线样例 · 非实时 AI',
        typewriter: true,
        onDone: function () { autoSpeak(l.text); }
      });
      global.BearEmotion.flash(l.emotion, 2400);
      setStatus('离线样例模式 · 如需真实 AI 请配置后端');
      busy = false;
    }, 420);
  }

  function send() {
    var v = input.value.trim();
    if (!v || busy) { if (!v) input.focus(); return; }
    addMessage(v, 'mine');
    input.value = '';
    reply(v);
  }

  function renderQuick() {
    quickBox.innerHTML = '';
    QUICK[mode].forEach(function (q) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = q;
      b.addEventListener('click', function () {
        if (busy) return;
        addMessage(q, 'mine'); reply(q);
      });
      quickBox.appendChild(b);
    });
  }

  function setMode(m, opts) {
    opts = opts || {};
    var next = (m === 'parent') ? 'parent' : 'child';
    var changed = (next !== mode);
    mode = next;
    document.body.setAttribute('data-ba-mode', mode);
    modeBtns.forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === mode); });
    renderQuick();
    // 真正切换模式时：清空聊天窗口和上下文，给一句新模式的问候
    if (changed && !opts.keepChat) {
      clearChatContent();
      var hello = (mode === 'parent')
        ? '您好，我是小熊助手。家长模式会给您更专业、简洁的说明，请问想了解什么？'
        : '你好呀！我是小熊，有什么问题可以问我。';
      addMessage(hello, 'bear', { tag: '小熊的问候' });
    }
    if (!opts.quiet) global.BearEmotion.flash(mode === 'parent' ? 'thinking' : 'wave', 1600);
  }

  function clearChatContent() {
    sessionToken++;              // 让进行中的请求作废
    typeTimers.forEach(function (t) { clearInterval(t); });
    typeTimers = [];
    if (global.BearVoice) global.BearVoice.stopSpeak();
    msgs.innerHTML = '';
    history = [];
    busy = false;
    setStatus(mode === 'parent' ? '家长模式 · 小熊在线' : '小熊在这儿陪你');
  }

  function clearChat() {
    clearChatContent();
    global.BearEmotion.flash('wave', 1500);
  }

  function openMood() {
    overlayMood.classList.add('show');
    global.BearEmotion.set('listening');
  }

  function chooseMood(m) {
    overlayMood.classList.remove('show');
    addMessage('我现在的心情是：' + m, 'mine');
    var replyText = MOOD_REPLY[m] || '谢谢你告诉我，小熊听见啦。';
    addMessage(replyText, 'bear', {
      tag: '小熊的回应',
      typewriter: true,
      onDone: function () { autoSpeak(replyText); }
    });
    global.BearEmotion.flash(m === '开心' ? 'happy' : 'comforting', 2800);
  }

  function openBreath() {
    overlayBreath.classList.add('show');
    global.BearEmotion.set('comforting');
    breathStep = 0;
    var circle = overlayBreath.querySelector('.ba-breath-circle');
    var label = circle.querySelector('span');
    var sub = circle.querySelector('small');
    function step() {
      var phase = breathStep % 2;
      if (phase === 0) {
        circle.classList.add('inhale'); circle.classList.remove('exhale');
        label.textContent = '吸气'; sub.textContent = '1 · 2 · 3';
      } else {
        circle.classList.add('exhale'); circle.classList.remove('inhale');
        label.textContent = '慢慢呼出来'; sub.textContent = '呼——';
      }
      breathStep++;
      breathTimer = setTimeout(step, 3200);
    }
    clearTimeout(breathTimer); step();
  }

  function closeOverlays() {
    overlayMood.classList.remove('show');
    overlayBreath.classList.remove('show');
    clearTimeout(breathTimer);
    global.BearEmotion.flash('idle', 1200);
  }

  function init(root) {
    panel = root.querySelector('.ba-panel');
    msgs = root.querySelector('.ba-msgs');
    input = root.querySelector('.ba-input');
    quickBox = root.querySelector('.ba-quick');
    modeBtns = Array.prototype.slice.call(root.querySelectorAll('.ba-modes button'));
    overlayMood = root.querySelector('#baOverlayMood');
    overlayBreath = root.querySelector('#baOverlayBreath');

    root.querySelector('.ba-send').addEventListener('click', send);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
    modeBtns.forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
    });
    root.querySelector('.ba-clear').addEventListener('click', clearChat);
    root.querySelector('[data-act="mood"]').addEventListener('click', openMood);
    root.querySelector('[data-act="breath"]').addEventListener('click', openBreath);
    Array.prototype.forEach.call(root.querySelectorAll('.ba-close-over'), function (b) {
      b.addEventListener('click', closeOverlays);
    });
    Array.prototype.forEach.call(root.querySelectorAll('.ba-moods button'), function (b) {
      b.addEventListener('click', function () { chooseMood(b.getAttribute('data-mood')); });
    });

    // 播放 / 静音按钮：再点一次同一段就静音，避免重复朗读叠音
    var speakBtn = root.querySelector('[data-act="speak"]');
    function setSpeakBtn(state) {
      speakBtn.classList.toggle('playing', state === 'playing');
      speakBtn.innerHTML = state === 'playing' ? '⏸ 停止' : '🔊 播放';
    }
    global.BearChat.setSpeakBtn = setSpeakBtn;
    speakBtn.addEventListener('click', function () {
      var list = msgs.querySelectorAll('.ba-msg:not(.mine)');
      var last = list[list.length - 1];
      var text = (last && last._pureText) || '';
      if (!text) {
        global.BearEmotion.flash('thinking', 1400);
        addMessage('还没有可以朗读的回复，先问我一个问题吧。', 'bear', { tag: '小熊的回应' });
        return;
      }
      var r = global.BearVoice.toggleSpeak(text, function () {
        setSpeakBtn('idle'); global.BearEmotion.flash('idle', 1000);
      });
      if (r === 'stopped') { setSpeakBtn('idle'); global.BearEmotion.flash('idle', 800); }
      else { setSpeakBtn('playing'); global.BearEmotion.flash('speaking', 6000); }
    });

    // 语音输入（浏览器识别）
    root.querySelector('.ba-mic').addEventListener('click', function () {
      var btn = this;
      if (global.BearVoice.isListening()) { global.BearVoice.stopListen(); return; }
      var ok = global.BearVoice.startListen({
        onResult: function (t) {
          if (!t || busy) return;
          input.value = t;
          addMessage(t, 'mine');
          reply(t);
        },
        onError: function () {
          addMessage('这个浏览器暂时不支持语音输入，可以直接打字告诉我哦。', 'bear', { tag: '小熊的回应' });
          global.BearEmotion.flash('thinking', 1800);
        }
      });
      if (ok) {
        btn.classList.add('rec');
        global.BearEmotion.set('listening');
        setTimeout(function () { btn.classList.remove('rec'); }, 6000);
      }
    });

    setMode('child', { quiet: true });
    addMessage('你好呀！我是小熊，有什么问题可以问我。', 'bear', { tag: '小熊的问候' });
    global.BearEmotion.flash('wave', 2600);

    // 探测后端；成功则标记在线，否则保持离线样例模式
    if (global.BearAI && global.BearAI.health) {
      global.BearAI.health().then(function (ok) {
        online = ok;
        var tag = panel.querySelector('.ba-title .ba-mini-status');
        if (ok) {
          setStatus('小熊在线 · 随时可以问我');
          if (tag) tag.textContent = 'AI 小熊 · 在线';
          var badge = panel.querySelector('.ba-title b span');
          if (badge) badge.textContent = 'AI 版';
        } else {
          setStatus('离线样例模式 · 如需真实 AI 请配置后端');
          if (tag) tag.textContent = '离线样例 · 可正常浏览';
        }
      });
    }
  }

  global.BearChat = { init: init, addMessage: addMessage, setMode: setMode, send: send };
})(window);
