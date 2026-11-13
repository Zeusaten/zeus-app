#!/usr/bin/env python3
"""Crea copie di CAT.EXE che saltano subito in una stanza (1..7), per osservarla in DOSBox.

Uso: force_room.py CAT.EXE outdir      -> outdir/r1/CAT.EXE ... outdir/r7/CAT.EXE
Le patch (offset relativi al segmento di codice, che inizia a 0x7430 nel file):
  CS:01AB  je 0155      -> nop nop          (esce subito dal vicolo, come se il gatto fosse entrato da una finestra)
  CS:01E5  call rand    -> mov al,N ; jmp 021C   (forza il numero di stanza)
  CS:0228  je 01E5      -> nop nop          (evita il ciclo infinito "stanza uguale alle ultime due")
"""
import os
import sys

src, out = sys.argv[1], sys.argv[2]
d = open(src, 'rb').read()
base = 0x200 + 0x7230
for n in range(1, 8):
    b = bytearray(d)
    assert b[base + 0x1AB:base + 0x1AD] == bytes([0x74, 0xA8])
    b[base + 0x1AB:base + 0x1AD] = b'\x90\x90'
    assert b[base + 0x1E5:base + 0x1E8] == bytes([0xE8, 0x15, 0x2C])
    b[base + 0x1E5:base + 0x1E9] = bytes([0xB0, n, 0xEB, 0x33])
    assert b[base + 0x228:base + 0x22A] == bytes([0x74, 0xBB])
    b[base + 0x228:base + 0x22A] = b'\x90\x90'
    os.makedirs(f'{out}/r{n}', exist_ok=True)
    open(f'{out}/r{n}/CAT.EXE', 'wb').write(b)
print('ok')
