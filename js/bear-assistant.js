/* ============================================================
   小熊伙伴 · 主控 bear-assistant.js
   以最小侵入方式注入悬浮入口 + 聊天面板，初始化各模块。
   加载顺序：emotion → voice → ar-context → chat → assistant
   ============================================================ */
(function (global) {
  'use strict';

  var IMG = 'assets/bear/bear-idle.webp';

  /* 状态表情层：叠在小熊图片上，SVG 坐标对应裁剪后的 841×822 图片 */
  var FACE_SVG = '' +
    '<svg class="ba-face" viewBox="0 0 841 822" aria-hidden="true">' +
      '<g class="f-wave"><path d="M118 596 q-34 -30 -52 -6" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>' +
        '<path d="M118 596 q-34 -30 -52 -6" fill="none" stroke="#e0a56d" stroke-width="4" stroke-linecap="round"/>' +
        '<text x="42" y="560" font-size="52">👋</text></g>' +
      '<g class="f-happy"><path d="M265 326 q30 -30 62 0" fill="none" stroke="#5b3a26" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M518 326 q30 -30 62 0" fill="none" stroke="#5b3a26" stroke-width="7" stroke-linecap="round"/>' +
        '<ellipse cx="228" cy="378" rx="28" ry="14" fill="#ff9b82" opacity=".4"/>' +
        '<ellipse cx="616" cy="378" rx="28" ry="14" fill="#ff9b82" opacity=".4"/></g>' +
      '<g class="f-listen"><path d="M196 292 q-26 34 0 68" fill="none" stroke="#5db4dd" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M170 274 q-40 52 0 104" fill="none" stroke="#7fd8be" stroke-width="6" stroke-linecap="round"/>' +
        '<path d="M648 292 q26 34 0 68" fill="none" stroke="#5db4dd" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M674 274 q40 52 0 104" fill="none" stroke="#7fd8be" stroke-width="6" stroke-linecap="round"/></g>' +
      '<g class="f-think"><circle cx="668" cy="176" r="14" fill="#fff" stroke="#a78bfa" stroke-width="3"/>' +
        '<circle cx="714" cy="132" r="20" fill="#fff" stroke="#a78bfa" stroke-width="3"/>' +
        '<circle cx="770" cy="86" r="28" fill="#fff" stroke="#a78bfa" stroke-width="3"/>' +
        '<text x="770" y="98" font-size="30" text-anchor="middle" fill="#7c5cc4" font-weight="800">?</text></g>' +
      '<g class="f-speak"><ellipse cx="420" cy="500" rx="30" ry="20" fill="#8c4a3c" stroke="#fff" stroke-width="3"/>' +
        '<path d="M392 470 q28 -12 56 0" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M330 478 q-24 26 0 52" fill="none" stroke="#ff8a70" stroke-width="6" stroke-linecap="round"/>' +
        '<path d="M512 478 q24 26 0 52" fill="none" stroke="#ff8a70" stroke-width="6" stroke-linecap="round"/></g>' +
      '<g class="f-comfort"><path d="M660 420 c-16 -22 -48 -10 -48 16 0 22 30 40 48 56 18 -16 48 -34 48 -56 0 -26 -32 -38 -48 -16z" fill="#ff8a70" opacity=".92"/>' +
        '<path d="M280 328 q30 -24 60 0" fill="none" stroke="#5b3a26" stroke-width="6" stroke-linecap="round"/>' +
        '<path d="M504 328 q30 -24 60 0" fill="none" stroke="#5b3a26" stroke-width="6" stroke-linecap="round"/></g>' +
    '</svg>';

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function build() {
    var root = el('div', 'ba-root');
    root.id = 'baRoot';

    // 悬浮入口
    var fab = el('button', 'ba-fab');
    fab.type = 'button';
    fab.setAttribute('aria-label', '打开小熊伙伴聊天');
    fab.setAttribute('data-state', 'idle');
    var ring = el('span', 'ba-fab-ring');
    var img = document.createElement('img');
    img.src = IMG; img.alt = '小熊伙伴';
    fab.appendChild(ring); fab.appendChild(img); fab.insertAdjacentHTML('beforeend', FACE_SVG);
    fab.appendChild(el('span', 'ba-fab-dot'));

    // 首次提示
    var hint = el('div', 'ba-hint');
    hint.innerHTML = '你好呀！我是<b>小熊</b>，有什么问题可以点击这里找我聊天哦！';

    // 面板
    var panel = el('section', 'ba-panel');
    panel.setAttribute('aria-label', '小熊伙伴聊天窗口');
    panel.setAttribute('data-state', 'idle');

    var head = el('div', 'ba-head');
    var mini = el('div', 'ba-mini');
    var miniImg = document.createElement('img'); miniImg.src = IMG; miniImg.alt = '';
    mini.appendChild(miniImg);
    var title = el('div', 'ba-title');
    title.innerHTML = '<b>小熊伙伴 <span style="font-size:10px;color:#a04a33">AI 版</span></b>' +
      '<span class="ba-mini-status">正在连接……</span>';
    var spacer = el('div', 'ba-spacer');
    var closeBtn = el('button', 'ba-icon-btn ba-close', '✕');
    closeBtn.type = 'button'; closeBtn.setAttribute('aria-label', '关闭聊天窗口');
    head.appendChild(mini); head.appendChild(title); head.appendChild(spacer); head.appendChild(closeBtn);

    var modes = el('div', 'ba-modes');
    modes.innerHTML = '<button type="button" data-mode="child" class="on">🧸 儿童模式</button>' +
                      '<button type="button" data-mode="parent">👨‍👩‍👧 家长模式</button>';

    var statebar = el('div', 'ba-statebar');
    statebar.innerHTML = '<span class="ba-pulse"></span><span>小熊在这儿陪你</span>';

    var msgs = el('div', 'ba-msgs');
    var quick = el('div', 'ba-quick');
    var tools = el('div', 'ba-tools');
    tools.innerHTML =
      '<button type="button" data-act="mood">😊 情绪</button>' +
      '<button type="button" data-act="breath">🌬️ 呼吸练习</button>' +
      '<button type="button" data-act="speak">🔊 播放</button>' +
      '<button type="button" class="ba-clear">🧹 清空</button>';

    var inputRow = el('div', 'ba-inputrow');
    inputRow.innerHTML =
      '<button type="button" class="ba-mic" aria-label="语音输入">🎤</button>' +
      '<input class="ba-input" type="text" maxlength="200" placeholder="想问小熊什么？" aria-label="输入问题">' +
      '<button type="button" class="ba-send" aria-label="发送">➤</button>';

    // 覆盖层
    var mood = el('div', 'ba-overlay');
    mood.id = 'baOverlayMood';
    mood.innerHTML = '<button type="button" class="ba-close-over" aria-label="返回">✕</button>' +
      '<h3>今天心情怎么样呀？</h3><p>点一个告诉小熊，小熊会陪着你。</p>' +
      '<div class="ba-moods">' +
      ['开心','平静','紧张','难过','生气','困困'].map(function (m, i) {
        var em = ['😄','😌','😰','😢','😠','😴'][i];
        return '<button type="button" data-mood="' + m + '"><span>' + em + '</span>' + m + '</button>';
      }).join('') + '</div>';

    var breath = el('div', 'ba-overlay');
    breath.id = 'baOverlayBreath';
    breath.innerHTML = '<button type="button" class="ba-close-over" aria-label="返回">✕</button>' +
      '<h3>和小熊一起呼吸</h3>' +
      '<div class="ba-breath-circle"><span>吸气</span><small>1 · 2 · 3</small></div>' +
      '<p>圆圈变大就慢慢吸气，变小就慢慢呼出来。<br>做三次，身体会放松一点点。</p>';

    panel.appendChild(head); panel.appendChild(modes); panel.appendChild(statebar);
    panel.appendChild(msgs); panel.appendChild(quick); panel.appendChild(tools);
    panel.appendChild(inputRow); panel.appendChild(mood); panel.appendChild(breath);

    root.appendChild(fab); root.appendChild(hint); root.appendChild(panel);
    document.body.appendChild(root);
    return root;
  }

  function init() {
    if (document.getElementById('baRoot')) return;
    var ctx = global.BearARContext ? global.BearARContext.detect() : null;
    // ar 页：桌面端让入口靠近 AR 手册演示区，不遮挡插画
    if (ctx && ctx.page === 'ar') document.body.classList.add('ba-on-ar');

    var root = build();
    var fab = root.querySelector('.ba-fab');
    var panel = root.querySelector('.ba-panel');
    var hint = root.querySelector('.ba-hint');

    if (global.BearChat) global.BearChat.init(root);

    fab.addEventListener('click', function () {
      var open = panel.classList.toggle('open');
      hint.classList.remove('show');
      if (open) {
        global.BearEmotion.flash('wave', 1800);
        var inp = panel.querySelector('.ba-input');
        setTimeout(function () { try { inp.focus(); } catch (e) {} }, 200);
      }
    });
    panel.querySelector('.ba-close').addEventListener('click', function () {
      panel.classList.remove('open');
      global.BearVoice.stopSpeak();
      global.BearVoice.stopListen();
      if (global.BearChat && global.BearChat.setSpeakBtn) global.BearChat.setSpeakBtn('idle');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { panel.classList.remove('open'); }
    });

    // 首次进入显示气泡，几秒后自动收起（用会话存储避免每次刷新都弹）
    var shown = false;
    try { shown = sessionStorage.getItem('baHintShown') === '1'; } catch (e) {}
    if (!shown) {
      setTimeout(function () { hint.classList.add('show'); }, 900);
      setTimeout(function () {
        hint.classList.remove('show');
        try { sessionStorage.setItem('baHintShown', '1'); } catch (e) {}
      }, 6500);
    }

    global.BearAssistant = {
      open: function () { panel.classList.add('open'); hint.classList.remove('show'); },
      close: function () { panel.classList.remove('open'); },
      root: root,
      panel: panel,
      context: ctx
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
