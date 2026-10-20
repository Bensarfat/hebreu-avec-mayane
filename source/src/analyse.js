/* =====================================================================
   HPA — analyse des documents déposés par Mayane et mise à jour des
   espaces élèves. Lecture : PDF (pdf.js), Word .docx (mammoth), images,
   texte. L'analyse elle-même est faite par Claude ; rien n'est ajouté à
   un élève sans validation de Mayane.
   ===================================================================== */
var HPA = (function () {
  'use strict';
  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFW = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var MAMMOTH = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
  var loaded = {};
  function script(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.onload = res;
      s.onerror = function () { delete loaded[src]; rej(new Error('Impossible de charger ' + src)); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }

  function kind(d) {
    var n = (d.name || '').toLowerCase(), t = d.type || '';
    if (t === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf';
    if (/\.docx$/.test(n) || /wordprocessingml/.test(t)) return 'docx';
    if (/\.doc$/.test(n) || t === 'application/msword') return 'doc';
    if (/^image\//.test(t) || /\.(png|jpe?g|webp|gif|heic)$/.test(n)) return 'img';
    if (/^text\//.test(t) || /\.(txt|md|csv)$/.test(n)) return 'txt';
    return 'other';
  }

  /* ---------- extraction : {text, images[]} ---------- */
  function canvasBlob(c) { return new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.85); }); }
  function fromPdf(blob, onStep) {
    return script(PDFJS).then(function () {
      var lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = PDFW;
      return blob.arrayBuffer().then(function (buf) { return lib.getDocument({ data: buf }).promise; });
    }).then(function (pdf) {
      var n = pdf.numPages, out = [], i = 1;
      function next() {
        if (i > n) return Promise.resolve();
        onStep && onStep('Lecture de la page ' + i + ' / ' + n);
        return pdf.getPage(i).then(function (p) {
          return p.getTextContent().then(function (tc) {
            out.push({ page: i, text: tc.items.map(function (x) { return x.str + (x.hasEOL ? '\n' : ' '); }).join(''), p: p });
            i++; return next();
          });
        });
      }
      return next().then(function () {
        var text = out.map(function (o) { return '--- page ' + o.page + ' ---\n' + o.text.trim(); }).join('\n\n');
        var chars = out.reduce(function (s, o) { return s + o.text.trim().length; }, 0);
        if (chars > 80 * n) return { text: text, images: [], pages: n };
        /* PDF scanné (peu de texte) : on envoie les pages en image */
        var imgs = [], max = Math.min(n, 40), j = 0;
        function snap() {
          if (j >= max) return Promise.resolve();
          onStep && onStep('Préparation de la page ' + (j + 1) + ' (document scanné)');
          var pg = out[j].p, vp = pg.getViewport({ scale: 1.6 });
          var c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
          return pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
            .then(function () { return canvasBlob(c); }).then(function (b) { imgs.push(b); j++; return snap(); });
        }
        return snap().then(function () { return { text: chars ? text : '', images: imgs, pages: n, scanned: true, cut: n > max }; });
      });
    });
  }
  function extract(doc, blob, onStep) {
    var k = kind(doc);
    if (k === 'pdf') return fromPdf(blob, onStep);
    if (k === 'docx') return script(MAMMOTH).then(function () {
      onStep && onStep('Lecture du document Word');
      return blob.arrayBuffer().then(function (buf) { return window.mammoth.extractRawText({ arrayBuffer: buf }); });
    }).then(function (r) { return { text: r.value || '', images: [] }; });
    if (k === 'img') return Promise.resolve({ text: '', images: [blob] });
    if (k === 'txt') return blob.text().then(function (t) { return { text: t, images: [] }; });
    if (k === 'doc') return Promise.reject(new Error('Les anciens fichiers Word (.doc) ne se lisent pas ici : enregistrez-le en .docx ou en PDF.'));
    return Promise.reject(new Error('Format non pris en charge.'));
  }

  /* ---------- consigne envoyée à Claude ---------- */
  var SCHEMA = '{\n' +
    '  "themes": [ { "name": "Nom du thème en français", "words": [ { "he_nikud": "mot avec nikoud", "fr": "traduction française", "nature": "n" } ] } ],\n' +
    '  "grammar": [ { "category": "Catégorie", "title": "Titre de la fiche", "he": "titre en hébreu", "html": "<p>…</p>" } ],\n' +
    '  "summary": "une phrase qui résume le contenu du document"\n}';
  /* consigne fixe (identique pour tous les morceaux d'un document : mise en cache par l'API) */
  function rules() {
    return 'Tu prépares le contenu de révision d\'un élève de Mayane, professeure d\'hébreu, à partir d\'UN document de cours qu\'elle a déposé.\n\n' +
      'RÈGLE ABSOLUE : n\'utilise QUE ce qui figure dans le document. N\'ajoute aucun mot, aucune règle, aucun exemple qui n\'y est pas. Si le document ne contient pas de vocabulaire ou de grammaire, renvoie des listes vides.\n\n' +
      'Vocabulaire : chaque mot hébreu du document avec sa traduction française. "he_nikud" = le mot avec nikoud (si le document n\'en donne pas, vocalise toi-même selon la norme standard, c\'est le seul ajout autorisé). "fr" = la traduction donnée par le document, sinon la tienne, courte. "nature" = une lettre : v verbe (à l\'infinitif si le document le donne ainsi), n nom, a adjectif, d adverbe, o mot-outil (préposition, pronom, conjonction), c nombre, x expression.\n' +
      'Regroupe les mots en thèmes en français ; si un thème existant (indiqué avec le document) convient, reprends exactement son nom.\n\n' +
      'Grammaire : une fiche par règle expliquée dans le document, en français, comme une fiche de révision claire : "html" n\'utilise que <p>, <ul>, <li>, <strong>, <em>, <br> et <div class="example"> pour les exemples, avec l\'hébreu dans <span class="he-inline">…</span>. Reprends les exemples du document.\n\n' +
      'Réponds UNIQUEMENT avec un objet JSON valide de cette forme :\n' + SCHEMA;
  }
  /* partie propre au document : son nom et les thèmes déjà présents */
  function context(existingThemes, docName) {
    return 'Document : « ' + docName + ' ».\nThèmes existants à réutiliser s\'ils conviennent : ' + (existingThemes && existingThemes.length ? existingThemes.join(' ; ') : '(aucun pour l\'instant)') + '.';
  }
  function instructions(existingThemes, docName) { return rules() + '\n\n' + context(existingThemes || [], docName); }

  function sampleFn() {
    try { return (window.claude && window.claude.use) ? window.claude.use('sample') : Promise.resolve(null); }
    catch (e) { return Promise.resolve(null); }
  }

  /* ---------- analyse via la fonction serveur du site (Vercel + clé Claude) ---------- */
  var serverCode = '', authFn = null;
  function setCode(c) { serverCode = c || ''; }
  function setAuth(f) { authFn = f; }
  function b64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = rej; r.readAsDataURL(blob);
    });
  }
  function toJpeg(blob) {
    return new Promise(function (res) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () {
        var k = Math.min(1, 1568 / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { res(b || blob); }, 'image/jpeg', 0.8);
      };
      im.onerror = function () { URL.revokeObjectURL(u); res(blob); };
      im.src = u;
    });
  }
  function parseJson(text) {
    var a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a < 0 || b <= a) { var e = new Error('invalid_json'); e.code = 'invalid_json'; throw e; }
    try { return JSON.parse(text.slice(a, b + 1)); } catch (x) { var e2 = new Error('invalid_json'); e2.code = 'invalid_json'; throw e2; }
  }
  var MAX_BODY = 3400000;   // Vercel refuse les requêtes de plus de 4,5 Mo
  function viaServer(ex, prompt, signal, onStep) {
    var imgs = ex.images.slice(0, 6);
    return Promise.all([Promise.all(imgs.map(function (b) { return toJpeg(b).then(b64); })), authFn ? authFn() : null]).then(function (r) {
      var list = [], total = prompt.system.length + prompt.prompt.length;
      r[0].forEach(function (x) { if (total + x.length < MAX_BODY) { list.push(x); total += x.length; } });
      if (r[0].length && !list.length) { var big = new Error('too_large'); big.code = 'too_large'; throw big; }
      onStep && onStep('Analyse par Claude… (souvent moins d\'une minute)');
      var h = { 'content-type': 'application/json' };
      if (serverCode) h['x-analyse-code'] = serverCode;
      if (r[1]) h.Authorization = 'Bearer ' + r[1];
      return fetch('/api/analyse', { method: 'POST', headers: h, body: JSON.stringify({ system: prompt.system, prompt: prompt.prompt, images: list }), signal: signal });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok) {
          /* d'abord « réponse coupée » : une réponse coupée peut être vide */
          if (j.truncated) { var t = new Error('truncated'); t.code = 'truncated'; throw t; }
          if (j.text) return parseJson(j.text);
        }
        var e = new Error(j.detail || j.error || ('HTTP ' + r.status));
        e.code = r.status === 404 || r.status === 405 || j.error === 'no_key' || j.error === 'not_configured' ? 'no_server'
          : r.status === 413 ? 'too_large' : r.status === 504 || j.error === 'timeout' ? 'timeout'
          : r.status === 402 || j.error === 'spend_limit' ? 'spend_limit' : r.status === 429 ? 'busy' : r.status === 401 && j.error === 'not_teacher' ? 'not_teacher'
          : j.error === 'bad_code' ? 'bad_code' : 'server_error';
        throw e;
      });
    }, function (err) {
      if (err && (err.name === 'AbortError' || err.code === 'cancelled')) { var c = new Error('cancelled'); c.code = 'cancelled'; throw c; }
      if (err && err.code) throw err;
      var e = new Error('network'); e.code = 'network'; throw e;
    });
  }
  function buildPrompt(ex, existingThemes, docName) {
    var text = ex.text.length > 180000 ? ex.text.slice(0, 180000) : ex.text;
    return { system: rules(), prompt: context(existingThemes, docName) +
      (text.trim() ? '\n\nTEXTE DU DOCUMENT :\n"""\n' + text + '\n"""' : '\n\nLe document est fourni en image(s) ci-jointe(s).') };
  }

  /* Un document long est analysé en plusieurs fois : la réponse de Claude a une longueur maximale
     (un résumé de cours dense en vocabulaire la dépasse vite). Le texte est coupé en morceaux,
     aux changements de page si possible ; si une réponse est quand même coupée, le morceau est
     redivisé en deux et réanalysé, jusqu'à ce que ça passe. Les pages scannées partent par 3. */
  var CHUNK = 9000, MIN_SPLIT = 1200, IMG_BATCH = 3;
  function chunks(text) {
    if (text.length <= CHUNK) return [text];
    var parts = text.split(/(?=--- page \d+ ---)/), out = [], cur = '';
    parts.forEach(function (p) {
      while (p.length > CHUNK) {
        if (cur) { out.push(cur); cur = ''; }
        var cut = p.lastIndexOf('\n', CHUNK); if (cut < CHUNK * 0.5) cut = CHUNK;
        out.push(p.slice(0, cut)); p = p.slice(cut);
      }
      if ((cur + p).length > CHUNK && cur) { out.push(cur); cur = ''; }
      cur += p;
    });
    if (cur.trim()) out.push(cur);
    return out;
  }
  /* coupe un texte en deux, au changement de page le plus proche du milieu, sinon à un retour à la ligne */
  function halves(text) {
    var mid = Math.floor(text.length / 2), re = /--- page \d+ ---/g, m, idx = -1, best = Infinity;
    while ((m = re.exec(text))) if (m.index > 0 && Math.abs(m.index - mid) < best) { best = Math.abs(m.index - mid); idx = m.index; }
    if (idx <= 0 || best > text.length * 0.3) { idx = text.lastIndexOf('\n', mid); if (idx < text.length * 0.2) idx = text.lastIndexOf(' ', mid); if (idx < text.length * 0.2) idx = mid; }
    return [text.slice(0, idx), text.slice(idx)];
  }
  function combine(list) {
    var themes = {}, order = [], grammar = [], gseen = {}, summaries = [], seen = {};
    list.forEach(function (r) {
      (r.themes || []).forEach(function (t) {
        if (!themes[t.name]) { themes[t.name] = { name: t.name, words: [] }; order.push(t.name); }
        (t.words || []).forEach(function (w) {
          var k = wkey(w.he, w.fr); if (seen[k]) return; seen[k] = 1;   /* un mot vu dans deux morceaux n'apparaît qu'une fois */
          themes[t.name].words.push(w);
        });
      });
      (r.grammar || []).forEach(function (g) { var k = (g.title || '').toLowerCase(); if (gseen[k]) return; gseen[k] = 1; grammar.push(g); });
      if (r.summary) summaries.push(r.summary);
    });
    return { themes: order.map(function (n) { return themes[n]; }).filter(function (t) { return t.words.length; }), grammar: grammar, summary: summaries.join(' ').slice(0, 400) };
  }
  function viaServerChunked(ex, existingThemes, docName, signal, onStep) {
    /* file d'attente des morceaux : texte d'abord, puis les pages scannées par paquets */
    var queue = [];
    (ex.text.trim() ? chunks(ex.text) : []).forEach(function (t) { queue.push({ text: t, images: [], depth: 0 }); });
    for (var i = 0; i < ex.images.length; i += IMG_BATCH) queue.push({ text: '', images: ex.images.slice(i, i + IMG_BATCH), depth: 0 });
    if (!queue.length) queue.push({ text: '', images: [], depth: 0 });
    var results = [], done = 0, themesSoFar = (existingThemes || []).slice();
    function label(t) {
      var total = done + queue.length + 1;
      return total > 1 ? t.replace('…', '… partie ' + (done + 1) + ' sur ' + total + ' (document long, analysé en plusieurs fois)') : t;
    }
    function next() {
      if (!queue.length) return Promise.resolve();
      var part = queue.shift();
      return viaServer(part, buildPrompt(part, themesSoFar, docName), signal, function (t) { onStep && onStep(label(t)); }).then(function (r) {
        var n = normalise(r); results.push(n); done++;
        n.themes.forEach(function (t) { if (themesSoFar.indexOf(t.name) < 0) themesSoFar.push(t.name); });   /* mêmes noms de thèmes d'un morceau à l'autre */
        return next();
      }, function (e) {
        /* réponse coupée ou trop longue à produire : on redivise ce morceau */
        if ((e.code !== 'truncated' && e.code !== 'timeout') || part.depth >= 6) throw e;
        /* réponse trop longue : on redivise ce morceau et on recommence */
        if (part.images.length > 1) {
          var h = Math.ceil(part.images.length / 2);
          queue.unshift({ text: '', images: part.images.slice(0, h), depth: part.depth + 1 }, { text: '', images: part.images.slice(h), depth: part.depth + 1 });
        } else if (part.text.length > MIN_SPLIT) {
          var hv = halves(part.text);
          queue.unshift({ text: hv[0], images: part.images, depth: part.depth + 1 }, { text: hv[1], images: [], depth: part.depth + 1 });
        } else throw e;
        return next();
      });
    }
    return next().then(function () { return results.length === 1 ? results[0] : combine(results); });
  }

  function analyse(doc, blob, existingThemes, onStep, signal) {
    return extract(doc, blob, onStep).then(function (ex) {
      if (!ex.text.trim() && !ex.images.length) throw new Error('Aucun texte lisible dans ce document.');
      return sampleFn().then(function (sample) {
        if (!sample) {
          return viaServerChunked(ex, existingThemes, doc.name, signal, onStep).catch(function (e) {
            if (e.code === 'no_server') { var n = new Error('no_sample'); n.code = 'no_sample'; n.extracted = ex; throw n; }
            throw e;
          });
        }
        var p = Promise.resolve(null);
        if (ex.images.length) p = sample.limits().then(function (l) { return l; }).catch(function () { return null; });
        return p.then(function (lim) {
          if (ex.images.length && !(lim && lim.images)) {
            if (!ex.text.trim()) { var e2 = new Error('Ce document est une image ou un scan, et l\'envoi d\'images n\'est pas disponible ici.'); throw e2; }
            ex.images = [];
          }
          var imgs = ex.images.slice(0, lim && lim.images ? lim.images.maxCount : 0);
          var text = ex.text.length > 180000 ? ex.text.slice(0, 180000) : ex.text;
          var prompt = instructions(existingThemes, doc.name) +
            (text.trim() ? '\n\nTEXTE DU DOCUMENT :\n"""\n' + text + '\n"""' : '\n\nLe document est fourni en image(s) ci-jointe(s).');
          onStep && onStep('Analyse par Claude…');
          var opts = { modelTier: 'complex', signal: signal, cache: false };
          if (imgs.length) opts.images = imgs;
          return sample.json(prompt, opts);
        });
      }).then(function (r) { return normalise(r); });
    });
  }

  /* ---------- nettoyage du résultat ---------- */
  var OK_TAGS = { P: 1, UL: 1, OL: 1, LI: 1, STRONG: 1, EM: 1, B: 1, I: 1, BR: 1, DIV: 1, SPAN: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TD: 1, TH: 1 };
  var OK_CLASS = { example: 1, 'he-inline': 1 };
  function clean(html) {
    var doc = new DOMParser().parseFromString('<div>' + String(html || '') + '</div>', 'text/html');
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) return;
        if (c.nodeType !== 1 || !OK_TAGS[c.tagName]) {
          if (c.nodeType === 1 && !/^(SCRIPT|STYLE|IFRAME|OBJECT)$/.test(c.tagName)) {
            walk(c); while (c.firstChild) node.insertBefore(c.firstChild, c);
          }
          node.removeChild(c); return;
        }
        Array.prototype.slice.call(c.attributes).forEach(function (a) {
          if (a.name === 'class') { var k = a.value.split(/\s+/).filter(function (x) { return OK_CLASS[x]; }).join(' '); if (k) c.setAttribute('class', k); else c.removeAttribute('class'); }
          else c.removeAttribute(a.name);
        });
        walk(c);
      });
    })(doc.body.firstChild);
    return doc.body.firstChild.innerHTML;
  }
  var NAT = { v: 1, n: 1, a: 1, d: 1, o: 1, c: 1, x: 1 };
  function str(x, max) { return typeof x === 'string' ? x.replace(/[<>]/g, '').trim().slice(0, max || 300) : ''; }
  function bare(he) { return String(he || '').replace(/[\u0591-\u05C7]/g, '').replace(/\s+/g, ' ').trim(); }
  function wkey(he, fr) { return bare(he) + '|' + String(fr || '').trim().toLowerCase(); }
  function normalise(r) {
    r = r && typeof r === 'object' ? r : {};
    var themes = (Array.isArray(r.themes) ? r.themes : []).map(function (t) {
      return {
        name: str(t && t.name, 80) || 'Divers',
        words: (Array.isArray(t && t.words) ? t.words : []).map(function (w) {
          /* accepte aussi un résultat déjà nettoyé (heVoc) : un second passage ne perd pas les voyelles */
          var he = bare(str(w && w.he) || str(w && w.he_nikud) || str(w && w.heVoc)), hv = str(w && w.he_nikud) || str(w && w.heVoc) || he, fr = str(w && w.fr), n = str(w && w.nature).charAt(0).toLowerCase();
          return { he: he, heVoc: hv, fr: fr, nature: NAT[n] ? n : 'n' };
        }).filter(function (w) { return w.he && w.fr; })
      };
    }).filter(function (t) { return t.words.length; });
    var grammar = (Array.isArray(r.grammar) ? r.grammar : []).map(function (g) {
      /* « html » (réponse de Claude) ou « body » (résultat déjà nettoyé) */
      return { category: str(g && g.category, 80) || 'Notes de cours', title: str(g && g.title, 160), he: str(g && g.he, 160), body: clean(g && (g.html != null ? g.html : g.body)) };
    }).filter(function (g) { return g.title && g.body; });
    return { themes: themes, grammar: grammar, summary: str(r.summary, 400) };
  }

  /* ---------- fusion dans le contenu d'un élève ---------- */
  function emptyContent() {
    return { VOCAB: {}, NATURE: {}, CONJ: [], CORE_THEMES: [], ADVANCED_THEMES: [], VERB_PRESENT: {}, GRAMMAR_CATEGORIES: [], sources: [] };
  }
  function existingKeys(c) {
    var k = {};
    Object.keys(c.VOCAB || {}).forEach(function (t) { c.VOCAB[t].forEach(function (e) { k[wkey(e[0], e[1])] = t; }); });
    return k;
  }
  function merge(content, result, docName) {
    var c = content ? JSON.parse(JSON.stringify(content)) : emptyContent();
    ['VOCAB', 'NATURE', 'VERB_PRESENT'].forEach(function (k) { if (!c[k]) c[k] = {}; });
    ['CONJ', 'CORE_THEMES', 'ADVANCED_THEMES', 'GRAMMAR_CATEGORIES', 'sources'].forEach(function (k) { if (!Array.isArray(c[k])) c[k] = []; });
    var keys = existingKeys(c), nw = 0, ng = 0, nv = 0;
    result.themes.forEach(function (t) {
      t.words.forEach(function (w) {
        var k = wkey(w.he, w.fr);
        /* mot déjà présent sans voyelles (anciennes analyses) : on lui ajoute celles du document */
        if (keys[k] && w.heVoc && w.heVoc !== w.he && /[\u0591-\u05C7]/.test(w.heVoc)) {
          (c.VOCAB[keys[k]] || []).forEach(function (e) {
            if (wkey(e[0], e[1]) === k && !/[\u0591-\u05C7]/.test(e[2] || '')) { e[2] = w.heVoc; nv++; }
          });
        }
        if (!w.keep || keys[k]) return;
        if (!c.VOCAB[t.name]) { c.VOCAB[t.name] = []; c.NATURE[t.name] = ''; if (c.CORE_THEMES.indexOf(t.name) < 0) c.CORE_THEMES.push(t.name); }
        var len = c.VOCAB[t.name].length;
        c.NATURE[t.name] = String(c.NATURE[t.name] || '').padEnd(len, 'n').slice(0, len) + w.nature;
        c.VOCAB[t.name].push([w.he, w.fr, w.heVoc]);
        keys[k] = t.name; nw++;
      });
    });
    result.grammar.forEach(function (g) {
      if (!g.keep) return;
      var cat = c.GRAMMAR_CATEGORIES.filter(function (x) { return x.name === g.category; })[0];
      if (!cat) { cat = { name: g.category, items: [] }; c.GRAMMAR_CATEGORIES.push(cat); }
      if (cat.items.some(function (x) { return x.title === g.title; })) return;
      cat.items.push({ title: g.title, he: g.he, body: g.body }); ng++;
    });
    if (docName && c.sources.indexOf(docName) < 0) c.sources.push(docName);
    return { content: c, words: nw, grammar: ng, vowels: nv };
  }
  /* contents : contenu de chaque élève visé ; un mot n'est « déjà présent » que si TOUS l'ont */
  function markDuplicates(result, contents) {
    contents = (Array.isArray(contents) ? contents : [contents]).map(function (c) { return existingKeys(c || emptyContent()); });
    if (!contents.length) contents = [{}];
    var seen = {};
    result.themes.forEach(function (t) {
      t.words.forEach(function (w) {
        var k = wkey(w.he, w.fr);
        w.dup = contents.every(function (keys) { return !!keys[k]; }) || !!seen[k];
        w.keep = !w.dup; seen[k] = 1;
      });
    });
    result.grammar.forEach(function (g) { g.keep = true; });
    return result;
  }
  function stats(c) {
    c = c || {};
    var themes = Object.keys(c.VOCAB || {}), words = 0;
    themes.forEach(function (t) { words += c.VOCAB[t].length; });
    var gram = (c.GRAMMAR_CATEGORIES || []).reduce(function (s, g) { return s + g.items.length; }, 0);
    return { themes: themes.length, words: words, grammar: gram, conj: (c.CONJ || []).length, tenses: !!c.tensesHtml };
  }

  return {
    kind: kind, extract: extract, analyse: analyse, normalise: normalise, merge: merge, markDuplicates: markDuplicates,
    stats: stats, emptyContent: emptyContent, instructions: instructions, rules: rules, context: context, SCHEMA: SCHEMA, sampleFn: sampleFn, setCode: setCode, setAuth: setAuth
  };
})();
