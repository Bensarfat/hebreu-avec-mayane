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

  /* ---------- test de niveau (#/test) : 15 questions, sans nikoud ---------- */
  var TEST = [
    ['Décollage', '___ רופא או אח?', ['אתה', 'את', 'היא']],
    ['Décollage', '- מאין אתה?\n- אני ___ צרפת.', ['מ...', 'ב...', 'ל...']],
    ['Décollage', 'הספר ___ על השולחן.', ['נמצא', 'נמצאת', 'נמצאים']],
    ['Décollage', '- איפה ___ גרים?\n- אנחנו גרים בחיפה.', ['אתם', 'אנחנו', 'הם']],
    ['Décollage', 'זאת ___ שלי, רותי.', ['חברה', 'חבר', 'חברים']],
    ['Décollage', 'יש לי שני ___.', ['ילדים', 'ילד', 'ילדות']],
    ['Décollage', '- אתה רוצה קפה?\n- לא, תודה. אני לא ___ קפה.', ['שותה', 'אוכל', 'קורא']],
    ['Décollage', 'הם ___ בבנק.', ['עובדים', 'עובד', 'עובדת']],
    ['Décollage', 'המשפחה שלי גרה ___ ירושלים.', ['ב...', 'מ...', 'את']],
    ['Décollage', '- כמה זה עולה?\n- עשרים ___.', ['שקלים', 'שקל', 'שקלה']],
    ['En vol', 'אתמול ___ סרט בקולנוע.', ['ראיתי', 'רואה', 'אראה']],
    ['En vol', 'בשבוע הבא הם ___ לאילת.', ['ייסעו', 'נסעו', 'נסענו']],
    ['En vol', 'הילדים ___ בגן כל בוקר.', ['משחקים', 'שיחקה', 'תשחק']],
    ['En vol', 'אני צריך ___ לרופא.', ['ללכת', 'הולך', 'הלכתי']],
    ['En vol', 'החדר הזה ___ מדי.', ['קטן', 'קטנה', 'קטנים']],
    ['En vol', '- למה לא באת?\n- כי ___ חולה.', ['הייתי', 'היה', 'תהיה']],
    ['En vol', 'אני מחכה ___ אוטובוס כבר חצי שעה.', ['ל...', 'את', 'על']],
    ['En vol', 'הבית ___ ההורים שלי ליד הים.', ['של', 'את', 'עם']],
    ['En vol', 'היא ___ עברית כבר שנתיים.', ['לומדת', 'למדה', 'תלמד']],
    ['En vol', '___ אתה לא עונה לטלפון?', ['למה', 'מה', 'מי']],
    ['Atterrissage', 'הספר ___ על ידי סופר ישראלי.', ['נכתב', 'כתב', 'יכתוב']],
    ['Atterrissage', 'אילו ___ לי זמן, הייתי בא איתכם.', ['היה', 'יש', 'יהיה']],
    ['Atterrissage', 'הוא ___ לי שהוא יגיע מאוחר.', ['הודיע', 'נודע', 'התוודע']],
    ['Atterrissage', '___ הגשם, יצאנו לטייל.', ['למרות', 'בגלל', 'כדי']],
    ['Atterrissage', '___ המורה לא הגיעה, השיעור בוטל.', ['מכיוון ש...', 'למרות ש...', 'כדי ש...']],
    ['Atterrissage', 'אני ___ לעבור דירה בקיץ.', ['מתכנן', 'מתוכנן', 'תכנן']],
    ['Atterrissage', 'דירת ___ גדולה מדי בשבילנו.', ['ההורים', 'הורים של', 'של ההורים']],
    ['Atterrissage', 'התלמידים ___ לבחינה כל השבוע.', ['התכוננו', 'הכינו', 'הוכנו']],
    ['Atterrissage', 'כדאי ___ את המסמכים מראש.', ['להכין', 'מכין', 'הכנה']],
    ['Atterrissage', 'Que veut dire « זה לא בא בחשבון » ?', ['Hors de question', 'Ça compte beaucoup', 'C\'est dans le calcul']]
  ];
  var LEVELS = [
    ['✈️', 'Décollage', 'Débutant', 'Les lettres, les sons, les premières phrases : on part ensemble, en douceur.'],
    ['☁️', 'En vol', 'Intermédiaire', 'Tu te débrouilles déjà : on t\'emmène vers des conversations fluides et naturelles.'],
    ['🛬', 'Atterrissage', 'Avancé', 'Tu as de belles bases : on affine pour que tu te sentes à l\'aise partout, au travail comme au quotidien.']
  ];
  function esc(x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function he(x) { return /[\u05D0-\u05EA]/.test(x) && !/[A-Za-zÀ-ÿ]/.test(x) ? '<span lang="he" dir="rtl">' + esc(x) + '</span>' : esc(x).replace(/« ([^»]*[\u05D0-\u05EA][^»]*) »/g, '« <span lang="he" dir="rtl">$1</span> »'); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function testPage(root) {
    var i = 0, score = 0, box;
    root.innerHTML = '<div class="lp mv" data-page="test" style="font-family: Nunito, system-ui, sans-serif; color: #24323F; background: #EAF6FB; min-height: 100vh">' +
      '<nav style="max-width: 760px; margin: 0 auto; padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px">' +
      '<a href="#/" style="display: flex; align-items: center; gap: 10px; text-decoration: none; color: #1F4E79"><span style="width: 40px; height: 40px; border-radius: 50%; background: #F7C948; display: flex; align-items: center; justify-content: center; font-family: Rubik, sans-serif; font-size: 22px">א</span><span style="font-family: Fraunces, Georgia, serif; font-size: 20px; font-weight: 600">Hébreu avec Maayane</span></a>' +
      '<a href="#/" style="font-weight: 700; text-decoration: none">← Accueil</a></nav>' +
      '<div style="max-width: 760px; margin: 0 auto; padding: 10px 20px 60px"><div id="lt-box"></div></div></div>';
    box = root.querySelector('#lt-box');
    function q() {
      if (i >= TEST.length) return result();
      var t = TEST[i], opts = shuffle(t[2]);
      box.innerHTML = '<p style="margin: 0 0 6px; font-size: 15px; font-weight: 700; color: #1B7385">Teste ton niveau · question ' + (i + 1) + ' / ' + TEST.length + '</p>' +
        '<div style="height: 8px; background: #FFFFFF; border-radius: 99px; overflow: hidden; margin-bottom: 22px"><div style="height: 100%; width: ' + Math.round(i / TEST.length * 100) + '%; background: #2E9AAE; border-radius: 99px"></div></div>' +
        '<div style="background: #FFFFFF; border-radius: 26px; padding: 28px 24px; box-shadow: 0 18px 40px -28px rgba(31,78,121,.6)">' +
        (/[A-Za-zÀ-ÿ]/.test(t[1]) ? '<h2 style="margin: 0 0 20px; font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: 26px; color: #1F4E79; line-height: 1.35">' + he(t[1]) + '</h2>'
          : '<p style="margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #5B6B7B">Complète :</p><h2 lang="he" dir="rtl" style="margin: 0 0 20px; font-family: Rubik, sans-serif; font-weight: 500; font-size: 26px; color: #1F4E79; line-height: 1.5; text-align: right">' + t[1].split('\n').map(esc).join('<br>') + '</h2>') +
        '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px">' + opts.map(function (o) {
          return '<button type="button" data-a="' + esc(o) + '" style="font: inherit; cursor: pointer; text-align: center; padding: 15px 14px; border-radius: 16px; border: 2px solid #D7E6EE; background: #FFFFFF; color: #1F4E79; font-weight: 700; font-size: ' + (/[\u05D0-\u05EA]/.test(o) ? '21px; font-family: Rubik, sans-serif' : '16px') + '">' + he(o) + '</button>';
        }).join('') + '</div>' +
        '<button type="button" data-skip style="font: inherit; cursor: pointer; margin-top: 16px; background: none; border: 0; color: #5B6B7B; text-decoration: underline; font-size: 14px">Je ne sais pas</button></div>';
      Array.prototype.forEach.call(box.querySelectorAll('[data-a]'), function (b) {
        b.onclick = function () { if (b.getAttribute('data-a') === t[2][0]) score++; i++; q(); };
      });
      box.querySelector('[data-skip]').onclick = function () { i++; q(); };
      window.scrollTo(0, 0);
    }
    function result() {
      var L = LEVELS[score <= 12 ? 0 : score <= 22 ? 1 : 2];
      box.innerHTML = '<div style="background: #FFFFFF; border-radius: 26px; padding: 34px 26px; text-align: center; box-shadow: 0 18px 40px -28px rgba(31,78,121,.6)">' +
        '<p style="margin: 0; font-size: 15px; font-weight: 700; color: #1B7385">Ton résultat : ' + score + ' / ' + TEST.length + '</p>' +
        '<p style="margin: 14px 0 0; font-size: 54px; line-height: 1">' + L[0] + '</p>' +
        '<h2 style="margin: 10px 0 0; font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: 38px; color: #1F4E79">' + L[1] + '</h2>' +
        '<p style="margin: 4px 0 0; font-weight: 700; color: #B5502F">Niveau ' + L[2].toLowerCase() + '</p>' +
        '<p style="margin: 16px auto 0; max-width: 460px; font-size: 17px; line-height: 1.65; color: #33475B">' + L[3] + '</p>' +
        '<p style="margin: 12px auto 0; max-width: 460px; font-size: 14.5px; line-height: 1.6; color: #5B6B7B">Ce test donne une première idée. Le cours d\'essai permet de faire le point plus précisément, avec Maayane.</p>' +
        '<div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 24px">' +
        '<a href="#/embarquer" style="text-decoration: none; background: #F7C948; color: #1F4E79; font-weight: 700; font-size: 17px; padding: 15px 26px; border-radius: 999px">Je réserve mon cours d\'essai</a>' +
        '<button type="button" data-again style="font: inherit; cursor: pointer; color: #1F4E79; font-weight: 700; font-size: 17px; padding: 13px 22px; border-radius: 999px; border: 2px solid #1F4E79; background: #FFFFFF">Refaire le test</button></div></div>';
      box.querySelector('[data-again]').onclick = function () { i = 0; score = 0; q(); };
      window.scrollTo(0, 0);
    }
    q();
  }

  function render(root, go) {
    if (!document.getElementById('lp-css')) {
      var s = document.createElement('style'); s.id = 'lp-css'; s.textContent = CSS; document.head.appendChild(s);
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS; document.head.appendChild(l);
    }
    document.title = 'Hébreu avec Maayane · Parle, travaille, aime, vis… en hébreu';
    var img = (window.ASSETS && ASSETS.img) || {};
    if (location.hash === '#/test') {
      if (!document.getElementById('lp-css')) { var s0 = document.createElement('style'); s0.id = 'lp-css'; s0.textContent = CSS; document.head.appendChild(s0); var l0 = document.createElement('link'); l0.rel = 'stylesheet'; l0.href = FONTS; document.head.appendChild(l0); }
      document.title = 'Teste ton niveau d\'hébreu · Hébreu avec Maayane';
      return testPage(root);
    }
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
    var m = /^#\/([\w-]+)$/.exec(location.hash), el = m && m[1] !== 'sante' && m[1] !== 'test' ? document.getElementById(m[1]) : null;
    if (el) setTimeout(function () { el.scrollIntoView(); }, 30); else window.scrollTo(0, 0);
  }
  function page() { return location.hash === '#/sante' ? 'sante' : location.hash === '#/test' ? 'test' : 'home'; }
  return { render: render, page: page };
})();
