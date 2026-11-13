import struct, sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_16
d=open(sys.argv[1],'rb').read()
img=d[0x200:]
CS=0x7230
code=img[CS:CS+0x62EB]
md=Cs(CS_ARCH_X86,CS_MODE_16); md.detail=False
tbl=[struct.unpack_from('<H',code,0x250+2*i)[0] for i in range(8)]
seeds=[0,0x14B3,0x14FB,0x1554,0x13C7]+tbl
seen={}; work=list(seeds); procs=set(seeds)
JCC={'jmp','je','jne','jz','jnz','jb','jnb','jae','ja','jbe','jc','jnc','jl','jg','jle','jge','js','jns','jo','jno','jcxz','loop','loope','loopne','jp','jnp'}
while work:
    a=work.pop()
    while 0<=a<len(code) and a not in seen:
        ins=next(md.disasm(code[a:a+8],a),None)
        if not ins: break
        seen[a]=ins
        m=ins.mnemonic
        tgt=None
        if (m in JCC or m=='call') and ins.op_str.startswith('0x'):
            tgt=int(ins.op_str,16)
            if m=='call': procs.add(tgt)
            work.append(tgt)
        if m in ('ret','retf','iret') or (m=='jmp' and tgt is not None) or (m=='jmp' and '[' in ins.op_str): break
        a+=ins.size
# data islands = gaps; write listing
out=open(sys.argv[2],'w')
pr=sorted(procs)
a=0
keys=sorted(seen)
prev_end=None
for k in keys:
    ins=seen[k]
    if prev_end is not None and k!=prev_end:
        out.write('        ; ---- gap %04X..%04X (%d bytes) data/unreached ----\n'%(prev_end,k,k-prev_end))
    if k in procs: out.write('\n; ===== proc_%04X =====\n'%k)
    out.write('%04X  %-16s %s %s\n'%(k,code[k:k+ins.size].hex(),ins.mnemonic,ins.op_str))
    prev_end=k+ins.size
out.close()
print('instructions',len(seen),'procs',len(procs),'covered bytes',sum(i.size for i in seen.values()),'of',len(code))
import json
json.dump({'procs':pr,'tbl':tbl},open(sys.argv[2]+'.procs.json','w'))
