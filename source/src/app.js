/* =====================================================================
   HPApp — connexion, back-office de Maayane, ouverture des espaces élèves.
   ===================================================================== */
var HPApp = (function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = HP.esc, fmt = HP.fmt;
  var root = document.getElementById('app');
  var DEMO = { teacher: ['mayane', 'mayane2026'], students: [['benjamin', 'ivrit2026'], ['lea', 'lea2026'], ['noam', 'noam2026']] };
  var DEMO_TEACHER = DEMO.teacher.slice();   /* identifiants de départ, pour « Réinitialiser la démo » */
  var results = {};                          /* analyses terminées pendant que la page affichait autre chose */
  var cache = { students: [], summaries: {}, contents: {}, docs: [], tests: [] };
  var sortKey = 'xp7', sortDir = -1, pending = {};
  /* agenda (réservation des cours) : voir agenda-ui.js */
  var AG = HPAgendaUI({ $: $, $$: $$, esc: esc, cache: cache, modal: modal, toast: toast, busy: busy, errText: errText, fullName: fullName, color: stColor,
    plural: plural, bindCopy: bindCopy, render: function () { renderTeacher(); } });

  /* ---------- session ---------- */
  function sess(v) {
    if (v !== undefined && typeof cache === 'object') cache.loadedAt = 0;   /* nouveau compte : données rechargées */
    try {
      if (v === undefined) return JSON.parse(sessionStorage.getItem('hp_session') || 'null');
      if (v === null) sessionStorage.removeItem('hp_session'); else sessionStorage.setItem('hp_session', JSON.stringify(v));
    } catch (e) { if (v !== undefined) window.__hpSess = v; return window.__hpSess || null; }
  }
  function toast(msg, long) {
    var bad = /impossible|n'a pas abouti|échec|erreur|expiré|interrompue/i.test(msg);
    var t = document.createElement('div'); t.className = 'toast' + (bad ? ' is-err' : ''); t.setAttribute('role', bad ? 'alert' : 'status'); t.setAttribute('aria-live', bad ? 'assertive' : 'polite');
    t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, long ? 6000 : 2600);
  }
  function plural(n, one, many) { return n + ' ' + (n > 1 ? (many || one + 's') : one); }
  /* bouton occupé pendant une opération, puis rendu ; affiche l'erreur si elle échoue */
  function busy(btn, promise, errMsg) {
    if (btn) { btn.disabled = true; btn.dataset.label = btn.dataset.label || btn.textContent; btn.textContent = 'Un instant…'; }
    return Promise.resolve(promise).then(function (v) {
      if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = btn.dataset.label; }
      return v;
    }, function (e) {
      if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = btn.dataset.label; }
      toast((errMsg || 'L\'opération n\'a pas abouti') + ' : ' + errText(e), true);
      throw e;
    });
  }
  function errText(e) {
    var c = e && e.code;
    if (c === 'login_taken') return 'cet identifiant est déjà utilisé';
    if (c === 'not_teacher') return 'votre session a expiré, reconnectez-vous';
    if (e && /fetch|network|Failed/i.test(e.message || '')) return 'connexion internet interrompue';
    var msg = (e && e.message) || '';
    if (/password/i.test(msg)) return 'le mot de passe doit contenir au moins 6 caractères';
    /* message technique (anglais, code, JSON) : on l'écrit en clair pour Maayane */
    if (!msg || /^(HTTP|\d{3}\b)|[{}_<>]|violates|duplicate|null value|JWT|PGRST|undefined|unexpected|status/i.test(msg)) return 'le serveur n\'a pas répondu comme prévu, réessayez dans un instant';
    return msg;
  }
  window.addEventListener('unhandledrejection', function (e) {
    console.error(e.reason);
    toast('Une opération n\'a pas abouti : ' + errText(e.reason) + '. Réessayez.', true);
  });
  function copy(txt) {
    try { navigator.clipboard.writeText(txt).then(function () { toast('Copié'); }, function () { toast('Copie impossible ici : sélectionnez le texte à la main'); }); }
    catch (e) { toast('Copie impossible ici : sélectionnez le texte à la main'); }
  }
  function initials(s) { var l = ((s.last || '').match(/\p{L}/u) || [''])[0]; return ((s.first || '?').charAt(0) + l).toUpperCase(); }
  function fullName(s) { return (s.first || '') + (s.last ? ' ' + s.last : ''); }
  /* couleur et photo de chaque élève : dans les réglages (lisibles par la professeure seulement) */
  var COLORS = [['#3b6fe0', 'bleu'], ['#7457f5', 'violet'], ['#a64fd6', 'mauve'], ['#d63a7a', 'framboise'], ['#e2574c', 'corail'],
    ['#d9701a', 'orange'], ['#a57c08', 'moutarde'], ['#1f9d6b', 'vert'], ['#0e93ad', 'turquoise'], ['#56657a', 'ardoise']];
  function look(id) { return ((cache.settings || {}).looks || {})[id] || {}; }
  function stColor(id) {
    var c = look(id).color;
    if (/^#[0-9a-f]{6}$/i.test(c || '')) return c;
    var h = 0; String(id).split('').forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
    return COLORS[h % COLORS.length][0];
  }
  /* personnages proposés à la place de la photo */
  var CHARS = [
    ['Métiers', [['👩‍⚕️', 'médecin'], ['👨‍⚕️', 'médecin'], ['🩺', 'chirurgien·ne'], ['🦷', 'dentiste'], ['💊', 'pharmacien·ne'], ['🐾', 'vétérinaire'], ['🧠', 'psychologue'], ['🛋️', 'psychanalyste'],
      ['👩‍✈️', 'pilote'], ['👨‍✈️', 'pilote'], ['👩‍🚀', 'astronaute'], ['👨‍🚀', 'astronaute'], ['👩‍🏫', 'professeure'], ['👨‍🏫', 'professeur'],
      ['👩‍🔬', 'chercheuse'], ['👨‍🔬', 'chercheur'], ['👩‍💻', 'informaticienne'], ['👨‍💻', 'informaticien'], ['👩‍🍳', 'cheffe cuisinière'], ['👨‍🍳', 'chef cuisinier'],
      ['👩‍⚖️', 'avocate'], ['👨‍⚖️', 'avocat'], ['👩‍💼', 'cheffe d\'entreprise'], ['👨‍💼', 'chef d\'entreprise'], ['👩‍🚒', 'pompière'], ['👨‍🚒', 'pompier'],
      ['👮‍♀️', 'policière'], ['👮‍♂️', 'policier'], ['👷‍♀️', 'ingénieure'], ['👷‍♂️', 'ingénieur'], ['👩‍🔧', 'mécanicienne'], ['👨‍🔧', 'mécanicien'],
      ['👩‍🌾', 'agricultrice'], ['👨‍🌾', 'agriculteur'], ['🕵️‍♀️', 'détective'], ['🕵️‍♂️', 'détective'], ['👩‍🎓', 'étudiante'], ['👨‍🎓', 'étudiant'],
      ['🏛️', 'architecte'], ['📚', 'bibliothécaire'], ['📰', 'journaliste'], ['✂️', 'coiffeur·se'], ['🪖', 'soldat'], ['⚓', 'marin']]],
    ['Musique et arts', [['👩‍🎤', 'chanteuse'], ['👨‍🎤', 'chanteur'], ['🎤', 'micro'], ['🎧', 'DJ'], ['🎸', 'guitariste'], ['🎹', 'pianiste'],
      ['🎻', 'violoniste'], ['🥁', 'batteur·se'], ['🎺', 'trompettiste'], ['🎷', 'saxophoniste'], ['🪕', 'banjo'], ['🪗', 'accordéon'],
      ['🎼', 'compositeur·rice'], ['👩‍🎨', 'peintre'], ['👨‍🎨', 'peintre'], ['🎨', 'palette'], ['💃', 'danseuse'], ['🕺', 'danseur'],
      ['🩰', 'danse classique'], ['🎭', 'théâtre'], ['🎬', 'cinéma'], ['📸', 'photographe'], ['✍️', 'écrivain·e'], ['🧶', 'tricot']]],
    ['Sport', [['⚽', 'football'], ['🏀', 'basket'], ['🎾', 'tennis'], ['🏐', 'volley'], ['🏓', 'ping-pong'], ['🏈', 'football américain'],
      ['⚾', 'baseball'], ['🏊‍♀️', 'nageuse'], ['🏊‍♂️', 'nageur'], ['🚴‍♀️', 'cycliste'], ['🚴‍♂️', 'cycliste'], ['🏃‍♀️', 'coureuse'],
      ['🏃‍♂️', 'coureur'], ['🧘‍♀️', 'yoga'], ['🤸', 'gymnastique'], ['🥋', 'judo / karaté'], ['🥊', 'boxe'], ['🏋️', 'musculation'],
      ['🧗', 'escalade'], ['⛷️', 'ski'], ['🏂', 'snowboard'], ['🏄', 'surf'], ['🛹', 'skate'], ['🏇', 'équitation'],
      ['⛳', 'golf'], ['♟️', 'échecs']]],
    ['Voitures et espace', [['🏎️', 'voiture de course'], ['🏁', 'drapeau à damier'], ['🚗', 'voiture'], ['🚙', '4x4'], ['🛻', 'dépanneuse'], ['🚚', 'camion'],
      ['🚌', 'bus'], ['🚒', 'camion de pompiers'], ['🚓', 'voiture de police'], ['🚑', 'ambulance'], ['🚜', 'tracteur'], ['🏍️', 'moto'],
      ['🚂', 'train'], ['🚁', 'hélicoptère'], ['✈️', 'avion'], ['🚀', 'fusée'], ['🛸', 'soucoupe volante'], ['🛰️', 'satellite'],
      ['🪐', 'planète'], ['🌌', 'galaxie'], ['👾', 'monstre de l\'espace'], ['🦹‍♂️', 'méchant masqué'], ['🦹‍♀️', 'méchante masquée'], ['🤺', 'combat au sabre']]],
    ['Personnes', [['👧', 'fille'], ['👦', 'garçon'], ['👩', 'femme'], ['👨', 'homme'], ['👩‍🦰', 'rousse'], ['👨‍🦰', 'roux'],
      ['👱‍♀️', 'blonde'], ['👱‍♂️', 'blond'], ['👩‍🦱', 'cheveux bouclés'], ['👨‍🦱', 'cheveux bouclés'], ['🧔', 'barbe'], ['👩‍🦳', 'cheveux blancs'],
      ['👵', 'grand-mère'], ['👴', 'grand-père'], ['🧕', 'foulard'], ['👳', 'turban'], ['🧑‍🦯', 'canne'], ['👶', 'bébé']]],
    ['Imaginaire', [['🦸‍♀️', 'super-héroïne'], ['🦸‍♂️', 'super-héros'], ['🧙‍♀️', 'magicienne'], ['🧙‍♂️', 'magicien'], ['🧚', 'fée'], ['🧜‍♀️', 'sirène'],
      ['🧞', 'génie'], ['🧝', 'elfe'], ['🧛', 'vampire'], ['👸', 'princesse'], ['🤴', 'prince'], ['🥷', 'ninja'],
      ['🏴‍☠️', 'pirate'], ['🤠', 'cow-boy'], ['🤖', 'robot'], ['👽', 'extraterrestre'], ['👻', 'fantôme'], ['🦄', 'licorne'],
      ['🐉', 'dragon'], ['🦖', 'dinosaure']]],
    ['Animaux', [['🦁', 'lion'], ['🐯', 'tigre'], ['🐻', 'ours'], ['🐼', 'panda'], ['🐨', 'koala'], ['🦊', 'renard'],
      ['🐺', 'loup'], ['🐱', 'chat'], ['🐶', 'chien'], ['🐰', 'lapin'], ['🐹', 'hamster'], ['🐭', 'souris'],
      ['🐵', 'singe'], ['🦒', 'girafe'], ['🐘', 'éléphant'], ['🦓', 'zèbre'], ['🐮', 'vache'], ['🐷', 'cochon'],
      ['🐴', 'cheval'], ['🐸', 'grenouille'], ['🦉', 'chouette'], ['🦜', 'perroquet'], ['🐧', 'pingouin'], ['🦩', 'flamant rose'],
      ['🐬', 'dauphin'], ['🐳', 'baleine'], ['🦈', 'requin'], ['🐙', 'pieuvre'], ['🐢', 'tortue'], ['🦔', 'hérisson'],
      ['🦋', 'papillon'], ['🐝', 'abeille'], ['🐞', 'coccinelle'], ['🐌', 'escargot']]],
    ['Nature et objets', [['🌸', 'fleur'], ['🌻', 'tournesol'], ['🌈', 'arc-en-ciel'], ['⭐', 'étoile'], ['🌙', 'lune'], ['☀️', 'soleil'],
      ['🔥', 'feu'], ['❄️', 'flocon'], ['🌵', 'cactus'], ['🍀', 'trèfle'], ['🍉', 'pastèque'], ['🍓', 'fraise'],
      ['🍕', 'pizza'], ['🍦', 'glace'], ['🧁', 'cupcake'], ['☕', 'café'],
      ['⛵', 'voilier'], ['🎈', 'ballon'], ['🎁', 'cadeau'], ['💎', 'diamant'],
      ['👑', 'couronne'], ['💡', 'idée'], ['🧩', 'puzzle'], ['🎮', 'jeux vidéo']]]
  ];
  var CHAR_OK = {}; CHARS.forEach(function (g) { g[1].forEach(function (c) { CHAR_OK[c[0]] = 1; }); });
  function avatar(s, cls) {
    var l = look(s.id), c = stColor(s.id), ph = l.photo;
    if (/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(ph || '')) return '<span class="av' + (cls ? ' ' + cls : '') + '" style="background:' + c + '"><img src="' + ph + '" alt=""></span>';
    if (CHAR_OK[l.char]) return '<span class="av emo' + (cls ? ' ' + cls : '') + '" style="background:color-mix(in srgb, ' + c + ' 30%, #fff);box-shadow:inset 0 0 0 2px ' + c + '"><span aria-hidden="true">' + l.char + '</span></span>';
    return '<span class="av' + (cls ? ' ' + cls : '') + '" style="background:' + c + '">' + initials(s) + '</span>';
  }
  function setLook(id, patch) {
    return HPB.getSettings().then(function (st) {
      var l = st.looks = st.looks || {};
      l[id] = Object.assign({}, l[id], patch);
      Object.keys(l[id]).forEach(function (k) { if (!l[id][k]) delete l[id][k]; });
      return HPB.setSettings(st).then(function () { cache.settings = st; });
    });
  }
  /* photo recadrée en carré et réduite (quelques Ko) */
  function shrinkPhoto(file) {
    return new Promise(function (ok, ko) {
      var u = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var n = 192, c = document.createElement('canvas'), m = Math.min(img.naturalWidth, img.naturalHeight);
        c.width = c.height = n;
        c.getContext('2d').drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, n, n);
        URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { URL.revokeObjectURL(u); ko(new Error('image illisible')); };
      img.src = u;
    });
  }
  function ago(day) {
    if (!day) return 'jamais';
    var n = Math.round((HP.parseDay(HP.dayKey()) - HP.parseDay(day)) / 864e5);
    return n <= 0 ? 'aujourd\'hui' : n === 1 ? 'hier' : 'il y a ' + n + ' j';
  }
  function slug(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  }

  /* ---------- statistiques d'élève : uniquement des nombres et des textes courts ----------
     Un élève écrit lui-même sa progression : rien de ce qu'il envoie n'est affiché sans être nettoyé. */
  function num(v) { v = +v; return isFinite(v) ? v : 0; }
  function txt(v, max) { return typeof v === 'string' ? v.slice(0, max || 120) : ''; }
  var DAY = /^\d{4}-\d{2}-\d{2}$/;
  function cleanSummary(s) {
    if (!s || typeof s !== 'object') return null;
    var o = { updatedAt: txt(s.updatedAt, 40), xp: num(s.xp), level: num(s.level), streak: num(s.streak), best: num(s.best),
      bestCombo: num(s.bestCombo), goal: [30, 60, 100, 150].indexOf(num(s.goal)) >= 0 ? num(s.goal) : 60,
      lastActive: DAY.test(s.lastActive) ? s.lastActive : null, days: {}, totals: {}, themes: [], weak: [], badges: {} };
    var days = s.days && typeof s.days === 'object' ? s.days : {};
    Object.keys(days).slice(-400).forEach(function (k) {
      if (!DAY.test(k) || !days[k] || typeof days[k] !== 'object') return;
      var d = HP.emptyDay(); for (var f in d) d[f] = num(days[k][f]); o.days[k] = d;
    });
    var t = s.totals && typeof s.totals === 'object' ? s.totals : {};
    ['qOk', 'qKo', 'fK', 'fA', 'fS', 'cK', 'cA', 'cS', 'mastered'].forEach(function (k) { o.totals[k] = num(t[k]); });
    (Array.isArray(s.themes) ? s.themes : []).slice(0, 300).forEach(function (x) {
      if (x && typeof x === 'object') o.themes.push({ theme: txt(x.theme), n: num(x.n), m: num(x.m), seen: num(x.seen), pct: Math.max(0, Math.min(100, num(x.pct))), runs: num(x.runs) });
    });
    (Array.isArray(s.weak) ? s.weak : []).slice(0, 100).forEach(function (x) {
      if (x && typeof x === 'object') o.weak.push(Object.assign({ he: txt(x.he, 80), fr: txt(x.fr, 160), bad: num(x.bad), seen: num(x.seen) }, x.q != null || x.f != null ? { q: num(x.q), f: num(x.f) } : {}));
    });
    var b = s.badges && typeof s.badges === 'object' ? s.badges : {};
    HP.BADGES.forEach(function (x) { if (DAY.test(b[x.id])) o.badges[x.id] = b[x.id]; });
    return o;
  }

  /* ---------- fichiers chargés à la demande ---------- */
  var tplP = null, demoP = null;
  function fetchOk(url, kind) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('fichier ' + url + ' introuvable (' + r.status + ')'); return kind === 'json' ? r.json() : r.text(); });
  }
  function getTpl() { return tplP || (tplP = fetchOk(ASSETS.student, 'text').catch(function (e) { tplP = null; throw e; })); }
  function loadDemo() { return demoP || (demoP = fetchOk(ASSETS.demo, 'json').catch(function (e) { demoP = null; throw e; })); }
  function idle(fn) { (window.requestIdleCallback || function (f) { setTimeout(f, 1500); })(function () { try { fn(); } catch (e) {} }); }

  /* ---------- démarrage ---------- */
  /* une page restée ouverte ne se met pas à jour toute seule : on propose de recharger dès qu'une nouvelle version est en ligne */
  function checkVersion() {
    if (!ASSETS.build || location.protocol === 'file:' || document.querySelector('.hp-update')) return;
    fetch('/version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (!v || !v.build || v.build === ASSETS.build || document.querySelector('.hp-update')) return;
      var b = document.createElement('div'); b.className = 'hp-update'; b.setAttribute('role', 'status');
      b.innerHTML = '<span>✨ Une nouvelle version du site est disponible.</span><button class="btn small primary">Recharger</button>';
      b.querySelector('button').onclick = function () {
        if (frame && frame.el && frame.el.contentWindow) try { frame.el.contentWindow.postMessage({ hp: 'flush' }, '*'); } catch (e) {}
        /* on laisse partir la dernière progression avant de recharger */
        setTimeout(function () { pushQueue.then(function () { location.reload(); }, function () { location.reload(); }); }, 600);
      };
      document.body.appendChild(b);
    }).catch(function () {});
  }
  setInterval(checkVersion, 10 * 60000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') checkVersion(); });
  window.addEventListener('focus', checkVersion);

  function boot() {
    /* la page d'accueil ne dépend pas du serveur : elle s'affiche tout de suite */
    if (!sess() && location.hash !== '#/connexion' && !/^#\/(tableau|eleve|documents|agenda|reglages)/.test(location.hash)) {
      HPHome.render(root, function () { location.hash = '#/connexion'; });
    }
    HP.injectCss();
    HPB.ready().then(function () {
      if (HPB.remoteError) return 'error';
      if (HPB.remote) return HPB.setupStatus().then(function (s) { return s.hasTeacher ? null : 'setup'; }, function () { return 'error'; });
      return HPB.getTeacher().then(function (t) {
      return t ? HPB.listStudents().then(function (l) {
        var known = {}; DEMO.students.forEach(function (d) { known[d[0]] = d[1]; });
        return l.filter(function (x) { return x.demo && !x.pw && known[x.login]; })
          .reduce(function (p, x) { return p.then(function () { x.pw = known[x.login]; return HPB.saveStudent(x); }); }, Promise.resolve());
      }).then(function () {
        /* démo créée avant l'agenda : on ajoute des disponibilités et quelques cours fictifs */
        return HPB.getSettings().then(function (s) { if (!s.agenda) return seedAgenda(); });
      }) : seedDemo();
      });
    }).then(function (r) {
      if (r === 'error') return renderFatal(HPB.remoteError || 'Le serveur ne répond pas. Rechargez la page dans un instant.');
      if (r === 'setup') return renderSetup();
      route();
    });
    window.addEventListener('hashchange', route);
    window.addEventListener('hp-progress', function (e) {
      HPB.getSummary(e.detail).then(function (s) { cache.summaries[e.detail] = cleanSummary(s); });
    });
  }

  function route() {
    var s = sess();
    if (!s && HPB.remote && !route.checked) {
      route.checked = true;
      return HPB.currentUser().then(function (u) { if (u && u.role !== 'blocked') sess(u); route(); });
    }
    if (!s) {
      if (location.hash === '#/connexion') { idle(getTpl); return renderLogin(); }
      var shown = root.querySelector('.mv');
      if (shown && HPB.remote && (shown.getAttribute('data-page') || 'home') === HPHome.page() && !/^#\/[\w-]+$/.test(location.hash)) return;   /* accueil déjà affiché */
      return HPHome.render(root, function () { location.hash = '#/connexion'; });
    }
    if (s.role === 'student' && !HPB.remote) return openStudent(s.id, false);
    if (s.role === 'student' && route.verified) return openStudent(s.id, false);
    if (HPB.remote && !route.verified) {
      /* la session enregistrée dans l'onglet doit correspondre au compte réellement connecté */
      return HPB.currentUser().then(function (u) {
        if (!u || u.role !== s.role || (s.role === 'student' && u.id !== s.id)) { sess(null); route.checked = true; return renderLogin(u && u.role === 'blocked' ? 'Ce compte est suspendu. Contacte Maayane.' : null); }
        route.verified = true; route();
      });
    }
    if (s.role === 'teacher') {
      /* données gardées en mémoire entre les pages ; rechargées après une modification ou au bout d'une minute */
      if (cache.loadedAt && Date.now() - cache.loadedAt < 60000) return renderTeacher();
      return loadAll().then(function () { renderTeacher(); autoRun(); }, function (e) { renderFatal('Impossible de charger vos données (' + errText(e) + '). Rechargez la page.'); });
    }
    sess(null); renderLogin();
  }

  /* Échecs passagers ou corrigés depuis (session expirée, connexion coupée, crédit épuisé, « document trop long »
     d'avant le découpage automatique, Claude surchargé…) : ce n'est pas la faute du document. On le remet
     « À intégrer », sans l'ancien message, pour qu'il soit relancé normalement. */
  var RETRYABLE = /session a expir|connexion perdue|connexion internet|trop long pour être analysé|credit balance|crédit de l'analyse|budget mensuel|très sollicité|pris trop de temps|réessayez dans un instant/i;
  function retryable(d) {
    if (d && d.status === 'error' && RETRYABLE.test(d.error || '')) { d.status = 'pending'; d.error = null; }
    return d;
  }
  function loadAll() {
    var slow = setTimeout(function () { document.body.classList.add('is-loading'); }, 250);
    return Promise.all([HPB.listStudents(), HPB.listDocs(), HPB.getSettings(), AG.load(), HPB.listLevelTests().then(function (l) { cache.testsError = ''; return l; }, function (e) { cache.testsError = errText(e); return []; })]).then(function (r) {
      cache.students = r[0]; cache.docs = r[1].map(retryable); cache.settings = r[2]; cache.tests = r[4];
      HPA.setCode(r[2].analyseCode || '');
      if (HPB.me && (HPB.me.role === 'teacher' || HPB.me.role === 'admin')) cache.teacherLogin = HPB.me.login;
      var ids = r[0].map(function (s) { return s.id; });
      /* une seule requête par type de données quand le serveur le permet */
      var sums = HPB.getSummaries ? HPB.getSummaries(ids) : Promise.all(ids.map(function (id) { return HPB.getSummary(id); })).then(function (l) { var o = {}; ids.forEach(function (id, i) { o[id] = l[i]; }); return o; });
      var conts = HPB.getContents ? HPB.getContents(ids) : Promise.all(ids.map(function (id) { return HPB.getContent(id); })).then(function (l) { var o = {}; ids.forEach(function (id, i) { o[id] = l[i]; }); return o; });
      var unread = HPB.unreadMessages ? Promise.resolve(HPB.unreadMessages()).catch(function () { return {}; }) : {};
      return Promise.all([sums, conts, unread]).then(function (x) {
        cache.summaries = {}; cache.contents = {}; cache.unread = x[2] || {};
        ids.forEach(function (id) { cache.summaries[id] = cleanSummary(x[0][id]); cache.contents[id] = x[1][id] || null; });
        cache.loadedAt = Date.now();
      });
    }).then(function (v) { clearTimeout(slow); document.body.classList.remove('is-loading'); return v; },
      function (e) { clearTimeout(slow); document.body.classList.remove('is-loading'); throw e; });
  }

  /* ================= CONNEXION ================= */
  function renderLogin(msg, loginValue) {
    document.title = 'Hébreu avec Maayane';
    root.innerHTML =
      '<div class="login-wrap"><div class="login">' +
        '<a class="back" href="#">← Accueil</a><br>' +
        '<span class="kicker">Espace de révision</span>' +
        '<h1>Hébreu avec Maayane <span class="grad">עִבְרִית</span></h1>' +
        '<p class="sub">Connecte-toi avec l\'identifiant et le mot de passe que Maayane t\'a envoyés.</p>' +
        '<div class="card"><form id="lf" autocomplete="on">' +
          '<label class="f">Identifiant<input class="in" name="login" autocomplete="username" autocapitalize="none" spellcheck="false" required value="' + esc(loginValue || '') + '"></label>' +
          '<label class="f">Mot de passe<input class="in" name="pw" type="password" autocomplete="current-password" required></label>' +
          (msg ? '<div class="err">' + esc(msg) + '</div>' : '') +
          '<button class="btn primary" type="submit">Se connecter</button>' +
        '</form></div>' +
        (HPB.remote ? '' : '<div class="demo-box"><b>Version de démonstration</b> — comptes de test :' +
          '<table><tr><td>Professeure</td><td class="mono">' + DEMO.teacher.join(' / ') + '</td><td><button data-demo="t">Utiliser</button></td></tr>' +
          DEMO.students.map(function (s, i) { return '<tr><td>Élève</td><td class="mono">' + s.join(' / ') + '</td><td><button data-demo="' + i + '">Utiliser</button></td></tr>'; }).join('') +
          '</table></div>') +
      '</div></div>';
    var f = $('#lf');
    $$('[data-demo]').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = b.dataset.demo === 't' ? DEMO.teacher : DEMO.students[+b.dataset.demo];
        f.login.value = c[0]; f.pw.value = c[1]; f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit'));
      });
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('button[type=submit]', f);
      busy(btn, HPB.login(f.login.value, f.pw.value), 'Connexion impossible').then(function (r) {
        if (!r) { renderLogin('Identifiant ou mot de passe incorrect.', f.login.value); var pw = $('#lf [name=pw]'); if (pw) pw.focus(); return; }
        route.verified = true;
        if (r.role === 'blocked') return renderLogin('Ce compte est suspendu. Contacte Maayane.');
        sess(r); if (r.role === 'teacher') location.hash = '#/tableau'; else history.replaceState(null, '', location.pathname + location.search); route();
      }).catch(function () {});
    });
  }

  function logout() {
    AG.closePane();
    sess(null); route.checked = true; route.verified = false; frame = null;
    pushQueue.then(function () { return HPB.logout ? HPB.logout() : null; }).catch(function () {})
      .then(function () { location.hash = '#/connexion'; renderLogin(); });
  }

  /* première ouverture du site en ligne : création du compte de la professeure */
  function renderSetup(msg) {
    document.title = 'Hébreu avec Maayane · première ouverture';
    root.innerHTML = '<div class="login-wrap"><div class="login">' +
      '<span class="kicker">Première ouverture</span><h1>Bienvenue <span class="grad">בְּרוּכָה הַבָּאָה</span></h1>' +
      '<p class="sub">Créez votre compte de professeure. Vous seule aurez accès à l\'espace de gestion.</p>' +
      '<div class="card"><form id="sf">' +
        '<label class="f">Prénom<input class="in" name="first" value="Maayane" required></label>' +
        '<label class="f">Identifiant<input class="in mono" name="login" value="mayane" autocapitalize="none" spellcheck="false" required></label>' +
        '<label class="f">Mot de passe (8 caractères minimum)<input class="in" name="pw" type="password" minlength="8" autocomplete="new-password" required></label>' +
        '<label class="f">Mot de passe, encore une fois<input class="in" name="pw2" type="password" minlength="8" autocomplete="new-password" required></label>' +
        (msg ? '<div class="err">' + esc(msg) + '</div>' : '') +
        '<button class="btn primary" type="submit">Créer mon compte</button></form></div></div></div>';
    var f = $('#sf');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (f.pw.value !== f.pw2.value) return renderSetup('Les deux mots de passe ne sont pas identiques.');
      var login = slug(f.login.value);
      if (!login) return renderSetup('Choisissez un identifiant en lettres latines (par exemple « mayane »).');
      $('button[type=submit]', f).disabled = true;
      HPB.setup(login, f.pw.value, f.first.value.trim()).then(function () { return HPB.login(login, f.pw.value); }).then(function (u) {
        if (!u) throw new Error('connexion impossible');
        route.verified = true; sess(u); location.hash = '#/tableau'; route();
      }).catch(function (err) {
        var c = err && err.code;
        renderSetup(c === 'already_setup' ? 'Le compte de la professeure existe déjà : connectez-vous.' : c === 'invalid' ? 'Identifiant invalide ou mot de passe trop court (8 caractères minimum).' : 'Création impossible : ' + errText(err) + '.');
      });
    });
  }
  function renderFatal(msg) {
    root.innerHTML = '<div class="login-wrap"><div class="login card empty-state"><div class="big">🔌</div><p>' + esc(msg) + '</p>' +
      '<button class="btn" onclick="location.reload()">Recharger la page</button></div></div>';
  }

  /* ================= ESPACE ÉLÈVE ================= */
  function openStudent(id, preview) {
    Promise.all([HPB.getStudent(id), HPB.getContent(id), HPB.getProgress(id).then(function (p) { return preview ? p : freshest(id, p); })]).catch(function (e) {
      renderFatal('Impossible d\'ouvrir l\'espace (' + errText(e) + '). Rechargez la page.'); throw e;
    }).then(function (r) {
      var st = r[0], content = r[1], prog = r[2];
      if (!st) { sess(null); return renderLogin(); }
      var s = HPAstats(content);
      if (!s.words && !s.grammar) {
        root.innerHTML = '<div class="login-wrap"><div class="login card empty-state"><div class="big">🌱</div>' +
          '<h2 style="font-family:var(--font-display)">שָׁלוֹם ' + esc(st.first) + ' !</h2>' +
          '<p class="muted">Ton espace est en préparation : Maayane va y déposer tes premiers cours. Reviens bientôt.</p>' +
          '<button class="btn" id="out">' + (preview ? 'Retour au tableau de bord' : 'Se déconnecter') + '</button></div></div>';
        $('#out').onclick = preview ? closePreview : logout;
        return;
      }
      /* thèmes retirés depuis la dernière visite : on les enlève aussi des préférences de l'élève */
      if (prog && prog.preferences && content.VOCAB) {
        ['selectedThemes', 'knownThemes'].forEach(function (k) {
          if (Array.isArray(prog.preferences[k])) prog.preferences[k] = prog.preferences[k].filter(function (t) { return content.VOCAB[t]; });
        });
      }
      var head = '<script>window.__HP_DATA__=' + JSON.stringify(noNikud(content)).replace(/</g, '\\u003c') +
        ';window.__HP_KEY__=' + JSON.stringify(preview ? 'hp_preview' : 'hp_cache_' + id) +
        ';window.__HP_RAW__=' + JSON.stringify(prog ? JSON.stringify(prog) : '{}').replace(/</g, '\\u003c') +
        ';window.__HP_STUDENT__=' + (preview ? 'null' : JSON.stringify(id)) + ';' +
        /* la page d'accueil indique si l'agenda est ouvert et le prochain cours */
        'window.addEventListener("message",function(e){var d=e.data;if(e.source!==parent||!d)return;if(d.hp==="flush"){if(window.HPG&&HPG.flush)HPG.flush();return;}if(d.hp==="msg-info"){var q=document.getElementById("hp-q-dot");if(q)q.hidden=!d.n;return;}if(d.hp!=="agenda-info")return;var b=document.getElementById("hp-ag-btn"),n=document.getElementById("hp-ag-next");if(b)b.hidden=!d.show;if(n)n.textContent=String(d.next||"");});<\/script>' +
        '<style>' + SBAR_CSS + (content.tensesHtml ? '' : '.tab[data-tab="tenses"]{display:none!important}') + '</style>';   /* « Jeux de mots » : dans le code commun (source/exercices/app.html) */
      var bar = '<div class="hp-sbar' + (preview ? ' pv' : '') + '">' +
        (preview ? '<span>👁 Aperçu de l\'espace de <b>' + esc(fullName(st)) + '</b> — vos réponses ne sont pas enregistrées</span>'
                 : '<span class="hi"><span class="he">שָׁלוֹם</span> <b>' + esc(st.first) + '</b></span>') +
        '<button type="button" id="hp-px-btn" class="px" hidden onclick="window.HPX&&HPX.open()">🧩<span class="l"> Jeux de mots</span><span class="s"> Exos</span></button>' +
        (preview ? '' : '<button type="button" class="q" onclick="parent.postMessage({hp:\'ask\'},\'*\')">❓<span class="l"> Une question ?</span><span class="s"> Question</span><i id="hp-q-dot" hidden></i></button>') +
        (preview ? '' : '<button type="button" id="hp-dc-btn" class="dc" onclick="parent.postMessage({hp:\'docs\'},\'*\')">📄<span class="l"> Mes documents</span><span class="s"> Docs</span></button>') +
        (preview ? '' : '<span class="hp-ag"><small id="hp-ag-next"></small><button type="button" id="hp-ag-btn" class="ag" hidden onclick="parent.postMessage({hp:\'agenda\'},\'*\')">📅 Mes cours</button></span>') +
        '<button type="button" onclick="if(window.HPG&&HPG.flush)HPG.flush();parent.postMessage({hp:\'' + (preview ? 'close' : 'logout') + '\'},\'*\')">' + (preview ? '← Tableau de bord' : 'Se déconnecter') + '</button></div>';
      return getTpl().then(function (TPL) {
      var html = TPL.replace('<!--HP_HEAD-->', function () { return head; })
        .replace('<!--HP_BAR-->', function () { return bar; })
        .replace('<!--HP_TITLE-->', function () { return 'Hébreu · ' + esc(st.first); })
        .replace('<!--HP_TENSES-->', function () { return content.tensesHtml || ''; });
      root.innerHTML = '';
      var fr = document.createElement('iframe');
      fr.id = 'student-frame'; fr.title = 'Espace de révision de ' + fullName(st);
      /* espace élève isolé : il ne peut ni lire la page qui l'accueille, ni utiliser la session ouverte ;
         il ne communique que par messages (progression, déconnexion) */
      fr.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals allow-forms allow-downloads');
      root.appendChild(fr);
      frame = { el: fr, id: id, preview: !!preview };
      if (!preview) fr.addEventListener('load', function () { sendAgendaInfo(fr, id); sendMsgInfo(fr, id); });
      fr.srcdoc = html;
      document.title = 'Hébreu · ' + st.first;
      });
    }).catch(function (e) { if (!root.querySelector('#student-frame')) renderFatal('Impossible d\'ouvrir l\'espace (' + errText(e) + '). Rechargez la page.'); });
  }
  function HPAstats(c) { return HPA.stats(c); }
  /* demande de Maayane : pas de nikoud dans les exercices des élèves. Les données enregistrées gardent
     les voyelles (on peut revenir en arrière) ; seul ce qui est envoyé à l'espace élève en est privé.
     Les fiches de grammaire et le cours « Passé & futur » ne sont pas touchés. */
  function noNikud(c) {
    var N = /[\u0591-\u05BD\u05BF-\u05C7]/g;   /* garde le makaf ־ */
    function st(x) {
      if (typeof x === 'string') return x.replace(N, '');
      if (Array.isArray(x)) return x.map(st);
      if (x && typeof x === 'object') return Object.keys(x).reduce(function (o, k) { o[k.replace(N, '')] = st(x[k]); return o; }, {});
      return x;
    }
    var o = JSON.parse(JSON.stringify(c || {}));
    Object.keys(o.VOCAB || {}).forEach(function (t) {
      o.VOCAB[t] = (o.VOCAB[t] || []).map(function (e) {
        var r = e.slice(); if (r.length > 2) r[2] = '';
        if (r[3]) r[3] = st(r[3]); if (r[4]) r[4] = st(r[4]);
        return r;
      });
    });
    if (o.CONJ) o.CONJ = st(o.CONJ);
    if (o.VERB_PRESENT) o.VERB_PRESENT = st(o.VERB_PRESENT);
    return o;
  }
  function sendAgendaInfo(fr, id) {
    if (!HPB.agendaState) return;
    AG.barInfo(id).then(function (info) { if (fr.isConnected && fr.contentWindow) fr.contentWindow.postMessage({ hp: 'agenda-info', show: !!info.show, next: info.next }, '*'); });
  }
  var SBAR_CSS = '.hp-sbar{display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap;margin:0 0 14px;padding:8px 8px 8px 16px;border-radius:999px;background:var(--glass);border:1px solid var(--line);font-size:14px;color:var(--ink-soft)}' +
    '.hp-sbar .he{font-family:var(--font-he);color:var(--accent);font-weight:700}.hp-sbar b{color:var(--ink)}' +
    '.hp-sbar button{border:1.5px solid var(--line-strong);background:var(--paper);border-radius:999px;padding:6px 14px;font:700 13px var(--font-ui);color:var(--ink-soft);cursor:pointer}' +
    '.hp-sbar .hp-ag{display:flex;align-items:center;gap:10px;margin-left:auto}.hp-sbar .hp-ag small{font-size:12.5px;color:var(--ink-soft);font-weight:600}' +
    '.hp-sbar button.ag{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:var(--on-accent);border-color:transparent}' +
    '.hp-sbar button.q{position:relative}.hp-sbar button.q i{position:absolute;top:-2px;right:-2px;width:10px;height:10px;border-radius:50%;background:var(--rose);border:2px solid var(--paper)}' +
    '.hp-sbar button.q{border-color:var(--accent-soft);color:var(--accent)}.hp-sbar button.q .s{display:none}@media(max-width:560px){.hp-sbar button.q .l{display:none}.hp-sbar button.q .s{display:inline}}' +
    '.hp-sbar button.dc{border-color:var(--accent-soft);color:var(--accent)}.hp-sbar button.dc .s{display:none}@media(max-width:560px){.hp-sbar button.dc .l{display:none}.hp-sbar button.dc .s{display:inline}}' +
    '.hp-sbar button.px{border-color:var(--accent-soft);color:var(--accent)}.hp-sbar button.px .s{display:none}@media(max-width:560px){.hp-sbar button.px .l{display:none}.hp-sbar button.px .s{display:inline}}' +
    '@media(max-width:560px){.hp-sbar .hp-ag small{display:none}}' +
    '.hp-sbar button:hover{border-color:var(--accent-soft);color:var(--ink)}.hp-sbar button.ag:hover{color:var(--on-accent);border-color:transparent;filter:brightness(1.06)}' +
    '@media(max-width:420px){.hp-sbar{gap:6px;padding:8px;border-radius:18px;justify-content:center}.hp-sbar .hi{display:none}.hp-sbar .hp-ag{margin-left:0}.hp-sbar button{white-space:nowrap;padding:6px 10px}}.hp-sbar.pv{background:var(--peach);border-color:transparent;border-radius:18px}';
  function closePreview() { frame = null; location.hash = location.hash || '#/tableau'; loadAll().then(renderTeacher); }

  /* messages venant de l'espace élève : la page décide elle-même de quel élève il s'agit */
  var frame = null;
  window.addEventListener('message', function (e) {
    if (!frame || !frame.el.isConnected || e.source !== frame.el.contentWindow || !e.data || typeof e.data !== 'object') return;
    var m = e.data;
    if (m.hp === 'logout' && !frame.preview) { frame = null; logout(); return; }
    if (m.hp === 'close' && frame.preview) { closePreview(); return; }
    if (m.hp === 'ask' && !frame.preview) { var f1 = frame; openAsk(frame.id, function () { if (f1.el.isConnected) sendMsgInfo(f1.el, f1.id); }); return; }
    if (m.hp === 'docs' && !frame.preview) { openDocs(frame.id); return; }
    if (m.hp === 'agenda' && !frame.preview) { var f0 = frame; AG.openPane(frame.id, function () { if (f0.el.isConnected) sendAgendaInfo(f0.el, f0.id); }); return; }
    if (m.hp === 'progress' && !frame.preview) {
      var sum = cleanSummary(m.summary), storage = m.storage && typeof m.storage === 'object' ? m.storage : null;
      if (sum && storage) queuePush(frame.id, sum, storage);
    }
  });
  /* envois de progression un par un ; si plusieurs arrivent pendant un envoi, seul le plus récent part ensuite */
  var pushQueue = Promise.resolve(), nextPush = null;
  function backup(id, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem('hp_backup_' + id) || 'null');
      if (v === null) localStorage.removeItem('hp_backup_' + id); else localStorage.setItem('hp_backup_' + id, JSON.stringify(v));
    } catch (e) { return null; }
  }
  /* au retour de l'élève : si une copie locale non envoyée est plus récente que celle du serveur, on la reprend */
  function freshest(id, prog) {
    var b = backup(id);
    if (!b || !b.storage || !b.sum || !HPB.getSummary) return Promise.resolve(prog);
    return Promise.resolve(HPB.getSummary(id)).catch(function () { return null; }).then(function (srv) {
      var a = String(b.sum.updatedAt || ''), z = String((srv && srv.updatedAt) || '');
      if (a > z) { queuePush(id, b.sum, b.storage); return b.storage; }
      backup(id, null); return prog;
    });
  }
  function queuePush(id, sum, storage) {
    var first = !nextPush;
    nextPush = { id: id, sum: sum, storage: storage };
    if (!first) return;
    pushQueue = pushQueue.then(function () {
      var p = nextPush; nextPush = null;
      return Promise.resolve(HPB.pushProgress(p.id, p.sum, p.storage)).catch(function (e) {
        console.warn('progression', e);
        return new Promise(function (r) { setTimeout(r, 4000); }).then(function () { return HPB.pushProgress(p.id, p.sum, p.storage); });
      }).then(function () { backup(p.id, null); }, function () {
        /* pas de réseau : copie gardée dans ce navigateur, renvoyée à la prochaine ouverture de l'espace */
        backup(p.id, { sum: p.sum, storage: p.storage });
      });
    });
  }

  /* ================= MESSAGES : questions des élèves, réponses de Maayane ================= */
  function unreadTotal() { var u = cache.unread || {}; return Object.keys(u).reduce(function (n, k) { return n + (u[k] || 0); }, 0); }
  function msgSeen(id, v) {
    try { if (v === undefined) return localStorage.getItem('hp_msg_seen_' + id) || ''; localStorage.setItem('hp_msg_seen_' + id, v); } catch (e) { return ''; }
  }
  function msgTime(t) { try { return new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  /* conversation + zone d'écriture ; me = 'teacher' (fiche élève) ou 'student' (espace élève) */
  function msgBox(box, sid, me, first) {
    function draw(list) {
      var empty = me === 'teacher' ? 'Aucune question pour l\'instant.' : 'Pas encore de question. Un mot, une règle, un exercice qui coince ? Écris ici : Maayane te répond.';
      box.innerHTML = '<div class="msg-thread">' + (list.length ? list.map(function (m) {
        var mine = m.from === me;
        return '<div class="msg ' + (mine ? 'me' : 'them') + '"><div class="msg-b" dir="' + (/[A-Za-zÀ-ÿ]/.test(m.body) ? 'ltr' : 'rtl') + '">' + esc(m.body) + '</div><small>' +
          (m.from === 'teacher' ? (me === 'teacher' ? 'Vous' : 'Maayane') : (me === 'student' ? 'Toi' : esc(first || 'Élève'))) + ' · ' + msgTime(m.at) + '</small></div>';
      }).join('') : '<p class="muted small">' + empty + '</p>') + '</div>' +
        '<form class="msg-form"><textarea class="in" name="body" rows="3" maxlength="2000" dir="auto" required placeholder="' + (me === 'teacher' ? 'Votre réponse…' : 'Ta question pour Maayane…') + '"></textarea>' +
        '<button class="btn primary" type="submit">' + (me === 'teacher' ? 'Répondre' : 'Envoyer') + '</button></form>';
      var th = $('.msg-thread', box); th.scrollTop = th.scrollHeight;
      $('.msg-form', box).onsubmit = function (e) {
        e.preventDefault();
        var t = e.target.body.value.trim(); if (!t) return;
        busy($('button', e.target), HPB.sendMessage(sid, t, me), 'Envoi impossible').then(function () {
          toast(me === 'teacher' ? 'Réponse envoyée' : 'Question envoyée à Maayane ✓'); load();
        }).catch(function () {});
      };
    }
    function load() {
      return Promise.resolve(HPB.listMessages(sid)).then(function (list) {
        draw(list);
        if (me === 'teacher' && list.some(function (m) { return m.from === 'student' && !m.readAt; })) {
          Promise.resolve(HPB.markMessagesRead(sid)).then(function () {
            if (cache.unread) delete cache.unread[sid];
            var tb = document.querySelector('a[href$="/' + sid + '/messages"]'); if (tb) tb.textContent = 'Messages';
            var nv = document.querySelector('.bo-nav a[href="#/eleves"]'); if (nv) nv.outerHTML = nv.outerHTML.replace(/<span class="count"[^>]*>\d+<\/span>/, '');
          }).catch(function () {});
        }
        if (me === 'student') { var lt = list.filter(function (m) { return m.from === 'teacher'; }).pop(); if (lt) msgSeen(sid, lt.at); }
      }, function (e) {
        box.innerHTML = '<p class="muted">La messagerie n\'est pas encore disponible. Réessayez un peu plus tard.</p><p class="small muted">' + esc((e && e.message) || '') + '</p>';
      });
    }
    load();
  }
  /* côté élève : fenêtre « Mes questions » par-dessus l'espace de révision */
  function openAsk(sid, onClose) {
    var el = document.createElement('div');
    el.className = 'ag-pane'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Mes questions à Maayane');
    el.innerHTML = '<div class="ag-pane-in"><div class="ag-ptop"><button type="button" class="btn small" data-close>← Retour à mes révisions</button></div>' +
      '<h1 class="page-title">Une question ? <span class="grad" lang="he" dir="rtl">שאלה</span></h1><div class="card msg-card"><div id="ask-box"><p class="muted">Chargement…</p></div></div></div>';
    document.body.appendChild(el);
    var close = function () { el.remove(); document.removeEventListener('keydown', esc1); if (onClose) onClose(); };
    function esc1(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', esc1);
    $('[data-close]', el).onclick = close;
    msgBox($('#ask-box', el), sid, 'student');
  }
  /* côté élève : documents des cours que Maayane a choisi de lui montrer */
  function docIcon(d) { var k = HPA.kind(d); return k === 'pdf' ? '📕' : k === 'img' ? '🖼️' : (k === 'docx' || k === 'doc') ? '📘' : '📄'; }
  function openDocs(sid) {
    var el = document.createElement('div');
    el.className = 'ag-pane'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Mes documents');
    el.innerHTML = '<div class="ag-pane-in"><div class="ag-ptop"><button type="button" class="btn small" data-close>← Retour à mes révisions</button></div>' +
      '<h1 class="page-title">Mes documents <span class="grad" lang="he" dir="rtl">מסמכים</span></h1><div class="card"><div id="dc-box"><p class="muted">Chargement…</p></div></div></div>';
    document.body.appendChild(el);
    var close = function () { el.remove(); document.removeEventListener('keydown', esc1); };
    function esc1(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', esc1);
    $('[data-close]', el).onclick = close;
    var box = $('#dc-box', el);
    HPB.myDocs(sid).then(function (list) {
      if (!list.length) { box.innerHTML = '<p class="hp-empty">Aucun document pour l\'instant. Maayane les ajoute ici après les cours.</p>'; return; }
      box.innerHTML = '<div class="docs">' + list.map(function (d) {
        return '<div class="doc"><span class="ft" style="font-size:20px;background:none">' + docIcon(d) + '</span><div><div class="nm">' + esc(d.name) + '</div><div class="sb"><span>' +
          (d.at ? new Date(d.at).toLocaleDateString('fr-FR') : '') + '</span><span>' + Math.max(1, Math.round((d.size || 0) / 1024)) + ' Ko</span></div></div>' +
          '<div class="act">' + (/^(pdf|img|txt)$/.test(HPA.kind(d)) ? '<button class="btn small" data-view="' + esc(d.id) + '">👁 Visualiser</button>' : '') +
          '<button class="btn small primary" data-get="' + esc(d.id) + '">Télécharger</button></div></div>';
      }).join('') + '</div>';
      $$('[data-view]', box).forEach(function (b) {
        b.onclick = function () { viewDoc(sid, list.filter(function (d) { return d.id === b.dataset.view; })[0]); };
      });
      $$('[data-get]', box).forEach(function (b) {
        b.onclick = function () {
          /* la fenêtre s'ouvre tout de suite (sinon le navigateur la bloque), le fichier y arrive ensuite */
          var w = null; try { w = window.open('', '_blank'); } catch (e) {}
          busy(b, HPB.myDocUrl(sid, b.dataset.get), 'Téléchargement impossible').then(function (u) {
            if (!u) { if (w) w.close(); return toast('Fichier introuvable'); }
            if (w) w.location.href = u; else location.href = u;
          }).catch(function () { if (w) w.close(); });
        };
      });
    }, function (e) { box.innerHTML = '<p class="muted">Les documents ne sont pas disponibles pour l\'instant. Réessaie un peu plus tard.</p><p class="small muted">' + esc((e && e.message) || '') + '</p>'; });
  }
  /* lecture d'un document sur le site, sans le télécharger : PDF (pages dessinées une à une), image ou texte */
  function viewDoc(sid, d) {
    if (!d) return;
    var k = HPA.kind(d), el = document.createElement('div'), url = null;
    el.className = 'ag-pane'; el.style.zIndex = 1001; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', d.name);
    el.innerHTML = '<div class="ag-pane-in" style="max-width:900px"><div class="ag-ptop"><button type="button" class="btn small" data-close>← Retour à mes documents</button></div>' +
      '<h2 style="margin:0 0 12px;word-break:break-word">' + esc(d.name) + '</h2><div id="dv-box" style="display:grid;gap:12px"><p class="muted">Ouverture du document…</p></div></div>';
    document.body.appendChild(el);
    var closed = false, close = function () { closed = true; el.remove(); document.removeEventListener('keydown', esc1); if (url) URL.revokeObjectURL(url); };
    function esc1(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', esc1);
    $('[data-close]', el).onclick = close;
    var box = $('#dv-box', el);
    HPB.myDocUrl(sid, d.id, true).then(function (u) {
      if (!u) throw new Error('Fichier introuvable');
      return fetch(u).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); });
    }).then(function (blob) {
      if (closed) return;
      if (k === 'img') { url = URL.createObjectURL(blob); box.innerHTML = '<img src="' + url + '" alt="' + esc(d.name) + '" style="max-width:100%;height:auto;border-radius:12px;background:#fff">'; return; }
      if (k === 'txt') return blob.text().then(function (t) { box.innerHTML = '<pre class="card" dir="auto" style="white-space:pre-wrap;margin:0;font:inherit">' + esc(t) + '</pre>'; });
      return HPA.pdfLib().then(function (lib) { return blob.arrayBuffer().then(function (buf) { return lib.getDocument({ data: buf }).promise; }); }).then(function (pdf) {
        box.innerHTML = '';
        var n = Math.min(pdf.numPages, 300), i = 1, dpr = Math.min(window.devicePixelRatio || 1, 2);
        function next() {
          if (closed || i > n) return;
          return pdf.getPage(i).then(function (p) {
            var w = box.clientWidth || 600, vp = p.getViewport({ scale: w / p.getViewport({ scale: 1 }).width * dpr });
            var c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
            c.style.cssText = 'width:100%;height:auto;background:#fff;border-radius:8px;box-shadow:0 6px 20px -14px rgba(0,0,0,.4)';
            c.setAttribute('aria-label', 'Page ' + i + ' / ' + pdf.numPages);
            box.appendChild(c);
            return p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () { i++; return next(); });
          });
        }
        return next();
      });
    }).catch(function (e) {
      if (!closed) box.innerHTML = '<p class="muted">Impossible d\'afficher ce document ici. Tu peux le télécharger.</p><p class="small muted">' + esc((e && e.message) || '') + '</p>';
    });
  }
  /* pastille « nouvelle réponse » sur le bouton de l'espace élève */
  function sendMsgInfo(fr, id) {
    if (!HPB.listMessages) return;
    Promise.resolve(HPB.listMessages(id)).then(function (list) {
      var seen = msgSeen(id), n = list.filter(function (m) { return m.from === 'teacher' && m.at > seen; }).length;
      if (fr.isConnected && fr.contentWindow) fr.contentWindow.postMessage({ hp: 'msg-info', n: n }, '*');
    }).catch(function () {});
  }

  /* ================= BACK-OFFICE ================= */
  function nav(cur) {
    var pendingDocs = cache.docs.filter(function (d) { return d.status !== 'done'; }).length;
    var nb = AG.badge(), nq = unreadTotal(), nt = newTests();
    var items = [['tableau', 'Tableau de bord'], ['eleves', 'Élèves' + (nq ? '<span class="count" title="Questions non lues">' + nq + '</span>' : '')], ['agenda', 'Agenda' + (nb ? '<span class="count">' + nb + '</span>' : '')], ['documents', 'Documents' + (pendingDocs ? '<span class="count">' + pendingDocs + '</span>' : '')], ['tests', 'Tests de niveau' + (nt ? '<span class="count">' + nt + '</span>' : '')], ['reglages', 'Réglages']];
    return (HPB.remote ? '' : '<div class="demo-strip">Version de démonstration · <b>les données restent dans ce navigateur</b> — elles ne sont pas encore partagées entre appareils.</div>') +
      '<header class="bo-top"><a class="brand" href="#/tableau"><span class="logo">מ</span>Espace de Maayane' + (HPB.me && HPB.me.role === 'admin' ? ' <span class="pill grey">administrateur</span>' : '') + '</a>' +
      '<nav class="bo-nav">' + items.map(function (it) { return '<a href="#/' + it[0] + '" class="' + (cur === it[0] ? 'on' : '') + '"' + (cur === it[0] ? ' aria-current="page"' : '') + '>' + it[1] + '</a>'; }).join('') +
      '</nav><button class="btn small" id="lo">Se déconnecter</button></header>';
  }
  function renderTeacher() {
    var h = (location.hash || '#/tableau').slice(2).split('/');
    var page = h[0] || 'tableau';
    document.title = 'Espace de Maayane';
    var body;
    if (page === 'eleve' && h[1]) body = studentPage(h[1], h[2] || 'progression');
    else if (page === 'eleves') body = studentsPage();
    else if (page === 'documents') body = docsPage();
    else if (page === 'agenda') body = AG.page(h[1]);
    else if (page === 'reglages') body = settingsPage();
    else if (page === 'tests') body = testsPage();
    else { page = 'tableau'; body = dashboard(); }
    root.innerHTML = nav(page === 'eleve' ? 'eleves' : page) + '<main class="bo-main">' + body + '</main>';
    $('#lo').onclick = logout;
    bind(page, h);
  }

  /* ---------- calculs par élève ---------- */
  function metrics(s) {
    var sum = cache.summaries[s.id], now = new Date();
    var m = { xp: 0, level: 1, streak: 0, best: 0, last: null, xp7: 0, rate7: null, rate7p: null, mastered: 0, words: 0, days: {}, ans7: 0, goal: 60, active7: 0 };
    var c = HPA.stats(cache.contents[s.id]); m.words = c.words;
    m.docs = docsFor(s.id).filter(function (x) { return x.status !== 'done'; }).length * 1000 + docsFor(s.id).length;
    if (!sum) return m;
    var d = sum.days || {}, w0 = HP.rangeSum(d, HP.addDays(now, -6), 7), w1 = HP.rangeSum(d, HP.addDays(now, -13), 7);
    var st = HP.streaks(d);
    m.xp = sum.xp; m.level = HP.levelInfo(sum.xp).level; m.streak = st.cur; m.best = Math.max(st.best, sum.best || 0); m.days = d; m.goal = sum.goal || 60;
    m.last = Object.keys(d).filter(function (k) { return HP.dayActive(d[k]); }).sort().pop() || null;
    m.xp7 = w0.xp; m.rate7 = HP.rate(w0); m.rate7p = HP.rate(w1); m.ans7 = HP.dayGood(w0) + HP.dayBad(w0);
    m.mastered = sum.totals ? sum.totals.mastered : 0;
    for (var i = 0; i < 7; i++) if (HP.dayActive(d[HP.dayKey(HP.addDays(now, -i))])) m.active7++;
    return m;
  }
  function docsFor(id) { return cache.docs.filter(function (d) { return (d.students || []).indexOf(id) >= 0; }); }
  function deltaHtml(a, b) {
    if (a == null || b == null || a === b) return '';
    return ' <small class="hp-delta ' + (a > b ? 'up' : 'down') + '" aria-label="' + (a > b ? '+' : '−') + Math.abs(a - b) + ' par rapport à la semaine précédente"><i aria-hidden="true">' + (a > b ? '▲' : '▼') + '</i>' + Math.abs(a - b) + '</small>';
  }

  /* ---------- tableau de bord ---------- */
  function dashboard() {
    var S = cache.students.filter(function (s) { return s.active !== false; });
    var M = {}; S.forEach(function (s) { M[s.id] = metrics(s); });
    var active = S.filter(function (s) { return M[s.id].active7 > 0; }).length;
    var xp7 = S.reduce(function (a, s) { return a + M[s.id].xp7; }, 0);
    var rates = S.map(function (s) { return M[s.id].rate7; }).filter(function (r) { return r != null; });
    var avg = null;   /* calculée plus bas sur toutes les réponses de la classe (pondérée) */
    var pend = cache.docs.filter(function (d) { return d.status !== 'done'; }).length;
    var classDays = {};
    S.forEach(function (s) {
      var d = M[s.id].days;
      Object.keys(d).forEach(function (k) {
        var c = classDays[k] || (classDays[k] = HP.emptyDay());
        for (var f in c) c[f] += d[k][f] || 0;
      });
    });
    avg = HP.rate(HP.rangeSum(classDays, HP.addDays(new Date(), -6), 7));
    /* alertes */
    var alerts = [];
    S.forEach(function (s) {
      var q = (cache.unread || {})[s.id];
      if (q) alerts.push(['good', '💬', '<b>' + esc(fullName(s)) + '</b> vous a posé ' + (q > 1 ? q + ' questions' : 'une question') + '.', s.id, 'messages']);
    });
    S.forEach(function (s) {
      var m = M[s.id], n = m.last ? Math.round((HP.parseDay(HP.dayKey()) - HP.parseDay(m.last)) / 864e5) : null;
      if (!m.words) alerts.push(['', '📥', '<b>' + esc(fullName(s)) + '</b> n\'a encore aucun contenu : déposez ses premiers documents.', s.id, 'documents']);
      else if (n == null) alerts.push(['', '👋', '<b>' + esc(fullName(s)) + '</b> n\'a pas encore révisé.', s.id]);
      else if (n >= 7) alerts.push(['warn', '⏰', '<b>' + esc(fullName(s)) + '</b> n\'a pas révisé depuis ' + n + ' jours.', s.id]);
      if (m.rate7 != null && m.rate7p != null && m.rate7p - m.rate7 >= 10) alerts.push(['warn', '📉', 'Réussite de <b>' + esc(fullName(s)) + '</b> en baisse : ' + m.rate7p + ' % → ' + m.rate7 + ' % cette semaine.', s.id]);
      if (m.active7 >= 5) alerts.push(['good', '🔥', '<b>' + esc(fullName(s)) + '</b> a révisé ' + m.active7 + ' jours sur 7. Bravo !', s.id]);
    });
    return '<div class="bo-head"><div><h1 class="page-title">Bonjour ' + esc((HPB.me && HPB.me.first) || 'Maayane') + ' <span class="grad">שָׁלוֹם</span></h1>' +
        '<p>Vue d\'ensemble de vos élèves sur les 7 derniers jours.</p></div>' +
        '<div class="row"><a class="btn" href="#/agenda">📅 Agenda</a><button class="btn" data-act="upload">Déposer des documents</button><button class="btn primary" data-act="new">+ Créer un compte élève</button></div></div>' +
      '<div class="stack">' +
      '<div class="hp-kpis">' +
        '<div class="hp-kpi"><b>' + active + '<small class="hp-of"> / ' + S.length + '</small></b><span>élèves actifs cette semaine</span></div>' +
        '<div class="hp-kpi gold"><b>' + fmt(xp7) + '</b><span>XP gagnés par la classe</span></div>' +
        '<div class="hp-kpi green"><b>' + (avg == null ? '—' : avg + ' %') + '</b><span>réussite moyenne</span></div>' +
        '<div class="hp-kpi' + (pend ? ' rose' : '') + '"><b>' + pend + '</b><span>document' + (pend > 1 ? 's' : '') + ' à intégrer</span></div>' +
      '</div>' +
      '<div class="card"><h3>Vos élèves</h3>' + studentsTable(S, M) + '</div>' +
      '<div class="dash-grid"><div class="card"><h3>À surveiller</h3>' + (alerts.length ? '<div class="alerts">' + alerts.map(function (a) {
        return '<div class="alert ' + a[0] + '" data-open="' + a[3] + '" data-tab="' + (a[4] || 'progression') + '" tabindex="0" role="link"><span class="ic" aria-hidden="true">' + a[1] + '</span><span>' + a[2] + '</span></div>';
      }).join('') + '</div>' : '<p class="hp-empty">Rien à signaler.</p>') + '</div>' + AG.dashboardCard() + '</div>' +
      '<div class="card"><h3>Activité de la classe <small>XP par jour, 30 jours</small></h3>' + HP.xpBars(classDays, 30, 0) + '</div>' +
      '</div>';
  }
  function studentsTable(S, M, manage) {
    if (!S.length) return '<div class="empty-state"><div class="big">🎒</div><p class="muted">Aucun élève pour l\'instant.</p><button class="btn primary" data-act="new">+ Créer un compte élève</button></div>';
    var cols = [['name', 'Élève'], ['level', 'Niveau'], ['xp7', 'XP 7 j'], ['streak', 'Série'], ['rate7', 'Réussite 7 j'], ['mastered', 'Mots maîtrisés'], ['spark', '14 derniers jours'], ['last', 'Dernière activité'], ['docs', 'Docs']];
    if (manage) cols.push(['spark', '']);
    /* même échelle pour toutes les mini-courbes : les élèves se comparent d'un coup d'œil */
    var sparkMax = 1;
    S.forEach(function (s) { for (var i = 0; i < 14; i++) { var d = (M[s.id].days || {})[HP.dayKey(HP.addDays(new Date(), -i))]; if (d && d.xp > sparkMax) sparkMax = d.xp; } });
    var list = S.slice().sort(function (a, b) {
      var x, y;
      if (sortKey === 'name') { x = fullName(a).toLowerCase(); y = fullName(b).toLowerCase(); return x < y ? -sortDir : x > y ? sortDir : 0; }
      x = M[a.id][sortKey]; y = M[b.id][sortKey];
      if (x == null) x = sortKey === 'last' ? '' : -1; if (y == null) y = sortKey === 'last' ? '' : -1;
      return (x > y ? 1 : x < y ? -1 : 0) * sortDir;
    });
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + cols.map(function (c) {
      return '<th data-sort="' + c[0] + '" class="' + (sortKey === c[0] ? 'sorted' : '') + '"' + (c[0] === 'spark' ? '' : ' tabindex="0" aria-sort="' + (sortKey === c[0] ? (sortDir > 0 ? 'ascending' : 'descending') : 'none') + '"') + '>' + c[1] + (sortKey === c[0] ? (sortDir > 0 ? ' ↑' : ' ↓') : '') + '</th>';
    }).join('') + '</tr></thead><tbody>' + list.map(function (s) {
      var m = M[s.id], L = HP.levelInfo(m.xp), pd = docsFor(s.id).filter(function (d) { return d.status !== 'done'; }).length;
      return '<tr class="click" data-open="' + s.id + '" tabindex="0" aria-label="Ouvrir la fiche de ' + esc(fullName(s)) + '">' +
        '<td><div class="who">' + avatar(s) + '<div><b>' + esc(fullName(s)) + '</b><small class="mono">' + esc(s.login) + '</small></div></div></td>' +
        '<td><span class="lv"><span class="he">' + L.letter + '</span>' + L.level + '</span></td>' +
        '<td class="num">' + fmt(m.xp7) + '</td>' +
        '<td class="num">' + (m.streak ? '🔥 ' + m.streak : '—') + '</td>' +
        '<td class="num">' + (m.rate7 == null ? '—' : m.rate7 + ' %' + deltaHtml(m.rate7, m.rate7p)) + '</td>' +
        '<td class="num">' + fmt(m.mastered) + '<span class="muted" style="font-weight:500"> / ' + fmt(m.words) + '</span></td>' +
        '<td>' + HP.sparkline(m.days, 14, sparkMax) + '</td>' +
        '<td>' + ago(m.last) + '</td>' +
        '<td>' + (pd ? '<span class="pill rose">' + pd + ' à intégrer</span>' : '<span class="pill grey">' + docsFor(s.id).length + '</span>') + '</td>' +
        (manage ? '<td style="text-align:right"><button class="btn small ghost" data-delst="' + s.id + '" title="Supprimer le compte" aria-label="Supprimer le compte de ' + esc(fullName(s)) + '">🗑</button></td>' : '') + '</tr>';
    }).join('') + '</tbody></table></div>';
  }

  /* ---------- liste des élèves ---------- */
  function studentsPage() {
    var all = cache.students, M = {};
    all.forEach(function (s) { M[s.id] = metrics(s); });
    return '<div class="bo-head"><div><h1 class="page-title">Élèves</h1><p>' + all.length + ' compte' + (all.length > 1 ? 's' : '') + '. Cliquez sur un élève pour voir sa progression, ses documents et ses accès.</p></div>' +
      '<button class="btn primary" data-act="new">+ Créer un compte élève</button></div>' +
      '<div class="card">' + studentsTable(all, M, true) + '</div>';
  }

  /* ---------- fiche élève ---------- */
  function studentPage(id, tab) {
    var s = cache.students.filter(function (x) { return x.id === id; })[0];
    if (!s) return '<p>Élève introuvable. <a href="#/eleves">Retour</a></p>';
    var m = metrics(s), L = HP.levelInfo(m.xp), pd = docsFor(id).filter(function (d) { return d.status !== 'done'; }).length;
    var nc = AG.upcoming(id).length;
    var nq = (cache.unread || {})[id] || 0;
    var tabs = [['progression', 'Progression'], ['messages', 'Messages' + (nq ? ' (' + nq + ')' : '')], ['cours', 'Cours' + (nc ? ' (' + nc + ')' : '')], ['documents', 'Documents' + (pd ? ' (' + pd + ')' : '')], ['contenu', 'Contenu du site'], ['acces', 'Compte & accès']];
    var body = tab === 'messages' ? '<div class="card msg-card"><h3>Questions de ' + esc(s.first) + '</h3><div id="msg-box"><p class="muted">Chargement…</p></div></div>' : tab === 'cours' ? AG.studentTab(s) : tab === 'documents' ? stDocs(s) : tab === 'contenu' ? stContent(s) : tab === 'acces' ? stAccess(s) : stProgress(s, m);
    return '<a class="back" href="#/eleves">← Tous les élèves</a>' +
      '<div class="st-head">' + avatar(s, 'lg') + '<div style="flex:1;min-width:220px"><h1>' + esc(fullName(s)) +
        (s.active === false ? ' <span class="pill rose">suspendu</span>' : '') + '</h1>' +
        '<div class="meta"><span class="mono">' + esc(s.login) + '</span>' + (s.email ? '<span>✉️ ' + esc(s.email) + '</span>' : '') + (s.phone ? '<span>📱 ' + esc(s.phone) + '</span>' : '') +
        '<span>Niveau ' + L.level + ' · ' + L.title + '</span><span>Dernière activité : ' + ago(m.last) + '</span></div></div>' +
        '<button class="btn" data-act="preview" data-id="' + id + '">👁 Voir son espace</button></div>' +
      '<nav class="st-tabs">' + tabs.map(function (t) { return '<a href="#/eleve/' + id + '/' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '"' + (tab === t[0] ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav>' +
      body;
  }

  function stProgress(s, m) {
    var sum = cache.summaries[s.id];
    if (!sum) return '<div class="card empty-state"><div class="big">📊</div><p class="muted">' + esc(s.first) + ' ne s\'est pas encore entraîné(e). Les statistiques apparaîtront ici dès ses premières réponses.</p></div>';
    var now = new Date(), d = sum.days || {}, t = sum.totals || {};
    var w0 = HP.rangeSum(d, HP.addDays(now, -6), 7), w1 = HP.rangeSum(d, HP.addDays(now, -13), 7), d30 = HP.rangeSum(d, HP.addDays(now, -29), 30);
    var active30 = 0; for (var i = 0; i < 30; i++) if (HP.dayActive(d[HP.dayKey(HP.addDays(now, -i))])) active30++;
    var goalDays = 0; for (i = 0; i < 30; i++) { var x = d[HP.dayKey(HP.addDays(now, -i))]; if (x && x.goal) goalDays++; }
    var mix = [['Quiz', d30.qOk + d30.qKo, HP.rate({ qOk: d30.qOk, qKo: d30.qKo })], ['Flashcards', d30.fK + d30.fA + d30.fS, HP.rate({ fK: d30.fK, fA: d30.fA, fS: d30.fS })], ['Conjugaison', d30.cK + d30.cA + d30.cS, HP.rate({ cK: d30.cK, cA: d30.cA, cS: d30.cS })]];
    var mixMax = Math.max.apply(null, mix.map(function (r) { return r[1]; }).concat([1]));
    var fl = (t.fK || 0) + (t.fA || 0) + (t.fS || 0);
    return '<div class="stack">' +
      '<div class="card">' + HP.levelCard({ xp: sum.xp, days: d, goal: sum.goal }) + '</div>' +
      '<div class="hp-kpis">' +
        '<div class="hp-kpi"><b>' + fmt(w0.xp) + deltaHtml(w0.xp, w1.xp) + '</b><span>XP sur 7 jours</span></div>' +
        '<div class="hp-kpi green"><b>' + (m.rate7 == null ? '—' : m.rate7 + ' %') + deltaHtml(m.rate7, m.rate7p) + '</b><span>réussite sur 7 jours</span></div>' +
        '<div class="hp-kpi gold"><b>' + active30 + '/30</b><span>jours actifs</span></div>' +
        '<div class="hp-kpi sky"><b>' + goalDays + '</b><span>objectifs du jour atteints (30 j)</span></div>' +
        '<div class="hp-kpi green"><b>' + fmt(t.mastered) + '<small class="hp-of"> / ' + fmt(m.words) + '</small></b><span>mots maîtrisés</span></div>' +
        '<div class="hp-kpi sky"><b>' + (fl ? Math.round(100 * (t.fK || 0) / fl) + ' %' : '—') + '</b><span>flashcards sues (total)</span></div>' +
      '</div>' +
      '<div class="two">' +
        '<div class="card"><h3>Taux de réussite par semaine</h3>' + HP.rateLine(d, 8) + '</div>' +
        '<div class="card"><h3>XP par jour <small>30 jours</small></h3>' + HP.xpBars(d, 30, sum.goal) + '</div>' +
      '</div>' +
      '<div class="two">' +
        '<div class="card"><h3>Régularité</h3>' + HP.heatmap(d, 17) + '</div>' +
          '<div class="card"><h3>Activités <small>30 jours</small></h3>' + mix.map(function (r) {
            return '<div class="hp-theme" style="margin-bottom:8px"><div class="hp-theme-name">' + r[0] + '</div><div class="hp-theme-bar"><i class="solid" style="width:' + Math.round(100 * r[1] / mixMax) + '%"></i></div><div class="hp-theme-num">' + fmt(r[1]) + '</div></div>' +
              (r[1] ? '<div class="small muted" style="margin:-4px 0 10px">réussite ' + r[2] + ' %</div>' : '');
          }).join('') + '</div>' +
      '</div>' +
      '<div class="two">' +
        '<div class="card"><h3>Maîtrise par thème</h3>' + HP.themeBars(sum.themes) + '</div>' +
          '<div class="card"><h3>Mots ratés <small>' + ((sum.weak || []).length) + '</small></h3><p class="small muted" style="margin:-6px 0 10px">Tous les exercices : quiz, jeux et cartes (« à revoir »).</p>' + (sum.weak && sum.weak.length ? (function () {
            function li(w) {
              var d = w.q != null || w.f != null ? [w.q ? plural(w.q, 'erreur') + ' (exercices)' : '', w.f ? w.f + ' × à revoir (cartes)' : ''].filter(Boolean).join(' · ') : plural(w.bad, 'erreur') + ' sur ' + w.seen;
              return '<li><span class="he" lang="he" dir="rtl">' + esc(w.he) + '</span><span>' + esc(w.fr) + '</span><small>' + d + '</small></li>';
            }
            var top = sum.weak.slice(0, 15), rest = sum.weak.slice(15);
            return '<ul class="hp-weak">' + top.map(li).join('') + '</ul>' +
              (rest.length ? '<details style="margin-top:8px"><summary class="small"><b>Voir les ' + rest.length + ' autres</b></summary><ul class="hp-weak">' + rest.map(li).join('') + '</ul></details>' : '');
          })() : '<p class="hp-empty">Aucun mot raté pour l\'instant.</p>') + '</div>' +
      '</div>' +
      '<div class="card"><h3>Badges <small>' + Object.keys(sum.badges || {}).length + ' / ' + HP.BADGES.length + '</small></h3>' + HP.badgesGrid(sum.badges) + '</div>' +
      '<p class="small muted">Dernière révision enregistrée : ' + (sum.updatedAt ? new Date(sum.updatedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) : '—') + '. Record de série : ' + m.best + ' jours · meilleur combo : ' + (sum.bestCombo || 0) + ' bonnes réponses d\'affilée.</p>' +
    '</div>';
  }

  /* ---------- documents ---------- */
  function dropZone(target) {
    return '<div class="drop" id="drop" data-target="' + (target || '') + '" tabindex="0" role="button">' +
      '<div class="big">📄</div><b>Glissez-déposez vos documents ici</b>' +
      '<span class="muted small">ou cliquez pour choisir — PDF, Word (.docx), images (photo de tableau, fiche scannée), texte</span>' +
      '<input type="file" id="file" multiple accept=".pdf,.docx,.txt,.md,image/*" hidden></div>';
  }
  function docRow(d, opts) {
    var k = HPA.kind(d), ft = k === 'pdf' ? 'pdf' : (k === 'docx' || k === 'doc') ? 'doc' : k === 'img' ? 'img' : 'txt';
    var lbl = k === 'docx' ? 'DOCX' : k === 'img' ? 'IMG' : k.toUpperCase();
    var names = (d.students || []).map(function (id) { var s = cache.students.filter(function (x) { return x.id === id; })[0]; return s ? s.first : null; }).filter(Boolean);
    var status = d.status === 'done' ? '<span class="pill green">✓ Intégré' + (d.result ? ' · ' + plural(+d.result.words || 0, 'mot') + ', ' + plural(+d.result.grammar || 0, 'fiche') : '') + '</span>'
      : d.status === 'error' ? '<span class="pill rose">Échec de l\'analyse</span>' : '<span class="pill gold">À intégrer</span>';
    return '<div class="doc" data-doc="' + d.id + '"><span class="ft ' + ft + '">' + lbl + '</span>' +
      '<div><div class="nm">' + esc(d.name) + '</div><div class="sb">' + status + '<span>' + new Date(d.addedAt).toLocaleDateString('fr-FR') + '</span><span>' + Math.max(1, Math.round(d.size / 1024)) + ' Ko</span>' +
      (opts && opts.showStudents ? '<span>→ ' + (names.length ? esc(names.join(', ')) : '<em>aucun élève</em>') + '</span>' : '') + '</div>' +
      (d.summary ? '<div class="small muted" style="margin-top:4px">' + esc(d.summary) + '</div>' : '') +
      (d.error ? '<div class="small" style="color:var(--bad);margin-top:4px">' + esc(d.error) + '</div>' : '') + '</div>' +
      '<div class="act">' + (d.status !== 'done' ? '<button class="btn small primary" data-an="' + d.id + '">Analyser et intégrer</button>' : '<button class="btn small" data-an="' + d.id + '">Ré-analyser</button>') +
      ((d.students || []).length ? '<button class="btn small' + (isShared(d.id) ? ' primary' : '') + '" data-share="' + d.id + '" aria-pressed="' + isShared(d.id) + '" title="L\'élève peut voir et télécharger ce document dans son espace">' + (isShared(d.id) ? '✓ Visible par l\'élève' : '👁 Montrer à l\'élève') + '</button>' : '') +
      '<button class="btn small" data-dl="' + d.id + '">Ouvrir</button><button class="btn small ghost" data-rm="' + d.id + '" title="Supprimer">🗑</button></div>' +
      '<div class="rv-slot" style="grid-column:1/-1" id="rv-' + d.id + '"></div></div>';
  }
  /* documents que les élèves concernés peuvent voir et télécharger dans leur espace */
  function isShared(id) { return ((cache.settings || {}).sharedDocs || []).indexOf(id) >= 0; }
  /* élèves dont les documents sont analysés et ajoutés sans relecture (réglage de la professeure) */
  function isAuto(id) { return ((cache.settings || {}).autoIntegrate || []).indexOf(id) >= 0; }
  function autoDoc(d) { return !!(d.students || []).length && d.students.every(isAuto); }
  function analyseAllBtn(docs) {
    var todo = docs.filter(function (d) { return d.status !== 'done' && HPA.kind(d) !== 'doc' && (d.students || []).length; });
    if (todo.length < 2) return '';
    return '<button class="btn small primary" data-anall="' + todo.map(function (d) { return d.id; }).join(',') + '">Analyser les ' + todo.length + ' documents en attente</button>';
  }
  /* bouton « tout montrer / tout masquer » pour les documents d'un élève */
  function shareAllBtn(s, docs) {
    if (!docs.length) return '';
    var all = docs.every(function (d) { return isShared(d.id); });
    return '<button class="btn small' + (all ? '' : ' primary') + '" data-shareall="' + s.id + '" data-on="' + (all ? '0' : '1') + '" title="Un document donné à plusieurs élèves devient visible pour chacun d\'eux">' +
      (all ? 'Retirer tous les documents de son espace' : '👁 Montrer tous les documents à ' + esc(s.first)) + '</button>';
  }
  function stDocs(s) {
    var docs = docsFor(s.id);
    return '<div class="stack"><div class="card"><h3>Déposer des documents pour ' + esc(s.first) + '</h3>' + dropZone(s.id) +
      (isAuto(s.id) ? '<p class="small muted" style="margin:12px 0 0">Dès le dépôt, Claude lit le document, en extrait le vocabulaire et la grammaire et les ajoute directement à l\'espace de ' + esc(s.first) + ', sans relecture de votre part, et uniquement à partir de vos documents.</p>'
        : '<p class="small muted" style="margin:12px 0 0">Après le dépôt, cliquez sur « Analyser et intégrer » : Claude lit le document, en extrait le vocabulaire et la grammaire, puis vous montre ce qui sera ajouté à l\'espace de ' + esc(s.first) + '. Rien n\'est ajouté sans votre validation, et uniquement à partir de vos documents.</p>') +
      '<label class="ag-switch" style="margin-top:14px;font-size:14.5px"><input type="checkbox" data-auto="' + s.id + '"' + (isAuto(s.id) ? ' checked' : '') + '><span></span><b>Intégrer automatiquement les documents de ' + esc(s.first) + ' (sans relecture)</b></label></div>' +
      '<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:12px"><h3 style="margin:0">Documents de ' + esc(s.first) + ' <small>' + docs.length + '</small></h3><div class="row">' + shareAllBtn(s, docs) + analyseAllBtn(docs) + '</div></div>' +
      (docs.length ? '<div class="docs">' + docs.map(function (d) { return docRow(d); }).join('') + '</div>' : '<p class="hp-empty">Aucun document pour l\'instant.</p>') + '</div></div>';
  }
  function docsPage() {
    var docs = cache.docs, pend = docs.filter(function (d) { return d.status !== 'done'; });
    return '<div class="bo-head"><div><h1 class="page-title">Documents</h1><p>Déposez un document une seule fois et attribuez-le à un ou plusieurs élèves.</p></div></div>' +
      '<div class="stack"><div class="card"><h3>Nouveau dépôt</h3><p class="small muted" style="margin:-6px 0 10px">1. Choisissez les élèves concernés</p>' +
      '<div class="chips" id="targets" role="group" aria-label="Élèves concernés">' + cache.students.map(function (s) { return '<button type="button" class="chip" aria-pressed="false" data-sid="' + s.id + '"><i class="dot" style="background:' + stColor(s.id) + '"></i>' + esc(fullName(s)) + '</button>'; }).join('') +
        (cache.students.length > 1 ? '<button type="button" class="chip" aria-pressed="false" data-sid="*" style="border-style:dashed">Toute la classe</button>' : '') + '</div>' +
      '<p class="small muted" style="margin:14px 0 10px">2. Déposez les documents</p>' + dropZone('') + '</div>' +
      '<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:12px"><h3 style="margin:0">À intégrer <small>' + pend.length + '</small></h3>' + analyseAllBtn(pend) + '</div>' + (pend.length ? '<div class="docs">' + pend.map(function (d) { return docRow(d, { showStudents: true }); }).join('') + '</div>' : '<p class="hp-empty">Tout est intégré. 👌</p>') + '</div>' +
      '<div class="card"><h3>Déjà intégrés <small>' + (docs.length - pend.length) + '</small></h3>' + (docs.length - pend.length ? '<div class="docs">' + docs.filter(function (d) { return d.status === 'done'; }).map(function (d) { return docRow(d, { showStudents: true }); }).join('') + '</div>' : '<p class="hp-empty">Aucun.</p>') + '</div></div>';
  }

  /* ---------- tests de niveau (page publique #/test) ---------- */
  function seenTest(v) { try { if (v) localStorage.setItem('hp-lt-seen', v); return localStorage.getItem('hp-lt-seen') || ''; } catch (e) { return v || ''; } }
  function newTests() { var s = seenTest(); return cache.tests.filter(function (t) { return t.id > s; }).length; }
  var LT_PARTS = [['lettres', 'Lettres'], ['dec', 'Décollage'], ['vol', 'En vol'], ['att', 'Atterrissage'], ['lect', 'Lecture']];
  var LT_PILL = { 'Embarquement': 'rose', 'Décollage': 'gold', 'En vol': 'green', 'Atterrissage': 'grey' };
  function testsPage() {
    return '<div class="bo-head"><div><h1 class="page-title">Tests de niveau</h1><p>Les réponses au test de la page d\'accueil. Vous seule les voyez : la personne reçoit seulement un message de remerciement.</p></div></div>' +
      '<div class="stack" id="lt-list">' + (cache.testsError ? '<div class="card"><div class="err">Impossible de lire les tests : ' + esc(cache.testsError) + '</div></div>' : '') + (cache.tests.length ? cache.tests.map(testCard).join('') : '<div class="card"><p class="hp-empty">Aucun test pour l\'instant. Lien à partager : <b>' + esc(location.origin + location.pathname) + '#/test</b></p></div>') + '</div>';
  }
  function testCard(t) {
    var Q = (window.HPHome && HPHome.test && HPHome.test.questions) || [], sc = t.scores || {};
    var mail = /@/.test(t.contact), tel = String(t.contact || '').replace(/[^\d+]/g, '');
    var parts = t.reads === false ? '<span class="pill rose">Ne lit pas encore l\'hébreu</span>' : LT_PARTS.filter(function (p) { return sc[p[0]]; }).map(function (p) {
      var v = sc[p[0]], ok = v[0] / v[1] >= 0.65;
      return '<span class="pill ' + (ok ? 'green' : 'grey') + '">' + p[1] + ' ' + v[0] + ' / ' + v[1] + '</span>';
    }).join(' ');
    var rows = (t.answers || []).map(function (a) {
      var q = Q[a.q]; if (!q) return '';
      var good = q[0] === 'Lecture' ? (q[2] ? 'נכון' : 'לא נכון') : q[2][0];
      return '<li style="margin:6px 0">' + (a.ok ? '✅' : a.a == null ? '⬜' : '❌') + ' <span class="small muted">' + (a.q + 1) + '.</span> ' + (/[A-Za-z]/.test(q[1]) ? esc(q[1]) : '<span lang="he" dir="rtl" style="display:block;text-align:right">' + q[1].split('\n').map(esc).join('<br>') + '</span>') +
        (a.ok ? '' : '<br><span class="small muted">Réponse : ' + (a.a == null ? 'je ne sais pas' : '<span lang="he" dir="rtl">' + esc(a.a) + '</span>') + ' · attendu : <span lang="he" dir="rtl">' + esc(good) + '</span></span>') + '</li>';
    }).join('');
    return '<div class="card"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">' +
      '<div><h3 style="margin:0">' + esc(t.name) + ' <span class="pill ' + (LT_PILL[t.level] || 'grey') + '">' + esc(t.level) + '</span></h3>' +
      '<p class="small muted" style="margin:4px 0 0">' + new Date(t.at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) + (t.minutes != null ? ' · ' + Math.max(1, Math.round(t.minutes)) + ' min' : '') + ' · ' +
      '<a href="' + (mail ? 'mailto:' + esc(t.contact) : 'tel:' + esc(tel)) + '">' + esc(t.contact) + '</a>' +
      (!mail && tel.length >= 9 ? ' · <a href="https://wa.me/' + esc(tel.replace(/^\+/, '').replace(/^0/, '972')) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</p></div>' +
      '<button class="btn small ghost" data-rmtest="' + esc(t.id) + '" title="Supprimer ce test" aria-label="Supprimer le test de ' + esc(t.name) + '">🗑</button></div>' +
      '<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:12px">' + parts + '</div>' +
      (rows ? '<details style="margin-top:12px"><summary class="small"><b>Voir les réponses</b></summary><ol style="list-style:none;padding:0;margin:10px 0 0">' + rows + '</ol></details>' : '') + '</div>';
  }
  function bindTests() {
    if (!cache.tests.length) return;
    if (cache.tests[0].id > seenTest()) seenTest(cache.tests[0].id);
    $$('[data-rmtest]').forEach(function (b) {
      b.onclick = function () {
        var m = modal('<h2>Supprimer ce test ?</h2><p>Les réponses seront effacées définitivement.</p>' +
          '<div class="row" style="margin-top:16px"><button class="btn danger" data-yes>Supprimer</button><button class="btn" data-no>Annuler</button></div>');
        $('[data-no]', m).onclick = function () { m.remove(); };
        $('[data-yes]', m).onclick = function () {
          busy($('[data-yes]', m), HPB.deleteLevelTest(b.dataset.rmtest), 'Suppression impossible').then(function () {
            m.remove(); cache.tests = cache.tests.filter(function (t) { return t.id !== b.dataset.rmtest; }); renderTeacher();
          }).catch(function () {});
        };
      };
    });
  }

  /* ---------- contenu du site de l'élève ---------- */
  function stContent(s) {
    var c = cache.contents[s.id], st = HPA.stats(c);
    var themes = c ? Object.keys(c.VOCAB || {}) : [];
    return '<div class="two"><div class="card"><h3>Ce que voit ' + esc(s.first) + '</h3>' +
      '<div class="hp-kpis" style="margin-bottom:14px"><div class="hp-kpi"><b>' + st.themes + '</b><span>thèmes</span></div><div class="hp-kpi green"><b>' + fmt(st.words) + '</b><span>mots</span></div>' +
      '<div class="hp-kpi gold"><b>' + st.grammar + '</b><span>fiches de grammaire</span></div><div class="hp-kpi sky"><b>' + st.conj + '</b><span>verbes à conjuguer</span></div></div>' +
      (themes.length ? '<ul class="content-list">' + themes.map(function (t) {
        return '<li><span>' + esc(t) + '</span><span class="row"><span class="pill grey">' + c.VOCAB[t].length + ' mots</span><button class="btn small ghost" data-rmtheme="' + esc(t) + '" title="Retirer ce thème">🗑</button></span></li>';
      }).join('') + '</ul>' : '<p class="hp-empty">Aucun contenu : déposez des documents dans l\'onglet Documents.</p>') +
      (c && HPA.oldThemes(c).length ? '<div class="review" style="margin-top:14px"><b>🗂 Ranger dans les grands thèmes</b><p class="small muted" style="margin:4px 0 8px">' +
        plural(HPA.oldThemes(c).length, 'ancien thème', 'anciens thèmes') + ' à regrouper. Claude range chaque mot dans un grand thème (famille, maison, nourriture, temps…). Aucun mot n\'est supprimé ni modifié, et la progression de ' + esc(s.first) + ' est conservée.</p>' +
        '<button class="btn small primary" data-regroup="' + s.id + '">Ranger les mots de ' + esc(s.first) + '</button></div>' : '') +
      (st.tenses ? '<p class="small muted" style="margin-top:12px">+ le cours « Passé &amp; futur ».</p>' : '') +
      (st.words ? (function () { var miss = HPA.missingExtras(c).length;
        return '<div class="review" style="margin-top:14px"><b>🧩 Définitions et phrases à compléter</b><p class="small muted" style="margin:4px 0 8px">Pour les exercices « Mot ↔ définition » et « Phrase à compléter » de ' + esc(s.first) + '. ' +
          (miss ? plural(st.words - miss, 'mot en a', 'mots en ont') + ' sur ' + st.words + '.' : 'Tous ses mots en ont ✓') + '</p>' +
          (miss ? '<button class="btn small primary" data-enrich="' + s.id + '">Préparer pour les ' + plural(miss, 'mot restant', 'mots restants') + '</button>' : '') + '</div>'; })() : '') +
      (c && c.updatedAt ? '<p class="small muted">Dernière mise à jour : ' + new Date(c.updatedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) + '</p>' : '') + '</div>' +
      '<div class="card"><h3>Sources</h3>' + (c && c.sources && c.sources.length ? '<ul class="content-list">' + c.sources.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="hp-empty">—</p>') +
      '<h3 style="margin-top:22px">Importer un contenu préparé</h3><p class="small muted">Si un document a été analysé dans une conversation avec Claude, importez ici le fichier .json qu\'il vous a remis : vous pourrez le relire avant de l\'ajouter.</p>' +
      '<label class="btn small">Choisir un fichier .json<input type="file" accept=".json,application/json" id="imp" hidden></label><div id="rv-import"></div></div></div>';
  }

  /* ---------- compte & accès ---------- */
  function studentForm(s) {
    s = s || {};
    return '<div class="grid2"><label class="f">Prénom<input class="in" name="first" value="' + esc(s.first || '') + '" required></label>' +
      '<label class="f">Nom<input class="in" name="last" value="' + esc(s.last || '') + '"></label>' +
      '<label class="f">Adresse e-mail<input class="in" name="email" type="email" value="' + esc(s.email || '') + '" autocomplete="off"></label>' +
      '<label class="f">Téléphone<input class="in" name="phone" type="tel" value="' + esc(s.phone || '') + '" autocomplete="off"></label>' +
      '<label class="f">Identifiant<input class="in mono" name="login" value="' + esc(s.login || '') + '" autocapitalize="none" spellcheck="false" required></label>' +
      (s.id ? '' : '<label class="f">Mot de passe<span class="row" style="flex-wrap:nowrap"><input class="in mono" name="pw" value="' + HPB.genPassword() + '" required minlength="6"><button type="button" class="btn small" data-gen aria-label="Proposer un mot de passe" title="Proposer un mot de passe">↻</button></span></label>') +
      '</div>';
  }
  function stAccess(s) {
    return '<div class="two"><div class="card"><h3>Informations</h3><form id="edit">' + studentForm(s) +
      '<div class="row" style="margin-top:16px"><button class="btn primary" type="submit">Enregistrer</button><span id="edit-msg"></span></div></form></div>' +
      '<div class="stack" style="gap:18px"><div class="card"><h3>Identifiants de connexion</h3>' +
        (s.pw ? accessCard(s, s.pw) : '<p class="small muted">Mot de passe non enregistré pour ce compte : définissez-en un ci-dessous.</p>') +
        '<form id="pwf" style="margin-top:16px"><label class="f">Changer le mot de passe<span class="row" style="flex-wrap:nowrap"><input class="in mono" name="pw" id="pw-new" value="" placeholder="nouveau mot de passe" minlength="6" required autocomplete="off"><button type="button" class="btn small" data-gen title="Proposer un mot de passe">↻</button></span></label>' +
        '<div class="row" style="margin-top:10px"><button class="btn" type="submit">Enregistrer le nouveau mot de passe</button></div></form></div>' +
      '<div class="card" data-look="' + s.id + '"><h3>Couleur, personnage ou photo</h3><div class="row" style="gap:16px">' + avatar(s, 'lg') +
        '<div class="row"><button type="button" class="btn small" data-chars>🦸 ' + (look(s.id).char ? 'Changer de personnage' : 'Choisir un personnage') + '</button>' +
        '<label class="btn small">📷 ' + (look(s.id).photo ? 'Changer la photo' : 'Ajouter une photo') + '<input type="file" accept="image/*" data-photo hidden></label>' +
        (look(s.id).photo || look(s.id).char ? '<button type="button" class="btn small ghost" data-nophoto>Revenir aux initiales</button>' : '') + '</div></div>' +
        '<div class="swatches" role="group" aria-label="Couleur de ' + esc(s.first) + '">' + COLORS.map(function (c) {
          return '<button type="button" class="sw' + (c[0] === stColor(s.id) ? ' on' : '') + '" data-color="' + c[0] + '" style="background:' + c[0] + '" title="' + c[1] + '" aria-label="' + c[1] + '" aria-pressed="' + (c[0] === stColor(s.id)) + '"></button>';
        }).join('') + '</div>' +
        '<p class="small muted" style="margin:12px 0 0">La couleur repère ' + esc(s.first) + ' dans la liste des élèves et dans l\'agenda. Le personnage ou la photo ne sont visibles que par vous.</p></div>' +
      '<div class="card"><h3>Accès</h3><div class="row">' +
        (s.active === false ? '<button class="btn" data-act="activate">Réactiver le compte</button>' : '<button class="btn" data-act="suspend">Suspendre le compte</button>') +
        '<button class="btn danger" data-act="delete">Supprimer le compte</button></div><p class="small muted">Un compte suspendu ne peut plus se connecter ; sa progression est conservée.</p>' +
        '<div class="row" style="margin-top:14px"><button class="btn" data-act="resetprog">↺ Remettre à zéro sa progression</button></div>' +
        '<p class="small muted">Efface ses réponses, XP, séries et badges (par exemple après un essai). Son compte, son contenu et ses documents restent.</p></div></div></div>';
  }
  function accessCard(s, pw) {
    var site = (cache.settings && cache.settings.siteUrl) || (HPB.remote ? location.origin : '');
    var msg = 'Shalom ' + s.first + ' !\n\nVoici tes accès à ton espace de révision d\'hébreu' + (site ? ' : ' + site : '') + '\n\nIdentifiant : ' + s.login + '\nMot de passe : ' + pw + '\n\nÀ bientôt,\nMaayane';
    return '<div class="access"><div><div class="k">Identifiant</div><div class="v">' + esc(s.login) + '</div></div>' +
      '<div><div class="k">Mot de passe</div><div class="v">' + esc(pw) + '</div></div>' +
      (location.hash.indexOf('/acces') < 0 ? '<div class="small muted">Vous le retrouverez à tout moment dans la fiche de l\'élève, onglet « Compte & accès ».</div>' : '') +
      '<div class="row"><button class="btn small" data-copy="' + esc(msg) + '">Copier le message</button>' +
      (s.email ? '<a class="btn small" href="mailto:' + encodeURIComponent(s.email) + '?subject=' + encodeURIComponent('Tes accès — hébreu avec Maayane') + '&body=' + encodeURIComponent(msg) + '">✉️ Envoyer par e-mail</a>' : '') +
      (s.phone ? '<a class="btn small" href="sms:' + encodeURIComponent(s.phone.replace(/\s/g, '')) + '?&body=' + encodeURIComponent(msg) + '">📱 Envoyer par SMS</a>' : '') +
      '<a class="btn small" target="_blank" rel="noopener" href="https://wa.me/' + (s.phone ? s.phone.replace(/[^0-9]/g, '') : '') + '?text=' + encodeURIComponent(msg) + '">WhatsApp</a></div></div>';
  }

  /* ---------- réglages ---------- */
  function settingsPage() {
    var st = cache.settings || {};
    return '<div class="bo-head"><div><h1 class="page-title">Réglages</h1></div></div><div class="two">' +
      '<div class="card"><h3>Mon compte</h3><form id="tpw"><div class="stack" style="gap:12px">' +
        '<label class="f">Identifiant<input class="in mono" name="login" value="' + esc(HPB.remote ? (cache.teacherLogin || '') : DEMO.teacher[0]) + '" required></label>' +
        '<label class="f">Nouveau mot de passe <span class="muted" style="font-weight:500">(laisser vide pour le garder)</span><input class="in" type="password" name="pw" minlength="8" autocomplete="new-password"></label>' +
        '<button class="btn primary" type="submit">Enregistrer</button><span id="tpw-msg"></span></div></form></div>' +
      '<div class="stack" style="gap:18px"><div class="card"><h3>Adresse du site</h3><p class="small muted" style="margin-top:-6px">Elle est ajoutée aux messages d\'accès envoyés aux élèves.</p>' +
        '<form id="site" class="stack" style="gap:12px"><input class="in" name="url" placeholder="' + esc(HPB.remote ? location.origin : 'https://…') + '" value="' + esc(st.siteUrl || '') + '">' +
        (HPB.remote ? '<input type="hidden" name="code" value="">' : '<label class="f">Code d\'analyse <span class="muted" style="font-weight:500">(seulement si Benjamin vous en a donné un)</span><input class="in mono" name="code" value="' + esc(st.analyseCode || '') + '" autocomplete="off"></label>') +
        '<div><button class="btn" type="submit">Enregistrer</button></div></form></div>' +
      (HPB.remote ? '' : '<div class="card"><h3>Démonstration</h3><p class="small muted" style="margin-top:-6px">Remet le site dans son état de départ (comptes de test, contenus et statistiques fictives).</p>' +
        '<button class="btn danger" data-act="resetdemo">Réinitialiser la démo</button></div>') + '</div></div>';
  }

  /* ---------- modale de création ---------- */
  function modal(html) {
    var m = document.createElement('div'); m.className = 'modal';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="card"><button class="close" aria-label="Fermer">×</button>' + html + '</div>';
    var before = document.activeElement;
    function close() { m.remove(); document.removeEventListener('keydown', onEsc); if (before && before.focus) before.focus(); }
    function onEsc(e) { if (e.key === 'Escape' && m.isConnected) close(); }
    m.addEventListener('click', function (e) { if (e.target === m || e.target.classList.contains('close')) close(); });
    document.addEventListener('keydown', onEsc);
    document.body.appendChild(m);
    var first = m.querySelector('input, button:not(.close), a'); if (first) setTimeout(function () { first.focus(); }, 30);
    return m;
  }
  function newStudent() {
    var m = modal('<h2>Créer un compte élève</h2><form id="nf">' + studentForm() +
      '<div id="nf-msg" style="margin-top:10px"></div><div class="row" style="margin-top:16px"><button class="btn primary" type="submit">Créer le compte</button></div></form>');
    var f = $('#nf', m), touched = false;
    f.login.addEventListener('input', function () { touched = true; });
    function sug() { if (!touched) f.login.value = slug(f.first.value + (f.last.value ? '.' + f.last.value : '')); }
    f.first.addEventListener('input', sug); f.last.addEventListener('input', sug);
    $('[data-gen]', m).onclick = function () { f.pw.value = HPB.genPassword(); };
    f.first.focus();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var login = slug(f.login.value);
      if (!login) { $('#nf-msg', m).innerHTML = '<div class="err">Choisissez un identifiant en lettres latines (par exemple « sarah.cohen »).</div>'; return; }
      var btn = $('button[type=submit]', f); if (btn.disabled) return; btn.disabled = true;
      HPB.loginTaken(login).catch(function () { return false; }).then(function (taken) {
        btn.disabled = false;
        if (taken) { $('#nf-msg', m).innerHTML = '<div class="err">Cet identifiant est déjà utilisé.</div>'; return; }
        var s = { id: 's' + Date.now().toString(36), first: f.first.value.trim(), last: f.last.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), login: login, active: true, createdAt: new Date().toISOString() };
        var pw = f.pw.value.trim();
        btn.disabled = true;
        HPB.saveStudent(s, pw).catch(function (err) {
          btn.disabled = false;
          $('#nf-msg', m).innerHTML = '<div class="err">Création impossible : ' + esc(errText(err)) + '</div>';
          throw err;
        }).then(function () {
          cache.students.push(s);
          $('.card', m).innerHTML = '<button class="close" aria-label="Fermer">×</button><h2>Compte créé 🎉</h2><p class="muted">Transmettez ces accès à ' + esc(s.first) + '.</p>' + accessCard(s, pw) +
            '<div class="row" style="margin-top:16px"><a class="btn primary" href="#/eleve/' + s.id + '/documents">Déposer ses premiers documents</a></div>';
          bindCopy(m);
          $('.btn.primary', m).addEventListener('click', function () { m.remove(); });
          if (/eleves|tableau/.test(location.hash) || !location.hash) renderTeacher();
        }).catch(function () {});
      });
    });
  }
  function bindCopy(r) { $$('[data-copy]', r).forEach(function (b) { b.onclick = function () { copy(b.dataset.copy); }; }); }

  /* ---------- dépôt et analyse ---------- */
  function handleFiles(files, targets) {
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return;
    if (!targets.length) { toast('Choisissez d\'abord au moins un élève'); return; }
    var refused = files.filter(function (f) { var k = HPA.kind(f); return k === 'doc' || k === 'other'; });
    files = files.filter(function (f) { return refused.indexOf(f) < 0; });
    if (refused.length) toast(refused.map(function (f) { return f.name; }).join(', ') + ' : format non lu. Enregistrez-le en .docx ou en PDF.', true);
    if (!files.length) return;
    var drop = $('#drop'); if (drop) drop.classList.add('busy');
    var ok = 0;
    /* un par un : chaque ajout relit la liste, des ajouts simultanés s'écraseraient */
    files.reduce(function (p, f) {
      return p.then(function () { return HPB.addDoc(f, targets).then(function () { ok++; }, function (e) { toast(f.name + ' n\'a pas pu être déposé : ' + errText(e), true); }); });
    }, Promise.resolve()).then(function () {
      if (ok) toast(plural(ok, 'document déposé', 'documents déposés'));
      return loadAll();
    }).then(function () {
      renderTeacher();
      return autoRun();
    }, function (e) { if (drop) drop.classList.remove('busy'); toast('Dépôt interrompu : ' + errText(e), true); });
  }

  /* élèves en intégration automatique : tous leurs documents en attente sont analysés et ajoutés
     d'un coup, l'un après l'autre, sans clic. retry : reprend aussi ceux dont l'analyse a échoué. */
  var autoBusy = false, autoTried = {};
  function autoRun(retry) {
    if (autoBusy) return Promise.resolve();
    var ids = cache.docs.filter(function (d) {
      return d.status !== 'done' && (retry || (d.status !== 'error' && !autoTried[d.id])) && autoDoc(d) && HPA.kind(d) !== 'doc';
    }).map(function (d) { return d.id; });
    if (!ids.length) return Promise.resolve();
    autoBusy = true;
    ids.forEach(function (id) { autoTried[id] = 1; });
    if (ids.length > 1) toast('Analyse automatique de ' + ids.length + ' documents…');
    var stopped = false;
    return ids.reduce(function (p, id) { return p.then(function () { if (stopped) return; return runAnalysis(id).then(function (r) { if (r === 'stop') stopped = true; }); }); }, Promise.resolve())
      .then(function () { autoBusy = false; if (stopped) return; if (ids.length > 1) toast('Analyse automatique terminée'); return autoRun(); }, function () { autoBusy = false; });
  }

  function runAnalysis(docId) {
    var d = cache.docs.filter(function (x) { return x.id === docId; })[0];
    var slot = document.getElementById('rv-' + docId);
    if (!d || (!slot && !autoDoc(d))) return Promise.resolve();
    if (pending[docId]) return Promise.resolve();
    if (!(d.students || []).length) { toast('Ce document n\'est attribué à aucun élève.'); return Promise.resolve(); }
    var ctl = new AbortController(); pending[docId] = ctl;
    if (slot) {
      slot.innerHTML = '<div class="review"><b id="st-' + docId + '">Préparation…</b><div class="progress-line"><i></i></div><div class="row" style="margin-top:10px"><button class="btn small" data-stop>Arrêter</button></div></div>';
      $('[data-stop]', slot).onclick = function () { ctl.abort(); };
    } else toast('Analyse de « ' + d.name + ' » en cours…');
    var step = function (t) { var el = document.getElementById('st-' + docId); if (el) el.textContent = t; };
    /* la page a pu changer pendant l'analyse : on retrouve l'emplacement à jour */
    var here = function () { var el = document.getElementById('rv-' + docId); return el || null; };
    var themes = {};
    (d.students || []).forEach(function (id) { var c = cache.contents[id]; if (c) Object.keys(c.VOCAB || {}).forEach(function (t) { themes[t] = 1; }); });
    return HPB.getBlob(docId).then(function (blob) {
      if (!blob) throw new Error('Fichier introuvable.');
      return HPA.analyse(d, blob, Object.keys(themes), step, ctl.signal);
    }).then(function (res) {
      delete pending[docId];
      var el = here();
      if (autoDoc(d)) {
        if (el) el.innerHTML = '<div class="review"><b>Ajout à l\'espace de l\'élève…</b><div class="progress-line"><i></i></div></div>';
        HPA.markDuplicates(res, d.students.map(function (id) { return cache.contents[id]; }));
        return applyResult(d, res, d.students).then(function (a) {
          toast('« ' + d.name + ' » intégré automatiquement : ' + plural(a.words, 'mot') + ', ' + plural(a.grammar, 'fiche') + (res.skipped ? ' — ' + plural(res.skipped, 'partie illisible', 'parties illisibles') + ', « Ré-analyser » plus tard pour compléter' : ' ✓'), !!res.skipped);
          return loadAll();
        }).then(renderTeacher, function (e) { var x = here(); if (x) x.innerHTML = '<div class="review"><div class="err">Ajout impossible : ' + esc(errText(e)) + '</div></div>'; else toast('Ajout de « ' + d.name + ' » impossible : ' + errText(e), true); });
      }
      if (el) showReview(el, d, res);
      else { results[docId] = res; toast('Analyse de « ' + d.name + ' » terminée : ouvrez Documents pour la valider.', true); }
    }).catch(function (e) {
      delete pending[docId];
      var el = here();
      if (e && e.code === 'cancelled') { if (el) el.innerHTML = ''; return; }
      if (e && e.code === 'no_sample') { if (el) showManual(el, d, e.extracted); return; }
      var msg = e && (e.code === 'rate_limited' || e.code === 'busy') ? 'Claude est très sollicité en ce moment : réessayez dans quelques minutes.'
        : e && e.code === 'invalid_json' ? 'La réponse de Claude n\'était pas exploitable. Réessayez.'
        : e && e.code === 'no_credit' ? 'Le crédit de l\'analyse automatique est épuisé. Benjamin doit en racheter sur platform.claude.com (Billing), puis relancez l\'analyse. Le document reste à intégrer.'
        : e && e.code === 'spend_limit' ? 'Le budget mensuel de l\'analyse automatique est atteint. Benjamin peut le relever sur platform.claude.com (Settings › Limits), puis relancez l\'analyse.'
        : e && e.code === 'truncated' ? 'Une page de ce document contient trop de vocabulaire pour être analysée, même seule. Réessayez ; si l\'erreur revient, envoyez cette page en image ou en fichier séparé.'
        : e && e.code === 'timeout' ? 'L\'analyse a pris trop de temps. Réessayez, ou découpez le document.'
        : e && e.code === 'too_large' ? 'Les images de ce document sont trop lourdes : réduisez le nombre de pages ou de photos.'
        : e && e.code === 'network' ? 'Connexion internet interrompue pendant l\'analyse : le document reste à intégrer. Relancez l\'analyse.'
        : e && e.code === 'not_teacher' ? 'Connexion perdue pendant l\'analyse : le document reste à intégrer. Rechargez la page, puis relancez l\'analyse.'
        : e && e.code === 'bad_code' ? 'Le code d\'analyse est incorrect : vérifiez-le dans Réglages.'
        : e && e.code === 'server_error' ? 'L\'analyse a échoué (' + e.message + '). Réessayez dans un instant.'
        : e && (e.code === 'not_granted' || e.code === 'sampling_disabled') ? 'L\'analyse par Claude n\'est pas autorisée pour ce site. Utilisez l\'import manuel (onglet Contenu du site).'
        : (e && e.message) || 'Erreur inconnue.';
      if (el) el.innerHTML = '<div class="review"><div class="err">' + esc(msg) + '</div></div>';
      else toast('Analyse de « ' + d.name + ' » : ' + msg, true);
      /* connexion perdue ou session expirée : ce n'est pas la faute du document. On ne le marque pas en échec,
         et la série en cours s'arrête (sinon tous les documents suivants échoueraient de la même façon). */
      if (e && (e.code === 'not_teacher' || e.code === 'network' || e.code === 'no_credit' || e.code === 'spend_limit')) return 'stop';
      d.status = 'error'; d.error = msg;
      return Promise.resolve(HPB.updateDoc(d)).catch(function () {});
    });
  }

  function showManual(slot, d, ex) {
    var prompt = HPA.instructions([], d.name);
    slot.innerHTML = '<div class="review"><b>L\'analyse automatique n\'est pas encore activée sur ce site.</b>' +
      '<p class="small muted">Elle s\'active une fois pour toutes en ajoutant une clé Claude au site (voir le guide). En attendant : envoyez ce document à Claude dans une conversation avec la consigne ci-dessous, puis importez le fichier .json obtenu dans l\'onglet « Contenu du site » de l\'élève.</p>' +
      '<button class="btn small" data-copy="' + esc(prompt) + '">Copier la consigne pour Claude</button>' +
      (ex && ex.text ? '<details style="margin-top:10px"><summary class="small">Texte extrait du document (' + fmt(ex.text.length) + ' caractères)</summary><pre class="code">' + esc(ex.text.slice(0, 4000)) + (ex.text.length > 4000 ? '\n…' : '') + '</pre></details>' : '') + '</div>';
    bindCopy(slot);
  }

  function skippedNote(res) {
    return res && res.skipped ? '<p class="small err" style="margin:8px 0 0">⚠️ ' + (res.skipped > 1 ? res.skipped + ' parties du document n\'ont' : 'Une partie du document n\'a') + ' pas pu être lue' + (res.skipped > 1 ? 's' : '') + ' (Claude très sollicité ou page illisible). Le reste est bien là ; « Ré-analyser » plus tard complétera sans créer de doublons.</p>' : '';
  }
  function showReview(slot, d, res, targetIds) {
    var targets = targetIds || (d ? d.students : []) || [];
    HPA.markDuplicates(res, targets.map(function (id) { return cache.contents[id]; }));
    var nWords = res.themes.reduce(function (s, t) { return s + t.words.length; }, 0);
    /* mots déjà présents mais sans voyelles : la ré-analyse peut les compléter */
    var vfix = targets.reduce(function (m, id) {
      var dry = { themes: res.themes.map(function (t) { return { name: t.name, words: t.words.map(function (w) { return Object.assign({}, w, { keep: false }); }) }; }), grammar: [] };
      var r = HPA.merge(cache.contents[id], dry, ''); return Math.max(m, (r.vowels || 0) + (r.enriched || 0));
    }, 0);
    var names = targets.map(function (id) { var s = cache.students.filter(function (x) { return x.id === id; })[0]; return s ? s.first : ''; }).filter(Boolean);
    function render() {
      var keep = res.themes.reduce(function (s, t) { return s + t.words.filter(function (w) { return w.keep; }).length; }, 0) + res.grammar.filter(function (g) { return g.keep; }).length;
      slot.innerHTML = '<div class="review"><b>Résultat de l\'analyse</b>' + (res.summary ? '<p class="small muted" style="margin:4px 0 0">' + esc(res.summary) + '</p>' : '') + skippedNote(res) +
        '<p class="small">' + plural(nWords, 'mot') + ' dans ' + plural(res.themes.length, 'thème') + ', ' + plural(res.grammar.length, 'fiche') + ' de grammaire. Décochez ce que vous ne voulez pas ajouter. Les mots déjà présents sont grisés.</p>' +
        res.themes.map(function (t, ti) {
          return '<h4>' + esc(t.name) + ' <span class="pill grey">' + t.words.length + '</span></h4><table class="rv-words">' + t.words.map(function (w, wi) {
            return '<tr class="' + (w.dup ? 'dup' : '') + '"><td style="width:28px"><input type="checkbox" data-w="' + ti + ':' + wi + '"' + (w.keep ? ' checked' : '') + (w.dup ? ' disabled' : '') + '></td>' +
              '<td class="he">' + esc(w.heVoc || w.he) + '</td><td>' + esc(w.fr) + '</td><td class="small muted">' + ({ v: 'verbe', n: 'nom', a: 'adjectif', d: 'adverbe', o: 'mot-outil', c: 'nombre', x: 'expression' }[w.nature] || '') + (w.dup ? ' · déjà présent' : '') + '</td></tr>';
          }).join('') + '</table>';
        }).join('') +
        (res.grammar.length ? '<h4>Grammaire</h4>' + res.grammar.map(function (g, gi) {
          return '<details class="rv-gram"><summary><input type="checkbox" data-g="' + gi + '"' + (g.keep ? ' checked' : '') + '> ' + esc(g.title) + (g.he ? ' <span class="he-inline">' + esc(g.he) + '</span>' : '') + ' <span class="pill grey">' + esc(g.category) + '</span></summary><div class="body">' + g.body + '</div></details>';
        }).join('') : '') +
        (!nWords && !res.grammar.length ? '<p class="hp-empty">Aucun vocabulaire ni grammaire trouvé dans ce document.</p>' : '') +
        (vfix ? '<p class="small ok" style="margin-top:12px">' + (vfix > 1 ? vfix + ' mots déjà présents seront complétés' : '1 mot déjà présent sera complété') + ' (nikoud, définition ou phrase d\'exemple).</p>' : '') +
        '<div class="row" style="margin-top:16px"><button class="btn primary" data-apply' + ((keep || vfix) && names.length ? '' : ' disabled') + '>' +
          (keep ? 'Ajouter ' + keep + ' élément' + (keep > 1 ? 's' : '') : 'Compléter les mots') + ' à l\'espace de ' + esc(names.join(', ') || '…') + '</button>' +
        '<button class="btn" data-cancel>Annuler</button></div></div>';
      $$('[data-w]', slot).forEach(function (cb) { cb.onchange = function () { var p = cb.dataset.w.split(':'); res.themes[+p[0]].words[+p[1]].keep = cb.checked; render(); }; });
      $$('[data-g]', slot).forEach(function (cb) { cb.onclick = function (e) { e.stopPropagation(); }; cb.onchange = function () { res.grammar[+cb.dataset.g].keep = cb.checked; render(); }; });
      $('[data-cancel]', slot).onclick = function () { slot.innerHTML = ''; };
      $('[data-apply]', slot).onclick = function () {
        busy(this, applyResult(d, res, targets), 'Ajout impossible').then(function () { toast('Espace mis à jour ✓'); return loadAll(); }).then(renderTeacher).catch(function () {});
      };
    }
    render();
  }

  /* ajoute le résultat d'une analyse à l'espace des élèves, puis marque le document comme intégré */
  function applyResult(d, res, targets) {
    var name = d ? d.name : 'Import JSON', added = { words: 0, grammar: 0 };
    /* élève par élève, en relisant son contenu juste avant d'écrire */
    return targets.reduce(function (p, id) {
      return p.then(function () { return HPB.getContent(id); }).then(function (c) {
        var r = HPA.merge(c, res, name);
        added.words = Math.max(added.words, r.words); added.grammar = Math.max(added.grammar, r.grammar); added.vowels = Math.max(added.vowels || 0, r.vowels || 0);
        return HPB.setContent(id, r.content);
      });
    }, Promise.resolve()).then(function () {
      if (d) { d.status = 'done'; d.integratedAt = new Date().toISOString(); d.result = added; d.summary = res.summary || d.summary; delete d.error; delete results[d.id]; return HPB.updateDoc(d); }
    }).then(function () { return added; });
  }

  /* ---------- liaisons d'événements ---------- */
  function bind(page, h) {
    $$('[data-act="new"]').forEach(function (b) { b.onclick = newStudent; });
    $$('[data-act="upload"]').forEach(function (b) { b.onclick = function () { location.hash = '#/documents'; }; });
    function onKey(el, fn) { el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }); }
    $$('[data-open]').forEach(function (r) {
      var go = function () { location.hash = '#/eleve/' + r.dataset.open + '/' + (r.dataset.tab || 'progression'); };
      r.onclick = go; onKey(r, go);
    });
    $$('th[data-sort]').forEach(function (th) {
      var go = function () { var k = th.dataset.sort; if (k === 'spark') return; if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'name' || k === 'last' ? 1 : -1; } renderTeacher(); };
      th.onclick = go; onKey(th, go);
    });
    /* analyses terminées pendant que la page affichait autre chose */
    Object.keys(results).forEach(function (id) {
      var el = document.getElementById('rv-' + id), d = cache.docs.filter(function (x) { return x.id === id; })[0];
      if (el && d) showReview(el, d, results[id]);
    });
    $$('[data-anall]').forEach(function (b) {
      b.onclick = function () {
        var ids = b.dataset.anall.split(',').filter(Boolean);
        b.disabled = true;
        var stopped = false;
        ids.reduce(function (p, id, i) {
          return p.then(function () {
            if (stopped) return;
            b.textContent = 'Analyse ' + (i + 1) + ' / ' + ids.length + '…';
            return runAnalysis(id).then(function (r) { if (r === 'stop') stopped = true; });
          });
        }, Promise.resolve()).then(function () {
          if (stopped) { toast('Analyses interrompues : voyez le message sous le document concerné, puis relancez « Analyser ».', true); b.disabled = false; b.textContent = 'Relancer l\'analyse'; return; }
          if (b.isConnected) { b.textContent = 'Analyses terminées : validez-les ci-dessous'; }
        });
      };
    });
    $$('[data-act="preview"]').forEach(function (b) { b.onclick = function () { openStudent(b.dataset.id, true); }; });
    $$('[data-delst]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var st = cache.students.filter(function (x) { return x.id === b.dataset.delst; })[0];
        if (!st) return;
        var m = modal('<h2>Supprimer le compte de ' + esc(fullName(st)) + ' ?</h2>' +
          '<p class="muted">Son accès, ses contenus et toute sa progression seront effacés définitivement. Les documents déposés restent dans la page Documents.</p>' +
          '<p class="small muted">Pour bloquer l\'accès sans rien effacer, utilisez plutôt « Suspendre le compte » dans sa fiche.</p>' +
          '<div class="row" style="margin-top:16px"><button class="btn danger" data-yes>Supprimer définitivement</button><button class="btn" data-no>Annuler</button></div>');
        $('[data-no]', m).onclick = function () { m.remove(); };
        $('[data-yes]', m).onclick = function () {
          busy(this, HPB.deleteStudent(st.id), 'Suppression impossible').then(function () { m.remove(); toast('Compte de ' + st.first + ' supprimé'); return loadAll(); }).then(renderTeacher).catch(function () {});
        };
      };
    });
    bindCopy(document);
    if (page === 'agenda') AG.bind(h[1]);
    if (page === 'tableau' || (page === 'eleve' && h[2] === 'cours')) AG.bindStudentTab();

    /* dépôt */
    var drop = $('#drop');
    if (drop) {
      var input = $('#file'), targets = [];
      if (drop.dataset.target) targets = [drop.dataset.target];
      $$('#targets .chip').forEach(function (c) {
        c.onclick = function () {
          if (c.dataset.sid === '*') {
            var all = !$$('#targets .chip').filter(function (x) { return x.dataset.sid !== '*'; }).every(function (x) { return x.classList.contains('on'); });
            $$('#targets .chip').forEach(function (x) { x.classList.toggle('on', all); });
          } else c.classList.toggle('on');
          $$('#targets .chip').forEach(function (x) { x.setAttribute('aria-pressed', x.classList.contains('on') ? 'true' : 'false'); });
          targets = $$('#targets .chip.on').map(function (x) { return x.dataset.sid; }).filter(function (x) { return x !== '*'; });
        };
      });
      var pick = function () {
        if (!targets.length) { toast('Choisissez d\'abord le ou les élèves concernés'); var t = $('#targets'); if (t) { t.classList.add('shake'); setTimeout(function () { t.classList.remove('shake'); }, 600); } return; }
        input.click();
      };
      drop.onclick = pick;
      drop.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
      input.onchange = function () { handleFiles(input.files, targets); input.value = ''; };
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
      drop.addEventListener('drop', function (e) { handleFiles(e.dataTransfer.files, targets); });
    }
    $$('[data-an]').forEach(function (b) { b.onclick = function () { runAnalysis(b.dataset.an); }; });
    $$('[data-regroup]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.regroup, label = b.textContent; b.disabled = true;
        HPB.getContent(id).then(function (c) {
          return HPA.regroup(c, function (t) { if (b.isConnected) b.textContent = t; }).then(function (r) {
            /* le contenu a pu changer pendant l'analyse : on n'enregistre que s'il est identique */
            return HPB.getContent(id).then(function (c2) {
              if (JSON.stringify(c2.VOCAB) !== JSON.stringify(c.VOCAB)) throw new Error('le vocabulaire a changé entre-temps, recommencez');
              return HPB.setContent(id, r.content).then(function () { return r; });
            });
          });
        }).then(function (r) {
          toast(plural(r.moved, 'mot rangé', 'mots rangés') + ' ✓' + (r.kept ? ' · ' + plural(r.kept, 'mot placé', 'mots placés') + ' dans « Autres mots »' : ''));
          return loadAll();
        }).then(renderTeacher, function (e) {
          if (b.isConnected) { b.disabled = false; b.textContent = label; }
          toast('Rangement impossible : ' + (e && e.code === 'no_server' ? 'l\'analyse automatique n\'est pas activée' : errText(e)), true);
        });
      };
    });
    $$('[data-enrich]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.enrich, label = b.textContent; b.disabled = true;
        HPB.getContent(id).then(function (c) {
          return HPA.enrich(c, function (t) { if (b.isConnected) b.textContent = t; }).then(function (res) {
            return HPB.getContent(id).then(function (c2) { var r = HPA.merge(c2, res, ''); return HPB.setContent(id, r.content).then(function () { return r.enriched; }); });
          });
        }).then(function (n) { toast(plural(n || 0, 'mot complété', 'mots complétés') + ' ✓'); return loadAll(); }).then(renderTeacher, function (e) {
          if (b.isConnected) { b.disabled = false; b.textContent = label; }
          toast('Préparation impossible : ' + (e && e.code === 'no_server' ? 'l\'analyse automatique n\'est pas activée' : errText(e)), true);
        });
      };
    });
    $$('[data-look]').forEach(function (card) {
      var id = card.dataset.look, save = function (patch, msg) {
        return setLook(id, patch).then(function () { toast(msg); renderTeacher(); }, function (e) { toast('Enregistrement impossible : ' + errText(e), true); });
      };
      $$('[data-color]', card).forEach(function (b) { b.onclick = function () { save({ color: b.dataset.color }, 'Couleur enregistrée'); }; });
      var ph = $('[data-photo]', card), rm = $('[data-nophoto]', card);
      if (ph) ph.onchange = function () {
        var f = ph.files && ph.files[0]; ph.value = '';
        if (f) shrinkPhoto(f).then(function (d) { return save({ photo: d, char: '' }, 'Photo enregistrée'); }, function () { toast('Cette image n\'a pas pu être lue : essayez une photo en JPEG ou PNG.', true); });
      };
      if (rm) rm.onclick = function () { save({ photo: '', char: '' }, 'Initiales rétablies'); };
      var ch = $('[data-chars]', card);
      if (ch) ch.onclick = function () {
        var cur = look(id).char;
        var m = modal('<h2>Choisir un personnage</h2><div class="char-tabs">' + CHARS.map(function (g, i) { return '<button type="button" class="chip" data-cg="' + i + '">' + g[0] + '</button>'; }).join('') + '</div>' + CHARS.map(function (g) {
          return '<h4 class="char-h">' + g[0] + '</h4><div class="chars">' + g[1].map(function (c) {
            return '<button type="button" class="char' + (c[0] === cur ? ' on' : '') + '" data-char="' + c[0] + '" aria-label="' + esc(c[1]) + '"><span class="e" aria-hidden="true">' + c[0] + '</span><small>' + esc(c[1]) + '</small></button>';
          }).join('') + '</div>';
        }).join(''));
        $$('[data-cg]', m).forEach(function (b) { b.onclick = function () { $$('.char-h', m)[+b.dataset.cg].scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
        $$('[data-char]', m).forEach(function (b) { b.onclick = function () { m.remove(); save({ char: b.dataset.char, photo: '' }, 'Personnage enregistré'); }; });
      };
    });
    $$('[data-share]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.share, on = !isShared(id);
        busy(b, HPB.getSettings().then(function (st) {
          var l = (st.sharedDocs || []).filter(function (x) { return x !== id && cache.docs.some(function (d) { return d.id === x; }); });
          if (on) l.push(id);
          st.sharedDocs = l;
          return HPB.setSettings(st).then(function () { cache.settings = st; });
        }), 'Enregistrement impossible').then(function () {
          toast(on ? 'Document visible dans l\'espace de l\'élève' : 'Document retiré de l\'espace de l\'élève');
          renderTeacher();
        }).catch(function () {});
      };
    });
    $$('[data-shareall]').forEach(function (b) {
      b.onclick = function () {
        var ids = docsFor(b.dataset.shareall).map(function (d) { return d.id; }), on = b.dataset.on === '1';
        busy(b, HPB.getSettings().then(function (st) {
          var l = (st.sharedDocs || []).filter(function (x) { return ids.indexOf(x) < 0 && cache.docs.some(function (d) { return d.id === x; }); });
          if (on) l = l.concat(ids);
          st.sharedDocs = l;
          return HPB.setSettings(st).then(function () { cache.settings = st; });
        }), 'Enregistrement impossible').then(function () {
          toast(on ? (ids.length > 1 ? ids.length + ' documents visibles' : 'Document visible') + ' dans l\'espace de l\'élève' : 'Documents retirés de l\'espace de l\'élève');
          renderTeacher();
        }).catch(function () {});
      };
    });
    $$('[data-auto]').forEach(function (cb) {
      cb.onchange = function () {
        var id = cb.dataset.auto, on = cb.checked;
        cb.disabled = true;
        HPB.getSettings().then(function (st) {
          var l = (st.autoIntegrate || []).filter(function (x) { return x !== id; });
          if (on) l.push(id);
          st.autoIntegrate = l;
          return HPB.setSettings(st).then(function () { cache.settings = st; });
        }).then(function () {
          toast(on ? 'Intégration automatique activée' : 'Intégration automatique désactivée : vous relirez chaque document');
          renderTeacher();
          if (on) autoRun(true);
        }, function (e) { cb.checked = !on; cb.disabled = false; toast('Enregistrement impossible : ' + errText(e), true); });
      };
    });
    $$('[data-dl]').forEach(function (b) {
      b.onclick = function () {
        /* la fenêtre s'ouvre tout de suite (sinon le navigateur la bloque), le fichier s'y affiche ensuite */
        var w = null; try { w = window.open('', '_blank'); } catch (e) {}
        if (w) { try { w.document.title = 'Chargement…'; w.document.body.textContent = 'Chargement du document…'; } catch (e) {} }
        HPB.getBlob(b.dataset.dl).then(function (blob) {
          if (!blob) { if (w) w.close(); return toast('Fichier introuvable'); }
          var u = URL.createObjectURL(blob);
          if (w) w.location.href = u; else toast('Autorisez les fenêtres pop-up pour ouvrir le document');
          setTimeout(function () { URL.revokeObjectURL(u); }, 120000);
        }, function (e) { if (w) w.close(); toast('Ouverture impossible : ' + errText(e), true); });
      };
    });
    $$('[data-rm]').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.armed) { busy(b, HPB.deleteDoc(b.dataset.rm), 'Suppression impossible').then(loadAll).then(renderTeacher).catch(function () {}); return; }
        b.dataset.armed = 1; b.textContent = 'Confirmer ?'; b.classList.add('danger');
        setTimeout(function () { if (b.isConnected) { delete b.dataset.armed; b.textContent = '🗑'; b.classList.remove('danger'); } }, 3000);
      };
    });

    if (page === 'eleve') {
      var id = h[1], s = cache.students.filter(function (x) { return x.id === id; })[0];
      if (!s) return;
      if (h[2] === 'messages' && $('#msg-box')) msgBox($('#msg-box'), id, 'teacher', s.first);
      var ef = $('#edit');
      if (ef) ef.addEventListener('submit', function (e) {
        e.preventDefault();
        var login = slug(ef.login.value);
        if (!login) { $('#edit-msg').innerHTML = '<span class="err">Identifiant en lettres latines, chiffres et points uniquement</span>'; return; }
        var btn = $('button[type=submit]', ef);
        busy(btn, HPB.loginTaken(login, s.id).then(function (taken) {
          if (taken) { $('#edit-msg').innerHTML = '<span class="err">Identifiant déjà utilisé</span>'; return false; }
          var upd = Object.assign({}, s, { first: ef.first.value.trim(), last: ef.last.value.trim(), email: ef.email.value.trim(), phone: ef.phone.value.trim(), login: login });
          return HPB.saveStudent(upd).then(function () { Object.assign(s, upd); return true; });
        }), 'Enregistrement impossible').then(function (done) { if (done) { toast('Enregistré'); renderTeacher(); } }).catch(function () {});
      });
      var pwf = $('#pwf');
      if (pwf) {
        $('[data-gen]', pwf).onclick = function () { pwf.pw.value = HPB.genPassword(); };
        pwf.addEventListener('submit', function (e) {
          e.preventDefault();
          var pw = pwf.pw.value.trim(); if (pw.length < 6) return;
          busy($('button[type=submit]', pwf), HPB.saveStudent(Object.assign({}, s), pw), 'Changement impossible')
            .then(function () { s.pw = pw; toast('Mot de passe changé — pensez à le transmettre'); renderTeacher(); }).catch(function () {});
        });
      }
      var sp = $('[data-act="suspend"]') || $('[data-act="activate"]');
      if (sp) sp.onclick = function () {
        var upd = Object.assign({}, s, { active: s.active === false });
        busy(sp, HPB.saveStudent(upd), 'Modification impossible').then(function () { s.active = upd.active; renderTeacher(); }).catch(function () {});
      };
      var rp = $('[data-act="resetprog"]');
      if (rp) rp.onclick = function () {
        var m = modal('<h2>Remettre à zéro la progression de ' + esc(fullName(s)) + ' ?</h2>' +
          '<p class="muted">Ses réponses, ses XP, sa série de jours, ses badges et ses statistiques seront effacés : son espace repartira de zéro. Ses thèmes choisis, son contenu, ses documents et son compte sont conservés.</p>' +
          '<p class="small muted">Faites-le de préférence quand ' + esc(s.first) + ' n\'est pas en train de réviser.</p>' +
          '<div class="row" style="margin-top:16px"><button class="btn danger" data-yes>Remettre à zéro</button><button class="btn" data-no>Annuler</button></div>');
        $('[data-no]', m).onclick = function () { m.remove(); };
        $('[data-yes]', m).onclick = function () {
          /* on garde seulement ses préférences (thèmes choisis, sens des questions) ; la date de remise à zéro
             passe devant toute copie plus ancienne restée sur un appareil */
          var work = Promise.resolve(HPB.getProgress(s.id)).catch(function () { return null; }).then(function (old) {
            var storage = old && old.preferences && Array.isArray(old.preferences.selectedThemes) ? { preferences: old.preferences } : {};
            var sum = cleanSummary({ updatedAt: new Date().toISOString() });
            backup(s.id, null);
            return HPB.pushProgress(s.id, sum, storage).then(function () { cache.summaries[s.id] = sum; });
          });
          busy(this, work, 'Remise à zéro impossible').then(function () { m.remove(); toast('Progression de ' + s.first + ' remise à zéro'); return loadAll(); }).then(renderTeacher).catch(function () {});
        };
      };
      var del = $('[data-act="delete"]');
      if (del) del.onclick = function () {
        var m = modal('<h2>Supprimer le compte de ' + esc(fullName(s)) + ' ?</h2>' +
          '<p class="muted">Son accès, ses contenus et toute sa progression seront effacés définitivement.</p>' +
          '<div class="row" style="margin-top:16px"><button class="btn danger" data-yes>Supprimer définitivement</button><button class="btn" data-no>Annuler</button></div>');
        $('[data-no]', m).onclick = function () { m.remove(); };
        $('[data-yes]', m).onclick = function () {
          busy(this, HPB.deleteStudent(s.id), 'Suppression impossible').then(function () { m.remove(); toast('Compte de ' + s.first + ' supprimé'); location.hash = '#/eleves'; return loadAll(); }).then(renderTeacher).catch(function () {});
        };
      };
      $$('[data-rmtheme]').forEach(function (b) {
        b.onclick = function () {
          if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Retirer ?'; b.classList.add('danger'); return; }
          var t = b.dataset.rmtheme;
          busy(b, HPB.getContent(s.id).then(function (c) {
            c = c || HPA.emptyContent();
            delete c.VOCAB[t]; if (c.NATURE) delete c.NATURE[t];
            c.CORE_THEMES = (c.CORE_THEMES || []).filter(function (x) { return x !== t; });
            c.ADVANCED_THEMES = (c.ADVANCED_THEMES || []).filter(function (x) { return x !== t; });
            return HPB.setContent(s.id, c).then(function () { cache.contents[s.id] = c; });
          }), 'Retrait impossible').then(renderTeacher).catch(function () {});
        };
      });
      var imp = $('#imp');
      if (imp) imp.onchange = function () {
        var f = imp.files[0]; if (!f) return;
        f.text().then(function (t) {
          var r; try { r = HPA.normalise(JSON.parse(t)); } catch (e) { $('#rv-import').innerHTML = '<div class="err" style="margin-top:10px">Fichier JSON illisible.</div>'; return; }
          showReview($('#rv-import'), null, r, [s.id]);
        });
      };
    }
    if (page === 'tests') bindTests();
    if (page === 'reglages') {
      var tf = $('#tpw');
      tf.addEventListener('submit', function (e) {
        e.preventDefault();
        var login = slug(tf.login.value);
        if (!login) { $('#tpw-msg').innerHTML = '<span class="err">Identifiant en lettres latines, chiffres et points uniquement</span>'; return; }
        var btn = $('button[type=submit]', tf); btn.disabled = true;
        HPB.setTeacherPassword(login, tf.pw.value).then(function () {
          DEMO.teacher = [login, '••••']; cache.teacherLogin = login; if (HPB.me) HPB.me.login = login;
          $('#tpw-msg').innerHTML = '<span class="ok">Identifiant et mot de passe enregistrés</span>'; tf.pw.value = ''; btn.disabled = false;
        }, function (err) { btn.disabled = false; $('#tpw-msg').innerHTML = '<span class="err">' + esc(errText(err)) + '</span>'; });
      });
      $('#site').addEventListener('submit', function (e) {
        e.preventDefault(); cache.settings.siteUrl = e.target.url.value.trim(); cache.settings.analyseCode = e.target.code.value.trim();
        HPA.setCode(cache.settings.analyseCode); busy($('button[type=submit]', e.target), HPB.setSettings(cache.settings), 'Enregistrement impossible').then(function () { toast('Enregistré'); }).catch(function () {});
      });
      var rd = $('[data-act="resetdemo"]');
      if (rd) rd.onclick = function () {
        if (!rd.dataset.armed) { rd.dataset.armed = 1; rd.textContent = 'Confirmer : tout effacer'; return; }
        DEMO.teacher = DEMO_TEACHER.slice();
        HPB.reset().then(seedDemo).then(function () { sess(null); location.hash = '#/connexion'; renderLogin(); });
      };
    }
  }

  /* ================= DONNÉES DE DÉMONSTRATION ================= */
  function seedDemo() {
    return loadDemo().then(function (d) { return seedDemoWith(d.data, d.tenses); });
  }
  function seedDemoWith(DEMO_DATA, TENSES) {
    var full = DEMO_DATA, now = new Date();
    var allThemes = Object.keys(full.VOCAB);
    function subset(themes, gramCats, conj) {
      var c = { VOCAB: {}, NATURE: {}, CONJ: conj ? full.CONJ.slice(0, conj) : [], VERB_PRESENT: full.VERB_PRESENT, GRAMMAR_CATEGORIES: full.GRAMMAR_CATEGORIES.slice(0, gramCats), ADVANCED_THEMES: [], sources: ['Démo — extrait du site de Benjamin'] };
      themes.forEach(function (t) { c.VOCAB[t] = full.VOCAB[t]; c.NATURE[t] = full.NATURE[t] || ''; });
      c.CORE_THEMES = themes.slice();
      return c;
    }
    var benContent = JSON.parse(JSON.stringify(full)); benContent.tensesHtml = TENSES; benContent.sources = ['Démo — contenu actuel du site de Benjamin'];
    var students = [
      { id: 'demo-ben', first: 'Benjamin', last: 'Sarfati', login: 'benjamin', pw: 'ivrit2026', email: '', phone: '', content: benContent },
      { id: 'demo-lea', first: 'Léa', last: '(démo)', login: 'lea', pw: 'lea2026', email: '', phone: '', content: subset(allThemes.slice(0, 9).concat(['Couleurs', 'Chiffres (1-10)']), 3, 30), sim: { days: 45, p0: 0.55, p1: 0.8, act: 0.8, vol: [12, 40], seed: 7, recent: 4 } },
      { id: 'demo-noam', first: 'Noam', last: '(démo)', login: 'noam', pw: 'noam2026', email: '', phone: '', content: subset(['Bases & pronoms', 'Famille', 'Nourriture & repas', 'Couleurs', 'Chiffres (1-10)'], 1, 0), sim: { days: 30, p0: 0.7, p1: 0.55, act: 0.55, vol: [10, 30], seed: 3, stopAt: 9 } }
    ];
    var chain = HPB.setTeacherPassword(DEMO.teacher[0], DEMO.teacher[1]);
    students.forEach(function (st) {
      chain = chain.then(function () {
        var rec = { id: st.id, first: st.first, last: st.last, login: st.login, email: st.email, phone: st.phone, active: true, createdAt: now.toISOString(), demo: true };
        return HPB.saveStudent(rec, st.pw);
      }).then(function () { return HPB.setContent(st.id, st.content); }).then(function () {
        if (!st.sim) return;
        var storage = simulate(st.content, st.sim);
        return HPB.pushProgress(st.id, HP.summarize(storage, storage.progress, st.content.VOCAB), storage);
      });
    });
    return chain.then(seedAgenda);
  }

  /* agenda de démonstration : disponibilités habituelles et quelques cours autour d'aujourd'hui */
  function seedAgenda() {
    var tz; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
    var cfg = HPCal.norm({ open: true, tz: tz || 'Europe/Paris', durations: [60, 90, 120], step: 30, notice: 12, horizon: 6, buffer: 0, cancel: 24,
      message: 'Les cours ont lieu en visio (lien envoyé la veille) ou chez Maayane. Pense à apporter ton cahier !',
      rules: [{ d: 0, from: '10:00', to: '13:00' }, { d: 1, from: '17:00', to: '21:00' }, { d: 2, from: '17:00', to: '21:00' },
        { d: 3, from: '09:00', to: '12:00' }, { d: 3, from: '17:00', to: '21:00' }, { d: 4, from: '17:00', to: '21:00' }] });
    var today = HPCal.dayKey(Date.now(), cfg.tz);
    function next(wd, minDays, h, mi) {
      var k = HPCal.addDaysKey(today, minDays); while (HPCal.weekdayOfKey(k) !== wd) k = HPCal.addDaysKey(k, 1);
      var p = k.split('-'); return HPCal.zoned(+p[0], +p[1], +p[2], h, mi, cfg.tz);
    }
    var list = [
      ['demo-lea', next(2, 2, 18, 0), 90, 'student', 'J\'aimerais revoir le passé des verbes en פעל'],
      ['demo-noam', next(4, 2, 17, 0), 60, 'teacher', ''],
      ['demo-ben', next(0, 2, 10, 30), 120, 'student', ''],
      ['demo-lea', next(2, -12, 18, 0), 90, 'student', ''],
      ['demo-ben', next(3, -10, 9, 0), 120, 'teacher', '']
    ];
    return HPB.getSettings().then(function (s) { s.agenda = cfg; return HPB.setSettings(s); }).then(function () {
      return list.reduce(function (p, b) {
        return p.then(function () { return HPB.addBooking({ studentId: b[0], start: b[1], end: b[1] + b[2] * 60000, by: b[3], note: b[4] }).catch(function () {}); });
      }, Promise.resolve());
    });
  }

  /* activité fictive, pour montrer les graphiques de la démo */
  function simulate(content, o) {
    var seed = o.seed; function r() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var words = []; Object.keys(content.VOCAB).forEach(function (t) { content.VOCAB[t].forEach(function (e) { words.push(e[0] + '|' + e[1]); }); });
    var S = { wordStats: {}, flash: {}, conj: {}, excluded: [], preferences: {}, progress: { xp: 0, days: {}, badges: {}, goal: 60, bestCombo: 0, backfilled: HP.dayKey() } };
    var P = S.progress, X = HP.XP, fam = {}, combo = 0;
    for (var i = o.days; i >= 0; i--) {
      if (o.stopAt && i < o.stopAt) break;
      if (r() > o.act && !(o.recent && i <= o.recent)) continue;
      var day = HP.addDays(new Date(), -i), k = HP.dayKey(day), d = P.days[k] = HP.emptyDay();
      var prog = 1 - i / o.days, p = o.p0 + (o.p1 - o.p0) * prog, n = Math.round(o.vol[0] + r() * (o.vol[1] - o.vol[0]));
      for (var j = 0; j < n; j++) {
        var w = words[Math.floor(r() * Math.min(words.length, 40 + prog * words.length))], ok = r() < Math.min(0.9, p + Math.min(fam[w] || 0, 6) * 0.015);
        fam[w] = (fam[w] || 0) + 1;
        if (r() < 0.45) {
          var q = S.wordStats[w] || (S.wordStats[w] = { seen: 0, correct: 0, wrong: 0 });
          q.seen++; if (ok) { q.correct++; d.qOk++; d.xp += X.quizOk; } else { q.wrong++; d.qKo++; d.xp += X.quizKo; }
        } else {
          var f = S.flash[w] || (S.flash[w] = { seen: 0, known: 0, again: 0, soft: 0 });
          f.seen++; if (ok) { f.known++; d.fK++; d.xp += X.flashKnown; } else if (r() < 0.2) { f.soft++; d.fS++; d.xp += X.flashSoft; } else { f.again++; d.fA++; d.xp += X.flashAgain; }
        }
        combo = ok ? combo + 1 : 0; if (combo > P.bestCombo) P.bestCombo = combo;
      }
      if (d.xp >= P.goal) { d.goal = 1; d.xp += X.goal; }
      P.xp += d.xp;
      var ctx = HP.badgeContext(P, HP.totalsFrom(S, content.VOCAB), HP.themeMastery(S, content.VOCAB));
      HP.BADGES.forEach(function (b) { if (!P.badges[b.id] && b.test(ctx)) P.badges[b.id] = k; });
    }
    return S;
  }

  return { boot: boot, logout: logout, closePreview: closePreview };
})();
HPApp.boot();
