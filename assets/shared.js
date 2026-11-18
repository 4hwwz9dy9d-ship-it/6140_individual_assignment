/* 共享交互脚本：进度条 / 返回顶部 / 导航高亮 / 揭示动画 */
(function(){
  var progressBar = document.getElementById('progressBar');
  var backTop = document.getElementById('backTop');
  window.addEventListener('scroll', function(){
    var scrollTop = window.scrollY;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar) progressBar.style.width = (docHeight > 0 ? (scrollTop / docHeight) * 100 : 0) + '%';
    if (backTop){ if (scrollTop > 400) backTop.classList.add('show'); else backTop.classList.remove('show'); }
  });
  if (backTop) backTop.addEventListener('click', function(){ window.scrollTo({top:0, behavior:'smooth'}); });

  // 导航高亮
  var here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(function(a){
    var href = a.getAttribute('href');
    if (href === here || (here === '' && href === 'index.html')) a.classList.add('active');
  });

  // 揭示动画
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, {threshold:.12});
  document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
})();
