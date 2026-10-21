/* =====================================================================
   Page d'accueil publique — cours d'hébreu en français avec Maayane
   ===================================================================== */
var HPHome = (function () {
  'use strict';

  /* Illustration d'accueil : « bonne réussite » et les quatre verbes */
  var SCENE = '<div class="mv-scene" role="img" aria-label="Parler, travailler, vivre, aimer en hébreu">' +
    '<i class="mv-l l1">א</i><i class="mv-l l2">ש</i><i class="mv-l l3">ל</i><i class="mv-l l4">מ</i>' +
    '<i class="mv-c c1"></i><i class="mv-c c2"></i><i class="mv-c c3"></i><i class="mv-c c4"></i><i class="mv-c c5"></i>' +
    '<div class="mv-tiles">' +
      '<div class="mv-tile t1"><span class="e">💬</span></div>' +
      '<div class="mv-tile t2"><span class="e">💼</span></div>' +
      '<div class="mv-tile t3"><span class="e">🏡</span></div>' +
      '<div class="mv-tile t4"><span class="e">❤️</span></div>' +
      '<div class="mv-target"><span class="e">🎯</span></div>' +
    '</div></div>';

  /* Illustration : Maayane (grande, brune, yeux marron, souriante) */
  var PORTRAIT = '' +
  '<svg class="mv-portrait" viewBox="0 0 360 440" role="img" aria-label="Illustration de Maayane">' +
    '<defs>' +
      '<linearGradient id="mvBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-2)"/></linearGradient>' +
      '<linearGradient id="mvHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2a1c"/><stop offset="1" stop-color="#2c1810"/></linearGradient>' +
      '<clipPath id="mvClip"><path d="M30 120 Q30 40 110 30 L250 30 Q330 40 330 120 L330 440 L30 440 Z"/></clipPath>' +
    '</defs>' +
    '<path d="M30 120 Q30 40 110 30 L250 30 Q330 40 330 120 L330 440 L30 440 Z" fill="url(#mvBg)"/>' +
    '<g clip-path="url(#mvClip)">' +
      '<text x="62" y="118" font-family="var(--font-he)" font-size="44" font-weight="700" fill="#fff" opacity=".22">א</text>' +
      '<text x="268" y="160" font-family="var(--font-he)" font-size="36" font-weight="700" fill="#fff" opacity=".2">ש</text>' +
      '<text x="58" y="300" font-family="var(--font-he)" font-size="30" font-weight="700" fill="#fff" opacity=".18">ל</text>' +
      '<text x="284" y="290" font-family="var(--font-he)" font-size="40" font-weight="700" fill="#fff" opacity=".2">מ</text>' +
      /* cheveux, arrière */
      '<path d="M104 170 Q96 82 180 74 Q266 80 258 172 L270 330 Q232 352 180 350 Q126 352 90 330 Z" fill="url(#mvHair)"/>' +
      /* corps */
      '<path d="M84 440 Q88 352 150 330 L210 330 Q272 352 276 440 Z" fill="#fff8f2"/>' +
      '<path d="M150 330 L180 372 L210 330" fill="none" stroke="#efd9c8" stroke-width="3"/>' +
      '<path d="M84 440 Q88 352 150 330 L160 336 Q118 360 112 440 Z" fill="#f4e5d6"/>' +
      /* cou */
      '<path d="M162 286 L162 334 Q180 346 198 334 L198 286 Z" fill="#d9a07a"/>' +
      '<path d="M162 304 Q180 318 198 304 L198 290 L162 290 Z" fill="#c78c66" opacity=".55"/>' +
      /* visage */
      '<ellipse cx="180" cy="214" rx="62" ry="78" fill="#e8b48e"/>' +
      '<ellipse cx="119" cy="222" rx="10" ry="16" fill="#e0a985"/><ellipse cx="241" cy="222" rx="10" ry="16" fill="#e0a985"/>' +
      '<circle cx="120" cy="240" r="4" fill="var(--gold)"/><circle cx="240" cy="240" r="4" fill="var(--gold)"/>' +
      /* cheveux, devant */
      '<path d="M114 196 Q116 130 182 128 Q248 132 248 196 Q236 160 196 150 Q170 170 120 186 Z" fill="url(#mvHair)"/>' +
      '<path d="M118 176 Q110 250 104 330 L90 330 Q88 230 108 170 Z" fill="url(#mvHair)"/>' +
      '<path d="M244 176 Q252 250 258 330 L272 330 Q274 230 252 170 Z" fill="url(#mvHair)"/>' +
      /* sourcils */
      '<path d="M140 190 Q154 182 168 188" fill="none" stroke="#3b2216" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M192 188 Q206 182 220 190" fill="none" stroke="#3b2216" stroke-width="5" stroke-linecap="round"/>' +
      /* yeux marron */
      '<ellipse cx="155" cy="212" rx="12" ry="9" fill="#fff"/><ellipse cx="205" cy="212" rx="12" ry="9" fill="#fff"/>' +
      '<circle cx="156" cy="213" r="7" fill="#6b3a1f"/><circle cx="204" cy="213" r="7" fill="#6b3a1f"/>' +
      '<circle cx="156" cy="213" r="3.2" fill="#2a160b"/><circle cx="204" cy="213" r="3.2" fill="#2a160b"/>' +
      '<circle cx="158.5" cy="210.5" r="2" fill="#fff"/><circle cx="206.5" cy="210.5" r="2" fill="#fff"/>' +
      '<path d="M142 206 Q155 198 168 206" fill="none" stroke="#2a160b" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path d="M192 206 Q205 198 218 206" fill="none" stroke="#2a160b" stroke-width="2.5" stroke-linecap="round"/>' +
      /* nez, joues, sourire */
      '<path d="M180 220 Q176 238 184 242" fill="none" stroke="#c98a63" stroke-width="3" stroke-linecap="round"/>' +
      '<ellipse cx="140" cy="242" rx="13" ry="8" fill="var(--rose)" opacity=".18"/><ellipse cx="220" cy="242" rx="13" ry="8" fill="var(--rose)" opacity=".18"/>' +
      '<path d="M156 256 Q180 280 204 256 Q180 266 156 256 Z" fill="#b5524a"/>' +
      '<path d="M160 257 Q180 264 200 257 Q180 270 160 257 Z" fill="#fff"/>' +
      /* livre */
      '<g transform="translate(206 378) rotate(-8)">' +
        '<rect x="0" y="0" width="92" height="66" rx="8" fill="var(--paper)" stroke="var(--line-strong)" stroke-width="2"/>' +
        '<line x1="46" y1="6" x2="46" y2="60" stroke="var(--line-strong)" stroke-width="2"/>' +
        '<text x="23" y="44" text-anchor="middle" font-family="var(--font-he)" font-size="26" font-weight="700" fill="var(--accent)">ב</text>' +
        '<text x="69" y="44" text-anchor="middle" font-family="var(--font-he)" font-size="26" font-weight="700" fill="var(--accent-2)">א</text>' +
      '</g>' +
      '<ellipse cx="214" cy="418" rx="20" ry="12" fill="#e8b48e"/>' +
    '</g>' +
  '</svg>';

  var CSS = '' +
    '.mv{min-height:100vh}' +
    '.mv-top{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:1120px;margin:0 auto;padding:18px 16px}' +
    '.mv-hero{max-width:1120px;margin:0 auto;padding:24px 16px 56px;display:grid;grid-template-columns:1.15fr .85fr;gap:40px;align-items:center}' +
    '@media (max-width:860px){.mv-hero{grid-template-columns:1fr;gap:20px}.mv-art{order:-1;width:100%;max-width:250px;margin:6px auto 0}}' +
    '.mv-hero h1{font:900 clamp(36px,6vw,62px)/1.04 var(--font-display);letter-spacing:-.025em;margin:14px 0 0;text-wrap:balance}' +
    '.mv-hero h1 .grad{display:inline-block}' +
    '.mv-lead{font-size:clamp(16px,2vw,19px);color:var(--ink-soft);margin:18px 0 26px;max-width:560px}' +
    '.mv-he{font:700 clamp(22px,3vw,30px) var(--font-he);color:var(--he);margin-top:10px;direction:rtl;text-align:left}' +
    '.mv-cta{display:flex;gap:10px;flex-wrap:wrap}.mv-cta .btn{padding:14px 24px;font-size:15.5px}' +
    '.mv-art{position:relative;container-type:inline-size;width:100%}.mv-portrait{width:100%;height:auto;display:block;filter:drop-shadow(0 30px 40px rgba(84,52,150,.25))}' +
    '.mv-bubble{position:absolute;background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:10px 14px;box-shadow:var(--shadow-card);font-size:13.5px;font-weight:700;color:var(--ink);display:flex;gap:8px;align-items:center;animation:mvFloat 5s ease-in-out infinite}' +
    '.mv-bubble .he{color:var(--accent);font-size:16px}' +
    '.mv-bubble .e{font-family:"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif;font-size:18px;line-height:1}.mv-bubble{max-width:230px;line-height:1.25}' +
    '.mv-b1{left:-12%;top:2%}.mv-b2{right:-10%;top:10%;animation-delay:-2s}.mv-b3{left:-12%;bottom:9%;animation-delay:-3.5s}.mv-b4{right:-8%;bottom:-3%;animation-delay:-1s}' +
    '@media (max-width:860px){.mv-bubble{font-size:11.5px;padding:7px 9px;max-width:140px;border-radius:14px}.mv-bubble .e{font-size:14px}.mv-b1{left:-20%;top:1%}.mv-b2,.mv-b3{display:none}.mv-b4{right:-20%;bottom:-3%}}' +
    '.mv-scene{position:relative;container-type:inline-size;aspect-ratio:360/440;border-radius:44% 44% 28px 28px / 28% 28% 28px 28px;overflow:hidden;background:linear-gradient(150deg,var(--accent),var(--accent-2));box-shadow:0 30px 60px -30px var(--accent);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7cqw;padding:16cqw 10cqw 12cqw}' +
    '.mv-scene-t{position:relative;display:flex;align-items:center;gap:3cqw;font:800 12cqw/1 var(--font-he);color:#fff;text-shadow:0 4px 18px rgba(0,0,0,.18)}.mv-scene-t .e{font:11cqw/1 "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif;text-shadow:none}' +
    '.mv-tiles{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:6cqw;width:88%}' +
    '.mv-tile{background:#fff;border-radius:6cqw;padding:7cqw 2cqw;display:flex;flex-direction:column;align-items:center;gap:2cqw;box-shadow:0 10px 24px -14px rgba(30,20,60,.55)}' +
    '.mv-tile .e{font:17cqw/1 "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif}.mv-tile b{font:700 6cqw/1.1 var(--font-he);color:#5a3fe0}' +
    '.mv-tile.t1{transform:rotate(-4deg);background:#eef4ff}.mv-tile.t2{transform:rotate(3deg);background:#fff3e6}.mv-tile.t3{transform:rotate(2deg);background:#e8f8f0}.mv-tile.t4{transform:rotate(-3deg);background:#ffeef3}' +
    '.mv-target{position:absolute;left:50%;top:50%;width:21cqw;height:21cqw;margin:-10.5cqw 0 0 -10.5cqw;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 0 0 1.6cqw rgba(255,255,255,.35),0 14px 30px -12px rgba(30,20,60,.6);animation:mvPop 3.2s ease-in-out infinite}' +
    '.mv-target .e{font:14cqw/1 "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif}' +
    '@keyframes mvPop{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}@media (prefers-reduced-motion:reduce){.mv-target{animation:none}}' +
    '.mv-medal-x{position:absolute;left:50%;margin-left:-8.5cqw;top:5cqw;width:17cqw;height:17cqw;border-radius:50%;background:#fff;display:grid;place-items:center;font:10cqw/1 "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif;box-shadow:0 8px 20px -8px rgba(0,0,0,.35);transform:rotate(10deg)}' +
    '.mv-l{position:absolute;font:700 11cqw var(--font-he);color:#fff;opacity:.16;font-style:normal}.mv-l.l1{left:8cqw;top:10cqw}.mv-l.l2{right:30cqw;top:4cqw;font-size:8cqw}.mv-l.l3{left:5cqw;bottom:14cqw;font-size:9cqw}.mv-l.l4{right:7cqw;bottom:8cqw}' +
    '.mv-c{position:absolute;width:2.6cqw;height:2.6cqw;border-radius:50%;background:#ffd166;opacity:.9}.mv-c.c1{left:22cqw;top:20cqw}.mv-c.c2{right:24cqw;top:28cqw;background:#7cf0c6}.mv-c.c3{left:12cqw;top:36cqw;background:#ffb3c8;width:2cqw;height:2cqw}.mv-c.c4{right:12cqw;bottom:30cqw;background:#9ad7ff}.mv-c.c5{left:46cqw;bottom:5cqw;background:#ffd166;width:2cqw;height:2cqw}' +
    '@keyframes mvFloat{50%{transform:translateY(-8px)}}' +
    '@media (prefers-reduced-motion:reduce){.mv-bubble{animation:none}}' +
    '.mv-sec{max-width:1120px;margin:0 auto;padding:30px 16px}' +
    '.mv-sec h2{font:900 clamp(26px,4vw,36px)/1.1 var(--font-display);letter-spacing:-.02em;margin:0 0 8px;text-align:center}' +
    '.mv-sec .mv-sub{color:var(--muted);text-align:center;margin:0 auto 28px;max-width:620px}' +
    '.mv-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}@media (max-width:860px){.mv-steps{grid-template-columns:1fr}}' +
    '.mv-step{background:var(--paper);border:1px solid var(--line);border-radius:24px;padding:24px;box-shadow:var(--shadow-card)}' +
    '.mv-step .n{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font:900 20px var(--font-display);margin-bottom:14px}' +
    '.mv-step h3{font:800 18px var(--font-display);margin:0 0 6px}.mv-step p{margin:0;color:var(--ink-soft);font-size:14.5px}' +
    '.mv-feats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}@media (max-width:860px){.mv-feats{grid-template-columns:1fr 1fr}}' +
    '.mv-feat{border-radius:22px;padding:18px;background:var(--glass);border:1px solid var(--line)}.mv-feat .ic{font-size:26px}.mv-feat b{display:block;margin:8px 0 2px;font-family:var(--font-display);font-size:16px}.mv-feat span{font-size:13.5px;color:var(--ink-soft)}.mv-four .mv-feat b .he{color:var(--he);font-size:15px;margin-left:6px}' +
    '.mv-about{display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:center;background:var(--paper);border:1px solid var(--line);border-radius:28px;padding:28px;box-shadow:var(--shadow-card)}' +
    '@media (max-width:700px){.mv-about{grid-template-columns:1fr;text-align:center}.mv-about .mv-face{margin:0 auto}}' +
    '.mv-face{width:120px;height:120px;border-radius:36px;overflow:hidden;background:var(--accent-tint)}.mv-face svg{width:100%;height:auto;transform:scale(1.7) translateY(-2%)}' +
    '.mv-about h3{font:900 24px var(--font-display);margin:0 0 6px}.mv-about p{margin:0 0 10px;color:var(--ink-soft)}' +
    '.mv-tags{display:flex;gap:6px;flex-wrap:wrap}@media (max-width:700px){.mv-tags{justify-content:center}}' +
    '.mv-band{max-width:1120px;margin:20px auto 0;padding:0 16px 60px}' +
    '.mv-band>div{border-radius:30px;padding:34px 24px;text-align:center;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:var(--on-accent)}' +
    '.mv-band h2{font:900 clamp(24px,4vw,34px) var(--font-display);margin:0 0 6px}.mv-band p{margin:0 0 18px;opacity:.9}' +
    '.mv-band .btn{background:var(--paper);color:var(--accent);border-color:transparent;font-weight:800;padding:13px 26px}' +
    '.mv-foot{text-align:center;color:var(--muted);font-size:13px;padding:0 16px 30px}.mv-foot .he{color:var(--accent)}';

  function render(root, go) {
    if (!document.getElementById('mv-css')) { var s = document.createElement('style'); s.id = 'mv-css'; s.textContent = CSS; document.head.appendChild(s); }
    document.title = 'Hébreu avec Maayane · cours en hébreu, avec le soutien du français';
    root.innerHTML =
      '<div class="mv">' +
      '<header class="mv-top"><a class="brand" href="#"><span class="logo">מ</span>Hébreu avec Maayane</a>' +
        '<button class="btn" data-go="login">Mon espace</button></header>' +
      '<section class="mv-hero"><div>' +
        '<span class="kicker">Cours en hébreu, avec le soutien du français · tous niveaux</span>' +
        '<h1>Parler, travailler, vivre, aimer… <span class="grad">en hébreu</span></h1>' +
        '<div class="mv-he" lang="he" dir="rtl">לְדַבֵּר, לַעֲבוֹד, לִחְיוֹת, לֶאֱהוֹב – בְּעִבְרִית</div>' +
        '<p class="mv-lead">Des cours en hébreu, avec le français pour t’aider quand tu en as besoin, à ton rythme et avec le sourire. Et un espace de révision rien qu’à toi : ton vocabulaire, tes règles de grammaire, tes flashcards, préparés à partir de tes propres cours.</p>' +
        '<div class="mv-cta"><button class="btn primary" data-go="login">Accéder à mon espace</button><a class="btn" href="#comment">Comment ça marche ?</a></div>' +
      '</div><div class="mv-art">' + SCENE +
        '<div class="mv-bubble mv-b1"><span class="e">💬</span>J\'ai tenu toute une conversation !</div>' +
        '<div class="mv-bubble mv-b2"><span class="e">💼</span>Entretien d’embauche réussi !</div>' +
        '<div class="mv-bubble mv-b3"><span class="e">🏡</span>Tout compris chez le médecin</div>' +
        '<div class="mv-bubble mv-b4"><span class="e">❤️</span>Mes enfants me répondent en hébreu !</div>' +
      '</div></section>' +

      '<section class="mv-sec"><div class="mv-feats mv-four">' +
        '<div class="mv-feat"><div class="ic">💬</div><b>Parler <span class="he" lang="he" dir="rtl">לְדַבֵּר</span></b><span>Oser la conversation du quotidien, sans traduire dans ta tête.</span></div>' +
        '<div class="mv-feat"><div class="ic">💼</div><b>Travailler <span class="he" lang="he" dir="rtl">לַעֲבוֹד</span></b><span>L’hébreu des réunions, des mails et des entretiens.</span></div>' +
        '<div class="mv-feat"><div class="ic">🏡</div><b>Vivre <span class="he" lang="he" dir="rtl">לִחְיוֹת</span></b><span>La banque, le médecin, l’école des enfants. Se sentir chez soi.</span></div>' +
        '<div class="mv-feat"><div class="ic">❤️</div><b>Aimer <span class="he" lang="he" dir="rtl">לֶאֱהוֹב</span></b><span>Parler avec ta famille, tes enfants, tes amis… et tomber amoureux de la langue.</span></div>' +
      '</div></section>' +

      '<section class="mv-sec" id="comment"><h2>Comment ça marche</h2><p class="mv-sub">Le cours, puis la révision : tout ce que tu vois en classe se retrouve dans ton espace.</p>' +
        '<div class="mv-steps">' +
          '<div class="mv-step"><div class="n" style="background:var(--accent-tint);color:var(--accent)">1</div><h3>Ton cours avec Maayane</h3><p>On parle hébreu ensemble, et le français est là pour t’expliquer quand c’est nécessaire, avec des explications claires et beaucoup d\'encouragements.</p></div>' +
          '<div class="mv-step"><div class="n" style="background:var(--mint);color:var(--olive)">2</div><h3>Ton espace se remplit</h3><p>Après chaque cours, Maayane y dépose ses fiches : ton vocabulaire et ta grammaire, rien que ce que tu as vu.</p></div>' +
          '<div class="mv-step"><div class="n" style="background:var(--peach);color:var(--gold)">3</div><h3>Tu révises en jouant</h3><p>Quiz, flashcards, conjugaison : tu gagnes des XP, tu montes de niveau et tu débloques des badges.</p></div>' +
        '</div></section>' +

      '<section class="mv-sec"><div class="mv-feats">' +
        '<div class="mv-feat"><div class="ic">🃏</div><b>Flashcards</b><span>Français → hébreu, hébreu → français, avec nikoud.</span></div>' +
        '<div class="mv-feat"><div class="ic">📖</div><b>Grammaire</b><span>Des fiches courtes, avec les exemples du cours.</span></div>' +
        '<div class="mv-feat"><div class="ic">🎯</div><b>Objectif du jour</b><span>Quelques minutes par jour, une série qui grandit.</span></div>' +
        '<div class="mv-feat"><div class="ic">📈</div><b>Ta progression</b><span>Mots maîtrisés, régularité, points à revoir.</span></div>' +
      '</div></section>' +

      '<section class="mv-sec"><div class="mv-about"><div class="mv-face">' + PORTRAIT + '</div><div>' +
        '<h3>Ta professeure : Maayane</h3>' +
        '<p>Patiente, à l\'écoute et toujours positive, Maayane adapte chaque cours à ton niveau et à tes envies. Elle suit tes progrès semaine après semaine et t\'aide à garder le rythme — même les jours où la motivation baisse.</p>' +
        '<div class="mv-tags"><span class="pill">En hébreu, soutien en français</span><span class="pill green">Bienveillance</span><span class="pill gold">Motivation</span><span class="pill rose">Tous niveaux</span></div>' +
      '</div></div></section>' +

      '<section class="mv-band"><div><h2>Prêt(e) pour ta révision du jour ?</h2><p>Connecte-toi avec les accès que Maayane t\'a envoyés.</p><button class="btn" data-go="login">Accéder à mon espace</button></div></section>' +
      '<footer class="mv-foot"><span class="he">לְאַט לְאַט</span> · petit à petit · Hébreu avec Maayane</footer>' +
      '</div>';
    Array.prototype.forEach.call(root.querySelectorAll('[data-go]'), function (b) { b.addEventListener('click', go); });
    var a = root.querySelector('a[href="#comment"]');
    if (a) a.addEventListener('click', function (e) { e.preventDefault(); document.getElementById('comment').scrollIntoView({ behavior: window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
    window.scrollTo(0, 0);
  }
  return { render: render };
})();
