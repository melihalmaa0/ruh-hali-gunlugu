# Pip · Ruh Hali Günlüğü

**Pip**, mobil öncelikli ve bağımlılıksız bir ruh hali günlüğü; adını maskotundan alır. Günlük ruh halini, kısa bir notu ve etiketleri kaydeder; haftalık grafik, kural tabanlı örüntüler ve renkli bir ay takvimi sunar.

## Çalıştırma

Derleme gerekmez. `index.html` dosyasını tarayıcıda açman yeterli.

İstersen yerel sunucuyla da çalıştırabilirsin:

```bash
npx serve .
# veya
python -m http.server 8000
```

İlk açılışta karşılama ekranı iki yol sunar: **Uygulamayı dene** (3 haftalık örnek veriyle dolu bir günlük) ve **Ürün kararlarını incele** (ürün paneli). Örnek veri, ürün paneli, ürün notları ve karşılama ekranına sonradan **Ayarlar** sekmesinden ulaşılabilir.

## Ürün katmanı

Uygulamayı inceleyen kişinin ürün kararlarını birkaç dakikada görebilmesi için:

- **Ürün paneli** (`#panel`): problem ve hedef, kuzey yıldızı metriği, aktivasyon hunisi, tutma eğrisi, A/B deneyleri (tamamlanan: Pip ve 5 buton; süren: ilk içgörü 3. kayıtta, suçlamayan seri), ICE önceliklendirmesi ve yol haritası. Bu metrikler **simüle edilmiş 1.000 kullanıcılık bir senaryodur**, panelde de açıkça belirtilir. En alttaki "Senin oturumun" bölümü ise gerçek ve canlıdır.
- **Ürün notları:** Sağ alttaki düğmeyle açılır. Her ekranda numaralı noktalar belirir; her nokta bir kararın gerekçesini, hipotezini ve izlenecek metriğini açıklar.
- **Olay takibi:** `session_start`, `screen_view`, `mood_selected` (sürükleme, dokunma, klavye), `entry_saved`, `tag_toggled`, `first_insight_unlocked`, `tags_chosen`, `onboarding_completed`, `reminder_prompt_shown`, `reminder_set`, `reminder_declined`, `reminder_calendar_added`, `reminder_fired`, `install_prompt`, `support_shown`, `support_resource_tapped`, `support_dismissed`, `note_opened`. Olaylar yalnızca tarayıcıda (`ruh-hali-gunlugu:events`, son 500 olay) tutulur, hiçbir yere gönderilmez.

**Akşam hatırlatması:** İlk kayıttan hemen sonra Bugün ekranında "Yarın da hatırlatayım mı?" kartı çıkar; tarayıcı bildirim izni ancak "Hatırlat" denince istenir. Sunucu olmadığı için bildirim yalnızca uygulama açıkken (ya da arka planda açık dururken) güvenilir; bu yüzden ikinci kanal olarak her gün tekrarlayan bir takvim etkinliği (`.ics`) indirilebilir. O gün kayıt yapıldıysa bildirim gönderilmez. Ayarlar → Hatırlatma ve uygulama bölümünden açılıp kapatılır, saati değiştirilir.

**Telefona yükleme (PWA):** `manifest.webmanifest` ve `sw.js` sayesinde site ana ekrana eklenip uygulama gibi açılır ve çevrimdışı çalışır. Service worker yalnızca http(s) üzerinde çalışır; `index.html` dosyadan açıldığında uygulama yine çalışır ama yüklenemez. Kendi dosyalar önce ağdan (güncel sürüm), ağ yoksa önbellekten gelir.

**Kısa başlangıç akışı:** Karşılamadaki "Kendi günlüğünü başlat" iki adımlık bir akış açar: (1) günleri etkileyen etiketlerin seçimi (`#baslangic`, atlanabilir, en fazla 8), (2) Bugün ekranında ilk kayda yönlendiren şerit. Etiketler sonradan Ayarlar → Etiketlerin (`#etiketler`) ekranından değiştirilebilir.

**Suçlamayan seri:** Tek bir boş gün "dinlenme günü" sayılır ve seriyi bozmaz (en fazla 7 günde bir); art arda iki boş gün seriyi bitirir. Dinlenme günleri seri sayısına eklenmez, takvimde çerçeveli gösterilir. Örnek veride bir gün bu yüzden bilerek boş.

**İlk içgörü 3. kayıtta:** Huni bulgusuna yanıt olarak ilk içgörü 5. yerine 3. kayıtta açılır. 7. kayda kadar "erken gözlem" olarak işaretlenmiş tek bir kart gösterilir; bu kart örüntü iddia etmez. Açıldığı an `first_insight_unlocked` olayıyla ölçülür.

**Zor günlerde destek:** Son 4 günün en az 3'ünde ruh hali "Kötü" ya da "Çok kötü" ise Bugün ve İçgörü ekranlarında nazik bir destek kartı çıkar. Kart kullanıcının kendi verisinden iyi gelen bir etiketi hatırlatır ve yardım kaynaklarını (`SUPPORT_RESOURCES`, Türkiye) listeler. "Şimdi değil" denince 3 gün gösterilmez. Demoda görmek için: Ayarlar → **Zor günler senaryosu**.

Ruh hali, maskot **Pip** yukarı ya da aşağı sürüklenerek seçilir; bırakınca en yakın ruh haline oturur. Sağdaki ölçeğe dokunarak ya da klavyede yön tuşlarıyla da seçilebilir. Pip seriyle büyür: 7 günde ikinci yaprak, 21 günde çiçek. Tasarım seçenekleri `tasarim/pip-secenekler.html` dosyasında.

Geçmiş kayıtlar, Geçmiş ekranındaki kalem ikonuyla ya da takvimde bir güne dokunarak düzenlenebilir veya silinebilir. Boş kalan geçmiş günlere sonradan kayıt eklenebilir. Düzenleme ekranının adresi `#duzenle/YYYY-AA-GG` biçimindedir.

## Yapı

| Dosya | İçerik |
| --- | --- |
| `index.html` | İskelet ve alt menü |
| `styles.css` | Tasarım (renk değişkenleri `:root` içinde) |
| `product.js` | Ürün katmanı: olay takibi, ürün notları, simülasyon verisi ve ürün paneli |
| `app.js` | Depolama, hesaplamalar, örnek veri, Pip ve arayüz |
| `sw.js` | Service worker: çevrimdışı önbellek, bildirime dokununca uygulamayı açma |
| `manifest.webmanifest`, `icons/` | PWA tanımı ve ikonlar |

- **Veri:** `localStorage` → `ruh-hali-gunlugu:v1` anahtarı (uygulamanın eski adı; yüklü cihazlardaki kayıtlar kaybolmasın diye anahtarlar değiştirilmedi). Biçim: `{ entries: { "YYYY-AA-GG": { date, mood (1-5), note, tags[], updatedAt } }, customTags[], tagSet[] | null }` (`tagSet` başlangıçta seçilen etiketler; `null` ise varsayılan 5 etiket)
- **İçgörüler:** `computeInsights(entries)` saf bir fonksiyondur ve `{ tone, title, body, basis }` listesi döner. AI entegrasyonu için bu fonksiyonun yerine aynı biçimde sonuç dönen bir servis çağrısı koymak yeterli.
- **Kurallar:** haftanın günü ortalaması ile genel ortalama farkı (≥ 0,5), etiketli ve etiketsiz günlerin farkı (≥ 0,5, her grupta en az 3 kayıt), son 7 gün ile önceki 7 günün farkı (≥ 0,4), 7 gün ve üzeri seri. Kayıt sayısı 3-6 arasındaysa ayrıca bir "erken gözlem" kartı eklenir.
