# Alley Cat (IBM, 1984): note di ricostruzione

Appunti per la riedizione mobile in `public/alley-cat/`. Il file originale `CAT.EXE`
(55.067 byte, SHA-256 `4979c886…7bfdd`) **non** e' nel repo: e' protetto da copyright.
Gli strumenti in `tools/` lo leggono da un percorso passato come argomento.

Legenda: **[V]** verificato (giocato in DOSBox o letto nel codice), **[I]** dedotto, **[?]** da verificare.
Le offset `CS:xxxx` sono nel segmento di codice (file `0x7430 + xxxx`), `DS:xxxx` nei dati (file `0x300 + xxxx`).

## Come riprodurre l'analisi

1. `pip install capstone` e `python3 -I tools/disasm.py CAT.EXE cat.asm` produce il listato
   (recursive descent: 8491 istruzioni, 270 procedure, 98,5% del codice coperto).
2. `python3 tools/force_room.py CAT.EXE out/` crea 7 copie patchate che entrano subito nella stanza N.
   In DOSBox (`machine=cga`, `cycles=fixed 4770`): premere un tasto, `N` (joystick), `K` (livello), un tasto.
3. Per vedere il gioco in un server senza schermo: `Xvfb :99` + `dosbox` + `xdotool` + `import` (ImageMagick).

## Struttura del programma [V]

- E' assembly 8088 scritto a mano: nessun `INT 21h`, solo BIOS e porte hardware. Video CGA modo 4 (320x200, 4 colori).
- `main` (CS:0000) controlla la CGA, legge il byte modello a F000:FFFE (`0xFD` = PCjr), mostra titolo e menu, poi gioca.
- **Vite**: `DS:1F80`, impostata a 3 all'inizio (`CS:00B4`). Da 0 si torna al titolo.
- **Livello di difficolta'**: `DS:0008` (parte dalla scelta del menu K/H/T/A, `DS:6DF8`).
- **Punteggio**: 7 cifre BCD a `DS:1F82` (record a `DS:1F89`). La routine `CS:2706` somma AL **x10** punti (l'ultima cifra e' sempre 0). `CS:271E` somma un numero BCD generico.
- **Ciclo del vicolo**: `CS:0155..01AB`. Esce quando `DS:0551 != 0` (il gatto entra in una finestra). Poi sceglie la stanza a caso.
- **Scelta della stanza** (`CS:01E5..0235`, poi `JMP CS:[BX+0250h]`):
  - con probabilita' 3/4 e livello 0..2: tabella `DS:0421` (4 voci per livello): Kitten `4 4 1 1`, House Cat `3 3 5 5`, Tomcat `6 6 4 1`;
  - altrimenti (1/4, e sempre al livello 3 Alley Cat): tabella `DS:042D` = `1 3 4 5 6`;
  - si rilancia se la stanza e' uguale alle ultime due (`DS:041D`, `DS:041F`);
  - la stanza 7 si forza se `DS:0418 != 0`; la stanza 2 si raggiunge solo dalla 1 (quando `DS:0554 != 0`).
- Ogni stanza e' un ciclo (frame) che chiama le sue routine e si chiude quando `DS:0551/0552/0553` o `DS:041B` (riavvia) / `DS:041C` (menu) sono diversi da 0.

## Le 7 stanze (viste in DOSBox) [V]

| N | Entry | Routine di stanza | Che cos'e' |
|---|-------|-------------------|------------|
| 1 | CS:03E2 | `3850` | Sala da pranzo: tavolo, sedie, lampada, **tavolino con la boccia dei pesci**, scopa che si muove. Dalla boccia si passa alla stanza 2. |
| 2 | CS:0459 | `35C9 3675 37E5` | **Sott'acqua** nella boccia: pesci rosa da prendere, serpentelli/anguille nere e grigie. Il gatto parte dalla superficie. Qui si usa `CS:271E` per i punti. |
| 3 | CS:0394 | `3B30 3C90 3CB1 3B42` | Salotto con **libreria altissima**, piante in cima e **ragno** appeso, finestra, sedie, lampade, scopa. Anche qui punti con `CS:271E`. |
| 4 | CS:0349 | `4090 3E90 40C2` | **Formaggio gigante** (sfondo rosso/verde) con buchi da cui escono i **topi**; scopa marrone. |
| 5 | CS:02FE | `457A 45AB 4340` | Stanza rossa: **gabbia con l'uccellino** sul tavolo, quadro, lampada, 3 sedie, scopa. |
| 6 | CS:02AA | `4C00 4943 47D6` | **Ciotole di latte** e **cani che dormono**, scopa, quadro; con Alt vicino a una ciotola si beve (12 ciotole, servono piu' sorsi) [README del port di terzi]. |
| 7 | CS:0260 | `4F59 6100 4C10 6106 2F66 2E60` | **Stanza dei cuori** (sfondo verde con cuori e cupido): la gattina e i gatti rivali; con Alt si posa un regalo sullo scaffale piu' vicino; ogni stanza completata aggiunge un regalo, fino a 8 [README del port di terzi]. |

Tutte le stanze (tranne la 2 sott'acqua) hanno **la scopa del padrone** che si muove sul pavimento: [I] e' il pericolo che fa perdere una vita.

## Vicolo [V]

- 6 bidoni (x ~ 40, 82, 120, 168, 255, 298), staccionata, 4x3 finestre che si aprono e chiudono a caso, 3 fili del bucato con panni che oscillano.
- **Cane** grigio: dopo un po' arriva correndo lungo il marciapiede e toglie una vita se il gatto e' a terra [V in DOSBox].
- **Testa di gatto** che spunta dai bidoni sul coperchio: sbalza il gatto, non toglie vite [V in DOSBox, vite rimaste 3].
- **Oggetti lanciati dalle finestre** (dalle note del port di terzi: con Ctrl-I "non viene lanciato nulla") [I].
- **3 topi sui fili** (uno per filo): valgono **90, 70, 50** punti (`DS:1F39 = 09 07 05`, x10) [V nel codice, routine `CS:2567`].
- Comandi: frecce + Alt (azione). Salto: Su, anche in diagonale con una freccia [V].
- Tasti nascosti nel codice (non provati): Ctrl-9 = 9 vite, Ctrl-Y = esci al DOS, Ctrl-S suono, Ctrl-R riparti, Ctrl-M menu, Esc pausa ("paws") [codice V, effetto I].

## Cosa e' implementato nella riedizione (`public/alley-cat/`)

Fatto: titolo, scelta livello (4), vicolo con fisica del gatto, cane, teste nei bidoni, oggetti dalle finestre,
3 topi (90/70/50), vite (3), punteggio e record, game over, controlli touch/tastiera, verticale e orizzontale.

Parametri **stimati** (da tarare contro l'originale): velocita' di corsa (130 u/s), altezza salto (~50 u), frequenza
cane/teste/oggetti per livello, punti per aver raggiunto bidoni/steccato/fili (10/25/50/75/100: scelta mia).

Da fare: le 7 stanze (porta d'ingresso = finestra aperta), regole e punteggi di ciascuna dalle routine sopra,
collegamento stanza -> stanza (1 -> 2), regalo/stanza 7, musica.
