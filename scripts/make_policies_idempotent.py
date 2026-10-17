#!/usr/bin/env python3
"""
Hace re-ejecutable sql/schema.sql: antes de cada CREATE POLICY inserta un
DROP POLICY IF EXISTS equivalente (mismo nombre, misma tabla).

Uso (desde la raíz del repo):
    python3 scripts/make_policies_idempotent.py sql/schema.sql

Modifica el archivo en el lugar y deja una copia en sql/schema.sql.bak.
Es seguro correrlo más de una vez: no duplica los DROP que ya existan.
"""
import re
import shutil
import sys

if len(sys.argv) != 2:
    sys.exit(__doc__)

path = sys.argv[1]
src = open(path, encoding="utf-8").read()

CREATE = re.compile(r'^([ \t]*)CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([\w."]+)', re.M | re.I)

def already_dropped(text, pos, name, table):
    """True si justo antes del CREATE ya hay un DROP POLICY IF EXISTS igual."""
    before = text[max(0, pos - 300):pos]
    pat = r'DROP\s+POLICY\s+IF\s+EXISTS\s+"%s"\s+ON\s+%s\s*;\s*$' % (re.escape(name), re.escape(table))
    return re.search(pat, before, re.I) is not None

out, last, added = [], 0, 0
for m in CREATE.finditer(src):
    indent, name, table = m.groups()
    if already_dropped(src, m.start(), name, table):
        continue
    out.append(src[last:m.start()])
    out.append(f'{indent}DROP POLICY IF EXISTS "{name}" ON {table};\n')
    last = m.start()
    added += 1
out.append(src[last:])

if added == 0:
    print("Nada que cambiar: todas las policies ya tienen su DROP POLICY IF EXISTS.")
    sys.exit(0)

shutil.copyfile(path, path + ".bak")
open(path, "w", encoding="utf-8").write("".join(out))
print(f"{added} DROP POLICY IF EXISTS agregados en {path} (copia: {path}.bak)")