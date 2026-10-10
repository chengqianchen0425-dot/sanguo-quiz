(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  let lang = params.get('lang') === 'en' ? 'en' : 'zh';
  let data = null;
  let answers = [];
  let questionIndex = 0;
  let view = 'start';
  let friendCode = params.get('r');
  let friendResult = null;
  const app = document.getElementById('app');
  const toast = document.getElementById('toast');

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const t = (key, vars = {}) => Object.keys(vars).reduce((text, name) => text.replaceAll(`{${name}}`, vars[name]), data.ui[key] || '');
  const resultAliases = { RSK: 'SOK', SKK: 'SSK', SRK: 'SOR' };
  const resultByCode = (code) => { const normalized = resultAliases[code] || code; return data.results.find((item) => item.id === normalized) || data.results[canonicalResults.indexOf(normalized)]; };
  const canonicalResults = ['OOK', 'OSK', 'OOR', 'OSR', 'SOK', 'SSK', 'SOR', 'SSR'];
  const displayName = (result) => result ? `${result.name} · ${result.title}` : '';

  async function loadLocale() {
    const response = await fetch(`sanguo-quiz-${lang === 'en' ? 'en' : 'cn'}.json`);
    data = await response.json();
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    document.title = t('docTitle', { name: data.meta.title, title: data.meta.subtitle });
    friendResult = friendCode && /^[A-Z]{3}$/.test(friendCode) ? resultByCode(friendCode) : null;
    render();
  }

  function render() {
    if (!data) return;
    document.documentElement.style.setProperty('--brand', data.meta.brand || '#F25C3B');
    app.innerHTML = view === 'quiz' ? quizView() : view === 'result' ? resultView() : startView();
    if (view === 'result') { const result = currentResult(); document.title = t('docTitle', { name: result.name, title: result.title }); drawAvatar(document.querySelector('#result-avatar'), result); }
  }

  function languageSwitch() {
    return `<div class="language-switch" role="group"><button class="lang-btn ${lang === 'zh' ? 'active' : ''}" data-lang="zh">${esc(t('langZh'))}</button><button class="lang-btn ${lang === 'en' ? 'active' : ''}" data-lang="en">${esc(t('langEn'))}</button></div>`;
  }

  function startView() {
    const names = data.results.map((result) => `<span>${esc(result.name)}</span>`).join('');
    const friend = friendResult ? `<section class="friend-banner"><span class="eyebrow">${esc(t('friendEyebrow'))}</span><strong>${esc(t('friendGot'))} ${esc(friendResult.name)}</strong><p>${esc(t('friendAsk'))}</p><p>${esc(t('friendLead'))}</p><button class="primary" data-action="start">${esc(t('friendGo'))}</button></section>` : '';
    return `<div class="shell start-shell">${languageSwitch()}${friend}<section class="hero"><div class="brand-mark">${esc(t('brandMark'))}</div><p class="eyebrow">${esc(data.meta.resultLabel)}</p><h1>${esc(data.meta.title)}</h1><h2>${esc(data.meta.subtitle)}</h2><p class="intro">${esc(data.meta.intro)}</p><div class="facts"><span><b>${data.questions.length}</b>${esc(t('factQ',{n:''}))}</span><span><b>02</b>${esc(t('factMin'))}</span><span><b>${data.results.length}</b>${esc(t('factR',{n:''}))}</span></div><button class="primary start-button" data-action="start">${esc(t('start'))}<span>↗</span></button></section><section class="preview"><p>${esc(t('maybeYou'))}</p><div class="name-cloud">${names}</div></section>${data.ui.note ? `<aside class="note"><strong>${esc(t('noteTitle'))}</strong><p>${esc(t('note'))}</p></aside>` : ''}<footer>${esc(t('footer'))}</footer></div>`;
  }

  function quizView() {
    const question = data.questions[questionIndex];
    const selected = answers[questionIndex];
    const options = question.options.map((option, index) => `<button class="option ${selected === index ? 'selected' : ''}" data-option="${index}"><span class="option-index">0${index + 1}</span><span>${esc(option.text)}</span><i>→</i></button>`).join('');
    return `<div class="shell quiz-shell">${languageSwitch()}<header class="quiz-top"><button class="text-button" data-action="back-start">← ${esc(t('backStart'))}</button><span class="progress-copy">${esc(t('progress',{n:questionIndex+1,total:data.questions.length}))}</span></header><div class="progress-track"><span style="width:${((questionIndex+1)/data.questions.length)*100}%"></span></div><section class="question"><p class="eyebrow">${String(questionIndex+1).padStart(2,'0')} / ${String(data.questions.length).padStart(2,'0')}</p><h1>${esc(question.text)}</h1><div class="options">${options}</div></section><nav class="quiz-nav">${questionIndex > 0 ? `<button class="text-button" data-action="prev">← ${esc(t('prev'))}</button>` : '<span></span>'}<span class="answer-state">${selected !== undefined ? '✓' : ''}</span></nav></div>`;
  }

  function score() {
    const totals = {};
    data.dimensions.forEach((dimension) => { totals[dimension.id] = {[dimension.left]:0,[dimension.right]:0}; });
    data.questions.forEach((question, index) => {
      const selected = question.options[answers[index]];
      if (!selected) return;
      const key = Object.keys(selected.score)[0];
      const dimension = data.dimensions.find((item) => item.id === question.dimension);
      if (dimension && totals[dimension.id][key] !== undefined) totals[dimension.id][key] += Number(selected.score[key]) || 0;
    });
    // Ties intentionally choose the configured left pole, as required by mode: poles.
    const code = data.dimensions.map((dimension) => totals[dimension.id][dimension.left] >= totals[dimension.id][dimension.right] ? dimension.leftCode : dimension.rightCode).join('');
    return { totals, code, result: resultByCode(code) || data.results[0] };
  }

  function currentResult() { return score().result; }

  function resultView() {
    const { totals, code, result } = score();
    const rank = data.results.map((item, index) => ({ item, value: item.id === code ? 100 : Math.max(46, 92 - index * 6) })).sort((a,b) => b.value - a.value);
    const strengths = result.strengths.map((item) => `<li>${esc(item)}</li>`).join('');
    const blindspots = result.blindspots.map((item) => `<li>${esc(item)}</li>`).join('');
    const best = resultByCode(result.match?.best); const worst = resultByCode(result.match?.worst);
    const dims = data.dimensions.map((dimension) => { const left = totals[dimension.id][dimension.left]; const right = totals[dimension.id][dimension.right]; const total = Math.max(1,left+right); return `<div class="dimension-row"><div><b>${esc(dimension.left)}</b><span>${left}</span></div><div class="dimension-bar"><span style="width:${(left/total)*100}%"></span></div><div><span>${right}</span><b>${esc(dimension.right)}</b></div></div>`; }).join('');
    const rankings = rank.map(({item,value}) => `<div class="rank-row"><span>${esc(item.name)}</span><div><i style="width:${value}%"></i></div><b>${value}%</b></div>`).join('');
    return `<div class="shell result-shell">${languageSwitch()}<section class="result-card" id="share-card"><div class="result-top"><span class="eyebrow">${esc(data.meta.resultLabel)}</span><span class="code">${esc(code)}</span></div><canvas id="result-avatar" width="32" height="32" aria-label="${esc(result.name)}"></canvas><h1>${esc(result.name)}</h1><h2>${esc(result.title)}</h2><p class="one-liner">${esc(result.oneLiner)}</p><div class="traits">${result.traits.map((trait) => `<span>${esc(trait)}</span>`).join('')}</div><p class="desc">${esc(result.desc)}</p><blockquote>${esc(result.quote)}</blockquote><div class="two-col"><section><h3>${esc(t('strengths'))}</h3><ul>${strengths}</ul></section><section><h3>${esc(t('blindspots'))}</h3><ul>${blindspots}</ul></section></div><div class="pair-grid"><div><small>${esc(t('best'))}</small><strong>${esc(best?.name || '')}</strong><span>${esc(best?.title || '')}</span></div><div><small>${esc(t('worst'))}</small><strong>${esc(worst?.name || '')}</strong><span>${esc(worst?.title || '')}</span></div></div><section class="dimensions"><h3>${esc(t('dims'))}</h3>${dims}</section><section class="ranking"><h3>${esc(t('rankV'))}</h3>${rankings}</section><!-- premium-slot --></section><section class="share"><p>${esc(t('shareHint'))}</p><div class="share-actions"><button class="primary" data-action="copy-link">${esc(t('copyLink'))}</button><button class="secondary" data-action="copy-result">${esc(t('copyRes'))}</button><button class="text-button" data-action="retry">↻ ${esc(t('retry'))}</button></div><textarea id="manual-copy" readonly aria-label="${esc(t('selectManual'))}"></textarea></section><footer>${esc(t('footer'))}</footer></div>`;
  }

  function drawAvatar(canvas, result) {
    if (!canvas || !result) return;
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,32,32);
    const a = result.avatar || {}; const px = (x,y,w,h,color) => {ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
    const skin='#f1bd8e', dark=a.hair||'#282329', robe=a.robe||'#40516b', trim=a.trim||'#d4ad68', hat=a.hat||'#555', hat2=a.hat2||'#d3a85b';
    px(6,21,20,11,robe); px(5,28,22,4,trim); px(8,10,16,15,skin);
    if (a.head === 'loose') {px(6,8,3,17,dark);px(23,8,3,17,dark);} else if (a.head === 'bun') px(12,5,8,6,dark); else if (a.head === 'guan') {px(10,5,12,4,dark);px(8,8,3,6,dark);px(21,8,3,6,dark);} else if (a.head === 'qing') {px(9,5,14,5,hat);px(12,2,8,4,hat2);} else if (a.head === 'jin') {px(6,5,20,4,hat);px(9,3,14,3,hat);} else if (a.head === 'futou') {px(7,4,18,5,hat);px(3,6,7,3,hat);} else if (a.head === 'straw') {px(4,5,24,3,hat);px(8,3,16,2,hat2);}
    if (a.head === 'qing' || a.head === 'jin' || a.head === 'futou') {px(7,10,3,8,dark);px(22,10,3,8,dark);} 
    if (a.eyes === 'sharp') {px(11,15,4,1,dark);px(18,15,4,1,dark);} else if (a.eyes === 'smile') {px(11,15,3,1,dark);px(19,15,3,1,dark);} else if (a.eyes === 'sleepy') {px(11,15,4,1,dark);px(18,15,4,1,dark);} else {px(12,14,2,2,dark);px(19,14,2,2,dark);}
    px(15,17,2,3,'#bf7f63'); if (a.extras === 'beard') {px(11,20,11,5,dark);px(14,24,5,3,dark);} if (a.extras === 'mustache') {px(12,19,4,2,dark);px(17,19,4,2,dark);}
    const prop=a.props; if(prop==='fan'){px(25,17,2,9,trim);px(25,14,5,4,'#eee4c8');} else if(prop==='sword'){px(25,18,2,10,trim);px(24,25,5,2,hat2);} else if(prop==='spear'){px(26,11,2,19,trim);px(25,10,4,3,hat2);} else if(prop==='scroll'){px(25,18,5,7,'#eee4c8');px(26,17,3,2,trim);} else if(prop==='qin'){px(24,23,8,4,trim);px(26,21,1,2,hat2);} else if(prop==='gourd'){px(26,20,4,7,hat2);px(27,18,2,3,trim);} else if(prop==='brush'){px(27,16,2,12,dark);px(26,15,4,3,hat2);} else if(prop==='flower'){px(26,19,2,9,'#63855c');px(24,17,6,4,'#f19b6b');}
    if (a.cape) px(4,19,3,12,a.cape); canvas.style.imageRendering='pixelated';
  }

  function shareUrl() { return `${location.origin}${location.pathname}?r=${score().code}&lang=${lang}`; }
  function showToast(message) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }
  async function copyText(text, fallback) { try { if (!navigator.clipboard) throw new Error('clipboard unavailable'); await navigator.clipboard.writeText(text); showToast(t('copied')); } catch (error) { const area=document.getElementById('manual-copy'); if(area){area.value=text;area.focus();area.select();} showToast(fallback); } }

  app.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action],[data-option],[data-lang]'); if (!target) return;
    if (target.dataset.lang) { lang=target.dataset.lang; await loadLocale(); return; }
    if (target.dataset.option !== undefined) { answers[questionIndex]=Number(target.dataset.option); if(questionIndex < data.questions.length-1){questionIndex += 1; render();}else{view='result';render();} return; }
    const action=target.dataset.action;
    if(action==='start'){answers=[];questionIndex=0;view='quiz';render();}
    if(action==='prev' && questionIndex>0){questionIndex-=1;render();}
    if(action==='back-start'){view='start';render();}
    if(action==='retry'){answers=[];questionIndex=0;view='quiz';render();}
    if(action==='copy-link') await copyText(shareUrl(),t('selectManual'));
    if(action==='copy-result'){const result=currentResult();await copyText(`${t('shareLine',{title:result.title,result:result.name})}\n${t('tryIt',{url:shareUrl()})}`,t('selectManual'));}
  });
  loadLocale().catch(() => { app.innerHTML=`<div class="shell error-state">${esc(data?.ui?.loadError || '')}</div>`; });
}());
