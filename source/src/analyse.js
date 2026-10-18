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
        var imgs = [], max = Math.min(n, 8), j = 0;
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
    '  "themes": [ { "name": "Nom du thème en français", "words": [ { "he": "mot sans nikoud", "he_nikud": "mot avec nikoud", "fr": "traduction française", "nature": "n" } ] } ],\n' +
    '  "grammar": [ { "category": "Catégorie", "title": "Titre de la fiche", "he": "titre en hébreu", "html": "<p>…</p>" } ],\n' +
    '  "summary": "une phrase qui résume le contenu du document"\n}';
  function instructions(existingThemes, docName) {
    return 'Tu prépares le contenu de révision d\'un élève de Mayane, professeure d\'hébreu, à partir d\'UN document de cours qu\'elle a déposé (« ' + docName + ' »).\n\n' +
      'RÈGLE ABSOLUE : n\'utilise QUE ce qui figure dans le document. N\'ajoute aucun mot, aucune règle, aucun exemple qui n\'y est pas. Si le document ne contient pas de vocabulaire ou de grammaire, renvoie des listes vides.\n\n' +
      'Vocabulaire : chaque mot hébreu du document avec sa traduction française. "he" = sans voyelles (nikoud), "he_nikud" = avec nikoud (si le document n\'en donne pas, vocalise toi-même selon la norme standard, c\'est le seul ajout autorisé). "fr" = la traduction donnée par le document, sinon la tienne, courte. "nature" = une lettre : v verbe (à l\'infinitif si le document le donne ainsi), n nom, a adjectif, d adverbe, o mot-outil (préposition, pronom, conjonction), c nombre, x expression.\n' +
      'Regroupe les mots en thèmes en français. Réutilise exactement un de ces thèmes existants s\'il convient : ' + (existingThemes.length ? existingThemes.join(' ; ') : '(aucun pour l\'instant)') + '.\n\n' +
      'Grammaire : une fiche par règle expliquée dans le document, en français, comme une fiche de révision claire : "html" n\'utilise que <p>, <ul>, <li>, <strong>, <em>, <br> et <div class="example"> pour les exemples, avec l\'hébreu dans <span class="he-inline">…</span>. Reprends les exemples du document.\n\n' +
      'Réponds UNIQUEMENT avec un objet JSON valide de cette forme :\n' + SCHEMA;
  }

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
    if (blob.type === 'image/jpeg' && blob.size < 3e6) return Promise.resolve(blob);
    return new Promise(function (res) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () {
        var k = Math.min(1, 2000 / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { res(b || blob); }, 'image/jpeg', 0.85);
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
  function viaServer(ex, prompt, signal, onStep) {
    var imgs = ex.images.slice(0, 6);
    return Promise.all([Promise.all(imgs.map(function (b) { return toJpeg(b).then(b64); })), authFn ? authFn() : null]).then(function (r) {
      var list = r[0];
      onStep && onStep('Analyse par Claude… (jusqu\'à une minute)');
      var h = { 'content-type': 'application/json' };
      if (serverCode) h['x-analyse-code'] = serverCode;
      if (r[1]) h.Authorization = 'Bearer ' + r[1];
      return fetch('/api/analyse', { method: 'POST', headers: h, body: JSON.stringify({ prompt: prompt, images: list }), signal: signal });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok && j.text) return parseJson(j.text);
        var e = new Error(j.detail || j.error || ('HTTP ' + r.status));
        e.code = r.status === 404 || r.status === 405 || j.error === 'no_key' ? 'no_server' : j.error === 'bad_code' ? 'bad_code' : 'server_error';
        throw e;
      });
    }, function (err) {
      if (err && err.name === 'AbortError') { var c = new Error('cancelled'); c.code = 'cancelled'; throw c; }
      var e = new Error('no_server'); e.code = 'no_server'; throw e;
    });
  }
  function buildPrompt(ex, existingThemes, docName) {
    var text = ex.text.length > 180000 ? ex.text.slice(0, 180000) : ex.text;
    return instructions(existingThemes, docName) +
      (text.trim() ? '\n\nTEXTE DU DOCUMENT :\n"""\n' + text + '\n"""' : '\n\nLe document est fourni en image(s) ci-jointe(s).');
  }

  function analyse(doc, blob, existingThemes, onStep, signal) {
    return extract(doc, blob, onStep).then(function (ex) {
      if (!ex.text.trim() && !ex.images.length) throw new Error('Aucun texte lisible dans ce document.');
      return sampleFn().then(function (sample) {
        if (!sample) {
          return viaServer(ex, buildPrompt(ex, existingThemes, doc.name), signal, onStep).catch(function (e) {
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
  function str(x) { return typeof x === 'string' ? x.trim() : ''; }
  function normalise(r) {
    r = r && typeof r === 'object' ? r : {};
    var themes = (Array.isArray(r.themes) ? r.themes : []).map(function (t) {
      return {
        name: str(t && t.name) || 'Divers',
        words: (Array.isArray(t && t.words) ? t.words : []).map(function (w) {
          var he = str(w && w.he), hv = str(w && w.he_nikud) || he, fr = str(w && w.fr), n = str(w && w.nature).charAt(0).toLowerCase();
          if (!he && hv) he = hv.replace(/[֑-ׇ]/g, '');
          return { he: he, heVoc: hv, fr: fr, nature: NAT[n] ? n : 'n' };
        }).filter(function (w) { return w.he && w.fr; })
      };
    }).filter(function (t) { return t.words.length; });
    var grammar = (Array.isArray(r.grammar) ? r.grammar : []).map(function (g) {
      return { category: str(g && g.category) || 'Notes de cours', title: str(g && g.title), he: str(g && g.he), body: clean(g && g.html) };
    }).filter(function (g) { return g.title && g.body; });
    return { themes: themes, grammar: grammar, summary: str(r.summary) };
  }

  /* ---------- fusion dans le contenu d'un élève ---------- */
  function emptyContent() {
    return { VOCAB: {}, NATURE: {}, CONJ: [], CORE_THEMES: [], ADVANCED_THEMES: [], VERB_PRESENT: {}, GRAMMAR_CATEGORIES: [], sources: [] };
  }
  function existingKeys(c) {
    var k = {};
    Object.keys(c.VOCAB || {}).forEach(function (t) { c.VOCAB[t].forEach(function (e) { k[e[0] + '|' + e[1]] = t; k['he:' + e[0]] = t; }); });
    return k;
  }
  function merge(content, result, docName) {
    var c = content ? JSON.parse(JSON.stringify(content)) : emptyContent();
    ['VOCAB', 'NATURE', 'VERB_PRESENT'].forEach(function (k) { if (!c[k]) c[k] = {}; });
    ['CONJ', 'CORE_THEMES', 'ADVANCED_THEMES', 'GRAMMAR_CATEGORIES', 'sources'].forEach(function (k) { if (!Array.isArray(c[k])) c[k] = []; });
    var keys = existingKeys(c), nw = 0, ng = 0;
    result.themes.forEach(function (t) {
      t.words.forEach(function (w) {
        if (!w.keep || keys['he:' + w.he]) return;
        if (!c.VOCAB[t.name]) { c.VOCAB[t.name] = []; c.NATURE[t.name] = ''; if (c.CORE_THEMES.indexOf(t.name) < 0) c.CORE_THEMES.push(t.name); }
        c.VOCAB[t.name].push([w.he, w.fr, w.heVoc]);
        c.NATURE[t.name] = (c.NATURE[t.name] || '') + w.nature;
        keys['he:' + w.he] = t.name; nw++;
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
    return { content: c, words: nw, grammar: ng };
  }
  function markDuplicates(result, content) {
    var keys = existingKeys(content || emptyContent()), seen = {};
    result.themes.forEach(function (t) {
      t.words.forEach(function (w) {
        w.dup = !!keys['he:' + w.he] || !!seen[w.he];
        w.keep = !w.dup; seen[w.he] = 1;
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
    stats: stats, emptyContent: emptyContent, instructions: instructions, SCHEMA: SCHEMA, sampleFn: sampleFn, setCode: setCode, setAuth: setAuth
  };
})();
