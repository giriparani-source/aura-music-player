import os
import re
import markdown
from xhtml2pdf import pisa

md_path = r"D:\music player\AURA_PROJECT_DOCUMENTATION_TANGLISH.md"
pdf_path = r"D:\music player\AURA_PROJECT_DOCUMENTATION_TANGLISH.pdf"

with open(md_path, "r", encoding="utf-8") as f:
    md_content = f.read()

# Replace any complex emojis with safe text or symbols if needed for standard PDF fonts
# or xhtml2pdf handles UTF-8 when properly declared
html_body = markdown.markdown(
    md_content,
    extensions=['extra', 'tables', 'fenced_code', 'nl2br']
)

# Style specifically optimized for xhtml2pdf / ReportLab engine
css = """
@page {
    size: a4 portrait;
    margin: 2cm 1.5cm 2cm 1.5cm;
}

body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #1e293b;
}

h1 {
    font-size: 18pt;
    font-weight: bold;
    color: #1e1b4b;
    border-bottom: 2px solid #6366f1;
    padding-bottom: 6px;
    margin-top: 0;
    margin-bottom: 14px;
}

h2 {
    font-size: 13pt;
    font-weight: bold;
    color: #312e81;
    background-color: #f1f5f9;
    padding: 5px 8px;
    margin-top: 18px;
    margin-bottom: 8px;
    border-left: 3px solid #6366f1;
}

h3 {
    font-size: 11pt;
    font-weight: bold;
    color: #4338ca;
    margin-top: 12px;
    margin-bottom: 6px;
}

p, ul, ol {
    margin-top: 0;
    margin-bottom: 8px;
}

li {
    margin-bottom: 3px;
}

blockquote {
    margin: 8px 0;
    padding: 6px 12px;
    background-color: #f8fafc;
    border-left: 3px solid #8b5cf6;
    color: #475569;
}

blockquote p {
    margin: 0;
}

code {
    font-family: Courier, monospace;
    font-size: 8.5pt;
    background-color: #f1f5f9;
    color: #4338ca;
    padding: 1px 3px;
}

pre {
    background-color: #0f172a;
    color: #f8fafc;
    padding: 8px 10px;
    font-family: Courier, monospace;
    font-size: 8pt;
    line-height: 1.35;
    margin: 8px 0;
}

pre code {
    background: transparent;
    color: #f8fafc;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 9pt;
}

th, td {
    border: 0.5pt solid #cbd5e1;
    padding: 5px 8px;
    text-align: left;
}

th {
    background-color: #f1f5f9;
    font-weight: bold;
    color: #0f172a;
}

hr {
    color: #e2e8f0;
    height: 1px;
    margin: 14px 0;
}
"""

html_document = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
{css}
</style>
</head>
<body>
{html_body}
</body>
</html>
"""

print("Rendering PDF via xhtml2pdf...")
with open(pdf_path, "wb") as pdf_file:
    pisa_status = pisa.CreatePDF(html_document.encode("utf-8"), dest=pdf_file, encoding="utf-8")

if pisa_status.err:
    print(f"Error occurred during PDF generation: {pisa_status.err}")
else:
    size_kb = os.path.getsize(pdf_path) / 1024
    print(f"SUCCESS: PDF generated successfully at {pdf_path} ({size_kb:.2f} KB)")
