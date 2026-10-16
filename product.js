/* Ruh Hali Günlüğü — ürün katmanı
   - Olay takibi (gerçek; yalnızca bu tarayıcıda)
   - Ürün notları (ekranlardaki numaralı açıklamalar)
   - Ürün paneli (simüle edilmiş 1.000 kullanıcılık senaryo + canlı oturum) */
'use strict';

/* =========================================================
   Olay takibi
   ========================================================= */

const EVENTS_KEY = 'ruh-hali-gunlugu:events';
const SESSION_ID = Date.now().toString(36);

const analytics = {
  load() {
    try { return JSON.parse(localStorage.getItem(EVENTS_KEY)) || []; } catch { return []; }
  },
  track(name, props = {}) {
    const ev = { name, props, at: Date.now(), session: SESSION_ID };
    try {
      const list = analytics.load();
      list.push(ev);
      localStorage.setItem(EVENTS_KEY, JSON.stringify(list.slice(-500)));
    } catch { /* depolama yoksa takip sessizce devre dışı */ }
    return ev;
  },
  session() {
    return analytics.load().filter((e) => e.session === SESSION_ID);
  },
};

// Ölçülen olaylar ve ne işe yaradıkları (panelde "olay şeması" olarak gösterilir)
const EVENT_SCHEMA = [
  { name: 'session_start', label: 'Oturum başladı', why: 'Aktif kullanıcı ve tutma hesabı' },
  { name: 'screen_view', label: 'Ekran görüntülendi', why: 'Hangi ekranın değer ürettiği' },
  { name: 'mood_selected', label: 'Ruh hali seçildi', why: 'Seçim yöntemi (sürükleme, dokunma, klavye)' },
  { name: 'entry_saved', label: 'Kayıt yapıldı', why: 'Aktivasyon, ilk kayda kadar geçen süre' },
  { name: 'tag_toggled', label: 'Etiket seçildi', why: 'İçgörü kalitesi' },
  { name: 'first_insight_unlocked', label: 'İlk içgörü açıldı', why: 'Aktivasyon anı: kullanıcının değeri ilk gördüğü an (Deney #2)' },
  { name: 'tags_chosen', label: 'Etiketler seçildi', why: 'Başlangıçta kaç etiket seçiliyor, kaç kişi atlıyor' },
  { name: 'onboarding_completed', label: 'Başlangıç tamamlandı', why: 'Karşılamadan ilk kayda kadar geçen süre' },
  { name: 'reminder_prompt_shown', label: 'Hatırlatma soruldu', why: 'Yumuşak sorunun kaç kişiye gösterildiği (Deney #4 paydası)' },
  { name: 'reminder_set', label: 'Hatırlatma açıldı', why: 'Saat ve tarayıcı izni sonucu: izin verme oranı' },
  { name: 'reminder_declined', label: 'Hatırlatma reddedildi', why: 'Soru doğru anda mı soruluyor' },
  { name: 'reminder_calendar_added', label: 'Takvime eklendi', why: 'Bildirim kısıtına karşı ikinci kanal kullanılıyor mu' },
  { name: 'reminder_fired', label: 'Hatırlatma gönderildi', why: 'Hatırlatma → kayıt dönüşümü' },
  { name: 'install_prompt', label: 'Yükleme önerildi', why: 'Ana ekrana ekleme oranı (yüklü kullanıcı daha çok döner mi)' },
  { name: 'support_shown', label: 'Destek kartı gösterildi', why: 'Tetik kuralı ne sıklıkla çalışıyor (eşik ayarı)' },
  { name: 'support_resource_tapped', label: 'Yardım kaynağına dokunuldu', why: 'Kart gerçekten işe yarıyor mu (yalnızca hangi kaynak, içerik değil)' },
  { name: 'support_dismissed', label: 'Destek kartı ertelendi', why: 'Kart rahatsız edici mi' },
  { name: 'note_opened', label: 'Ürün notu açıldı', why: 'Bu sunumun hangi kısmı ilgi çekiyor' },
];

/* =========================================================
   Ürün notları
   ========================================================= */

const PRODUCT_NOTES = {
  streak: {
    n: 1, title: 'Seri: tutma mekanizması',
    body: 'Seri ve Filiz’in büyümesi (7 günde ikinci yaprak, 21 günde çiçek) kullanıcıya her gün geri dönmek için bir neden verir. Seri suçlamaz: tek bir boş gün “dinlenme günü” sayılır (haftada en fazla bir), art arda iki boş gün seriyi bitirir.',
    hypothesis: 'Tek bir kaçırılan gün yüzünden seriyi kaybeden kullanıcı “artık anlamı yok” deyip bırakıyor. Dinlenme hakkı bu terki azaltır, seriyi de değersizleştirmez.',
    risk: 'Dinlenme hakkı fazla cömert olursa seri anlamını yitirir. Bu yüzden haftada bir ile sınırlı ve dinlenme günleri seri sayısına eklenmiyor.',
    metric: 'Boş günden sonraki gün geri dönüş oranı, 7. ve 30. gün tutma',
    panel: true,
  },
  filiz: {
    n: 2, title: 'Filiz seçici: temel eylemin sürtünmesi',
    body: 'İlk versiyonda 5 renkli buton vardı. Ruh hali seçimi uygulamanın tek zorunlu adımı; tek hareketlik, oyunsu bir seçici bu adımı keyifli hale getiriyor.',
    hypothesis: 'Sürüklenebilir seçici, ilk kayda kadar geçen süreyi kısaltır ve seçimden vazgeçmeyi azaltır.',
    metric: 'İlk kayda kadar geçen süre, seçim → kayıt tamamlama oranı',
    panel: true,
  },
  note: {
    n: 3, title: 'Tek cümlelik not',
    body: 'Uzun günlük yazmak, bu kategorideki en büyük terk sebeplerinden biri. Not isteğe bağlı ve tek cümle; yer tutucu soru ruh haline göre değişir (“Seni en çok ne yordu?”).',
    metric: 'Notlu kayıt oranı',
  },
  tags: {
    n: 4, title: 'Etiketler: içgörülerin hammaddesi',
    body: 'Etiketler “Spor yaptığın günlerde ruh halin daha yüksek” gibi kişisel içgörüleri mümkün kılar. Hazır 5 etiket tek dokunuşla seçilir; özel etiket kişiselleştirme sağlar.',
    metric: 'Etiketli kayıt oranı, kayıt başına etiket sayısı',
  },
  save: {
    n: 5, title: 'Kayıt anı: alışkanlık döngüsünün ödülü',
    body: 'Tetik (akşam) → eylem (10 saniyelik kayıt) → ödül (Filiz zıplar, seri artar). Günde tek kayıt bilinçli bir karar: içgörüler anlamlı kalır, ekran sade olur.',
    metric: 'Günlük aktif kaydeden, kayıt süresi',
  },
  weekly: {
    n: 6, title: 'Haftalık özet: değerin görünmesi',
    body: 'Kullanıcı birkaç kayıttan sonra emeğinin karşılığını görmeli. “En iyi gün” gibi insani bir özet, rakamları anlamlı kılar.',
    metric: 'İçgörü ekranı görüntüleme → ertesi gün dönüş',
  },
  patterns: {
    n: 7, title: 'Kural tabanlı içgörüler (v1)',
    body: 'Bilerek AI ile başlamadım: kurallar hızlı, ucuz ve açıklanabilir. Her kartta “dayanak” satırı var; kullanıcı neye dayandığını görünce güveniyor.',
    hypothesis: 'Huni verisine göre kullanıcıların çoğu ilk içgörüye (5. kayıt) ulaşmadan bırakıyordu. İlk içgörü artık 3. kayıtta açılıyor; veri azken kart “erken gözlem” olarak işaretleniyor ve örüntü iddia etmiyor.',
    risk: 'Az veriyle yanlış genelleme. Erken kart yalnızca 7. kayda kadar görünür, sonra yerini kurallara bırakır.',
    metric: 'v2: AI ile haftalık yansıma, Filiz Plus aboneliğinin çekirdeği',
    panel: true,
  },
  responsible: {
    n: 8, title: 'Sorumlu ürün',
    body: 'Ruh sağlığına yakın bir üründe içgörüler tıbbi tavsiye gibi sunulmamalı. Bu yüzden her kartta dayanak var ve dil “teşhis” değil “gözlem”. Art arda zor günlerde nazik bir destek kartı ve yardım kaynakları çıkıyor; bu madde puanlamadan bağımsız, ilke gereği yapıldı.',
  },
  reminder: {
    n: 14, title: 'Akşam hatırlatması: doğru anda, doğru kanaldan',
    body: 'Hatırlatma izni açılışta değil, ilk kayıttan hemen sonra isteniyor: kullanıcı değeri yeni gördüğü için “evet” deme olasılığı en yüksek an. Önce uygulamanın kendi kartı soruyor, tarayıcı izni ancak “Hatırlat” denince açılıyor; reddedilen tarayıcı izni bir daha sorulamaz.',
    hypothesis: 'Hatırlatma, tetik → eylem → ödül döngüsünün eksik parçası. Huni verisine göre en büyük kayıp ilk kayıttan sonra; akşam hatırlatması 3. gün geri dönüşü artırır.',
    risk: 'Sunucusuz bir sitede bildirim yalnızca uygulama açıkken güvenilir. Bu kısıtı gizlemek yerine ikinci bir kanal eklendi: takvim etkinliği (.ics) her telefonda çalışır ve veri cihazdan çıkmaz. O gün kayıt yapıldıysa bildirim sessiz kalır.',
    metric: 'Yumuşak soruya “evet” oranı, tarayıcı izni verme oranı, hatırlatma açık kullanıcıların 7. gün tutması (Deney #4)',
    panel: true,
  },
  onboarding: {
    n: 13, title: 'Kısa başlangıç: değer, form değil',
    body: 'Başlangıç iki adım: kullanıcı günlerini etkileyen etiketleri seçer, ardından doğrudan ilk kaydına geçer. Hesap, profil ya da hedef sorusu yok; her soru ilk kayda giden yolu uzatır. Etiket adımı atlanabilir, atlayan varsayılan 5 etiketle başlar.',
    hypothesis: 'Kendi etiketlerini seçen kullanıcı kayıtlarına daha çok etiket ekler; bu da içgörülerin daha erken ve daha kişisel olmasını sağlar.',
    risk: 'Her ek adım terk demek. Bu yüzden tek ekran, tek dokunuşlu seçim ve “Şimdilik atla”. Başlangıçtan ilk kayda kadar geçen süre ölçülüyor; 30 saniyeyi aşarsa adım sadeleştirilir.',
    metric: 'Karşılama → ilk kayıt dönüşümü, başlangıç süresi (onboarding_completed), etiketli kayıt oranı',
  },
  support: {
    n: 12, title: 'Zor günlerde destek',
    body: 'Son 4 günün en az 3’ünde ruh hali “Kötü” ya da “Çok kötü” ise kart çıkar. Dil yargılamaz ve teşhis koymaz; kullanıcının kendi verisinden iyi gelen bir şeyi hatırlatır ve gerçek yardım kaynaklarına tek dokunuşla ulaştırır. “Şimdi değil” denince 3 gün gösterilmez.',
    risk: 'Kart sık çıkarsa rahatsız eder, hiç çıkmazsa ihtiyacı kaçırır. Eşik bilerek temkinli; yanlış alarm, kaçırılan bir zor haftadan daha az zararlı. Kriz anını yalnızca bir uygulama kartına bırakmamak için 112 her zaman listede.',
    metric: 'Başarı dönüşüm değil: kaynağa dokunma oranı, kartı kapatma oranı ve kartı gören kullanıcıların ertesi hafta geri dönüşü. Kartın gösterildiği haftada hiçbir ücretli teklif gösterilmez.',
  },
  calendar: {
    n: 9, title: 'Geriye bakmak: biriken değer',
    body: 'Renkli takvim birikmiş kayıtları görünür kılar; kullanıcı kaybetmek istemediği bir şey biriktirdiğini hisseder. Abonelik ürünlerinde tutmanın en güçlü kaldıraçlarından biri.',
    metric: 'Geçmiş ekranı ziyaret sıklığı',
  },
  edit: {
    n: 10, title: 'Kullanıcı kontrolü',
    body: 'Geçmiş kayıtlar düzenlenip silinebiliyor, unutulan günler sonradan eklenebiliyor. Veri kalitesini artırır ve “bir günü kaçırdım, artık anlamı yok” terkini azaltır.',
  },
  privacy: {
    n: 11, title: 'Gizlilik: veri cihazda',
    body: 'Ruh hali hassas bir veri. İlk sürümde hesap ve sunucu yok; güven, abonelikten önce gelir. Hesap ve senkronizasyon, Plus ile birlikte açık rızayla gelecek.',
  },
};

/* =========================================================
   Simüle edilmiş senaryo (1.000 kullanıcı)
   Gerçek kullanıcı verisi değildir; hangi metriklerin neden izlendiğini gösterir.
   ========================================================= */

const SIM = {
  northStar: {
    label: 'Haftalık aktif kaydeden',
    definition: 'Son 7 günde en az 3 gün kayıt yapan kullanıcı',
    why: 'Uygulamanın verdiği değer (kendini tanımak) ancak düzenli kayıtla oluşur. Tek seferlik açılışları değil, alışkanlığı ölçer; abonelik dönüşümünün de en güçlü öncü göstergesi.',
    weeks: [118, 164, 201, 232, 251, 268, 289, 312],
  },
  inputs: [
    { label: 'Aktivasyon', value: '%69', sub: 'ilk gün kayıt yapan' },
    { label: '7. gün tutma', value: '%31', sub: 'hedef %35' },
    { label: 'Haftalık kayıt', value: '4,2', sub: 'aktif kullanıcı başına' },
  ],
  funnel: [
    { label: 'Uygulamayı açtı', count: 1000 },
    { label: 'Ruh hali seçti', count: 820 },
    { label: 'İlk kaydı yaptı', count: 690 },
    { label: '3. gün geri döndü', count: 410 },
    { label: '7 gün seri yaptı', count: 260 },
  ],
  funnelFinding: {
    finding: 'Kullanıcılar ilk kayıttan sonra dönmüyor. İlk içgörü 5. kayıtta açılıyordu; kullanıcıların çoğu değeri görmeden bırakıyordu.',
    action: 'İlk içgörü 3. kayda çekildi ve suçlamayan seri yayına alındı; ikisi de deneyle ölçülüyor (Deney #2 ve #3). Ardından akşam hatırlatması eklendi (Deney #4).',
  },
  retention: [
    { day: 0, value: 100 }, { day: 1, value: 58 }, { day: 3, value: 41 },
    { day: 7, value: 31 }, { day: 14, value: 24 }, { day: 30, value: 18 },
  ],
  retentionTarget: 25,
  experiment: {
    title: 'Deney #1 · Ruh hali seçici',
    hypothesis: 'Klasik 5 buton yerine sürüklenebilir Filiz, ilk kayda kadar geçen süreyi kısaltır ve seçimden vazgeçmeyi azaltır.',
    setup: 'Yeni kullanıcılar, %50 / %50 · 14 gün · 1.000 kullanıcı',
    rule: 'Ana metrikte en az %10 iyileşme ve koruma metriğinde düşüş yoksa B yayına alınır.',
    variants: [
      { key: 'A', name: '5 renkli buton', role: 'Kontrol' },
      { key: 'B', name: 'Sürüklenebilir Filiz', role: 'Varyant' },
    ],
    rows: [
      { metric: 'İlk kayda kadar süre', kind: 'Ana metrik', a: '21 sn', b: '14 sn', diff: '−%33', good: true },
      { metric: 'Seçim → kayıt tamamlama', kind: 'İkincil', a: '%78', b: '%86', diff: '+8 puan', good: true },
      { metric: '7. gün tutma', kind: 'Koruma metriği', a: '%29', b: '%33', diff: '+4 puan', good: true },
    ],
    decision: 'B kazandı ve varsayılan oldu.',
    learning: 'B’de ilk kullanımda “nasıl seçilir?” tereddüdü görüldü. v2’de ölçeğe uç etiketleri (Harika / Çok kötü) ve “Yukarı ya da aşağı kaydır” ipucu eklendi.',
  },
  // Huni bulgusundan çıkan, yayına alınmış ama sonucu henüz belli olmayan deneyler
  running: [
    {
      title: 'Deney #2 · İlk içgörü 3. kayıtta',
      progress: '6 / 14 gün',
      hypothesis: 'Kullanıcı ilk içgörüyü 5. yerine 3. kayıtta görürse değeri daha erken fark eder ve 3. gün geri dönüş artar.',
      variants: [
        { key: 'A', name: 'İlk içgörü 5. kayıtta', role: 'Kontrol' },
        { key: 'B', name: '3. kayıtta “erken gözlem”', role: 'Varyant' },
      ],
      setup: 'Yeni kullanıcılar, %50 / %50 · 14 gün · hedef 1.200 kullanıcı',
      metrics: [
        { kind: 'Ana metrik', metric: '3. gün geri dönüş (şu an %59)' },
        { kind: 'İkincil', metric: 'İçgörü ekranını gören → ertesi gün kayıt' },
        { kind: 'Koruma metriği', metric: '7. gün tutma (erken ve zayıf içgörü güveni düşürmemeli)' },
      ],
      rule: 'Ana metrikte en az 4 puan artış ve koruma metriğinde düşüş yoksa B kalıcı olur. Ara sonuçlara bakıp erken karar verilmez.',
    },
    {
      title: 'Deney #3 · Suçlamayan seri',
      progress: '3 / 21 gün',
      hypothesis: 'Tek bir boş gün seriyi sıfırlamazsa, kullanıcı “artık anlamı yok” deyip bırakmaz ve ertesi gün geri döner.',
      variants: [
        { key: 'A', name: 'Boş gün seriyi sıfırlar', role: 'Kontrol' },
        { key: 'B', name: 'Haftada 1 dinlenme günü', role: 'Varyant' },
      ],
      setup: 'Tüm aktif kullanıcılar, %50 / %50 · 21 gün',
      metrics: [
        { kind: 'Ana metrik', metric: 'Boş günden sonraki 2 gün içinde geri dönüş' },
        { kind: 'İkincil', metric: '30. gün tutma' },
        { kind: 'Koruma metriği', metric: 'Haftalık kayıt sayısı (4,2): seri gevşeyince düzen bozulmamalı' },
      ],
      rule: 'Geri dönüşte en az 5 puan artış ve haftalık kayıt sayısında %5’ten fazla düşüş yoksa B kalıcı olur.',
    },
    {
      title: 'Deney #4 · Hatırlatma izni',
      progress: '1 / 14 gün',
      hypothesis: 'İzni açılışta değil, ilk kayıttan sonra uygulamanın kendi kartıyla sormak izin verme oranını artırır; reddedilen tarayıcı izni bir daha sorulamadığı için bu fark kalıcıdır.',
      variants: [
        { key: 'A', name: 'Açılışta tarayıcı izni', role: 'Kontrol' },
        { key: 'B', name: 'İlk kayıttan sonra yumuşak soru', role: 'Varyant' },
      ],
      setup: 'Yeni kullanıcılar, %50 / %50 · 14 gün',
      metrics: [
        { kind: 'Ana metrik', metric: 'Hatırlatması açık kullanıcı oranı (bildirim ya da takvim)' },
        { kind: 'İkincil', metric: '3. gün geri dönüş' },
        { kind: 'Koruma metriği', metric: 'Bildirimi sonradan kapatma oranı: hatırlatma rahatsız etmemeli' },
      ],
      rule: 'Ana metrikte en az 10 puan artış ve koruma metriğinde artış yoksa B kalıcı olur.',
    },
  ],
  backlog: [
    { idea: 'Akşam hatırlatması (saat seçilebilir)', i: 8, c: 7, e: 8, shipped: true },
    { idea: 'İlk içgörüyü 3. kayıtta göster', i: 8, c: 6, e: 9, shipped: true },
    { idea: 'Suçlamayan seri (1 gün dinlenme hakkı)', i: 7, c: 7, e: 9, shipped: true },
    { idea: 'Filiz Plus: AI haftalık yansıma (sahte kapı testi)', i: 9, c: 5, e: 6 },
    { idea: 'Kısa başlangıç akışı (etiket seçimi)', i: 6, c: 6, e: 7, shipped: true },
    { idea: 'Gece teması', i: 3, c: 8, e: 7 },
  ],
  principle: { idea: 'Zor günlerde destek kartı ve yardım kaynakları', note: 'İlke gereği, puanlamadan bağımsız', shipped: true },
  roadmap: [
    { when: 'Şimdi', status: 'Yayında', items: ['Günlük kayıt ve Filiz seçici', 'Kural tabanlı içgörüler', 'Geçmiş, takvim ve düzenleme', 'Olay takibi'], fresh: ['Suçlamayan seri', 'İlk içgörü 3. kayıtta', 'Zor günlerde destek', 'Kısa başlangıç akışı', 'Akşam hatırlatması', 'Telefona yüklenebilir sürüm (PWA)'] },
    { when: 'Sonra', status: 'Sıradaki çeyrek', items: ['Hatırlatma saatini kayıt alışkanlığına göre önermek', 'Destek kartı eşiğini veriyle ayarlamak', 'Push sunucusu: uygulama kapalıyken bildirim'] },
    { when: 'Daha sonra', status: 'Doğrulanınca', items: ['Filiz Plus: AI haftalık yansıma', 'Hesap ve cihazlar arası senkron', 'Aylık örüntüler ve dışa aktarma'] },
  ],
  notNow: [
    { item: 'Günde birden fazla kayıt', why: 'Takvim, seri ve içgörüler gün bazında anlamlı; ekranı karmaşıklaştırır.' },
    { item: 'Sosyal paylaşım', why: 'Hassas veri; güven inşa edilmeden paylaşım, terk riskini artırır.' },
  ],
};

/* =========================================================
   Ürün paneli
   ========================================================= */

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtInt = (n) => n.toLocaleString('tr-TR');
const pctTr = (n) => `%${Math.round(n)}`;
const num1 = (n) => n.toFixed(1).replace('.', ',');

function sparklineSvg(values) {
  const W = 132, H = 40, P = 4;
  const max = Math.max(...values), min = Math.min(...values);
  const x = (i) => P + (i / (values.length - 1)) * (W - P * 2);
  const y = (v) => P + (1 - (v - min) / (max - min)) * (H - P * 2);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const last = values.length - 1;
  return `
    <svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Son 8 hafta: ${values.join(', ')}">
      <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="7" fill="transparent"><title>${i + 1}. hafta: ${v}</title></circle>`).join('')}
      <circle cx="${x(last).toFixed(1)}" cy="${y(values[last]).toFixed(1)}" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>
    </svg>`;
}

function funnelHtml() {
  const steps = SIM.funnel;
  const base = steps[0].count;
  const drops = steps.map((s, i) => (i ? 1 - s.count / steps[i - 1].count : 0));
  const worst = drops.indexOf(Math.max(...drops));
  return steps.map((s, i) => {
    const pct = (s.count / base) * 100;
    const drop = i
      ? `<div class="f-drop${i === worst ? ' is-worst' : ''}">
           <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2v8M2.5 6.5L6 10l3.5-3.5"/></svg>
           ${i === worst ? '<strong>En büyük kayıp</strong> · ' : ''}${pctTr(drops[i] * 100)} ayrıldı
         </div>`
      : '';
    return `${drop}
      <div class="f-row" title="${escapeHtml(s.label)}: ${fmtInt(s.count)} kullanıcı (${pctTr(pct)})">
        <div class="f-head"><span>${escapeHtml(s.label)}</span><span class="f-num">${fmtInt(s.count)} <small>${pctTr(pct)}</small></span></div>
        <div class="f-track"><div class="f-bar" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

function retentionSvg() {
  const pts = SIM.retention;
  const W = 320, H = 180, L = 34, R = 14, T = 14, B = 28;
  const x = (d) => L + (d / 30) * (W - L - R);
  const y = (v) => T + (1 - v / 100) * (H - T - B);
  const grid = [0, 25, 50, 75, 100].map((v) => `
    <line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/>
    <text x="${L - 8}" y="${y(v) + 3.5}" text-anchor="end" class="ax">%${v}</text>`).join('');
  const xTicks = [0, 7, 14, 30].map((d) => `<text x="${x(d)}" y="${H - 8}" text-anchor="middle" class="ax">${d === 0 ? 'Gün 0' : d}</text>`).join('');
  const t = SIM.retentionTarget;
  const target = `
    <line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 4"/>
    <text x="${L + 6}" y="${y(t) + 14}" text-anchor="start" class="ax ax-strong">Hedef: 30. gün %${t}</text>`;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const labelled = { 1: 'start', 7: 'start', 30: 'end' };
  const dots = pts.map((p) => `
    <g>
      <circle cx="${x(p.day)}" cy="${y(p.value)}" r="12" fill="transparent"><title>${p.day}. gün: %${p.value} hâlâ aktif</title></circle>
      <circle cx="${x(p.day)}" cy="${y(p.value)}" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2" pointer-events="none"/>
      ${labelled[p.day] ? `<text x="${x(p.day) + (labelled[p.day] === 'end' ? -8 : 8)}" y="${y(p.value) + (labelled[p.day] === 'end' ? 18 : -9)}" text-anchor="${labelled[p.day]}" class="dl">%${p.value}</text>` : ''}
    </g>`).join('');
  return `
    <svg class="retention" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tutma eğrisi: ${pts.map((p) => `${p.day}. gün %${p.value}`).join(', ')}. Hedef 30. gün %${t}.">
      ${grid}${target}
      <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${xTicks}
    </svg>`;
}

function experimentHtml() {
  const ex = SIM.experiment;
  const check = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';
  return `
    <article class="card exp">
      <div class="exp-head">
        <h3>${ex.title}</h3>
        <span class="chip-status">${check}Tamamlandı</span>
      </div>
      <p class="exp-hyp"><span class="k">Hipotez</span>${escapeHtml(ex.hypothesis)}</p>
      <div class="exp-variants">
        ${ex.variants.map((v) => `
          <div class="variant">
            <span class="v-key">${v.key}</span>
            <div><strong>${escapeHtml(v.name)}</strong><span>${v.role}</span></div>
          </div>`).join('')}
      </div>
      <p class="exp-meta">${escapeHtml(ex.setup)}</p>
      <div class="table-wrap">
        <table class="exp-table">
          <thead><tr><th>Metrik</th><th>A</th><th>B</th><th>Fark</th></tr></thead>
          <tbody>${ex.rows.map((r) => `
            <tr>
              <td><strong>${r.metric}</strong><span>${r.kind}</span></td>
              <td>${r.a}</td><td>${r.b}</td>
              <td class="diff">${r.good ? check : ''}${r.diff}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="exp-rule"><span class="k">Karar kuralı (önceden belirlendi)</span>${escapeHtml(ex.rule)}</p>
      <div class="exp-decision">
        <p><span class="k">Karar</span>${escapeHtml(ex.decision)}</p>
        <p><span class="k">Öğrenilen</span>${escapeHtml(ex.learning)}</p>
      </div>
    </article>`;
}

function runningExperimentHtml(ex) {
  return `
    <article class="card exp">
      <div class="exp-head">
        <h3>${ex.title}</h3>
        <span class="chip-status is-running"><i></i>Sürüyor · ${ex.progress}</span>
      </div>
      <p class="exp-hyp"><span class="k">Hipotez</span>${escapeHtml(ex.hypothesis)}</p>
      <div class="exp-variants">
        ${ex.variants.map((v) => `
          <div class="variant">
            <span class="v-key">${v.key}</span>
            <div><strong>${escapeHtml(v.name)}</strong><span>${v.role}</span></div>
          </div>`).join('')}
      </div>
      <p class="exp-meta">${escapeHtml(ex.setup)}</p>
      <ul class="exp-metrics">${ex.metrics.map((m) => `
        <li><span>${m.kind}</span>${escapeHtml(m.metric)}</li>`).join('')}
      </ul>
      <p class="exp-rule"><span class="k">Karar kuralı (önceden belirlendi)</span>${escapeHtml(ex.rule)}</p>
      <p class="exp-demo">Bu demoda B sürümü açık; uygulamada deneyebilirsin.</p>
    </article>`;
}

function backlogHtml() {
  const rows = SIM.backlog
    .map((b) => ({ ...b, score: (b.i + b.c + b.e) / 3 }))
    .sort((a, b) => b.score - a.score);
  return `
    <div class="card table-card">
      <div class="table-wrap">
        <table class="ice">
          <thead><tr><th>Fikir</th><th title="Etki">E</th><th title="Güven">G</th><th title="Kolaylık">K</th><th>Puan</th></tr></thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr${i < 3 ? ' class="is-top"' : ''}>
                <td>${escapeHtml(r.idea)}${r.shipped ? ' <span class="tag-shipped">Yayında</span>' : ''}</td><td>${r.i}</td><td>${r.c}</td><td>${r.e}</td>
                <td><span class="score"><i style="width:${(r.score * 4).toFixed(1)}px"></i>${num1(r.score)}</span></td>
              </tr>`).join('')}
            <tr class="principle">
              <td>${escapeHtml(SIM.principle.idea)}${SIM.principle.shipped ? ' <span class="tag-shipped">Yayında</span>' : ''}</td>
              <td colspan="4">${escapeHtml(SIM.principle.note)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="table-foot">E: Etki · G: Güven · K: Kolaylık (1-10). Puan üçünün ortalaması. “Yayında” etiketli fikirler bu çeyrekte hayata geçti.</p>
    </div>`;
}

function roadmapHtml() {
  return `
    <div class="roadmap">
      ${SIM.roadmap.map((col, i) => `
        <div class="card rm-col${i === 0 ? ' is-now' : ''}">
          <div class="rm-head"><h3>${col.when}</h3><span>${col.status}</span></div>
          <ul>${col.items.map((it) => `<li>${escapeHtml(it)}</li>`).join('')}${(col.fresh || []).map((it) => `
            <li>${escapeHtml(it)} <span class="tag-shipped">Yeni</span></li>`).join('')}</ul>
        </div>`).join('')}
    </div>
    <div class="card not-now">
      <h3>Bilerek yapılmayanlar</h3>
      <ul>${SIM.notNow.map((n) => `<li><strong>${escapeHtml(n.item)}</strong><span>${escapeHtml(n.why)}</span></li>`).join('')}</ul>
    </div>`;
}

const SCREEN_LABELS = { today: 'Bugün', insights: 'İçgörü', history: 'Geçmiş', settings: 'Ayarlar', panel: 'Ürün paneli', welcome: 'Karşılama', edit: 'Geçmiş günü düzenleme', onboarding: 'Başlangıç', tags: 'Etiketler' };
const METHOD_LABELS = { drag: 'sürükleyerek', tap: 'dokunarak', keyboard: 'klavyeyle' };

function describeEvent(e) {
  const p = e.props || {};
  const moodLabel = (v) => (MOODS[v - 1] ? MOODS[v - 1].label : '');
  switch (e.name) {
    case 'session_start': return p.returning ? 'Geri dönen ziyaretçi' : 'İlk ziyaret';
    case 'screen_view': return SCREEN_LABELS[p.screen] || p.screen;
    case 'mood_selected': return `${moodLabel(p.mood)} · ${METHOD_LABELS[p.method] || ''}`;
    case 'entry_saved': return [moodLabel(p.mood), p.isUpdate ? 'güncelleme' : 'yeni kayıt', p.hasNote ? 'notlu' : '', p.tagCount ? `${p.tagCount} etiket` : '', p.afterRest ? 'dinlenme gününden sonra' : ''].filter(Boolean).join(' · ');
    case 'first_insight_unlocked': return `${p.entries}. kayıtta`;
    case 'tag_toggled': return `${p.tag} ${p.on ? 'seçildi' : 'kaldırıldı'}`;
    case 'note_opened': return PRODUCT_NOTES[p.note] ? PRODUCT_NOTES[p.note].title : p.note;
    case 'sample_loaded': return p.scenario === 'hard' ? 'Zor günler senaryosu' : '3 haftalık örnek veri';
    case 'tags_chosen': return p.skipped ? 'atlandı' : `${p.count} etiket · ${p.from === 'settings' ? 'Ayarlar' : 'başlangıç'}`;
    case 'onboarding_completed': return `ilk kayda ${fmtDuration(p.ms)}`;
    case 'reminder_set': return [p.time, { granted: 'bildirim izni verildi', denied: 'bildirim izni reddedildi', unsupported: 'bildirim yok, takvim', default: 'izin sorusu kapatıldı' }[p.permission] || '', { prompt: 'kayıt sonrası soru', settings: 'Ayarlar', time_change: 'saat değişti' }[p.from] || ''].filter(Boolean).join(' · ');
    case 'reminder_calendar_added': return p.time;
    case 'reminder_fired': return 'bildirim';
    case 'install_prompt': return p.outcome === 'accepted' ? 'kabul edildi' : 'vazgeçildi';
    case 'support_shown': return `${SCREEN_LABELS[p.where] || p.where} · son 4 günde ${p.low} düşük kayıt`;
    case 'support_resource_tapped': return p.resource.replace('tel:', 'Arama: ');
    case 'support_dismissed': return SCREEN_LABELS[p.where] || p.where;
    case 'welcome_choice': return { try: 'Uygulamayı dene', panel: 'Ürün kararlarını incele', empty: 'Kendi günlüğünü başlat' }[p.choice] || p.choice;
    case 'notes_toggled': return p.on ? 'açıldı' : 'kapatıldı';
    default: return '';
  }
}

const EVENT_LABELS = {
  ...Object.fromEntries(EVENT_SCHEMA.map((e) => [e.name, e.label])),
  sample_loaded: 'Örnek veri yüklendi',
  welcome_choice: 'Karşılama seçimi',
  notes_toggled: 'Ürün notları',
};

function fmtDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} sn` : `${Math.floor(s / 60)} dk ${s % 60} sn`;
}

function sessionHtml() {
  const evs = analytics.session();
  if (!evs.length) return '<p class="muted small">Bu oturumda henüz olay yok.</p>';
  const t0 = evs[0].at;
  const firstSave = evs.find((e) => e.name === 'entry_saved');
  const lastPick = [...evs].reverse().find((e) => e.name === 'mood_selected');
  const stats = [
    { label: 'Ölçülen olay', value: fmtInt(evs.length) },
    { label: 'İlk kayda kadar', value: firstSave ? fmtDuration(firstSave.at - t0) : '–' },
    { label: 'Seçim yöntemi', value: lastPick ? (METHOD_LABELS[lastPick.props.method] || '–') : '–' },
  ];
  const recent = evs.slice(-10);
  return `
    <div class="tiles tiles-3">${stats.map((s) => `
      <div class="tile"><span class="tile-label">${s.label}</span><span class="tile-value">${s.value}</span></div>`).join('')}
    </div>
    <ol class="timeline">${recent.map((e) => `
      <li>
        <span class="tl-time">+${fmtDuration(e.at - t0)}</span>
        <span class="tl-name">${EVENT_LABELS[e.name] || e.name}</span>
        <span class="tl-detail">${escapeHtml(describeEvent(e))}</span>
      </li>`).join('')}
    </ol>
    ${evs.length > recent.length ? `<p class="muted small">Son 10 olay gösteriliyor.</p>` : ''}`;
}

function renderPanel() {
  const ns = SIM.northStar;
  const w = ns.weeks;
  const delta = ((w[w.length - 1] - w[w.length - 2]) / w[w.length - 2]) * 100;
  const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

  return `
    <header class="top">
      <a class="back-link" href="#bugun" data-action="panel-back">${icon('M15 6l-6 6 6 6')}<span>Uygulamaya dön</span></a>
    </header>
    <p class="eyebrow">Ürün paneli</p>
    <h1 class="title">Ürün kararları ve metrikler</h1>

    <div class="sim-badge" role="note">
      ${icon('M12 8v5M12 16.5v.5M10.3 3.9L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z')}
      <p><strong>Simüle edilmiş veri · 1.000 kullanıcılık senaryo.</strong> Ürünün henüz gerçek kullanıcısı yok; bu panel hangi metrikleri neden izlediğimi ve verilerden nasıl karar çıkardığımı gösterir. En alttaki “Senin oturumun” bölümü ise gerçek ve canlıdır.</p>
    </div>

    <section class="p-section">
      <h2 class="section-title">Problem ve hedef</h2>
      <div class="card brief">
        <div><span class="k">Problem</span><p>Ruh hali takip uygulamaları çoğu zaman bir angarya gibi hissettiriyor; kullanıcıların büyük kısmı ilk haftada bırakıyor.</p></div>
        <div><span class="k">Hedef kitle</span><p>25-40 yaş arası, yoğun tempolu ve kendini daha iyi tanımak isteyen kadınlar; uzun günlük yazmaya vakti olmayanlar.</p></div>
        <div><span class="k">Başarı tanımı</span><p>10 saniyelik bir günlük alışkanlık ve ilk hafta içinde kişisel bir içgörü.</p></div>
      </div>
    </section>

    <section class="p-section">
      <h2 class="section-title">Kuzey yıldızı metriği</h2>
      <div class="card ns">
        <div class="ns-top">
          <div>
            <span class="tile-label">${ns.label}</span>
            <div class="ns-value">${fmtInt(w[w.length - 1])}<span class="ns-delta">${icon('M7 14l5-5 5 5')}+%${num1(delta)} geçen hafta</span></div>
          </div>
          ${sparklineSvg(w)}
        </div>
        <p class="ns-def">${escapeHtml(ns.definition)}</p>
        <p class="ns-why"><span class="k">Neden bu metrik?</span>${escapeHtml(ns.why)}</p>
      </div>
      <div class="tiles tiles-3">${SIM.inputs.map((t) => `
        <div class="tile"><span class="tile-label">${t.label}</span><span class="tile-value">${t.value}</span><span class="tile-sub">${t.sub}</span></div>`).join('')}
      </div>
    </section>

    <section class="p-section">
      <h2 class="section-title">Aktivasyon hunisi</h2>
      <div class="card funnel">${funnelHtml()}</div>
      <div class="card callout">
        <p><span class="k">Bulgu</span>${escapeHtml(SIM.funnelFinding.finding)}</p>
        <p><span class="k">Aksiyon</span>${escapeHtml(SIM.funnelFinding.action)}</p>
      </div>
    </section>

    <section class="p-section">
      <h2 class="section-title">Tutma eğrisi</h2>
      <div class="card chart-card">
        <p class="chart-sub">İlk açılıştan sonraki günlerde hâlâ kayıt yapan kullanıcı oranı</p>
        ${retentionSvg()}
      </div>
    </section>

    <section class="p-section">
      <h2 class="section-title">Deneyler</h2>
      ${experimentHtml()}
      ${SIM.running.map(runningExperimentHtml).join('')}
    </section>

    <section class="p-section">
      <h2 class="section-title">Önceliklendirme (ICE)</h2>
      ${backlogHtml()}
    </section>

    <section class="p-section">
      <h2 class="section-title">Yol haritası</h2>
      ${roadmapHtml()}
    </section>

    <section class="p-section">
      <div class="live-head">
        <h2 class="section-title">Senin oturumun</h2>
        <span class="live-badge"><i></i>Gerçek veri</span>
      </div>
      <div class="card session">
        <p class="muted small">Uygulama her etkileşimi ölçüyor. Aşağıdakiler senin bu ziyaretteki gerçek hareketlerin (yalnızca bu tarayıcıda saklanır, hiçbir yere gönderilmez).</p>
        ${sessionHtml()}
        <details class="schema">
          <summary>Olay şeması</summary>
          <ul>${EVENT_SCHEMA.map((e) => `<li><code>${e.name}</code><span>${e.why}</span></li>`).join('')}</ul>
        </details>
      </div>
    </section>

    <div class="panel-cta">
      <button class="btn btn-primary btn-block" data-action="tour">Uygulamayı ürün notlarıyla gez</button>
      <p class="save-hint">Her ekranda numaralı noktalara dokunarak kararların gerekçesini okuyabilirsin.</p>
    </div>`;
}
