import os
import subprocess
import markdown

md_path = r"D:\music player\AURA_PROJECT_DOCUMENTATION_TANGLISH.md"
html_path = r"D:\music player\AURA_PROJECT_DOCUMENTATION_TANGLISH.html"
pdf_path = r"D:\music player\AURA_PROJECT_DOCUMENTATION_TANGLISH.pdf"

with open(md_path, "r", encoding="utf-8") as f:
    md_content = f.read()

# Convert markdown to HTML
html_body = markdown.markdown(
    md_content,
    extensions=['extra', 'tables', 'fenced_code', 'toc', 'nl2br']
)

# Professional Print-optimized CSS
html_full = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Aura Music Player - Project Documentation (Tanglish)</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  @page {{
    size: A4;
    margin: 18mm 15mm 18mm 15mm;
    @bottom-right {{
      content: counter(page);
    }}
  }}

  * {{
    box-sizing: border-box;
  }}

  body {{
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background-color: #ffffff;
    line-height: 1.65;
    font-size: 13.5px;
    margin: 0;
    padding: 0;
  }}

  h1 {{
    font-size: 24px;
    font-weight: 800;
    color: #0f172a;
    border-bottom: 2.5px solid #6366f1;
    padding-bottom: 8px;
    margin-top: 0;
    margin-bottom: 16px;
  }}

  h2 {{
    font-size: 17px;
    font-weight: 700;
    color: #1e1b4b;
    background: #f1f5f9;
    padding: 6px 12px;
    border-radius: 6px;
    border-left: 4px solid #6366f1;
    margin-top: 24px;
    margin-bottom: 12px;
    page-break-after: avoid;
  }}

  h3 {{
    font-size: 15px;
    font-weight: 700;
    color: #334155;
    margin-top: 18px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }}

  p, ul, ol {{
    margin-top: 0;
    margin-bottom: 10px;
  }}

  li {{
    margin-bottom: 4px;
  }}

  blockquote {{
    margin: 12px 0;
    padding: 10px 16px;
    background-color: #f8fafc;
    border-left: 4px solid #8b5cf6;
    color: #475569;
    border-radius: 0 6px 6px 0;
    font-style: normal;
  }}

  blockquote p {{
    margin: 0;
  }}

  code {{
    font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
    font-size: 12px;
    background-color: #f1f5f9;
    color: #4338ca;
    padding: 2px 5px;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
  }}

  pre {{
    background-color: #0f172a;
    color: #e2e8f0;
    padding: 12px 16px;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 11.5px;
    line-height: 1.5;
    margin: 12px 0;
    page-break-inside: avoid;
  }}

  pre code {{
    background: transparent;
    color: inherit;
    padding: 0;
    border: none;
    font-size: inherit;
  }}

  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 12.5px;
    page-break-inside: avoid;
  }}

  th, td {{
    border: 1px solid #cbd5e1;
    padding: 8px 12px;
    text-align: left;
  }}

  th {{
    background-color: #f1f5f9;
    font-weight: 700;
    color: #0f172a;
  }}

  tr:nth-child(even) {{
    background-color: #f8fafc;
  }}

  hr {{
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 20px 0;
  }}

  a {{
    color: #4f46e5;
    text-decoration: none;
  }}

  .page-break {{
    page-break-before: always;
  }}
</style>
</head>
<body>
{html_body}
</body>
</html>
"""

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_full)

import tempfile
import shutil

print(f"Generated HTML at {html_path}")

edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not os.path.exists(edge_path):
    edge_path = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"

file_url = f"file:///{html_path.replace(os.sep, '/')}"
temp_dir = tempfile.mkdtemp()

cmd = [
    edge_path,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    f"--user-data-dir={temp_dir}",
    "--no-pdf-header-footer",
    f"--print-to-pdf={pdf_path}",
    file_url
]

print("Running Edge print-to-pdf with isolated user-data-dir...")
try:
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    print("Edge process finished.")
except Exception as e:
    print(f"Error running Edge: {e}")
finally:
    shutil.rmtree(temp_dir, ignore_errors=True)

if os.path.exists(pdf_path):
    size_kb = os.path.getsize(pdf_path) / 1024
    print(f"SUCCESS: PDF generated at {pdf_path} ({size_kb:.2f} KB)")
else:
    print(f"FAILED to generate PDF")

