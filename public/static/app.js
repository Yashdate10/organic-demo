const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const api = async (p, o) => { const r = await fetch('/api/' + p, o); if (!r.ok) throw new Error(r.status); return r.json(); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');

/* theme (dark by default) */
const setTheme = t => { document.documentElement.dataset.theme = t; localStorage.theme = t; };
setTheme(localStorage.theme || 'dark');
$('#theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

/* scroll progress + reveal + counters */
addEventListener('scroll', () => {
  const h = document.documentElement;
  $('#progress').style.transform = `scaleX(${h.scrollTop / (h.scrollHeight - h.clientHeight || 1)})`;
}, { passive: true });

const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in'); io.unobserve(e.target);
}), { threshold: .15 });
$$('.reveal').forEach(el => io.observe(el));

const co = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const el = e.target, to = +el.dataset.to, t0 = performance.now();
  const tick = t => { const p = Math.min((t - t0) / 1200, 1); el.textContent = Math.round(to * p); p < 1 && requestAnimationFrame(tick); };
  requestAnimationFrame(tick); co.unobserve(el);
}), { threshold: .6 });
$$('.count').forEach(el => co.observe(el));

/* Part 1: composting scrollytelling */
(async function () {
  const steps = await api('compost');
  $('#steps').innerHTML = steps.map((s, i) =>
    `<article class="step" data-i="${i}"><span class="num">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></article>`).join('');
  const layers = $$('.layer'), els = $$('.step');
  const so = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const i = +e.target.dataset.i;
    els.forEach(x => x.classList.toggle('active', x === e.target));
    layers.forEach((l, j) => l.classList.toggle('on', j <= i));
    $('#jar').classList.toggle('done', i === 4);
    $('#jarcap').textContent = steps[i].caption;
  }), { rootMargin: '-45% 0px -45% 0px' });
  els.forEach(s => so.observe(s));
})();

/* Part 2: pest tabs */
(async function () {
  const m = await api('pests'), tabs = $('#pestTabs'), panel = $('#pestPanel');
  tabs.innerHTML = m.map((p, i) => `<button class="chip" data-i="${i}">${p.icon} ${esc(p.name)}</button>`).join('');
  const show = i => {
    $$('.chip', tabs).forEach((c, j) => c.classList.toggle('on', i === j));
    const p = m[i];
    panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap');
    panel.innerHTML = `<h3>${p.icon} ${esc(p.name)}</h3><p>${esc(p.how)}</p><p class="meta" style="margin-top:10px">Controls: ${esc(p.targets)}</p>`;
  };
  tabs.onclick = e => { const b = e.target.closest('.chip'); b && show(+b.dataset.i); };
  show(0);
})();

/* Part 3: rotation */
(async function () {
  const g = await api('rotation'), plots = $('#plots'), slider = $('#season');
  $('#legend').innerHTML = g.map(x =>
    `<div class="legend-item" style="--c:${x.color}"><h3>${esc(x.name)}</h3><p class="meta">${esc(x.benefit)}</p></div>`).join('');
  const draw = () => {
    const s = +slider.value;
    $('#seasonLbl').textContent = `Season ${s + 1} of 4`;
    plots.innerHTML = [0, 1, 2, 3].map(i => {
      const x = g[(i + s) % 4];
      return `<div class="plot" style="--c:${x.color}"><b>Plot ${'ABCD'[i]}</b><span>${esc(x.name)}</span><small>${esc(x.crops)}</small></div>`;
    }).join('');
  };
  slider.oninput = draw; draw();
})();

/* Part 4: results + estimator */
(async function () {
  const d = await api('comparison');
  let ci = 0, mk = 'profit';
  const M = {
    yield: ['Yield', 'yield', v => v.toLocaleString('en-IN') + ' kg/acre'],
    cost: ['Cost', 'cost', inr],
    profit: ['Profit', 'profit', inr],
  };
  const ct = $('#cropTabs'), mt = $('#metricTabs'), card = $('#resultCard');
  ct.innerHTML = d.map((r, i) => `<button class="chip" data-i="${i}">${esc(r.crop)}</button>`).join('');
  mt.innerHTML = Object.entries(M).map(([k, v]) => `<button class="chip" data-k="${k}">${v[0]}</button>`).join('');
  const draw = () => {
    $$('.chip', ct).forEach((c, j) => c.classList.toggle('on', j === ci));
    $$('.chip', mt).forEach(c => c.classList.toggle('on', c.dataset.k === mk));
    const r = d[ci], [label, key, f] = M[mk];
    const o = r[key + '_org'], c = r[key + '_conv'], max = Math.max(o, c);
    card.classList.remove('go');
    $('#bars').innerHTML =
      `<div class="bar o"><label><span>🌱 Organic</span><b>${f(o)}</b></label><div class="track"><i style="--w:${o / max * 100}%"></i></div></div>
       <div class="bar c"><label><span>🧪 Conventional</span><b>${f(c)}</b></label><div class="track"><i style="--w:${c / max * 100}%"></i></div></div>`;
    const save = r.cost_conv - r.cost_org, gain = r.profit_org - r.profit_conv;
    $('#verdict').textContent = `${r.crop}: organic costs ${inr(Math.abs(save))} ${save >= 0 ? 'less' : 'more'} per acre and earns ${inr(Math.abs(gain))} ${gain >= 0 ? 'more' : 'less'}.`;
    void card.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('go')));
  };
  ct.onclick = e => { const b = e.target.closest('.chip'); if (b) { ci = +b.dataset.i; draw(); } };
  mt.onclick = e => { const b = e.target.closest('.chip'); if (b) { mk = b.dataset.k; draw(); } };
  const once = new IntersectionObserver(([e]) => { if (e.isIntersecting) { draw(); once.disconnect(); } }, { threshold: .3 });
  once.observe(card);

  $('#estCrop').innerHTML = d.map(r => `<option>${esc(r.crop)}</option>`).join('');
  $('#estBtn').onclick = async () => {
    try {
      const e = await api(`estimate?crop=${encodeURIComponent($('#estCrop').value)}&acres=${+$('#estAcres').value || 1}`);
      $('#estOut').textContent = `${e.acres} acre of ${e.crop}: ~${e.compost_tonnes} t compost, ${e.neem_oil_ml_per_spray} ml neem oil per spray, saves ${inr(e.cost_saving_inr)} in costs, extra profit ${inr(e.extra_profit_inr)}.`;
    } catch { $('#estOut').textContent = 'Could not estimate. Check the values.'; }
  };
})();

/* Field journal */
const ICON = { compost: '🪱', pest: '🐞', rotation: '🔄', harvest: '🧺', other: '📝' };
async function loadLogs() {
  const { logs, totals } = await api('logs');
  $('#totals').textContent = `${totals.entries} entries · total cost ${inr(totals.cost_inr)} · total yield ${totals.yield_kg} kg`;
  $('#logList').innerHTML = logs.map(l =>
    `<li>${ICON[l.activity]} ${esc(l.note)}<br><small>${esc(l.date)} · ${inr(l.cost_inr)} · ${l.yield_kg} kg</small></li>`).join('');
}
$('#logForm').onsubmit = async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  await api('logs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activity: f.get('activity'), note: f.get('note'), cost_inr: +f.get('cost_inr') || 0, yield_kg: +f.get('yield_kg') || 0 }),
  });
  e.target.reset(); loadLogs();
};
loadLogs();