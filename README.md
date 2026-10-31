# Survive the Syllabus

Ders çalışmanı zombi baskınına çeviren oyun. Tamamen ücretsiz altyapıyla çalışır: Vercel (site) ve Supabase (giriş, kayıt, sıralama).

## Dosyalar
| Dosya | Ne işe yarar |
|---|---|
| `index.html` | Oyunun kendisi |
| `config.js` | Supabase adresi, herkese açık anahtar, yönetici e-postası (gizli bilgi yok) |
| `platform.js` | Giriş, kayıt, sıralama bağlantısı |
| `supabase.sql` | Veritabanı tablosu ve güvenlik kuralları |
| `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Telefona uygulama gibi ekleme ve internetsiz açılma |
| `build.py` | `kaynak/claude-surumu.html` dosyasından `index.html` üretir |

Sunucu fonksiyonu ve gizli anahtar yok; Vercel'e ortam değişkeni girmen gerekmiyor.

## Not: şifre sıfırlama mailleri
Şifre sıfırlama linkleri Supabase'in kendi mail servisiyle gider. Ücretsiz planda saatte sadece birkaç mail gönderebiliyor; kalabalık bir lansmandan önce kendi SMTP servisini bağlamak gerekir.

## Güncelleme
Claude'daki sürüm değişince yeni dosyayı `kaynak/claude-surumu.html` olarak kaydet, `python3 build.py` çalıştır, GitHub'a yükle. Vercel kendiliğinden yeniden yayınlar.
