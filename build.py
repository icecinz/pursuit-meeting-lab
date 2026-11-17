"""Build the self-contained classroom page used online and offline."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
html = (ROOT / 'index.html').read_text(encoding='utf-8')


def inline_style(match):
    source = (ROOT / match[1]).read_text(encoding='utf-8')
    return '<style>\n' + source + '\n</style>'


def inline_script(match):
    source = (ROOT / match[1]).read_text(encoding='utf-8')
    return '<script>\n' + source.replace('</script', '<\\/script') + '\n</script>'


html = re.sub(r'<link rel="stylesheet" href="([\w.-]+\.css)(?:\?[^\"]*)?">', inline_style, html)
html = re.sub(r'<script src="([\w.-]+\.js)(?:\?[^\"]*)?"></script>', inline_script, html)
if re.search(r'<script\b[^>]*\bsrc=|<link\b[^>]*\brel=[\"\x27]stylesheet', html):
    raise SystemExit('构建未完成：仍有未内联的脚本或样式。')

(ROOT / 'dist').mkdir(exist_ok=True)
(ROOT / 'dist' / 'index.html').write_text(html, encoding='utf-8')
(ROOT / '追及与相遇演示.html').write_text(html, encoding='utf-8')
print('已生成可离线打开的单文件演示。')
