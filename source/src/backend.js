/* =====================================================================
   HPB — stockage du site de Mayane.
   Version 1 (démo) : tout est conservé dans ce navigateur (IndexedDB).
   L'interface est volontairement réduite à ces fonctions pour pouvoir
   brancher ensuite un vrai serveur (comptes partagés entre appareils)
   sans toucher au reste du site.
   ===================================================================== */
var HPB = (function () {
  'use strict';
  var DBN = 'mayane-hebreu-v1', ST = 'kv', idb = null, mem = {};

  function open() {
    return new Promise(function (res) {
      try {
        var r = indexedDB.open(DBN, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
        r.onsuccess = function () { idb = r.result; res(); };
        r.onerror = function () { res(); };
        r.onblocked = function () { res(); };
      } catch (e) { res(); }
    });
  }
  function get(k) {
    if (!idb) return Promise.resolve(mem[k]);
    return new Promise(function (res) {
      try {
        var q = idb.transaction(ST).objectStore(ST).get(k);
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { res(mem[k]); };
      } catch (e) { res(mem[k]); }
    });
  }
  function set(k, v) {
    mem[k] = v;
    if (!idb) return Promise.resolve();
    return new Promise(function (res) {
      try {
        var t = idb.transaction(ST, 'readwrite');
        t.objectStore(ST).put(v, k);
        t.oncomplete = function () { res(); };
        t.onerror = function () { res(); };
      } catch (e) { res(); }
    });
  }
  function del(k) {
    delete mem[k];
    if (!idb) return Promise.resolve();
    return new Promise(function (res) {
      try {
        var t = idb.transaction(ST, 'readwrite');
        t.objectStore(ST).delete(k);
        t.oncomplete = function () { res(); };
        t.onerror = function () { res(); };
      } catch (e) { res(); }
    });
  }
  function clearAll() {
    mem = {};
    if (!idb) return Promise.resolve();
    return new Promise(function (res) {
      try {
        var t = idb.transaction(ST, 'readwrite');
        t.objectStore(ST).clear();
        t.oncomplete = function () { res(); };
        t.onerror = function () { res(); };
      } catch (e) { res(); }
    });
  }

  /* ---------- mots de passe : vérifiés par empreinte (hash) ; celui des élèves est aussi gardé pour Mayane ---------- */
  function rnd(n) {
    var a = new Uint8Array(n);
    try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256); }
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function hash(pw, salt) {
    var txt = salt + '::' + pw;
    try {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      });
    } catch (e) {
      var h = 5381; for (var i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0;
      return Promise.resolve('x' + (h >>> 0).toString(16));
    }
  }
  function withPassword(rec, pw) {
    rec.salt = rnd(12);
    return hash(pw, rec.salt).then(function (h) { rec.hash = h; return rec; });
  }
  var WORDS = ['shalom', 'toda', 'boker', 'layla', 'shemesh', 'yam', 'sefer', 'mayim', 'tapuz', 'kelev', 'perah', 'hatul', 'kochav', 'bayit', 'lehem'];
  function genPassword() {
    var a = new Uint32Array(2);
    try { crypto.getRandomValues(a); } catch (e) { a[0] = Math.random() * 1e9; a[1] = Math.random() * 1e9; }
    return WORDS[a[0] % WORDS.length] + '-' + (1000 + a[1] % 9000);
  }

  /* ---------- API ---------- */
  var api = {
    ready: open,
    genPassword: genPassword,
    reset: clearAll,

    getTeacher: function () { return get('teacher'); },
    setTeacherPassword: function (login, pw) {
      return get('teacher').then(function (t) {
        t = t || { name: 'Mayane' };
        t.login = login;
        if (!pw) return set('teacher', t);   /* identifiant seul : mot de passe inchangé */
        return withPassword(t, pw).then(function (r) { return set('teacher', r); });
      });
    },
    getSettings: function () { return get('settings').then(function (s) { return s || {}; }); },
    setSettings: function (s) { return set('settings', s); },

    listStudents: function () { return get('students').then(function (l) { return l || []; }); },
    getStudent: function (id) { return api.listStudents().then(function (l) { return l.filter(function (s) { return s.id === id; })[0] || null; }); },
    saveStudent: function (st, pw) {
      return api.listStudents().then(function (l) {
        /* la prof doit pouvoir retrouver le mot de passe de chaque élève : il est gardé avec le compte */
        if (pw) st.pw = pw;
        var p = pw ? withPassword(st, pw) : Promise.resolve(st);
        return p.then(function () {
          var i = l.findIndex(function (s) { return s.id === st.id; });
          if (i < 0) l.push(st); else l[i] = st;
          return set('students', l).then(function () { return st; });
        });
      });
    },
    deleteStudent: function (id) {
      return api.listStudents().then(function (l) {
        return set('students', l.filter(function (s) { return s.id !== id; }));
      }).then(function () {
        return Promise.all([del('content:' + id), del('summary:' + id), del('progress:' + id)]);
      }).then(function () {
        return api.listDocs().then(function (docs) {
          docs.forEach(function (d) { d.students = (d.students || []).filter(function (x) { return x !== id; }); });
          return set('docs', docs);
        });
      });
    },
    loginTaken: function (login, exceptId) {
      login = (login || '').trim().toLowerCase();
      return Promise.all([api.listStudents(), get('teacher')]).then(function (r) {
        if (r[1] && r[1].login === login) return true;
        return r[0].some(function (s) { return s.login === login && s.id !== exceptId; });
      });
    },
    /* connexion : renvoie {role, id} ou null */
    login: function (login, pw) {
      login = (login || '').trim().toLowerCase();
      return Promise.all([get('teacher'), api.listStudents()]).then(function (r) {
        var t = r[0];
        if (t && t.login === login) return hash(pw, t.salt).then(function (h) { return h === t.hash ? { role: 'teacher' } : null; });
        var s = r[1].filter(function (x) { return x.login === login; })[0];
        if (!s) return null;
        return hash(pw, s.salt).then(function (h) {
          if (h !== s.hash) return null;
          if (s.active === false) return { role: 'blocked' };
          return { role: 'student', id: s.id };
        });
      });
    },

    getContent: function (id) { return get('content:' + id).then(function (c) { return c || null; }); },
    setContent: function (id, c) { c.updatedAt = new Date().toISOString(); return set('content:' + id, c); },
    getSummary: function (id) { return get('summary:' + id).then(function (s) { return s || null; }); },
    getProgress: function (id) { return get('progress:' + id).then(function (p) { return p || null; }); },
    /* appelé par l'espace élève à chaque réponse (regroupé) */
    pushProgress: function (id, summary, storage) {
      if (!id) return Promise.resolve();
      return Promise.all([set('summary:' + id, summary), set('progress:' + id, storage)]).then(function () {
        try { window.dispatchEvent(new CustomEvent('hp-progress', { detail: id })); } catch (e) {}
      });
    },

    listDocs: function () { return get('docs').then(function (l) { return l || []; }); },
    addDoc: function (file, students) {
      var d = {
        id: 'd' + Date.now().toString(36) + rnd(3), name: file.name, type: file.type || '', size: file.size,
        addedAt: new Date().toISOString(), students: students.slice(), status: 'pending'
      };
      return set('blob:' + d.id, file).then(function () { return api.listDocs(); }).then(function (l) {
        l.unshift(d); return set('docs', l);
      }).then(function () { return d; });
    },
    updateDoc: function (d) {
      return api.listDocs().then(function (l) {
        var i = l.findIndex(function (x) { return x.id === d.id; });
        if (i >= 0) l[i] = d; return set('docs', l);
      });
    },
    deleteDoc: function (id) {
      return api.listDocs().then(function (l) { return set('docs', l.filter(function (x) { return x.id !== id; })); })
        .then(function () { return del('blob:' + id); });
    },
    getBlob: function (id) { return get('blob:' + id); },

    _set: set, _get: get, _withPassword: withPassword
  };
  return api;
})();
