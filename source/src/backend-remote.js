/* =====================================================================
   HPB en ligne — même interface que backend.js, mais les comptes, contenus,
   progressions et documents sont enregistrés dans Supabase : chacun retrouve
   son espace depuis n'importe quel appareil.
   S'active tout seul quand le site (sur Vercel) est relié à Supabase
   (fonction /api/config) ; sinon le site reste en mode démonstration.
   ===================================================================== */
(function () {
  'use strict';
  var LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  var DOMAIN = 'hebreu-avec-mayane.app';
  var local = {};                       // méthodes du mode démo, gardées en secours
  Object.keys(HPB).forEach(function (k) { local[k] = HPB[k]; });
  var sbc = null;                       // client Supabase

  function loadLib() {
    return new Promise(function (res, rej) {
      if (window.supabase && window.supabase.createClient) return res();
      var s = document.createElement('script'); s.src = LIB; s.onload = res;
      /* empreinte de la bibliothèque : le navigateur refuse un fichier modifié sur le CDN */
      s.integrity = 'sha384-0w2KAL2YHP6wKOkUDzkCDGgVvfmHnj02DHeQ6XcHOgTfFsGyonKOpShMH1x6nk9o'; s.crossOrigin = 'anonymous';
      s.onerror = function () { rej(new Error('Impossible de charger Supabase')); };
      document.head.appendChild(s);
    });
  }
  function q(p) {                       // { data, error } → data ou exception
    return p.then(function (r) { if (r.error) { var e = new Error(r.error.message || 'Erreur Supabase'); e.code = r.error.code; throw e; } return r.data; });
  }
  function emailFor(login) { return String(login || '').trim().toLowerCase() + '@' + DOMAIN; }
  function token() { return sbc.auth.getSession().then(function (r) { return r.data && r.data.session ? r.data.session.access_token : null; }); }
  function admin(body) { return post('/api/admin', body); }
  function post(path, body) {
    return token().then(function (t) {
      return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + (t || '') }, body: JSON.stringify(body) });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.detail || j.error || ('HTTP ' + r.status)); e.code = j.error; throw e; }
        return j;
      });
    });
  }
  function toStudent(p, secrets) {
    return {
      id: p.id, first: p.first || '', last: p.last || '', login: p.login, email: p.email || '', phone: p.phone || '',
      active: p.active !== false, createdAt: p.created_at, pw: secrets ? (secrets[p.id] || '') : undefined
    };
  }
  function docFromRow(r) {
    return {
      id: r.id, name: r.name, type: r.type, size: r.size, path: r.path, students: r.students || [], status: r.status,
      result: r.result || undefined, summary: r.summary || undefined, error: r.error || undefined,
      addedAt: r.added_at, integratedAt: r.integrated_at || undefined
    };
  }
  function bookingFromRow(r) {
    return { id: r.id, studentId: r.student_id, start: Date.parse(r.starts_at), end: Date.parse(r.ends_at), status: r.status, note: r.note || '',
      by: r.created_by, cancelledBy: r.cancelled_by || null, createdAt: r.created_at, cancelledAt: r.cancelled_at || null };
  }
  function iso(ms) { return new Date(ms).toISOString(); }
  function safeName(n) { return String(n || 'document').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80); }

  var remote = {
    remote: true,

    /* qui est connecté ? (pour rester connecté d'une visite à l'autre) */
    currentUser: function () {
      return sbc.auth.getSession().then(function (r) {
        var s = r.data && r.data.session; if (!s) return null;
        return q(sbc.from('profiles').select('id,role,active,login,first').eq('id', s.user.id).maybeSingle()).then(function (p) {
          if (!p) return null;
          HPB.me = p;
          if (p.role === 'student' && p.active === false) return { role: 'blocked' };
          /* administrateur : exactement l'espace de la professeure */
          if (p.role === 'teacher' || p.role === 'admin') return { role: 'teacher', admin: p.role === 'admin' };
          return { role: 'student', id: p.id };
        });
      }).catch(function () { return null; });
    },
    setupStatus: function () { return admin({ action: 'status' }); },
    setup: function (login, pw, first) { return admin({ action: 'setup', login: login, pw: pw, first: first }); },
    logout: function () { return sbc.auth.signOut().catch(function () {}); },
    authToken: token,

    getTeacher: function () { return Promise.resolve({ remote: true }); },
    setTeacherPassword: function (login, pw) { return admin({ action: 'teacher', login: login, pw: pw }); },
    getSettings: function () { return q(sbc.from('settings').select('data').eq('id', 1).maybeSingle()).then(function (r) { return (r && r.data) || {}; }).catch(function () { return {}; }); },
    setSettings: function (s) { return q(sbc.from('settings').upsert({ id: 1, data: s })); },

    listStudents: function () {
      return Promise.all([
        q(sbc.from('profiles').select('*').eq('role', 'student').order('created_at')),
        q(sbc.from('student_secrets').select('student_id,pw')).catch(function () { return []; })
      ]).then(function (r) {
        var sec = {}; r[1].forEach(function (x) { sec[x.student_id] = x.pw; });
        return r[0].map(function (p) { return toStudent(p, sec); });
      });
    },
    getStudent: function (id) {
      return q(sbc.from('profiles').select('*').eq('id', id).maybeSingle()).then(function (p) { return p ? toStudent(p, null) : null; });
    },
    saveStudent: function (st, pw) {
      return admin({ action: 'save', student: st, pw: pw || '' }).then(function (j) {
        st.id = j.id; if (pw) st.pw = pw; return st;
      });
    },
    deleteStudent: function (id) {
      return admin({ action: 'delete', id: id }).then(function () { return remote.listDocs(); }).then(function (docs) {
        return Promise.all(docs.filter(function (d) { return d.students.indexOf(id) >= 0; }).map(function (d) {
          return q(sbc.from('docs').update({ students: d.students.filter(function (x) { return x !== id; }) }).eq('id', d.id));
        }));
      });
    },
    loginTaken: function (login, exceptId) {
      login = (login || '').trim().toLowerCase();
      return q(sbc.from('profiles').select('id').eq('login', login)).then(function (rows) {
        return rows.some(function (r) { return r.id !== exceptId; });
      });
    },
    login: function (login, pw) {
      return sbc.auth.signInWithPassword({ email: emailFor(login), password: pw }).then(function (r) {
        if (r.error || !r.data.session) return null;
        return remote.currentUser().then(function (u) {
          if (u && u.role === 'blocked') sbc.auth.signOut();
          return u;
        });
      });
    },

    getContent: function (id) { return q(sbc.from('contents').select('data').eq('student_id', id).maybeSingle()).then(function (r) { return r ? r.data : null; }); },
    setContent: function (id, c) {
      c.updatedAt = new Date().toISOString();
      return q(sbc.from('contents').upsert({ student_id: id, data: c, updated_at: c.updatedAt }));
    },
    /* tous les élèves en une requête (tableau de bord) */
    getSummaries: function (ids) {
      if (!ids.length) return Promise.resolve({});
      return q(sbc.from('progress').select('student_id,summary').in('student_id', ids)).then(function (rows) {
        var o = {}; rows.forEach(function (r) { o[r.student_id] = r.summary; }); return o;
      });
    },
    getContents: function (ids) {
      if (!ids.length) return Promise.resolve({});
      return q(sbc.from('contents').select('student_id,data').in('student_id', ids)).then(function (rows) {
        var o = {}; rows.forEach(function (r) { o[r.student_id] = r.data; }); return o;
      });
    },
    getSummary: function (id) { return q(sbc.from('progress').select('summary').eq('student_id', id).maybeSingle()).then(function (r) { return r ? r.summary : null; }); },
    getProgress: function (id) { return q(sbc.from('progress').select('storage').eq('student_id', id).maybeSingle()).then(function (r) { return r ? r.storage : null; }); },
    pushProgress: function (id, summary, storage) {
      if (!id) return Promise.resolve();
      return q(sbc.from('progress').upsert({ student_id: id, summary: summary, storage: storage, updated_at: new Date().toISOString() }))
        .then(function () { try { window.dispatchEvent(new CustomEvent('hp-progress', { detail: id })); } catch (e) {} })
        .catch(function (e) { console.warn('Progression non enregistrée', e); throw e; });
    },

    listDocs: function () { return q(sbc.from('docs').select('*').order('added_at', { ascending: false })).then(function (rows) { return rows.map(docFromRow); }); },
    addDoc: function (file, students) {
      var id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      var path = id + '/' + safeName(file.name);
      return q(sbc.storage.from('documents').upload(path, file, { contentType: file.type || 'application/octet-stream' })).then(function () {
        var row = { id: id, name: file.name, type: file.type || '', size: file.size, path: path, students: students.slice(), status: 'pending' };
        return q(sbc.from('docs').insert(row)).then(function () { return docFromRow(Object.assign({ added_at: new Date().toISOString() }, row)); });
      });
    },
    updateDoc: function (d) {
      return q(sbc.from('docs').update({
        students: d.students, status: d.status, result: d.result || null, summary: d.summary || null,
        error: d.error || null, integrated_at: d.integratedAt || null
      }).eq('id', d.id));
    },
    deleteDoc: function (id) {
      return q(sbc.from('docs').select('path').eq('id', id).maybeSingle()).then(function (r) {
        return (r ? q(sbc.storage.from('documents').remove([r.path])).catch(function () {}) : Promise.resolve())
          .then(function () { return q(sbc.from('docs').delete().eq('id', id)); });
      });
    },
    getBlob: function (id) {
      return q(sbc.from('docs').select('path').eq('id', id).maybeSingle()).then(function (r) {
        return r ? q(sbc.storage.from('documents').download(r.path)) : null;
      });
    },
    reset: function () { return Promise.resolve(); },

    /* ---------- tests de niveau (fichiers déposés par /api/test ; lus et supprimés par le serveur, pour la professeure seule) ---------- */
    addLevelTest: function (rec) { return post('/api/test', rec); },
    listLevelTests: function () { return post('/api/test', { action: 'list' }).then(function (r) { return r.tests || []; }); },
    deleteLevelTest: function (id) { return post('/api/test', { action: 'delete', id: id }); },

    /* ---------- messages (questions des élèves, réponses de Maayane) ---------- */
    listMessages: function (sid) {
      return q(sbc.from('messages').select('*').eq('student_id', sid).order('created_at', { ascending: true }).limit(500))
        .then(function (rows) { return rows.map(function (r) { return { id: r.id, studentId: r.student_id, from: r.from_role, body: r.body, at: r.created_at, readAt: r.read_at }; }); });
    },
    sendMessage: function (sid, body, from) {
      return q(sbc.from('messages').insert({ student_id: sid, from_role: from === 'teacher' ? 'teacher' : 'student', body: String(body).slice(0, 2000) }));
    },
    markMessagesRead: function (sid) {
      return q(sbc.from('messages').update({ read_at: new Date().toISOString() }).eq('student_id', sid).eq('from_role', 'student').is('read_at', null));
    },
    unreadMessages: function () {
      return q(sbc.from('messages').select('student_id').eq('from_role', 'student').is('read_at', null).limit(2000))
        .then(function (rows) { var o = {}; rows.forEach(function (r) { o[r.student_id] = (o[r.student_id] || 0) + 1; }); return o; });
    },

    /* ---------- agenda ---------- */
    listBookings: function (from, to) {
      var qq = sbc.from('bookings').select('*').order('starts_at', { ascending: true }).limit(3000);
      if (to) qq = qq.lt('starts_at', iso(to));
      if (from) qq = qq.gt('ends_at', iso(from));
      return q(qq).then(function (rows) { return rows.map(bookingFromRow); });
    },
    addBooking: function (b) {
      return q(sbc.from('bookings').insert({ student_id: b.studentId, starts_at: iso(b.start), ends_at: iso(b.end), note: String(b.note || '').slice(0, 500), created_by: 'teacher' }).select().single())
        .then(bookingFromRow, function (e) { if (e.code === '23P01') e.code = 'taken'; throw e; });
    },
    cancelBooking: function (id) {
      return q(sbc.from('bookings').update({ status: 'cancelled', cancelled_by: 'teacher', cancelled_at: new Date().toISOString() }).eq('id', id));
    },
    /* côté élève : tout passe par le serveur, qui vérifie le créneau */
    agendaState: function (sid, from, to) { return post('/api/agenda', { action: 'state', from: from, to: to }); },
    agendaBook: function (sid, start, minutes, note) { return post('/api/agenda', { action: 'book', start: start, minutes: minutes, note: note }).then(function (r) { return r.booking; }); },
    agendaCancel: function (sid, id) { return post('/api/agenda', { action: 'cancel', id: id }); }
  };

  HPB.remote = false;
  HPB.ready = function () {
    /* la bibliothèque se charge en même temps que la configuration (gain d'un aller-retour) */
    var libP = location.protocol === 'file:' ? null : loadLib().then(function () { return null; }, function (e) { return e; });
    return fetch('/api/config', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : { remote: false }; }).catch(function () { return { remote: false }; })
      .then(function (cfg) {
        if (!cfg || !cfg.remote) return local.ready();
        return (libP || loadLib()).then(function (err) {
          if (err) throw err;
          sbc = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'hp-mayane-auth' } });
          Object.keys(remote).forEach(function (k) { HPB[k] = remote[k]; });
          if (window.HPA && HPA.setAuth) HPA.setAuth(token);
        }).catch(function (e) {
          console.error(e);
          HPB.remoteError = 'Le site n\'arrive pas à joindre le serveur. Vérifiez votre connexion internet, puis rechargez la page.';
        });
      });
  };
})();
