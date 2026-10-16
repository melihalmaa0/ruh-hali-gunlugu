# Ruh Hali Günlüğü

Mobil öncelikli, bağımlılıksız bir ruh hali günlüğü. Günlük ruh halini, kısa bir notu ve etiketleri kaydeder; haftalık grafik, kural tabanlı örüntüler ve renkli bir ay takvimi sunar.

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

- **Ürün paneli** (`#panel`): problem ve hedef, kuzey yıldızı metriği, aktivasyon hunisi, tutma eğrisi, A/B deneyi (Filiz ve 5 buton), ICE önceliklendirmesi ve yol haritası. Bu metrikler **simüle edilmiş 1.000 kullanıcılık bir senaryodur**, panelde de açıkça belirtilir. En alttaki "Senin oturumun" bölümü ise gerçek ve canlıdır.
- **Ürün notları:** Sağ alttaki düğmeyle açılır. Her ekranda numaralı noktalar belirir; her nokta bir kararın gerekçesini, hipotezini ve izlenecek metriğini açıklar.
- **Olay takibi:** `session_start`, `screen_view`, `mood_selected` (sürükleme, dokunma, klavye), `entry_saved`, `tag_toggled`, `note_opened`. Olaylar yalnızca tarayıcıda (`ruh-hali-gunlugu:events`, son 500 olay) tutulur, hiçbir yere gönderilmez.

Ruh hali, maskot **Filiz** yukarı ya da aşağı sürüklenerek seçilir; bırakınca en yakın ruh haline oturur. Sağdaki ölçeğe dokunarak ya da klavyede yön tuşlarıyla da seçilebilir. Filiz seriyle büyür: 7 günde ikinci yaprak, 21 günde çiçek. Tasarım seçenekleri `tasarim/filiz-secenekler.html` dosyasında.

Geçmiş kayıtlar, Geçmiş ekranındaki kalem ikonuyla ya da takvimde bir güne dokunarak düzenlenebilir veya silinebilir. Boş kalan geçmiş günlere sonradan kayıt eklenebilir. Düzenleme ekranının adresi `#duzenle/YYYY-AA-GG` biçimindedir.

## Yapı

| Dosya | İçerik |
| --- | --- |
| `index.html` | İskelet ve alt menü |
| `styles.css` | Tasarım (renk değişkenleri `:root` içinde) |
| `product.js` | Ürün katmanı: olay takibi, ürün notları, simülasyon verisi ve ürün paneli |
| `app.js` | Depolama, hesaplamalar, örnek veri, Filiz ve arayüz |

- **Veri:** `localStorage` → `ruh-hali-gunlugu:v1` anahtarı. Biçim: `{ entries: { "YYYY-AA-GG": { date, mood (1-5), note, tags[], updatedAt } }, customTags[] }`
- **İçgörüler:** `computeInsights(entries)` saf bir fonksiyondur ve `{ tone, title, body, basis }` listesi döner. AI entegrasyonu için bu fonksiyonun yerine aynı biçimde sonuç dönen bir servis çağrısı koymak yeterli.
- **Kurallar:** haftanın günü ortalaması ile genel ortalama farkı (≥ 0,5), etiketli ve etiketsiz günlerin farkı (≥ 0,5, her grupta en az 3 kayıt), son 7 gün ile önceki 7 günün farkı (≥ 0,4), 7 gün ve üzeri seri.
