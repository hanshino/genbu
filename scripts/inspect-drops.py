import sqlite3, sys, json
sys.stdout.reconfigure(encoding='utf-8')
con = sqlite3.connect('tthol.sqlite')
rows = con.execute("SELECT m.id, n.name, m.drop_item FROM monsters m JOIN npc n ON m.id=n.id WHERE m.drop_item IS NOT NULL AND m.drop_item != '' LIMIT 5").fetchall()
for r in rows:
    print(r[1], '->', r[2][:200])
    try:
        parsed = json.loads(r[2])
        print('  parsed:', type(parsed).__name__, 'len=', len(parsed) if hasattr(parsed, '__len__') else '?')
        print('  first 6 elems:', parsed[:6])
    except Exception as e:
        print('  parse err:', e)
    print()
