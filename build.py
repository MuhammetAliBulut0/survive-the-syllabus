# Claude içindeki sürümden (survive-the-syllabus.html) site sürümünü (index.html) üretir.
import sys, pathlib
src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "kaynak/claude-surumu.html").read_text()
out = pathlib.Path(__file__).with_name("index.html")

patches = [
    ("Sayfayı Claude hesabınla açtığında sıralamaya katılırsın.", "Giriş yaptığında sıralamaya katılırsın."),
    ('if(!window.claude) devOK=true; // yerel önizleme', ''),
]
for a, b in patches:
    if src.count(a) != 1:
        sys.exit("Yama bulunamadı: " + a[:60])
    src = src.replace(a, b)

cut = src.index('<canvas class="stage"')
head, body = src[:cut], src[cut:]
favicon = "data:image/svg+xml," + "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23150d1f'/%3E%3Ccircle cx='16' cy='15' r='9' fill='%23c3f53c'/%3E%3Ccircle cx='12.5' cy='14' r='2' fill='%23ff4d6d'/%3E%3Ccircle cx='19.5' cy='14' r='2' fill='%23ff4d6d'/%3E%3Crect x='11' y='20' width='10' height='2' fill='%23150d1f'/%3E%3C/svg%3E"
page = f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Ders çalışmanı zombi baskınına çeviren oyun. Görevlerini bitir, sürüden sağ çık.">
<meta property="og:title" content="Survive the Syllabus">
<meta property="og:description" content="Ders çalışmanı zombi baskınına çeviren oyun. Görevlerini bitir, sürüden sağ çık.">
<meta name="theme-color" content="#150d1f">
<link rel="icon" href="{favicon}">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Syllabus">
<script>if("serviceWorker" in navigator&&location.protocol==="https:")addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{{}}));</script>
<style>:root{{color-scheme:dark;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}html,body{{margin:0}}body{{font:14px/1.5 system-ui,sans-serif}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
<script src="config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="platform.js"></script>
{head}</head>
<body>
{body}
</body>
</html>
"""
out.write_text(page)
print("index.html hazır:", len(page), "bayt")
