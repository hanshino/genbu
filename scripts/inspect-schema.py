import sqlite3, sys
sys.stdout.reconfigure(encoding='utf-8')
con = sqlite3.connect('tthol.sqlite')
con.row_factory = sqlite3.Row
tables = ['items', 'item_rand', 'monsters', 'npc', 'magic', 'hero']
for t in tables:
    rows = con.execute(f'PRAGMA table_info({t})').fetchall()
    print(f'=== {t} ({len(rows)} cols) ===')
    for r in rows:
        print(f"  {r['name']:25} {r['type']:15} notnull={r['notnull']} default={r['dflt_value']}")
    print()
