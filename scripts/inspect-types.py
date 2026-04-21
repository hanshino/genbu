import sqlite3, sys
sys.stdout.reconfigure(encoding='utf-8')
con = sqlite3.connect('tthol.sqlite')
rows = con.execute("SELECT type, COUNT(*) c FROM items GROUP BY type ORDER BY c DESC").fetchall()
for r in rows:
    print(f"{r[0] or '(null)':20} {r[1]}")
