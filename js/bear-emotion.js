/* ============================================================
   小熊伙伴 · 情绪状态机 bear-emotion.js
   状态：idle / wave / happy / listening / thinking / speaking / comforting
   只操作 .ba-* 元素，不影响原页面
   ============================================================ */
(function (global) {
  'use strict';

  var STATES = {
    idle:       { label: '小熊在这儿陪你',      hint: '随时可以点我聊天' },
    wave:       { label: '小熊在跟你打招呼',    hint: '你好呀！' },
    happy:      { label: '小熊很开心',          hint: '太棒啦！' },
    listening:  { label: '小熊在认真听你说',    hint: '我听着呢，慢慢讲' },
    thinking:   { label: '小熊在想一想',        hint: '让我想一想哦' },
    speaking:   { label: '小熊正在说话',        hint: '小熊说话中…' },
    comforting: { label: '小熊想抱抱你',        hint: '没关系，我在这里' }
  };

  var current = 'idle';
  var listeners = [];
  var idleTimer = null;

  function apply(state, ms) {
    if (!STATES[state]) state = 'idle';
    current = state;

    // 同步到悬浮入口与面板，CSS 根据 data-state 切换表情与动画
    var fab = document.querySelector('.ba-fab');
    var panel = document.querySelector('.ba-panel');
    if (fab) fab.setAttribute('data-state', state);
    if (panel) {
      panel.setAttribute('data-state', state);
      var bar = panel.querySelector('.ba-statebar span:last-child');
      if (bar) bar.textContent = STATES[state].label;
      var status = panel.querySelector('.ba-mini-status');
      if (status) status.textContent = STATES[state].hint;
    }

    listeners.forEach(function (fn) { try { fn(state); } catch (e) {} });

    clearTimeout(idleTimer);
    if (ms && ms > 0) {
      idleTimer = setTimeout(function () { apply('idle'); }, ms);
    }
    return state;
  }

  global.BearEmotion = {
    STATES: STATES,
    get: function () { return current; },
    set: apply,
    /** 临时情绪，ms 毫秒后自动回到 idle */
    flash: function (state, ms) { return apply(state, ms || 2600); },
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); }
  };
})(window);
