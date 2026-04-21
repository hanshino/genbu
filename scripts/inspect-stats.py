import sqlite3, sys
sys.stdout.reconfigure(encoding='utf-8')
con = sqlite3.connect('tthol.sqlite')
for t in ['items', 'magic', 'monsters', 'npc']:
    try:
        c = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"{t}: {c}")
    except Exception as e:
        print(f"{t}: err {e}")
