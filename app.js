/* Ruh Hali Günlüğü — bağımlılıksız, tek dosyalık uygulama mantığı. */
'use strict';

/* =========================================================
   Sabitler
   ========================================================= */

const MOODS = [
  { value: 1, label: 'Çok kötü', color: '#C9B8D9' },
  { value: 2, label: 'Kötü',     color: '#B7CCE3' },
  { value: 3, label: 'İdare',    color: '#E8D9A8' },
  { value: 4, label: 'İyi',      color: '#BFDCC2' },
  { value: 5, label: 'Harika',   color: '#8FC7A6' },
];

const DEFAULT_TAGS = ['İş', 'Uyku', 'Spor', 'Aile', 'Arkadaşlar'];
const STORAGE_KEY = 'ruh-hali-gunlugu:v1';
const NOTE_MAX = 120;
const TAG_MAX = 20;

// Pazartesi = 0
const DAY_SHORT  = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const DAY_NAME   = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const DAY_PLURAL = ['Pazartesileri', 'Salıları', 'Çarşambaları', 'Perşembeleri', 'Cumaları', 'Cumartesileri', 'Pazarları'];

const moodOf = (v) => MOODS[v - 1];

/* =========================================================
   Tarih yardımcıları (yerel saat, "YYYY-AA-GG" anahtarları)
   ========================================================= */

const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const weekdayIdx = (d) => (d.getDay() + 6) % 7;

const fmtLongDate = (d) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }).format(d);
const fmtDayMonth = (d) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(d);
const fmtMonthYear = (d) =>
  new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(d);
const fmtTime = (iso) =>
  new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

const fmtNum = (n) => n.toFixed(1).replace('.', ',');
const avg = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;

/* =========================================================
   Depolama (localStorage)
   ========================================================= */

const storage = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { entries: {}, customTags: [] };
      const data = JSON.parse(raw);
      return { entries: data.entries || {}, customTags: data.customTags || [] };
    } catch {
      return { entries: {}, customTags: [] };
    }
  },
  save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries: state.entries, customTags: state.customTags }));
      return true;
    } catch {
      return false;
    }
  },
};

/* =========================================================
   Hesaplamalar
   ========================================================= */

/** Bugünden (bugün kayıt yoksa dünden) geriye kesintisiz kayıtlı gün sayısı. */
function computeStreak(entries, today = startOfToday()) {
  let d = entries[toKey(today)] ? today : addDays(today, -1);
  let n = 0;
  while (entries[toKey(d)]) { n++; d = addDays(d, -1); }
  return n;
}

/** [başlangıç, bitiş] aralığındaki kayıtlar (her ikisi dahil). */
function entriesBetween(entries, from, to) {
  const out = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const e = entries[toKey(d)];
    if (e) out.push(e);
  }
  return out;
}

function tagPhrase(tag) {
  const phrases = {
    'Spor': 'Spor yaptığın günlerde',
    'Aile': 'Ailenle vakit geçirdiğin günlerde',
    'Arkadaşlar': 'Arkadaşlarınla görüştüğün günlerde',
  };
  return phrases[tag] || `“${tag}” etiketli günlerde`;
}

/**
 * Kural tabanlı içgörüler. Saf fonksiyon: aynı girdi → aynı çıktı.
 * İleride AI entegrasyonu bu fonksiyonun yerine geçebilir; dönen biçim
 * { tone: 'up'|'down'|'neutral', title, body, basis } olarak korunmalı.
 */
function computeInsights(entries, today = startOfToday()) {
  const list = Object.values(entries);
  if (list.length < 5) return [];

  const overall = avg(list.map((e) => e.mood));
  const out = [];

  // 1) Haftanın günleri
  const byDay = Array.from({ length: 7 }, () => []);
  list.forEach((e) => byDay[weekdayIdx(fromKey(e.date))].push(e.mood));
  const dayStats = byDay
    .map((moods, i) => ({ i, n: moods.length, avg: moods.length ? avg(moods) : 0 }))
    .filter((s) => s.n >= 2);

  if (dayStats.length >= 3) {
    const low = dayStats.reduce((a, b) => (b.avg < a.avg ? b : a));
    const high = dayStats.reduce((a, b) => (b.avg > a.avg ? b : a));
    if (overall - low.avg >= 0.5) {
      out.push({
        tone: 'down', weight: overall - low.avg,
        title: `${DAY_PLURAL[low.i]} enerjin düşük`,
        body: `${DAY_NAME[low.i]} ortalaman ${fmtNum(low.avg)}, genel ortalaman ${fmtNum(overall)}. Bu güne hafif bir plan yapmayı deneyebilirsin.`,
        basis: `${low.n} ${DAY_NAME[low.i]} kaydına dayanıyor`,
      });
    }
    if (high.avg - overall >= 0.5 && high.i !== low.i) {
      out.push({
        tone: 'up', weight: high.avg - overall,
        title: `${DAY_PLURAL[high.i]} en iyi halindesin`,
        body: `${DAY_NAME[high.i]} ortalaman ${fmtNum(high.avg)}, genel ortalamanın ${fmtNum(high.avg - overall)} puan üstünde.`,
        basis: `${high.n} ${DAY_NAME[high.i]} kaydına dayanıyor`,
      });
    }
  }

  // 2) Etiketler: etiketli günler ile diğer günlerin farkı
  const tags = new Set(list.flatMap((e) => e.tags || []));
  const tagEffects = [];
  tags.forEach((tag) => {
    const withTag = list.filter((e) => (e.tags || []).includes(tag)).map((e) => e.mood);
    const without = list.filter((e) => !(e.tags || []).includes(tag)).map((e) => e.mood);
    if (withTag.length < 3 || without.length < 3) return;
    const diff = avg(withTag) - avg(without);
    if (Math.abs(diff) >= 0.5) tagEffects.push({ tag, diff, withAvg: avg(withTag), withoutAvg: avg(without), n: withTag.length });
  });
  tagEffects
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 3)
    .forEach((t) => {
      const higher = t.diff > 0;
      out.push({
        tone: higher ? 'up' : 'down', weight: Math.abs(t.diff),
        title: `${tagPhrase(t.tag)} ruh halin daha ${higher ? 'yüksek' : 'düşük'}`,
        body: `Bu günlerde ortalaman ${fmtNum(t.withAvg)}, diğer günlerde ${fmtNum(t.withoutAvg)} (${higher ? '+' : '−'}${fmtNum(Math.abs(t.diff))} puan).`,
        basis: `${t.n} etiketli kayda dayanıyor`,
      });
    });

  // 3) Haftalık eğilim
  const thisWeek = entriesBetween(entries, addDays(today, -6), today);
  const lastWeek = entriesBetween(entries, addDays(today, -13), addDays(today, -7));
  if (thisWeek.length >= 3 && lastWeek.length >= 3) {
    const a = avg(thisWeek.map((e) => e.mood));
    const b = avg(lastWeek.map((e) => e.mood));
    if (Math.abs(a - b) >= 0.4) {
      const up = a > b;
      out.push({
        tone: up ? 'up' : 'down', weight: Math.abs(a - b) * 0.9,
        title: up ? 'Bu hafta yükselişteydin' : 'Bu hafta biraz daha zorlandın',
        body: `Son 7 günün ortalaması ${fmtNum(a)}, önceki 7 gün ${fmtNum(b)}.`,
        basis: `${thisWeek.length + lastWeek.length} kayda dayanıyor`,
      });
    }
  }

  // 4) Süreklilik
  const streak = computeStreak(entries, today);
  if (streak >= 7) {
    out.push({
      tone: 'neutral', weight: 0,
      title: `${streak} gündür aralıksız yazıyorsun`,
      body: 'Düzenli kayıt tuttukça örüntüler daha güvenilir hale gelir.',
      basis: 'Seri sayacına dayanıyor',
    });
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, 5);
}

/* =========================================================
   Örnek veri (sabit tohumlu, her seferinde aynı 3 hafta)
   ========================================================= */

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAMPLE_NOTES = {
  1: ['Günü zor bitirdim, her şey üst üste geldi.', 'Çok gergindim, kimseyle konuşmak istemedim.', 'Hiçbir şey yolunda gitmedi.'],
  2: ['Toplantılar bütün enerjimi tüketti.', 'Az uyudum, odaklanmakta zorlandım.', 'Durgun ve isteksiz bir gündü.', 'Kafam dağınıktı, işler birikti.'],
  3: ['Sakin, sıradan bir gün geçti.', 'Ne iyi ne kötü, akıp gitti.', 'İşler yolunda ama biraz yorgunum.', 'Ortalama bir gün, şikâyetim yok.'],
  4: ['Verimli bir gün geçirdim.', 'Akşam yürüyüşü iyi geldi.', 'Kendimi dengeli hissettim.', 'Güzel bir sohbet günümü toparladı.'],
  5: ['Harika bir antrenman, enerjim çok yüksek.', 'Arkadaşlarla bol bol güldük.', 'Uzun zamandır bu kadar iyi hissetmemiştim.', 'Her şey yerine oturdu, çok mutluyum.'],
};

function generateSampleEntries(today = startOfToday()) {
  const rand = mulberry32(20261016);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const entries = {};

  // Bugün boş bırakılır; kullanıcı kendi kaydını ekleyip seriyi sürdürebilsin.
  for (let i = 21; i >= 1; i--) {
    const d = addDays(today, -i);
    const wd = weekdayIdx(d);
    const weekend = wd >= 5;
    const tags = [];
    let score = 3.3;

    if (!weekend && rand() < 0.75) { tags.push('İş'); score -= 0.3; }
    if (rand() < 0.3)              { tags.push('Uyku'); score -= 0.8; }
    if (rand() < 0.4)              { tags.push('Spor'); score += 1.0; }
    if (weekend && rand() < 0.6)   { tags.push('Aile'); score += 0.4; }
    if (rand() < 0.3)              { tags.push('Arkadaşlar'); score += 0.6; }
    if (wd === 0) score -= 1.3;
    if (weekend) score += 0.3;
    score += (rand() - 0.5) * 1.2;

    const mood = Math.max(1, Math.min(5, Math.round(score)));
    const note = tags.includes('Spor') && mood >= 4 && rand() < 0.5
      ? 'Spor sonrası kafam açıldı.'
      : pick(SAMPLE_NOTES[mood]);

    const at = new Date(d);
    at.setHours(20 + Math.floor(rand() * 3), Math.floor(rand() * 60));
    entries[toKey(d)] = { date: toKey(d), mood, note, tags, updatedAt: at.toISOString() };
  }
  return entries;
}

/* =========================================================
   Filiz (maskot) — ruh hali 1..5 arasında sürekli değerle çizilir
   ========================================================= */

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** 1..5 aralığındaki v için dizideki komşu değerler arasında doğrusal geçiş. */
function interp(values, v) {
  const i = clamp(Math.floor(v - 1), 0, values.length - 2);
  return lerp(values[i], values[i + 1], clamp(v - 1 - i, 0, 1));
}

const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

function moodColorAt(v) {
  const i = clamp(Math.floor(v - 1), 0, 3);
  const t = clamp(v - 1 - i, 0, 1);
  const a = hexRgb(MOODS[i].color);
  const b = hexRgb(MOODS[i + 1].color);
  return `rgb(${a.map((x, k) => Math.round(lerp(x, b[k], t))).join(',')})`;
}

const FILIZ_IDLE = '#DCC9B0'; // Seçim öncesi sıcak kum tonu; zeminden belirgin ayrışır
const FILIZ_INK = '#2A302B';
const LEAF = '#6FA58A';
const LEAF_DARK = '#5A8F76';

/** Seriye göre büyüme: 1 yaprak → 7 günde 2 yaprak → 21 günde çiçek. */
const filizStage = (streak) => (streak >= 21 ? 3 : streak >= 7 ? 2 : 1);

function filizParams(raw, chosen) {
  const v = clamp(raw, 1, 5);
  const c = interp([-3.5, -1.8, 0, 2.4, 4.2], v);      // ağız eğriliği
  const w = interp([5.5, 5.5, 5.5, 5.5, 6.5], v);      // ağız genişliği
  const f = (n) => n.toFixed(2);
  return {
    color: chosen ? moodColorAt(v) : FILIZ_IDLE,
    mouth: `M${f(50 - w)} ${f(69 - c / 2)} Q50 ${f(69 + c)} ${f(50 + w)} ${f(69 - c / 2)}`,
    dots: 1 - clamp(v - 4, 0, 1),                      // nokta gözler → gülen gözler
    arcs: clamp(v - 4, 0, 1),
    brows: clamp(2 - v, 0, 1) * 0.7,                   // yalnızca düşük ruh halinde kaşlar
    blush: chosen ? interp([0.15, 0.2, 0.3, 0.4, 0.5], v) : 0.2,
    sprout: (3 - v) * 8,                               // yaprak kötüde düşer, iyide dikleşir
    lift: -(clamp(raw, 0.6, 5.4) - 3) * 2.5,           // iyi ruh halinde hafifçe yükselir
  };
}

function filizFlower(cx, cy, r) {
  const petals = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    return `<circle cx="${(cx + Math.cos(a) * r).toFixed(2)}" cy="${(cy + Math.sin(a) * r).toFixed(2)}" r="${(r * 0.85).toFixed(2)}" fill="#F2BFA8"/>`;
  }).join('');
  return `${petals}<circle cx="${cx}" cy="${cy}" r="${(r * 0.7).toFixed(2)}" fill="#E8C46A"/>`;
}

function filizSvg(v = 3, { chosen = true, stage = 1, cls = '' } = {}) {
  const p = filizParams(v, chosen);
  const leafR = `<path d="M50 24 C53 13 63 8 73 10 C71 20 62 26 50 24Z" fill="${LEAF}"/>`;
  const leafL = `<path d="M50 26 C47 16 38 12 29 14 C31 23 39 28 50 26Z" fill="${LEAF_DARK}"/>`;
  return `
    <svg class="filiz ${cls}" viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="50" cy="93" rx="26" ry="3.2" fill="rgba(74,60,40,.13)"/>
      <g data-part="figure" transform="translate(0 ${p.lift.toFixed(2)})">
        <g data-part="sprout" transform="rotate(${p.sprout.toFixed(2)} 50 32)">
          <path d="M50 34 Q49 28 50 22" stroke="${LEAF_DARK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
          ${stage >= 2 ? leafL : ''}${leafR}${stage >= 3 ? filizFlower(50, 15, 4.2) : ''}
        </g>
        <g class="f-body">
          <path data-part="skin" d="M50 32 C71 32 83 47 83 64 C83 81 69 91 50 91 C31 91 17 81 17 64 C17 47 29 32 50 32Z" fill="${p.color}"/>
          <ellipse cx="38" cy="46" rx="9" ry="5" fill="#fff" opacity=".22" transform="rotate(-25 38 46)"/>
          <g opacity=".88" fill="none" stroke="${FILIZ_INK}" stroke-width="1.8" stroke-linecap="round">
            <g data-part="blush" opacity="${p.blush}" stroke="none" fill="#E39A88"><ellipse cx="37" cy="66.5" rx="3.4" ry="2.1"/><ellipse cx="63" cy="66.5" rx="3.4" ry="2.1"/></g>
            <g data-part="brows" opacity="${p.brows}" stroke-width="1.6"><path d="M39 56 L45 54"/><path d="M61 56 L55 54"/></g>
            <g data-part="dots" opacity="${p.dots}" stroke="none" fill="${FILIZ_INK}"><circle cx="42" cy="61" r="2.3"/><circle cx="58" cy="61" r="2.3"/></g>
            <g data-part="arcs" opacity="${p.arcs}"><path d="M39 62 Q42 58 45 62"/><path d="M55 62 Q58 58 61 62"/></g>
            <path data-part="mouth" d="${p.mouth}"/>
          </g>
        </g>
      </g>
    </svg>`;
}

/** Var olan bir Filiz SVG'sini yeniden oluşturmadan günceller (animasyon için). */
function paintFiliz(svg, raw, chosen) {
  const p = filizParams(raw, chosen);
  const q = (name) => svg.querySelector(`[data-part="${name}"]`);
  q('figure').setAttribute('transform', `translate(0 ${p.lift.toFixed(2)})`);
  q('sprout').setAttribute('transform', `rotate(${p.sprout.toFixed(2)} 50 32)`);
  q('skin').setAttribute('fill', p.color);
  q('mouth').setAttribute('d', p.mouth);
  ['dots', 'arcs', 'brows', 'blush'].forEach((k) => q(k).setAttribute('opacity', p[k].toFixed(3)));
  return p;
}

const NOTE_PROMPTS = {
  1: 'Seni en çok ne yordu?',
  2: 'Günü ne ağırlaştırdı?',
  3: 'Bugün aklında ne var?',
  4: 'Seni ne iyi hissettirdi?',
  5: 'Bugünü harika yapan neydi?',
};

/* =========================================================
   Arayüz
   ========================================================= */

if (typeof document !== 'undefined') {
  const state = storage.load();
  const ui = {
    view: null,
    editDate: null,       // Geçmiş bir günü düzenlerken o günün anahtarı; bugün için null
    keepHistory: false,   // Düzenlemeden dönünce takvim ayı ve seçili gün korunsun
    draft: null,          // Kayıt formunda düzenlenen kayıt
    addingTag: false,
    calMonth: null,       // Takvimde gösterilen ayın ilk günü
    listLimit: 10,        // Son kayıtlar listesinde gösterilen kayıt sayısı
    selectedDay: null,
    armed: null,          // İki adımlı onay bekleyen işlem ('sample' | 'clear')
    armedTimer: null,
    notesOn: false,       // Ürün notları modu (işe alımcı turu)
  };

  const $view = document.getElementById('view');
  const $toast = document.getElementById('toast');

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const allTags = () => [...DEFAULT_TAGS, ...state.customTags];

  function persist() {
    if (!storage.save(state)) toast('Kaydedilemedi: tarayıcı depolaması kullanılamıyor');
  }

  let toastTimer;
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), 2200);
  }

  const activeKey = () => ui.editDate || toKey(startOfToday());

  function resetDraft() {
    const e = state.entries[activeKey()];
    ui.draft = e ? { mood: e.mood, note: e.note, tags: [...e.tags] } : { mood: null, note: '', tags: [] };
    ui.addingTag = false;
  }

  function isUnchanged() {
    const e = state.entries[activeKey()];
    const d = ui.draft;
    return Boolean(e) && e.mood === d.mood && e.note === d.note.trim()
      && e.tags.length === d.tags.length && e.tags.every((t) => d.tags.includes(t));
  }

  function disarm() {
    ui.armed = null;
    clearTimeout(ui.armedTimer);
  }

  function greeting(hour = new Date().getHours()) {
    if (hour >= 5 && hour < 12) return 'Günaydın';
    if (hour >= 12 && hour < 18) return 'İyi günler';
    if (hour >= 18 && hour < 23) return 'İyi akşamlar';
    return 'İyi geceler';
  }

  /* ---------- İkonlar ---------- */

  const chevron = (dir) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}"/></svg>`;

  /* ---------- Ürün notları ---------- */

  /** Ürün notları açıkken numaralı not noktası; kapalıyken hiçbir şey çizmez. */
  function pnote(id, { corner = false } = {}) {
    if (!ui.notesOn) return '';
    const n = PRODUCT_NOTES[id];
    return `<button class="pnote${corner ? ' corner' : ''}" type="button" data-action="note" data-note="${id}"
      aria-label="Ürün notu ${n.n}: ${esc(n.title)}">${n.n}</button>`;
  }

  /* ---------- Kayıt formu durumu ---------- */

  function formState() {
    const existing = state.entries[activeKey()];
    const streak = computeStreak(state.entries);
    const d = ui.draft;
    const unchanged = isUnchanged();
    let hint = '';
    if (ui.editDate) hint = existing ? 'Değişiklikler bu günün kaydına işlenir.' : 'Bu gün için yeni kayıt ekliyorsun.';
    else if (existing) hint = `Bugün kaydedildi (${fmtTime(existing.updatedAt)}). Dilediğin zaman güncelleyebilirsin.`;
    else if (!d.mood) hint = 'Kaydetmek için Filiz’i kaydırarak ruh halini seç.';
    else if (streak > 0) hint = `Kaydedersen serin ${streak + 1} güne çıkar.`;
    return {
      disabled: !d.mood || unchanged,
      saved: Boolean(existing) && unchanged,
      label: existing ? (unchanged ? 'Kaydedildi' : 'Güncelle') : 'Kaydet',
      hint,
    };
  }

  const CHECK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const saveButtonInner = (f) => (f.saved ? `${CHECK_ICON}<span>${f.label}</span>` : f.label);
  const COUNTER_FROM = NOTE_MAX - 20; // Sayaç yalnızca sınıra yaklaşınca görünür

  const notePlaceholder = () => (ui.draft.mood ? NOTE_PROMPTS[ui.draft.mood] : 'Ör. Sabah yürüyüşü iyi geldi.');

  /** Formu yeniden çizmeden kaydet butonunu, ipucunu ve not yer tutucusunu günceller. */
  function refreshFormState() {
    const btn = $view.querySelector('[data-action="save"]');
    if (!btn) return;
    const f = formState();
    btn.disabled = f.disabled;
    btn.classList.toggle('btn-saved', f.saved);
    btn.innerHTML = saveButtonInner(f);
    const hint = $view.querySelector('.save-hint');
    hint.textContent = f.hint;
    hint.hidden = !f.hint;
    const note = document.getElementById('note');
    if (note) note.placeholder = notePlaceholder();
  }

  /* ---------- Filiz seçici (sürükle, bırak, yerine otursun) ---------- */

  const STEP_PX = 44; // Bir ruh hali basamağı için gereken dikey sürükleme
  const picker = { cur: 3, target: 3, chosen: false, drag: null, raf: 0, lastStep: null };

  function syncPicker() {
    const m = ui.draft && ui.draft.mood;
    picker.cur = picker.target = m || 3;
    picker.chosen = Boolean(m);
    picker.lastStep = m || null;
    paintPicker();
  }

  function paintPicker() {
    const root = $view.querySelector('.picker');
    if (!root) return;
    const p = paintFiliz(root.querySelector('.filiz'), picker.cur, picker.chosen);
    const v = clamp(picker.cur, 1, 5);
    const step = Math.round(v);

    root.style.setProperty('--halo', p.color);
    root.classList.toggle('is-idle', !picker.chosen);
    root.querySelector('.scale-knob').style.top = `${((5 - v) / 4) * 100}%`;
    root.querySelectorAll('.stop').forEach((s) =>
      s.classList.toggle('is-active', picker.chosen && Number(s.dataset.value) === step));

    const slider = root.querySelector('[role="slider"]');
    slider.setAttribute('aria-valuenow', picker.chosen ? step : 3);
    slider.setAttribute('aria-valuetext', picker.chosen ? moodOf(step).label : 'Seçilmedi');

    const label = $view.querySelector('.picker-label');
    label.textContent = picker.chosen ? moodOf(step).label : 'Yukarı ya da aşağı kaydır';
    label.classList.toggle('is-placeholder', !picker.chosen);

    // Her yeni basamakta küçük bir esneme ve (destekleyen cihazlarda) hafif titreşim
    if (picker.chosen && step !== picker.lastStep) {
      picker.lastStep = step;
      const body = root.querySelector('.f-body');
      body.classList.remove('boing');
      void body.getBoundingClientRect();
      body.classList.add('boing');
      if (picker.drag && navigator.vibrate) { try { navigator.vibrate(8); } catch { /* yok say */ } }
    }
  }

  function runPicker() {
    if (picker.raf) return;
    const tick = () => {
      // Sürüklerken parmağı yakından takip et, bırakınca yumuşakça yerine otur
      const k = picker.drag ? 0.4 : 0.14;
      picker.cur += (picker.target - picker.cur) * k;
      if (Math.abs(picker.target - picker.cur) < 0.002) picker.cur = picker.target;
      paintPicker();
      picker.raf = picker.cur === picker.target && !picker.drag ? 0 : requestAnimationFrame(tick);
    };
    picker.raf = requestAnimationFrame(tick);
  }

  function commitMood(v, method) {
    picker.chosen = true;
    picker.target = clamp(Math.round(v), 1, 5);
    analytics.track('mood_selected', { mood: picker.target, method });
    ui.draft.mood = picker.target;
    refreshFormState();
    runPicker();
  }

  /* ---------- Bugün ---------- */

  function renderToday() {
    const today = startOfToday();
    const isPast = Boolean(ui.editDate);
    const date = isPast ? fromKey(ui.editDate) : today;
    const existing = state.entries[activeKey()];
    const streak = computeStreak(state.entries, today);
    const d = ui.draft;

    const badgeHtml = isPast
      ? `<a class="back-link" href="#gecmis" data-action="back">${chevron('left')}<span>Geçmiş</span></a>`
      : streak > 0
      ? `<span class="streak" title="${existing ? 'Bugün dahil' : 'Bugün kaydedersen seri devam eder'}">
           <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8.6 1.2c.3 2.2-1.4 3.2-2.4 4.6C5.4 6.9 5 8 5.2 9.2c-.6-.4-1-1.1-1.1-1.9C3.4 8.4 3 9.6 3 10.6 3 13.3 5.2 15 8 15s5-1.8 5-4.6c0-3.5-2.8-5-4.4-9.2Z"/></svg>
           <span><strong>${streak}</strong> gün seri</span>
         </span>`
      : `<span class="streak">Seriye bugün başla</span>`;

    // Filiz'i yukarı/aşağı sürükleyerek ya da ölçekteki etiketlere dokunarak seçilir
    const stopsHtml = MOODS.map((m) => `
      <button class="stop" type="button" tabindex="-1" data-action="mood-set" data-value="${m.value}"
              style="top:${((5 - m.value) / 4) * 100}%" aria-label="${m.label}" title="${m.label}"></button>`).join('');
    const pickerHtml = `
      <div class="picker">
        ${pnote('filiz', { corner: true })}
        <div class="picker-stage" role="slider" tabindex="0" aria-label="Ruh hali"
             aria-valuemin="1" aria-valuemax="5" aria-valuenow="${d.mood || 3}" aria-valuetext="${d.mood ? moodOf(d.mood).label : 'Seçilmedi'}">
          <div class="picker-halo"></div>
          ${filizSvg(d.mood || 3, { chosen: Boolean(d.mood), stage: filizStage(isPast ? computeStreak(state.entries, date) : streak) })}
        </div>
        <div class="scale">
          <span class="scale-end" aria-hidden="true">Harika</span>
          <div class="scale-track">${stopsHtml}<span class="scale-knob"></span></div>
          <span class="scale-end" aria-hidden="true">Çok kötü</span>
        </div>
      </div>
      <p class="picker-label" aria-hidden="true"></p>`;

    // Kayıtta olup listede artık bulunmayan etiketler de görünsün
    const tagOptions = [...new Set([...allTags(), ...d.tags])];
    const chipsHtml = tagOptions.map((t) => `
      <button class="chip" aria-pressed="${d.tags.includes(t)}" data-action="tag" data-tag="${esc(t)}">${esc(t)}</button>`).join('');

    const addTagHtml = ui.addingTag
      ? `<form class="tag-form" data-form="tag">
           <input class="input" id="new-tag" maxlength="${TAG_MAX}" placeholder="Yeni etiket" autocomplete="off" aria-label="Yeni etiket adı">
           <button class="btn btn-ghost btn-sm" type="submit">Ekle</button>
           <button class="btn btn-quiet btn-sm" type="button" data-action="tag-cancel">Vazgeç</button>
         </form>`
      : `<button class="chip chip-add" data-action="tag-open">+ Etiket ekle</button>`;

    const form = formState();

    const deleteHtml = existing
      ? `<button class="btn btn-sm btn-block ${ui.armed === 'delete' ? 'btn-danger-armed' : 'btn-link'}" data-action="delete">
           ${ui.armed === 'delete' ? 'Silmek için tekrar dokun' : 'Bu kaydı sil'}
         </button>`
      : '';

    return `
      <header class="top">
        ${isPast ? badgeHtml : `<p class="eyebrow"><strong>${greeting()}</strong> · ${fmtDayMonth(date)}, ${DAY_NAME[weekdayIdx(date)]}</p><span class="top-end">${pnote('streak')}${badgeHtml}</span>`}
      </header>
      ${isPast ? `<p class="eyebrow eyebrow-lead">${fmtLongDate(date)}</p>` : ''}
      <h1 class="title">${isPast ? 'O gün nasıl hissediyordun?' : 'Bugün nasıl hissediyorsun?'}</h1>

      ${pickerHtml}

      <div class="field">
        <div class="label-row"><label class="label" for="note">${isPast ? 'O günü' : 'Bugünü'} tek cümleyle anlat</label>${pnote('note')}</div>
        <input class="input" id="note" maxlength="${NOTE_MAX}" value="${esc(d.note)}" placeholder="${notePlaceholder()}" autocomplete="off">
        <span class="counter" id="note-count" ${d.note.length < COUNTER_FROM ? 'hidden' : ''}>${d.note.length}/${NOTE_MAX}</span>
      </div>

      <div class="field">
        <div class="label-row"><span class="label" id="tags-label">Etiketler</span>${pnote('tags')}</div>
        <div class="chips" role="group" aria-labelledby="tags-label">${chipsHtml}${addTagHtml}</div>
      </div>

      <div class="save-area">
        ${pnote('save', { corner: true })}
        <button class="btn btn-primary btn-block${form.saved ? ' btn-saved' : ''}" data-action="save" ${form.disabled ? 'disabled' : ''}>${saveButtonInner(form)}</button>
        <p class="save-hint" ${form.hint ? '' : 'hidden'}>${form.hint}</p>
        ${deleteHtml}
      </div>`;
  }

  /* ---------- İçgörü ---------- */

  /** Grafiğin altındaki özet: kayıt sayısı ve haftanın en iyi günü. */
  function weekFoot(days) {
    const logged = days.map((d) => ({ d, e: state.entries[toKey(d)] })).filter((x) => x.e);
    const parts = [`7 günün ${logged.length} günü kaydedildi`];
    if (logged.length >= 3) {
      // En yüksek puanlı gün; eşitlikte en yakın tarihli olan
      const best = logged.reduce((a, b) => (b.e.mood >= a.e.mood ? b : a));
      const isToday = toKey(best.d) === toKey(startOfToday());
      parts.push(`En iyi gün: <strong>${isToday ? 'Bugün' : DAY_NAME[weekdayIdx(best.d)]}</strong>`);
    }
    return parts.join(' · ');
  }

  function renderInsights() {
    const today = startOfToday();
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const week = days.map((d) => state.entries[toKey(d)]).filter(Boolean);
    const prev = entriesBetween(state.entries, addDays(today, -13), addDays(today, -7));
    const weekAvg = week.length ? avg(week.map((e) => e.mood)) : null;
    const prevAvg = prev.length ? avg(prev.map((e) => e.mood)) : null;

    const bars = days.map((d) => {
      const e = state.entries[toKey(d)];
      const isToday = toKey(d) === toKey(today);
      const label = `${DAY_NAME[weekdayIdx(d)]}: ${e ? moodOf(e.mood).label : 'kayıt yok'}`;
      return `
        <div class="bar-col${isToday ? ' is-today' : ''}" role="img" aria-label="${label}">
          <div class="bar-track">
            ${e ? `<div class="bar" style="height:${(e.mood / 5) * 100}%;--c:${moodOf(e.mood).color}" title="${moodOf(e.mood).label}"></div>`
                : '<div class="bar-empty"></div>'}
          </div>
          <span class="bar-label">${isToday ? 'Bugün' : DAY_SHORT[weekdayIdx(d)]}</span>
        </div>`;
    }).join('');

    let summary;
    if (weekAvg === null) {
      summary = `<div><span class="avg-num">–</span><p class="avg-caption">Bu hafta henüz kayıt yok</p></div>`;
    } else {
      const m = moodOf(Math.round(weekAvg));
      let delta = '';
      if (prevAvg !== null) {
        const diff = weekAvg - prevAvg;
        delta = Math.abs(diff) < 0.05
          ? '<span class="delta">Geçen haftayla aynı</span>'
          : `<span class="delta${diff > 0 ? ' up' : ''}">Geçen haftaya göre ${diff > 0 ? '+' : '−'}${fmtNum(Math.abs(diff))}</span>`;
      }
      summary = `
        <div>
          <span class="avg-num">${fmtNum(weekAvg)}</span><span class="avg-of">/ 5</span>
          <p class="avg-caption">Ortalama puan</p>
        </div>
        <div class="avg-meta">
          <span class="pill" style="--c:${m.color}">${m.label}</span>
          ${delta}
        </div>`;
    }

    const insights = computeInsights(state.entries, today);
    const TONES = {
      up:      { tint: 'var(--tint-up)',      color: MOODS[4].color, icon: '<path d="M4 16l5-5 4 4 7-7"/><path d="M15 8h5v5"/>' },
      down:    { tint: 'var(--tint-down)',    color: MOODS[0].color, icon: '<path d="M4 8l5 5 4-4 7 7"/><path d="M15 16h5v-5"/>' },
      neutral: { tint: 'var(--tint-neutral)', color: MOODS[2].color, icon: '<circle cx="12" cy="12" r="8"/><path d="M8.5 12.2l2.4 2.3 4.6-4.8"/>' },
    };
    const total = Object.keys(state.entries).length;

    const insightsHtml = insights.length
      ? `<div class="insights">${insights.map((ins) => {
          const t = TONES[ins.tone];
          return `
          <article class="card insight" style="--tint:${t.tint};--c:${t.color}">
            <span class="insight-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${t.icon}</svg></span>
            <div>
              <h3>${esc(ins.title)}</h3>
              <p>${esc(ins.body)}</p>
              <p class="basis">${esc(ins.basis)}</p>
            </div>
          </article>`;
        }).join('')}</div>`
      : `<div class="card empty">
          <div class="empty-filiz">${filizSvg(total < 5 ? 3 : 4)}</div>
          <h3>${total < 5 ? 'Örüntüler için biraz daha kayıt lazım' : 'Henüz belirgin bir örüntü yok'}</h3>
          <p>${total < 5
            ? `İlk içgörüler 5 kayıttan sonra görünür. Şu an ${total} kaydın var.`
            : 'Kayıt ekledikçe günler ve etiketler arasındaki farklar burada belirecek.'}</p>
          ${total < 5 ? '<button class="btn btn-ghost btn-sm" data-action="sample">Örnek veriyle dene</button>' : ''}
        </div>`;

    return `
      <header class="top"><p class="eyebrow">Son 7 gün</p></header>
      <h1 class="title">Haftalık içgörü</h1>

      <section class="card has-note" aria-label="Son 7 günün ruh hali">
        ${pnote('weekly', { corner: true })}
        <div class="avg-row">${summary}</div>
        <div class="chart">${bars}</div>
        <p class="chart-foot">${weekFoot(days)}</p>
      </section>

      <h2 class="section-title">Örüntüler ${pnote('patterns')}</h2>
      ${insightsHtml}
      <p class="disclaimer">${pnote('responsible')}İçgörüler kayıtlarından basit kurallarla hesaplanır, tıbbi bir değerlendirme değildir.</p>`;
  }

  /* ---------- Geçmiş ---------- */

  const pencil = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/></svg>`;

  function entryCard(e, tag = 'li') {
    const m = moodOf(e.mood);
    const d = fromKey(e.date);
    return `
      <${tag} class="card entry">
        <span class="entry-swatch" style="--c:${m.color}" aria-hidden="true"></span>
        <div>
          <div class="entry-head">
            <span class="entry-date">${fmtDayMonth(d)}, ${DAY_NAME[weekdayIdx(d)]}</span>
            <span class="entry-mood">${m.label}</span>
          </div>
          ${e.note ? `<p class="entry-note">${esc(e.note)}</p>` : '<p class="entry-note empty-note">Not yok</p>'}
          ${e.tags.length ? `<div class="entry-tags">${e.tags.map((t) => `<span class="tag-mini">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
        <button class="icon-btn entry-edit" data-action="edit" data-key="${e.date}" aria-label="${fmtDayMonth(d)} kaydını düzenle" title="Düzenle">${pencil}</button>
      </${tag}>`;
  }

  function emptyDayCard(key) {
    const d = fromKey(key);
    return `
      <div class="card entry entry-missing">
        <span class="entry-swatch" aria-hidden="true"></span>
        <div>
          <div class="entry-head"><span class="entry-date">${fmtDayMonth(d)}, ${DAY_NAME[weekdayIdx(d)]}</span></div>
          <p class="entry-note empty-note">Bu gün için kayıt yok</p>
        </div>
        <button class="btn btn-ghost btn-sm" data-action="edit" data-key="${key}">Kayıt ekle</button>
      </div>`;
  }

  function renderHistory() {
    const today = startOfToday();
    const month = ui.calMonth;
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const isCurrentMonth = first.getFullYear() === today.getFullYear() && first.getMonth() === today.getMonth();

    let cells = DAY_SHORT.map((d) => `<span class="cal-wd">${d}</span>`).join('');
    cells += '<span></span>'.repeat(weekdayIdx(first));
    for (let n = 1; n <= daysInMonth; n++) {
      const d = new Date(first.getFullYear(), first.getMonth(), n);
      const key = toKey(d);
      const e = state.entries[key];
      const cls = ['cal-day'];
      if (e) cls.push('has-entry');
      if (key === toKey(today)) cls.push('is-today');
      if (d > today) cls.push('is-future');
      if (key === ui.selectedDay) cls.push('is-selected');
      const label = `${fmtDayMonth(d)}: ${e ? moodOf(e.mood).label : 'kayıt yok'}`;
      cells += `<button class="${cls.join(' ')}" data-action="day" data-key="${key}" aria-label="${label}"
        ${e ? `style="--c:${moodOf(e.mood).color}"` : ''} ${d > today ? 'disabled' : ''}>${n}</button>`;
    }

    const legend = MOODS.map((m) => `<span><i class="dot" style="--c:${m.color}"></i>${m.label}</span>`).join('');
    const selectedHtml = !ui.selectedDay ? ''
      : state.entries[ui.selectedDay] ? entryCard(state.entries[ui.selectedDay], 'div')
      : emptyDayCard(ui.selectedDay);
    const all = Object.values(state.entries).sort((a, b) => b.date.localeCompare(a.date));
    const recent = all.slice(0, ui.listLimit);
    const hasData = all.length > 0;
    const remaining = all.length - recent.length;

    const sampleLabel = ui.armed === 'sample' ? 'Mevcut kayıtlar silinecek, onayla' : 'Örnek veri yükle';
    const clearLabel = ui.armed === 'clear' ? 'Emin misin? Tekrar dokun' : 'Tüm verileri sil';

    return `
      <header class="top"><p class="eyebrow">${Object.keys(state.entries).length} kayıt</p></header>
      <h1 class="title">Geçmiş</h1>

      <section class="card has-note" aria-label="Ay takvimi">
        ${pnote('calendar', { corner: true })}
        <div class="cal-head">
          <button class="icon-btn" data-action="month" data-dir="-1" aria-label="Önceki ay">${chevron('left')}</button>
          <h2>${fmtMonthYear(first)}</h2>
          <button class="icon-btn" data-action="month" data-dir="1" aria-label="Sonraki ay" ${isCurrentMonth ? 'disabled' : ''}>${chevron('right')}</button>
        </div>
        <div class="cal-grid">${cells}</div>
        <div class="legend">${legend}</div>
      </section>

      ${selectedHtml ? `<div class="detail">${selectedHtml}</div>` : ''}

      <h2 class="section-title">Son kayıtlar ${pnote('edit')}</h2>
      ${hasData
        ? `<ul class="entries">${recent.map((e) => entryCard(e)).join('')}</ul>
           ${remaining > 0 ? `<button class="btn btn-quiet btn-sm btn-block more-btn" data-action="more">Daha fazla göster (${remaining})</button>` : ''}`
        : `<div class="card empty"><div class="empty-filiz">${filizSvg(3)}</div><h3>Henüz kayıt yok</h3><p>Bugün ekranından ilk kaydını ekleyebilir ya da örnek veriyle uygulamayı deneyebilirsin.</p></div>`}

      <section class="card data-tools">
        <h2 class="section-title" style="margin-top:0">Demo ve veriler ${pnote('privacy')}</h2>
        <p>Uygulamayı denemek için 3 haftalık örnek veri yükleyebilirsin. Kayıtların yalnızca bu tarayıcıda saklanır, hiçbir sunucuya gönderilmez.</p>
        <div class="row">
          <a class="btn btn-sm btn-ghost" href="#panel">Ürün paneli</a>
          <a class="btn btn-sm btn-quiet" href="#hosgeldin">Karşılama ekranı</a>
        </div>
        <div class="row" style="margin-top:8px">
          <button class="btn btn-sm ${ui.armed === 'sample' ? 'btn-primary' : 'btn-ghost'}" data-action="sample">${sampleLabel}</button>
          ${hasData ? `<button class="btn btn-sm ${ui.armed === 'clear' ? 'btn-danger-armed' : 'btn-quiet'}" data-action="clear">${clearLabel}</button>` : ''}
        </div>
      </section>`;
  }

  /* ---------- Yönlendirme ve çizim ---------- */

  /* ---------- Karşılama ---------- */

  const WELCOMED_KEY = 'ruh-hali-gunlugu:welcomed';
  const markWelcomed = () => { try { localStorage.setItem(WELCOMED_KEY, '1'); } catch { /* yok say */ } };
  const wasWelcomed = () => { try { return localStorage.getItem(WELCOMED_KEY) === '1'; } catch { return true; } };

  function renderWelcome() {
    return `
      <section class="welcome">
        <div class="welcome-filiz">${filizSvg(5, { stage: 3 })}</div>
        <p class="eyebrow">Bir ürün çalışması</p>
        <h1 class="title welcome-title">Ruh Hali Günlüğü</h1>
        <p class="welcome-lead">Ruh halini her gün 10 saniyede kaydet, seni neyin iyi hissettirdiğini keşfet.</p>
        <div class="welcome-actions">
          <button class="choice choice-primary" data-action="welcome-try">
            <span class="choice-title">Uygulamayı dene</span>
            <span class="choice-sub">3 haftalık örnek veriyle, dolu bir günlük</span>
          </button>
          <button class="choice" data-action="welcome-panel">
            <span class="choice-title">Ürün kararlarını incele</span>
            <span class="choice-sub">Metrikler, deney ve yol haritası · 2 dk</span>
          </button>
        </div>
        <button class="btn btn-link" data-action="welcome-empty">Boş bir günlükle başla</button>
        <p class="welcome-foot">Tüm veriler yalnızca bu tarayıcıda saklanır.</p>
      </section>`;
  }

  function loadSampleIfEmpty() {
    if (Object.keys(state.entries).length) return;
    state.entries = generateSampleEntries();
    persist();
    analytics.track('sample_loaded', { from: 'welcome' });
  }

  /* ---------- Not kartı ---------- */

  const $sheet = document.getElementById('note-sheet');
  const $notesToggle = document.getElementById('notes-toggle');

  function openNote(id) {
    const n = PRODUCT_NOTES[id];
    if (!n) return;
    document.getElementById('note-num').textContent = n.n;
    document.getElementById('note-title').textContent = n.title;
    const row = (k, v) => (v ? `<p class="note-row"><span class="k">${k}</span>${esc(v)}</p>` : '');
    document.getElementById('note-body').innerHTML = `
      <p>${esc(n.body)}</p>
      ${row('Hipotez', n.hypothesis)}${row('Risk', n.risk)}${row('Metrik', n.metric)}
      ${n.panel ? '<a class="note-link" href="#panel">Ürün panelinde gör →</a>' : ''}`;
    $sheet.hidden = false;
    analytics.track('note_opened', { note: id });
  }

  const closeNote = () => { $sheet.hidden = true; };

  function setNotes(on) {
    ui.notesOn = on;
    analytics.track('notes_toggled', { on });
    if (!on) closeNote();
    render();
  }

  /* ---------- Yönlendirme ve çizim ---------- */

  const ROUTES = { bugun: 'today', icgoru: 'insights', gecmis: 'history', hosgeldin: 'welcome', panel: 'panel' };
  const RENDER = { today: renderToday, insights: renderInsights, history: renderHistory, welcome: renderWelcome, panel: renderPanel };
  const STANDALONE = ['welcome', 'panel']; // Alt menü ve not düğmesi olmadan gösterilen ekranlar

  function render({ enter = false } = {}) {
    const standalone = STANDALONE.includes(ui.view);
    const banner = ui.notesOn && !standalone
      ? `<div class="notes-banner">
           <span>Ürün notları açık · numaralara dokun</span>
           <a href="#panel">Ürün paneli →</a>
         </div>`
      : '';
    $view.innerHTML = banner + RENDER[ui.view]();
    $view.classList.toggle('enter', enter);
    document.body.classList.toggle('standalone', standalone);
    document.querySelector('.app').classList.toggle('wide', ui.view === 'panel');
    $notesToggle.setAttribute('aria-pressed', String(ui.notesOn));
    $notesToggle.querySelector('span').textContent = ui.notesOn ? 'Notları kapat' : 'Ürün notları';
    if (ui.view === 'today') syncPicker();
    // Geçmiş bir günü düzenlerken Geçmiş sekmesi seçili görünsün
    const activeTab = ui.view === 'today' && ui.editDate ? 'history' : ui.view;
    document.querySelectorAll('.tab').forEach((t) => {
      if (t.dataset.view === activeTab) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
  }

  function parseRoute() {
    const hash = location.hash.slice(1);
    const m = hash.match(/^duzenle\/(\d{4}-\d{2}-\d{2})$/);
    if (m) {
      const todayKey = toKey(startOfToday());
      // Gelecek tarihler düzenlenemez; bugünün anahtarı normal Bugün ekranıdır
      if (m[1] < todayKey) return { view: 'today', editDate: m[1] };
      return { view: 'today', editDate: null };
    }
    return { view: ROUTES[hash] || 'today', editDate: null };
  }

  function onRoute() {
    const { view, editDate } = parseRoute();
    if (view === ui.view && editDate === ui.editDate) return;
    ui.view = view;
    ui.editDate = editDate;
    disarm();
    if (view === 'today') resetDraft();
    if (view === 'history' && (!ui.keepHistory || !ui.calMonth)) {
      ui.calMonth = new Date(startOfToday().getFullYear(), startOfToday().getMonth(), 1);
      ui.selectedDay = null;
      ui.listLimit = 10;
    }
    ui.keepHistory = false;
    closeNote();
    analytics.track('screen_view', { screen: editDate ? 'edit' : view });
    render({ enter: true });
    window.scrollTo(0, 0);
  }

  function backToHistory() {
    ui.keepHistory = true;
    location.hash = '#gecmis';
  }

  function arm(action) {
    ui.armed = action;
    clearTimeout(ui.armedTimer);
    ui.armedTimer = setTimeout(() => { ui.armed = null; render(); }, 4000);
    render();
  }

  /* ---------- Etkileşimler ---------- */

  const actions = {
    'mood-set'(el) {
      commitMood(Number(el.dataset.value), 'tap');
    },
    tag(el) {
      const t = el.dataset.tag;
      const tags = ui.draft.tags;
      const on = !tags.includes(t);
      ui.draft.tags = on ? [...tags, t] : tags.filter((x) => x !== t);
      analytics.track('tag_toggled', { tag: t, on });
      render();
    },
    note(el) {
      openNote(el.dataset.note);
    },
    'welcome-try'() {
      markWelcomed();
      analytics.track('welcome_choice', { choice: 'try' });
      loadSampleIfEmpty();
      location.hash = '#bugun';
    },
    'welcome-panel'() {
      markWelcomed();
      analytics.track('welcome_choice', { choice: 'panel' });
      loadSampleIfEmpty();
      location.hash = '#panel';
    },
    'welcome-empty'() {
      markWelcomed();
      analytics.track('welcome_choice', { choice: 'empty' });
      location.hash = '#bugun';
    },
    tour() {
      ui.notesOn = true;
      analytics.track('notes_toggled', { on: true, from: 'panel' });
      location.hash = '#bugun';
    },
    'panel-back'() {
      location.hash = '#bugun';
    },
    'tag-open'() {
      ui.addingTag = true;
      render();
      document.getElementById('new-tag')?.focus();
    },
    'tag-cancel'() {
      ui.addingTag = false;
      render();
    },
    save() {
      const d = ui.draft;
      if (!d.mood) return;
      const key = activeKey();
      const isUpdate = Boolean(state.entries[key]);
      state.entries[key] = { date: key, mood: d.mood, note: d.note.trim(), tags: [...d.tags], updatedAt: new Date().toISOString() };
      persist();
      analytics.track('entry_saved', { mood: d.mood, isUpdate, past: Boolean(ui.editDate), hasNote: Boolean(d.note.trim()), tagCount: d.tags.length });
      if (ui.editDate) {
        toast(isUpdate ? `${fmtDayMonth(fromKey(key))} kaydı güncellendi` : `${fmtDayMonth(fromKey(key))} için kayıt eklendi`);
        backToHistory();
        return;
      }
      resetDraft();
      render();
      // Kayıt anı: Filiz sevinçle zıplar
      $view.querySelector('.picker .filiz')?.classList.add('hop');
      const streak = computeStreak(state.entries);
      toast(isUpdate ? 'Kaydın güncellendi' : `Kaydedildi · ${streak} gün seri`);
    },
    delete() {
      const key = activeKey();
      if (!state.entries[key]) return;
      if (ui.armed !== 'delete') return arm('delete');
      disarm();
      delete state.entries[key];
      persist();
      toast(`${fmtDayMonth(fromKey(key))} kaydı silindi`);
      if (ui.editDate) { ui.selectedDay = null; backToHistory(); return; }
      resetDraft();
      render();
    },
    edit(el) {
      const key = el.dataset.key;
      ui.selectedDay = key;
      location.hash = key === toKey(startOfToday()) ? '#bugun' : `#duzenle/${key}`;
    },
    back() {
      backToHistory();
    },
    more() {
      ui.listLimit += 10;
      render();
    },
    month(el) {
      const m = ui.calMonth;
      ui.calMonth = new Date(m.getFullYear(), m.getMonth() + Number(el.dataset.dir), 1);
      ui.selectedDay = null;
      render();
    },
    day(el) {
      const key = el.dataset.key;
      if (key > toKey(startOfToday())) return;
      if (!state.entries[key] && key === toKey(startOfToday())) { location.hash = '#bugun'; return; }
      ui.selectedDay = ui.selectedDay === key ? null : key;
      render();
    },
    sample() {
      if (Object.keys(state.entries).length && ui.armed !== 'sample') return arm('sample');
      disarm();
      state.entries = generateSampleEntries();
      persist();
      analytics.track('sample_loaded', { from: ui.view });
      toast('21 günlük örnek veri yüklendi');
      location.hash = '#icgoru';
      if (ui.view === 'insights') render();
    },
    clear() {
      if (ui.armed !== 'clear') return arm('clear');
      disarm();
      state.entries = {};
      state.customTags = [];
      persist();
      ui.selectedDay = null;
      render();
      toast('Tüm veriler silindi');
    },
  };

  $view.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el || !$view.contains(el)) return;
    const fn = actions[el.dataset.action];
    if (fn) { ev.preventDefault(); fn(el); }
  });

  $view.addEventListener('input', (ev) => {
    if (ev.target.id !== 'note') return;
    ui.draft.note = ev.target.value;
    const counter = document.getElementById('note-count');
    counter.textContent = `${ev.target.value.length}/${NOTE_MAX}`;
    counter.hidden = ev.target.value.length < COUNTER_FROM;
    // Formu yeniden çizmeden güncelle; input odakta kalsın
    refreshFormState();
  });

  $view.addEventListener('keydown', (ev) => {
    if (ev.target.id === 'new-tag' && ev.key === 'Escape') actions['tag-cancel']();
    if (ev.target.id === 'note' && ev.key === 'Enter') $view.querySelector('[data-action="save"]:not(:disabled)')?.click();
    // Filiz seçicisi klavyeyle de kullanılabilir (slider deseni)
    if (ev.target.getAttribute && ev.target.getAttribute('role') === 'slider') {
      const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[ev.key];
      const base = picker.chosen ? picker.target : 3;
      let v = null;
      if (dir) v = base + dir;
      else if (ev.key === 'Home') v = 1;
      else if (ev.key === 'End') v = 5;
      if (v !== null) { ev.preventDefault(); commitMood(clamp(v, 1, 5), 'keyboard'); }
    }
  });

  /* Filiz'i sürükleme: dikey hareket ruh halini değiştirir, bırakınca en yakın basamağa oturur */
  $view.addEventListener('pointerdown', (ev) => {
    const root = ev.target.closest('.picker');
    if (!root || ev.button > 0) return;
    picker.drag = { id: ev.pointerId, startY: ev.clientY, startV: picker.chosen ? picker.target : 3, moved: false, root };
  });

  $view.addEventListener('pointermove', (ev) => {
    const d = picker.drag;
    if (!d || ev.pointerId !== d.id) return;
    const dy = d.startY - ev.clientY;
    if (!d.moved) {
      if (Math.abs(dy) < 6) return; // dokunma ile sürüklemeyi ayırt et
      d.moved = true;
      try { d.root.setPointerCapture(ev.pointerId); } catch { /* yakalama desteklenmiyorsa da çalışır */ }
      d.root.classList.add('is-dragging');
      picker.chosen = true;
    }
    let v = d.startV + dy / STEP_PX;
    // Uçlarda lastik etkisi
    if (v > 5) v = 5 + (v - 5) * 0.25;
    if (v < 1) v = 1 - (1 - v) * 0.25;
    picker.target = v;
    runPicker();
  });

  const endDrag = (ev) => {
    const d = picker.drag;
    if (!d || ev.pointerId !== d.id) return;
    picker.drag = null;
    d.root.classList.remove('is-dragging');
    if (d.moved) commitMood(picker.target, 'drag');
  };
  $view.addEventListener('pointerup', endDrag);
  $view.addEventListener('pointercancel', endDrag);

  $view.addEventListener('submit', (ev) => {
    if (ev.target.dataset.form !== 'tag') return;
    ev.preventDefault();
    const input = document.getElementById('new-tag');
    const name = input.value.trim().replace(/\s+/g, ' ').slice(0, TAG_MAX);
    if (!name) { input.focus(); return; }
    const existing = allTags().find((t) => t.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'));
    if (!existing) { state.customTags.push(name); persist(); }
    const tag = existing || name;
    if (!ui.draft.tags.includes(tag)) ui.draft.tags.push(tag);
    ui.addingTag = false;
    render();
  });

  /* ---------- Ürün notları: düğme ve not kartı ---------- */

  $notesToggle.addEventListener('click', () => setNotes(!ui.notesOn));
  $sheet.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-close-note]') || ev.target === $sheet) closeNote();
    if (ev.target.closest('.note-link')) closeNote();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$sheet.hidden) closeNote(); });
  // Kartın dışına dokununca kapansın (not noktalarına dokunmak hariç)
  document.addEventListener('pointerdown', (ev) => {
    if (!$sheet.hidden && !ev.target.closest('.note-card, .pnote')) closeNote();
  });

  /* ---------- Başlangıç ---------- */

  analytics.track('session_start', { returning: Object.keys(state.entries).length > 0 });
  // İlk ziyarette (boş günlük, adres belirtilmemiş) karşılama ekranı
  if (!location.hash && !wasWelcomed() && !Object.keys(state.entries).length) {
    history.replaceState(null, '', '#hosgeldin');
  }

  window.addEventListener('hashchange', onRoute);
  onRoute();
}
