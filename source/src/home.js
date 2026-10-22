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
    '@media (max-width:640px){.lp .lp-nl{display:none}}' +
    '.lp-sante>span{transition:transform .15s,box-shadow .15s}.lp-sante:hover>span{transform:translateY(-2px);box-shadow:0 14px 30px -18px #1F4E79}';   /* téléphone : seulement « Embarquer » et « Mon espace » */

  function render(root, go) {
    if (!document.getElementById('lp-css')) {
      var s = document.createElement('style'); s.id = 'lp-css'; s.textContent = CSS; document.head.appendChild(s);
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS; document.head.appendChild(l);
    }
    document.title = 'Hébreu avec Maayane · Parle, travaille, aime, vis… en hébreu';
    var img = (window.ASSETS && ASSETS.img) || {};
    var sante = location.hash === '#/sante';
    if (sante) document.title = 'Hébreu médical · médecins, dentistes, infirmiers · Hébreu avec Maayane';
    root.innerHTML = String((sante ? window.HP_SANTE_HTML : window.HP_HOME_HTML) || '').replace(/\{\{img:([\w-]+)\}\}/g, function (m, k) { return img[k] || ''; });
    Array.prototype.forEach.call(root.querySelectorAll('[data-go]'), function (b) { b.addEventListener('click', go); });
    /* liens internes (#methode…) : on fait défiler sans changer l'adresse (elle sert à la navigation du site) */
    /* les liens « #/page » changent de page ; les autres (#methode…) font défiler */
    Array.prototype.forEach.call(root.querySelectorAll('.lp a[href^="#"]:not([href^="#/"])'), function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        e.preventDefault();
        var el = id && id !== 'accueil' ? document.getElementById(id) : null;
        var smooth = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (el) el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' }); else window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
      });
    });
    /* #/embarquer, #/faq… : on arrive directement sur la bonne section */
    var m = /^#\/([\w-]+)$/.exec(location.hash), el = m && m[1] !== 'sante' ? document.getElementById(m[1]) : null;
    if (el) setTimeout(function () { el.scrollIntoView(); }, 30); else window.scrollTo(0, 0);
  }
  function page() { return location.hash === '#/sante' ? 'sante' : 'home'; }
  return { render: render, page: page };
})();
