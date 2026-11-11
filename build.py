from pathlib import Path
root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'style.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="style.css?v=15">', '<style>\n' + css + '\n</style>')
map_css = (root / 'map.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="map.css?v=15">', '<style>\n' + map_css + '\n</style>')
teaching_css = (root / 'teaching.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="teaching.css?v=15">', '<style>\n' + teaching_css + '\n</style>')
for name in ('font.js', 'physics.js', 'presets.js', 'app.js', 'map.js'):
    source = (root / name).read_text(encoding='utf-8')
    html = html.replace(f'<script src="{name}?v=15"></script>', '<script>\n' + source + '\n</script>')
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / 'index.html').write_text(html, encoding='utf-8')
(root / '追及与相遇演示.html').write_text(html, encoding='utf-8')
print('已生成可离线打开的单文件演示。')
