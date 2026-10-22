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
    /* encadré « Spécialité » dessiné en ambulance (Magen David Adom) */
    '.lp .amb-body{position:relative;display:flex;align-items:flex-end;filter:drop-shadow(0 16px 22px rgba(31,78,121,.22))}' +
    '.lp .amb-box{position:relative;flex:1 1 auto;min-width:0;padding:30px 28px 46px;background:#FFFFFF;border:2px solid #1F4E79;border-radius:24px 8px 8px 24px}' +
    '.lp .amb-cab{flex:0 0 96px;position:relative;align-self:flex-end;height:min(60%,300px);min-height:170px;background:#FFFFFF;border:2px solid #1F4E79;border-left:0;border-radius:0 46px 14px 0}' +
    '.lp .amb-win{position:absolute;top:18px;left:10px;right:16px;height:70px;background:linear-gradient(160deg,#BFE3F0,#8CCBE0);border:2px solid #1F4E79;border-radius:6px 22px 6px 6px}' +
    '.lp .amb-door{position:absolute;top:112px;left:14px;width:10px;height:4px;border-radius:2px;background:#1F4E79}' +
    '.lp .amb-stripe{position:absolute;left:2px;right:2px;bottom:22px;height:12px;background:#D7262E;border-radius:0 0 0 2px}' +
    '.lp .amb-siren{position:absolute;top:14px;right:130px;display:flex;gap:2px}' +
    '.lp .amb-siren i{display:block;width:26px;height:18px;border:2px solid #1F4E79;border-bottom:0;border-radius:8px 8px 0 0;background:#D7262E;animation:ambBlink 1.2s steps(1) infinite}' +
    '.lp .amb-siren i+i{background:#2E7DD7;animation-delay:.6s}' +
    '@keyframes ambBlink{50%{filter:brightness(1.6)}}' +
    '.lp .amb-wheel{position:absolute;bottom:14px;width:46px;height:46px;border-radius:50%;background:#24323F;border:8px solid #4A5866;box-shadow:inset 0 0 0 7px #24323F,inset 0 0 0 14px #C9D3DB}' +
    '.lp .amb-wheel.w1{left:52px}.lp .amb-wheel.w2{right:140px}' +
    '@media (max-width:640px){.lp .amb-cab{display:none}.lp .amb-box{border-radius:22px}.lp .amb-siren{right:40px}.lp .amb-wheel.w2{right:52px}.lp .amb-box{padding:28px 20px 46px}}' +
    '@media (prefers-reduced-motion: reduce){.lp .amb-siren i{animation:none}}';   /* téléphone : seulement « Embarquer » et « Mon espace » */

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
