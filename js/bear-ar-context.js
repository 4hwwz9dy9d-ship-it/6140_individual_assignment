/* ============================================================
   小熊伙伴 · AR 手册上下文 bear-ar-context.js
   只读当前页面已经存在的 DOM，不改动任何原页面逻辑。
   用于让「小熊」知道孩子现在在看哪个器官、哪一页，
   为第二轮轻量 RAG 预留接口。
   ============================================================ */
(function (global) {
  'use strict';

  var DEFAULT = {
    page: 'index',
    pageName: '首页',
    organ: null,
    organName: null,
    mode: 'child'
  };

  function detectPage() {
    var p = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (p.indexOf('kid') > -1) return 'kid';
    if (p.indexOf('parent') > -1) return 'parent';
    if (p.indexOf('ar') > -1) return 'ar';
    return 'index';
  }

  var PAGE_NAMES = { index: '首页', kid: '小朋友探险页', parent: '家长专区', ar: 'AR 手册' };
  var ORGAN_NAMES = {
    brain:'大脑', throat:'小喉咙', lungs:'肺', heart:'心脏',
    stomach:'胃', tummy:'小肚子', intestine:'肠道'
  };

  function detect() {
    var ctx = {
      page: detectPage(),
      pageName: PAGE_NAMES[detectPage()],
      organ: null,
      organName: null,
      mode: document.body.getAttribute('data-ba-mode') === 'parent' ? 'parent' : 'child'
    };

    // ar.html：读取当前选中的器官按钮
    var on = document.querySelector('#simOrgans button.on');
    if (!on) on = document.querySelector('.sim-overlay .org.on');
    if (on) {
      var k = on.getAttribute('data-o');
      if (k && ORGAN_NAMES[k]) { ctx.organ = k; ctx.organName = ORGAN_NAMES[k]; }
    }

    // kid.html：读取高亮的身体部位（若有）
    var hot = document.querySelector('.body-dots .on, [data-organ].on, .organ-card:not([style*="none"])');
    if (!ctx.organ && hot) {
      var ok = hot.getAttribute('data-organ') || hot.getAttribute('data-o');
      if (ok && ORGAN_NAMES[ok]) { ctx.organ = ok; ctx.organName = ORGAN_NAMES[ok]; }
    }

    // 也接受页面主动广播
    if (global.BearContextOverride) {
      var o = global.BearContextOverride();
      if (o && typeof o === 'object') {
        for (var k2 in o) if (Object.prototype.hasOwnProperty.call(o, k2)) ctx[k2] = o[k2];
      }
    }
    return ctx;
  }

  /** 生成给Reply/未来 RAG 用的上下文提示（不发给任何服务器） */
  function hint(ctx) {
    ctx = ctx || detect();
    var s = '当前页面：' + ctx.pageName;
    if (ctx.organName) s += '；正在看：' + ctx.organName;
    if (ctx.mode === 'parent') s += '；家长模式';
    return s;
  }

  global.BearARContext = { detect: detect, hint: hint, ORGAN_NAMES: ORGAN_NAMES, DEFAULT: DEFAULT };
})(window);
