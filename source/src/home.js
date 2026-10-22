/* =====================================================================
   Page d'accueil publique — design « voyage » (cible, valises, carte d'embarquement)
   Le contenu est dans home.html (inséré par le build dans HP_HOME_HTML).
   ===================================================================== */
var HPHome = (function () {
  'use strict';
  var FONTS = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Nunito:wght@400;600;700&family=Rubik:wght@400;500&display=swap';
  /* styles du design, limités à la page d'accueil (.lp) */
  var CSS = '.lp a{color:#1F4E79}.lp a:hover{color:#163A5C}.lp summary{cursor:pointer}.lp img{max-width:100%}' +
    '@keyframes arrowFly{0%{transform:translate(-300px,-173px);opacity:0}4%{opacity:1}16%{transform:translate(0,0)}88%{transform:translate(0,0);opacity:1}96%,100%{transform:translate(0,0);opacity:0}}' +
    '@keyframes arrowWobble{0%,16%{transform:rotate(0)}19%{transform:rotate(-3deg)}22%{transform:rotate(2deg)}25%{transform:rotate(-1deg)}28%,100%{transform:rotate(0)}}' +
    '@keyframes hitRing{0%,15%{transform:scale(1);opacity:0}16%{opacity:1}32%,100%{transform:scale(1.9);opacity:0}}' +
    '.lp .arrow-fly{animation:arrowFly 7s cubic-bezier(.25,.8,.3,1) infinite}' +
    '.lp .arrow-wobble{transform-box:view-box;transform-origin:240px 220px;animation:arrowWobble 7s ease-out infinite}' +
    '.lp .hit-ring{transform-box:fill-box;transform-origin:center;opacity:0;animation:hitRing 7s ease-out infinite}' +
    '@media (prefers-reduced-motion: reduce){.lp .arrow-fly,.lp .arrow-wobble,.lp .hit-ring{animation:none}}' +
    '@media (max-width:640px){.lp .lp-nl{display:none}}';   /* téléphone : seulement « Embarquer » et « Mon espace » */

  function render(root, go) {
    if (!document.getElementById('lp-css')) {
      var s = document.createElement('style'); s.id = 'lp-css'; s.textContent = CSS; document.head.appendChild(s);
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS; document.head.appendChild(l);
    }
    document.title = 'Hébreu avec Maayane · Parle, travaille, aime, vis… en hébreu';
    var img = (window.ASSETS && ASSETS.img) || {};
    root.innerHTML = String(window.HP_HOME_HTML || '').replace(/\{\{img:([\w-]+)\}\}/g, function (m, k) { return img[k] || ''; });
    Array.prototype.forEach.call(root.querySelectorAll('[data-go]'), function (b) { b.addEventListener('click', go); });
    /* liens internes (#methode…) : on fait défiler sans changer l'adresse (elle sert à la navigation du site) */
    Array.prototype.forEach.call(root.querySelectorAll('.lp a[href^="#"]'), function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        e.preventDefault();
        var el = id && id !== 'accueil' ? document.getElementById(id) : null;
        var smooth = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (el) el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' }); else window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
      });
    });
    window.scrollTo(0, 0);
  }
  return { render: render };
})();
