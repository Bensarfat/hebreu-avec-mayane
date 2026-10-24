/* =====================================================================
   HPB — stockage du site de Maayane.
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

  /* ---------- mots de passe : vérifiés par empreinte (hash) ; celui des élèves est aussi gardé pour Maayane ---------- */
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
        t = t || { name: 'Maayane' };
        t.login = login;
        if (!pw) return set('teacher', t);   /* identifiant seul : mot de passe inchangé */
        return withPassword(t, pw).then(function (r) { return set('teacher', r); });
      });
    },
    getSettings: function () { return get('settings').then(function (s) { return s || {}; }); },
    setSettings: function (s) { return set('settings', s); },

    /* ---------- documents montrés à l'élève (démo) ---------- */
    myDocs: function (sid) {
      return Promise.all([api.listDocs(), api.getSettings()]).then(function (r) {
        var ok = r[1].sharedDocs || [];
        return r[0].filter(function (d) { return ok.indexOf(d.id) >= 0 && (d.students || []).indexOf(sid) >= 0; })
          .map(function (d) { return { id: d.id, name: d.name, type: d.type, size: d.size, at: d.addedAt }; });
      });
    },
    myDocUrl: function (sid, id) { return api.getBlob(id).then(function (b) { return b ? URL.createObjectURL(b) : null; }); },

    /* ---------- tests de niveau (démo : gardés dans ce navigateur) ---------- */
    addLevelTest: function (rec) {
      return get('leveltests').then(function (l) {
        l = l || []; rec = JSON.parse(JSON.stringify(rec)); rec.at = new Date().toISOString();
        rec.id = rec.at.replace(/[:.]/g, '-') + '-' + Math.random().toString(36).slice(2, 8);
        l.push(rec); return set('leveltests', l.slice(-200));
      });
    },
    listLevelTests: function () { return get('leveltests').then(function (l) { return (l || []).slice().sort(function (a, b) { return a.id < b.id ? 1 : -1; }); }); },
    deleteLevelTest: function (id) { return get('leveltests').then(function (l) { return set('leveltests', (l || []).filter(function (r) { return r.id !== id; })); }); },

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
        return Promise.all([del('content:' + id), del('summary:' + id), del('progress:' + id),
          get('bookings').then(function (l) { return set('bookings', (l || []).filter(function (b) { return b.studentId !== id; })); }),
          get('messages').then(function (l) { return set('messages', (l || []).filter(function (m) { return m.studentId !== id; })); })]);
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

    /* ---------- messages (questions des élèves, réponses de Maayane) ---------- */
    listMessages: function (sid) {
      return get('messages').then(function (l) { return (l || []).filter(function (m) { return m.studentId === sid; }); });
    },
    sendMessage: function (sid, body, from) {
      return get('messages').then(function (l) {
        l = l || [];
        l.push({ id: 'm' + Date.now().toString(36) + rnd(3), studentId: sid, from: from === 'teacher' ? 'teacher' : 'student', body: String(body).slice(0, 2000), at: new Date().toISOString(), readAt: null });
        return set('messages', l);
      });
    },
    markMessagesRead: function (sid) {
      return get('messages').then(function (l) {
        l = l || []; var now = new Date().toISOString();
        l.forEach(function (m) { if (m.studentId === sid && m.from === 'student' && !m.readAt) m.readAt = now; });
        return set('messages', l);
      });
    },
    unreadMessages: function () {
      return get('messages').then(function (l) { var o = {}; (l || []).forEach(function (m) { if (m.from === 'student' && !m.readAt) o[m.studentId] = (o[m.studentId] || 0) + 1; }); return o; });
    },

    /* ---------- agenda : cours réservés (mêmes règles que le serveur, via HPCal) ---------- */
    listBookings: function (from, to) {
      return get('bookings').then(function (l) {
        return (l || []).filter(function (b) { return (!from || b.end > from) && (!to || b.start < to); })
          .sort(function (a, b) { return a.start - b.start; });
      });
    },
    addBooking: function (b) {
      return get('bookings').then(function (l) {
        l = l || [];
        if (l.some(function (x) { return x.status === 'booked' && x.start < b.end && x.end > b.start; })) { var e = new Error('créneau déjà pris'); e.code = 'taken'; throw e; }
        var r = { id: 'b' + Date.now().toString(36) + rnd(3), studentId: b.studentId, start: b.start, end: b.end, status: 'booked',
          note: String(b.note || '').slice(0, 500), by: b.by || 'teacher', createdAt: new Date().toISOString() };
        l.push(r);
        return set('bookings', l).then(function () { return r; });
      });
    },
    cancelBooking: function (id, by) {
      return get('bookings').then(function (l) {
        l = l || [];
        var r = l.filter(function (x) { return x.id === id; })[0];
        if (r) { r.status = 'cancelled'; r.cancelledBy = by || 'teacher'; r.cancelledAt = new Date().toISOString(); }
        return set('bookings', l);
      });
    },
    agendaState: function (sid, from, to) {
      return Promise.all([api.getSettings(), api.listBookings()]).then(function (r) {
        var now = Date.now();
        return {
          cfg: HPCal.pub(r[0].agenda), now: now,
          busy: r[1].filter(function (b) { return b.status === 'booked' && b.end > from && b.start < to; }).map(function (b) { return { s: b.start, e: b.end }; }),
          mine: r[1].filter(function (b) { return b.studentId === sid && b.start > from; })
        };
      });
    },
    agendaBook: function (sid, start, minutes, note) {
      return api.agendaState(sid, start - 864e5, start + 864e5).then(function (st) {
        var fail = function (code) { var e = new Error(code); e.code = code; throw e; };
        if (st.cfg.maxUpcoming && st.mine.filter(function (b) { return b.status === 'booked' && b.start > st.now; }).length >= st.cfg.maxUpcoming) fail('max_upcoming');
        var why = HPCal.check(st.cfg, st.busy, start, minutes, st.now);
        if (why) fail(why);
        return api.addBooking({ studentId: sid, start: start, end: start + minutes * 60000, note: note, by: 'student' });
      });
    },
    agendaCancel: function (sid, id) {
      return Promise.all([api.getSettings(), api.listBookings()]).then(function (r) {
        var b = r[1].filter(function (x) { return x.id === id && x.studentId === sid && x.status === 'booked'; })[0];
        var fail = function (code) { var e = new Error(code); e.code = code; throw e; };
        if (!b) fail('not_found');
        if (!HPCal.canCancel(r[0].agenda, b.start, Date.now())) fail('too_late');
        return api.cancelBooking(id, 'student');
      });
    },

    _set: set, _get: get, _withPassword: withPassword
  };
  return api;
})();
