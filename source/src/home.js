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

  /* ---------- test de niveau (#/test) : sans nikoud ----------
     1. prénom + contact ; 2. « Sais-tu lire ? » ; 3. trois lettres ; 4. 30 questions ; 5. texte + 5 vrai/faux.
     Le résultat part chez Maayane seulement (api/test.js) : l'élève voit juste un message de remerciement.
     Format : [partie, phrase (\n = dialogue), [bonne réponse, autres…]] ; lecture : ['Lecture', affirmation, vrai ?] */
  /* lettre écrite à la main (police Gveret Levin, licence OFL) → la même lettre en imprimé */
  var LETTERS = [['ש', ['ש', 'ע', 'צ']], ['ג', ['ג', 'נ', 'ז']], ['ק', ['ק', 'ה', 'ח']]];
  var TEST = [
    ['Décollage', '___ תלמיד או מורה?', ['אתה', 'את', 'היא']],
    ['Décollage', 'דנה ___ עברית באולפן.', ['לומדת', 'שותה', 'נחה']],
    ['Décollage', 'אנחנו ___ עברית.', ['מדברים', 'מדבר', 'מדברת']],
    ['Décollage', '- מאיפה אתה?\n- אני ___ צרפת.', ['מ...', 'ב...', 'ל...']],
    ['Décollage', '- איפה ___ גרים?\n- אנחנו גרים בחיפה.', ['אתם', 'אנחנו', 'הם']],
    ['Décollage', 'זאת ___ שלי, רותי.', ['חברה', 'חבר', 'חברים']],
    ['Décollage', '- אתה רוצה קפה?\n- לא תודה, אני לא ___ קפה.', ['שותה', 'אוכל', 'קורא']],
    ['Décollage', 'הם ___ בבנק.', ['עובדים', 'עובד', 'עובדת']],
    ['Décollage', 'יש לי ___ ילדים.', ['שני', 'שתי', 'שניים', 'שתיים']],
    ['Décollage', 'הן מטיילות ברחובות ___.', ['גדולים', 'גדולות', 'גדול', 'גדולה']],
    ['Décollage', '- ___ היא הולכת?\n- ___מסעדה.', ['לאן / ל...', 'איפה / ב...', 'איך / מ...']],
    ['Décollage', 'הם אוהבים ___ ישראל.', ['את', 'ה...', '(rien)']],
    ['En vol', 'אתמול ___ סרט בקולנוע.', ['ראיתי', 'רואה', 'אראה']],
    ['En vol', 'בשבוע הבא הם ___ לאילת.', ['ייסעו', 'נסעו', 'נסענו']],
    ['En vol', 'אני צריך ___ לרופא.', ['ללכת', 'הולך', 'הלכתי']],
    ['En vol', '- למה לא באת?\n- כי ___ חולה.', ['הייתי', 'היה', 'תהיה']],
    ['En vol', 'אני מחכה ___ אוטובוס כבר חצי שעה.', ['ל...', 'את', 'על']],
    ['En vol', 'הבית ___ ההורים שלי ליד הים.', ['של', 'את', 'עם']],
    ['En vol', 'כשהייתי ילד, ___ ברגל לבית הספר.', ['הייתי הולך', 'הולך', 'אלך']],
    ['En vol', '___ אתה לא עונה לטלפון?', ['למה', 'מה', 'מי']],
    ['En vol', 'אין לי זמן, ___ אני לא יכול לבוא.', ['לכן', 'כי', 'אבל']],
    ['En vol', 'אני ___ אליך מחר בערב.', ['אתקשר', 'התקשרתי', 'מתקשר']],
    ['Atterrissage', 'הספר ___ על ידי סופר ישראלי.', ['נכתב', 'כתב', 'יכתוב']],
    ['Atterrissage', 'אילו ___ לי זמן, הייתי בא איתכם.', ['היה', 'יש', 'יהיה']],
    ['Atterrissage', '___ הגשם, יצאנו לטייל.', ['למרות', 'בגלל', 'כדי']],
    ['Atterrissage', '___ המורה לא הגיעה, השיעור בוטל.', ['מכיוון ש...', 'למרות ש...', 'כדי ש...']],
    ['Atterrissage', 'דירת ___ גדולה מדי בשבילנו.', ['ההורים', 'הורים של', 'של ההורים']],
    ['Atterrissage', 'התלמידים ___ לבחינה כל השבוע.', ['התכוננו', 'הכינו', 'הוכנו']],
    ['Atterrissage', 'כדאי ___ את המסמכים מראש.', ['להכין', 'מכין', 'הכנה']],
    ['Atterrissage', 'Que veut dire « זה לא בא בחשבון » ?', ['Hors de question', 'Ça compte beaucoup', 'C\'est dans le calcul']],
    ['Lecture', 'השוק נמצא בתל אביב.', false],
    ['Lecture', 'ביום שישי יש בשוק מעט אנשים.', false],
    ['Lecture', 'בשוק יש היום גם מסעדות.', true],
    ['Lecture', 'בערב באים לשוק צעירים.', true],
    ['Lecture', 'בשבת אפשר לקנות בשוק.', false]
  ];
  var READING = 'שוק מחנה יהודה נמצא במרכז ירושלים. ביום שישי בבוקר יש בשוק הרבה אנשים: הם קונים פירות, ירקות, לחם ודגים לשבת. בשנים האחרונות נפתחו בשוק גם בתי קפה ומסעדות, ובערב צעירים באים לשמוע מוזיקה ולשבת עם חברים. התיירים אוהבים לטעום את האוכל ולצלם את הדוכנים. בשבת השוק סגור.';
  function esc(x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function he(x) { return /[א-ת]/.test(x) && !/[A-Za-zÀ-ÿ]/.test(x) ? '<span lang="he" dir="rtl">' + esc(x) + '</span>' : esc(x).replace(/« ([^»]*[א-ת][^»]*) »/g, '« <span lang="he" dir="rtl">$1</span> »'); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var CARD = 'background: #FFFFFF; border-radius: 26px; padding: 28px 24px; box-shadow: 0 18px 40px -28px rgba(31,78,121,.6)';
  var H2 = 'margin: 0 0 14px; font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: 28px; color: #1F4E79; line-height: 1.3';
  var BTN = 'font: inherit; cursor: pointer; text-align: center; padding: 15px 14px; border-radius: 16px; border: 2px solid #D7E6EE; background: #FFFFFF; color: #1F4E79; font-weight: 700; font-size: ';
  var MAIN = 'font: inherit; cursor: pointer; border: 0; background: #F7C948; color: #1F4E79; font-weight: 700; font-size: 17px; padding: 15px 26px; border-radius: 999px';
  var INPUT = 'display: block; width: 100%; box-sizing: border-box; margin-top: 6px; font: inherit; font-size: 17px; padding: 13px 14px; border-radius: 14px; border: 2px solid #D7E6EE; color: #24323F; background: #FFFFFF';

  /* partie atteinte : on commence là où l'élève n'est plus à l'aise */
  function levelOf(sc) {
    if (!sc.reads || (sc.lettres && sc.lettres[0] < 2)) return 'Embarquement';
    if (sc.dec[0] < 8) return 'Décollage';
    if (sc.vol[0] < 6) return 'En vol';
    return 'Atterrissage';
  }

  function testPage(root) {
    var who = { name: '', contact: '' }, ans = [], letters = 0, i = 0, t0 = Date.now(), box;
    root.innerHTML = '<div class="lp mv" data-page="test" style="font-family: Nunito, system-ui, sans-serif; color: #24323F; background: #EAF6FB; min-height: 100vh">' +
      '<nav style="max-width: 760px; margin: 0 auto; padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px">' +
      '<a href="#/" style="display: flex; align-items: center; gap: 10px; text-decoration: none; color: #1F4E79"><span style="width: 40px; height: 40px; border-radius: 50%; background: #F7C948; display: flex; align-items: center; justify-content: center; font-family: Rubik, sans-serif; font-size: 22px">א</span><span style="font-family: Fraunces, Georgia, serif; font-size: 20px; font-weight: 600">Hébreu avec Maayane</span></a>' +
      '<a href="#/" style="font-weight: 700; text-decoration: none">← Accueil</a></nav>' +
      '<div style="max-width: 760px; margin: 0 auto; padding: 10px 20px 60px"><div id="lt-box"></div></div></div>';
    box = root.querySelector('#lt-box');
    var font = (window.ASSETS && ASSETS.img && ASSETS.img['gveret-levin']) || '';
    if (font && !document.getElementById('lt-font')) { var fs = document.createElement('style'); fs.id = 'lt-font'; fs.textContent = "@font-face{font-family:'Gveret Levin';src:url('" + font + "') format('woff2');font-display:block}"; document.head.appendChild(fs); }
    function show(html) { box.innerHTML = html; window.scrollTo(0, 0); }
    function bar(n, total, label) {
      return '<p style="margin: 0 0 6px; font-size: 15px; font-weight: 700; color: #1B7385">' + label + '</p>' +
        '<div style="height: 8px; background: #FFFFFF; border-radius: 99px; overflow: hidden; margin-bottom: 22px"><div style="height: 100%; width: ' + Math.round(n / total * 100) + '%; background: #2E9AAE; border-radius: 99px"></div></div>';
    }
    function choices(opts, big) {
      return '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(' + (big ? '120px' : '220px') + ', 1fr)); gap: 10px">' + opts.map(function (o) {
        return '<button type="button" data-a="' + esc(o) + '" style="' + BTN + (big ? '36px; padding: 8px; font-family: Rubik, sans-serif' : /[א-ת]/.test(o) ? '21px; font-family: Rubik, sans-serif' : '16px') + '">' + he(o) + '</button>';
      }).join('') + '</div>';
    }
    function onPick(fn) {
      Array.prototype.forEach.call(box.querySelectorAll('[data-a]'), function (b) { b.onclick = function () { fn(b.getAttribute('data-a')); }; });
      var s = box.querySelector('[data-skip]'); if (s) s.onclick = function () { fn(null); };
    }
    var SKIP = '<button type="button" data-skip style="font: inherit; cursor: pointer; margin-top: 16px; background: none; border: 0; color: #5B6B7B; text-decoration: underline; font-size: 14px">Je ne sais pas</button>';

    /* 1. qui es-tu ? */
    function intro() {
      show('<div style="' + CARD + '"><h1 style="' + H2 + '">🎯 Teste ton niveau d\'hébreu</h1>' +
        '<p style="margin: 0 0 18px; font-size: 17px; line-height: 1.6; color: #33475B">Une quinzaine de minutes, des questions de plus en plus difficiles et un petit texte à lire à la fin. Réponds seul·e, sans dictionnaire : si tu ne sais pas, clique sur « Je ne sais pas », c\'est normal.<br>Maayane reçoit ton résultat et te recontacte pour te proposer le cours qui te correspond.</p>' +
        '<form id="lt-who" autocomplete="on">' +
        '<label style="display: block; font-weight: 700; margin-bottom: 14px">Ton prénom et ton nom<input name="name" required maxlength="80" autocomplete="name" style="' + INPUT + '"></label>' +
        '<label style="display: block; font-weight: 700; margin-bottom: 14px">Ton téléphone ou ton e-mail<input name="contact" required maxlength="120" autocomplete="email" style="' + INPUT + '"></label>' +
        '<input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position: absolute; left: -9999px; width: 1px; height: 1px">' +
        '<p id="lt-err" role="alert" style="margin: 0 0 12px; color: #B5502F; font-weight: 700"></p>' +
        '<button type="submit" style="' + MAIN + '">Commencer</button></form></div>');
      var f = box.querySelector('#lt-who');
      f.onsubmit = function (e) {
        e.preventDefault();
        var el = function (k) { return f.elements.namedItem(k).value; }; who.name = el('name').trim(); who.contact = el('contact').trim(); who.website = el('website');
        if (!who.name || who.contact.length < 5) { box.querySelector('#lt-err').textContent = 'Indique ton nom et un téléphone ou un e-mail pour que Maayane puisse te répondre.'; return; }
        reads();
      };
    }
    /* 2. lis-tu l'hébreu ? */
    function reads() {
      show('<div style="' + CARD + '"><h2 style="' + H2 + '">Sais-tu lire les lettres hébraïques ?</h2>' +
        '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px">' +
        '<button type="button" data-r="1" style="' + BTN + '16px">Oui</button><button type="button" data-r="0" style="' + BTN + '16px">Non, pas encore</button></div></div>');
      box.querySelector('[data-r="1"]').onclick = function () { letter(0); };
      box.querySelector('[data-r="0"]').onclick = function () { send(false); };
    }
    /* 3. trois lettres */
    function letter(k) {
      if (k >= LETTERS.length) return letters < 2 ? send(true) : q();
      var L = LETTERS[k];
      show(bar(k, LETTERS.length, 'Les lettres · ' + (k + 1) + ' / ' + LETTERS.length) +
        '<div style="' + CARD + '"><p style="margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #5B6B7B">Cette lettre est écrite à la main. Quelle est la même lettre en imprimé ?</p>' +
        '<p lang="he" dir="rtl" style="margin: 0 0 20px; text-align: center; font-family: \'Gveret Levin\', cursive; font-size: 96px; line-height: 1.2; color: #1F4E79">' + L[0] + '</p>' +
        choices(shuffle(L[1]), true) + SKIP + '</div>');
      onPick(function (a) { if (a === L[1][0]) letters++; letter(k + 1); });
    }
    /* 4. et 5. les questions, puis le texte */
    function q() {
      if (i >= TEST.length) return send(true);
      var t = TEST[i], n = i + 1, tf = t[0] === 'Lecture';
      var head = bar(i, TEST.length, 'Question ' + n + ' / ' + TEST.length);
      if (tf) {
        show(head + '<div style="' + CARD + '"><p style="margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #5B6B7B">Lis le texte, puis dis si la phrase est vraie ou fausse.</p>' +
          '<p lang="he" dir="rtl" style="margin: 0 0 20px; padding: 16px 18px; border-radius: 16px; background: #F4F9FC; font-family: Rubik, sans-serif; font-size: 19px; line-height: 1.75; text-align: right">' + esc(READING) + '</p>' +
          '<h2 lang="he" dir="rtl" style="margin: 0 0 20px; font-family: Rubik, sans-serif; font-weight: 500; font-size: 24px; color: #1F4E79; text-align: right">' + esc(t[1]) + '</h2>' +
          choices(['נכון', 'לא נכון']) + SKIP + '</div>');
        return onPick(function (a) { ans.push({ q: i, a: a, ok: a !== null && (a === 'נכון') === t[2] }); i++; q(); });
      }
      show(head + '<div style="' + CARD + '">' +
        (/[A-Za-zÀ-ÿ]/.test(t[1]) ? '<h2 style="' + H2 + '; font-size: 26px">' + he(t[1]) + '</h2>'
          : '<p style="margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #5B6B7B">Complète :</p><h2 lang="he" dir="rtl" style="margin: 0 0 20px; font-family: Rubik, sans-serif; font-weight: 500; font-size: 26px; color: #1F4E79; line-height: 1.5; text-align: right">' + t[1].split('\n').map(esc).join('<br>') + '</h2>') +
        choices(shuffle(t[2])) + SKIP + '</div>');
      onPick(function (a) { ans.push({ q: i, a: a, ok: a === t[2][0] }); i++; q(); });
    }
    function count(part) { return ans.filter(function (a) { return a.ok && TEST[a.q][0] === part; }).length; }
    /* envoi à Maayane ; l'élève ne voit pas son score */
    function send(readsHebrew) {
      var sc = { reads: readsHebrew, lettres: readsHebrew ? [letters, 3] : null, dec: [count('Décollage'), 12], vol: [count('En vol'), 10], att: [count('Atterrissage'), 8], lect: [count('Lecture'), 5] };
      var rec = { name: who.name, contact: who.contact, website: who.website || '', reads: readsHebrew, level: levelOf(sc), scores: { lettres: sc.lettres, dec: sc.dec, vol: sc.vol, att: sc.att, lect: sc.lect }, answers: ans, minutes: (Date.now() - t0) / 60000 };
      show('<div style="' + CARD + '; text-align: center"><p style="font-size: 17px; color: #33475B">Envoi en cours…</p></div>');
      var p = window.HPB && HPB.addLevelTest ? HPB.addLevelTest(rec) : Promise.reject(new Error('indisponible'));
      p.then(done, function () {
        show('<div style="' + CARD + '; text-align: center"><h2 style="' + H2 + '">Oups, l\'envoi n\'a pas marché</h2><p style="font-size: 17px; color: #33475B">Vérifie ta connexion internet, puis réessaie : tes réponses sont gardées.</p>' +
          '<button type="button" data-retry style="' + MAIN + '">Réessayer</button></div>');
        box.querySelector('[data-retry]').onclick = function () { send(readsHebrew); };
      });
    }
    function done() {
      show('<div style="' + CARD + '; text-align: center; padding: 34px 26px"><p style="margin: 0; font-size: 54px; line-height: 1">✈️</p>' +
        '<h2 style="' + H2 + '; margin-top: 12px; font-size: 32px">Merci ' + esc(who.name.split(' ')[0]) + ' !</h2>' +
        '<p style="margin: 0 auto; max-width: 460px; font-size: 17px; line-height: 1.65; color: #33475B">Maayane a bien reçu ton test. Elle le regarde et te recontacte très vite pour te proposer le cours qui te correspond.</p>' +
        '<a href="#/" style="display: inline-block; margin-top: 24px; text-decoration: none; ' + MAIN + '">Retour à l\'accueil</a></div>');
    }
    intro();
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
  return { render: render, page: page, test: { questions: TEST, letters: LETTERS, reading: READING } };
})();
