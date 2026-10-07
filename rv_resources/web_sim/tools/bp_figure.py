#!/usr/bin/env python3
"""Draw BranchPred.svg: the pipeline's fetch side with branch prediction, in
the style of Microarch_pipelined.svg (data black, control blue, its mux,
adder, register and memory shapes), as the simulator implements it.

Against the course's original figure:
  - the target comes from the next-PC adder, PCNextE = (PCE or RD1FwdE) +
    ExtImmE when E jumps, else PCE + 4, so jalr is covered, and PCNextE is
    also the PC to recover to: no separate correction mux, no PCPlus4 or
    predicted target carried through D and E;
  - the BHT has a second read/write port at PCE instead of carrying PrPCSrc
    and PrBTA through the pipeline registers; the entry cannot change under
    a live instruction, since it is written only when that instruction
    mispredicts, which flushes everything younger;
  - each PrPCSrc is one bit, or a 2-bit counter whose top bit predicts.

  python3 tools/bp_figure.py            writes BranchPred.svg
  python3 tools/bp_figure.py --embed    and the copy riscv_simulator.html
                                        shows when the Branch Predictor
                                        block is clicked
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('BP_OUT') or os.path.join(ROOT, 'BranchPred.svg')
W, H = 2680, 1830

K = '#000000'       # data
B = '#0070C0'       # control
DATA, CTRL, BLOCK = 6.875, 3.4375, 8.02083
FONT = 'Arial,Arial_MSFontService,sans-serif'
out = []


def line(pts, colour=K, w=None):
    w = w or (CTRL if colour == B else DATA)
    out.append('<path d="M%s" stroke="%s" stroke-width="%g" stroke-miterlimit="8" fill="none"/>' % (
        ' '.join('%g %g' % p for p in pts), colour, w))


def shape(pts, colour=K, w=DATA, fill='none'):
    out.append('<path d="M%sZ" stroke="%s" stroke-width="%g" stroke-miterlimit="8" fill="%s"/>' % (
        ' '.join('%g %g' % p for p in pts), colour, w, fill))


def rect(x0, y0, x1, y1, colour=K, fill='none'):
    out.append('<rect x="%g" y="%g" width="%g" height="%g" stroke="%s" stroke-width="%g" stroke-miterlimit="8" fill="%s"/>' % (
        x0, y0, x1 - x0, y1 - y0, colour, BLOCK, fill))


def rounded(x0, y0, x1, y1, colour=B, r=20):
    out.append('<rect x="%g" y="%g" width="%g" height="%g" rx="%g" stroke="%s" stroke-width="%g" fill="none"/>' % (
        x0, y0, x1 - x0, y1 - y0, r, colour, BLOCK))


def text(s, x, y, size=37, colour=K, bold=False, anchor='start', rot=False):
    tr = ' transform="rotate(-90 %g %g)"' % (x, y) if rot else ''
    out.append('<text x="%g" y="%g" font-family="%s" font-size="%g" font-weight="%s" fill="%s" text-anchor="%s"%s>%s</text>' % (
        x, y, FONT, size, 700 if bold else 400, colour, anchor, tr, s))


def mux(x0, y0, h, labels, size=37):
    """A mux, 65 wide, inputs on the left; labels [(text, input y)]."""
    s = h * 0.273
    shape([(x0, y0), (x0 + 65, y0 + s), (x0 + 65, y0 + h - s), (x0, y0 + h)])
    for t, y in labels:
        text(t, x0 + 9, y + 14, size)
    return x0 + 65, y0 + h / 2            # the output


def adder(x0, y0, h):
    """The drawing's adder: 81 wide, notched in the middle of its left side."""
    s = h * 0.16
    m = y0 + h / 2
    shape([(x0, y0), (x0 + 81, y0 + s), (x0 + 81, y0 + h - s), (x0, y0 + h)], w=BLOCK)
    shape([(x0, m - 22), (x0 + 30, m), (x0, m + 22)], w=BLOCK)
    shape([(x0 - 12, m - 22), (x0 + 18, m), (x0 - 12, m + 22)], '#FFFFFF', BLOCK, '#FFFFFF')
    text('+', x0 + 38, m + 12, 46, bold=True)
    return x0 + 81, m


def clock(x, y, label=True):
    """A clock input on a top edge at x."""
    line([(x, y - 41), (x, y)], K, CTRL)
    shape([(x + 18.5, y + 1), (x, y + 25), (x - 18.5, y + 1)], K, CTRL, '#FFFFFF')
    if label:
        text('CLK', x - 32, y - 48, 37)


def bubble(x, y):
    out.append('<circle cx="%g" cy="%g" r="8.5" stroke="%s" stroke-width="%g" fill="none"/>' % (x, y, K, DATA))


def reg(x0, y0, x1, y1, name):
    rect(x0, y0, x1, y1, K, '#FFFFFF')
    clock((x0 + x1) / 2, y0)
    text(name, (x0 + x1) / 2, y0 + 70, 41, anchor='middle')


def xor(x, y):     # inputs at y -/+ 18 on the left; output at x + 74
    out.append('<path d="M%g %g Q%g %g %g %g Q%g %g %g %g Q%g %g %g %gZ" stroke="%s" stroke-width="%g" fill="none"/>' % (
        x, y - 40, x + 50, y - 40, x + 74, y, x + 50, y + 40, x, y + 40, x + 17, y, x, y - 40, K, DATA))
    out.append('<path d="M%g %g Q%g %g %g %g" stroke="%s" stroke-width="%g" fill="none"/>' % (
        x - 12, y - 40, x + 5, y, x - 12, y + 40, K, DATA))


def gate_or(x, y):
    out.append('<path d="M%g %g Q%g %g %g %g Q%g %g %g %g Q%g %g %g %gZ" stroke="%s" stroke-width="%g" fill="none"/>' % (
        x, y - 40, x + 50, y - 40, x + 74, y, x + 50, y + 40, x, y + 40, x + 17, y, x, y - 40, K, DATA))


def gate_and(x, y):
    out.append('<path d="M%g %g L%g %g A40 40 0 0 1 %g %g L%g %gZ" stroke="%s" stroke-width="%g" fill="none"/>' % (
        x, y - 40, x + 34, y - 40, x + 34, y + 40, x, y + 40, K, DATA))


def comparator(x, y):  # inputs at y -/+ 18; output at x + 70
    shape([(x, y - 44), (x + 70, y), (x, y + 44)], K, DATA)
    text('≠', x + 10, y + 13, 38, bold=True)


# ---------------------------------------------------------------- the figure
# Every wire label is 37 regular, near where the wire leaves or enters a
# block, as in Microarch_pipelined.svg; only block names are 46 bold.
L = 37


def label(s, x, y, colour=K, anchor='start', rot=False):
    text(s, x, y, L, colour, anchor=anchor, rot=rot)


def pipereg(x0, name, en=False):
    """A pipeline register, 36 wide, from RT to RB, with its clock, letter and
    EN/CLR pins at the bottom."""
    rect(x0, RT, x0 + 36, RB, K, '#FFFFFF')
    clock(x0 + 18, RT)
    text(name, x0 + 18, RT + 68, 41, anchor='middle')
    if en:
        text('EN', x0 + 16, RB - 8, 22, rot=True)
        text('CLR', x0 + 32, RB - 8, 22, rot=True)
    else:
        text('CLR', x0 + 28, RB - 8, 28, rot=True)


RT, RB = 300, 1000          # pipeline registers, top and bottom
HY0, HY1 = 1700, 1790       # the hazard unit
TOP_NEXT, TOP_MISS = 60, 112
DX, EX = 1100, 1400         # the D and E registers
G = 470                     # the check logic's offset right of the BHT

# Fetch: the PC mux picks PCNextE on a misprediction, else the prediction.
mx, my = mux(100, 403, 169, [('1', 455), ('0', 521)])
line([(mx, my), (260, my)])
label("PC'", 176, my - 14)
rect(260, 388, 340, 586)
clock(300, 388)
text('PC', 316, 520, 46, bold=True, rot=True)
text('EN', 318, 578, 28, rot=True)
bubble(300, 595)

PCF_Y = 487
line([(340, PCF_Y), (600, PCF_Y)])
label('PCF', 350, PCF_Y - 14)
rect(600, 360, 834, 698)
text('A', 616, PCF_Y + 14, 46)
text('RD', 764, 572, 46)
text('Instr', 684, 640, 46, bold=True, rot=True)
text('Memory', 740, 670, 46, bold=True, rot=True)
line([(834, 558), (DX, 558)])
label('InstrF', 846, 544)
line([(480, PCF_Y), (480, 898), (DX, 898)])
label('PCF', 900, 884)

pipereg(DX, 'D', en=True)
bubble(DX + 14, RB + 9)
line([(DX + 36, 558), (DX + 180, 558)])
label('InstrD', DX + 48, 544)
line([(EX - 175, 618), (EX, 618)])
label('ExtImmD', EX - 172, 604)
line([(DX + 36, 898), (EX, 898)])
label('PCD', DX + 48, 884)

# Execute: PC Logic, and the next-PC adder working out PCNextE.
E1 = EX + 36
pipereg(EX, 'E')
rounded(1560, 250, 1660, 440)
text('PC', 1604, 345, 46, B, True, 'middle', rot=True)
text('Logic', 1648, 345, 46, B, True, 'middle', rot=True)
line([(E1, 340), (1560, 340)], B)
label('PCSE', E1 + 12, 326, B)
line([(1610, 540), (1610, 440)], B)
label('ALUFlags', 1622, 500, B)
line([(E1, 618), (1780, 618)])
label('ExtImmE', E1 + 12, 604)
line([(1740, 552), (1780, 552)])
text('4', 1708, 566, 40, bold=True)
o1 = mux(1780, 500, 169, [('0', 552), ('1', 618)])
line([(1596, 832), (1780, 832)])
label('RD1FwdE', 1600, 818)
line([(E1, 898), (1780, 898)])
label('PCE', E1 + 12, 884)
o2 = mux(1780, 780, 169, [('1', 832), ('0', 898)])
ax, ay = adder(1940, 525, 400)
line([o1, (1940, o1[1])])
line([o2, (1940, o2[1])])
PN = 2090                   # PCNextE's vertical
PS = 1880                   # PCSrcE's vertical
line([(1660, 350), (PS, 350), (PS, 1100)], B)
label('PCSrcE', 1670, 336, B)
line([(1812, 350), (1812, 523)], B)
text('[0]', 1820, 470, 30, B)
line([(PS, 980), (1812, 980), (1812, 926)], B)
text('[1]', 1820, 1016, 30, B)
line([(ax, ay), (PN, ay), (PN, TOP_NEXT), (40, TOP_NEXT), (40, 455), (100, 455)])
line([(PN, ay), (PN, 1100)])
label('PCNextE', PN + 12, ay - 14)

# The BHT, below Execute: port 1 read at PCF for Fetch's prediction; port 2
# at PCE, read for the check and written when E's instruction mispredicts.
bx0, by0, bx1, by1 = 1500, 1100, 2150, 1560
rect(bx0, by0, bx1, by1)
clock(1700, by0)
text('CLK', 1668, by0 - 48, 37)
text('BHT', 1620, by0 + 190, 46, bold=True, anchor='middle')
tx0, tx1, ty0, ty1 = 1740, 2040, by0 + 60, by1 - 40
cx = tx0 + 110
text('PrPCSrc', (tx0 + cx) / 2, ty0 + 36, 26, anchor='middle')
text('PrBTA', (cx + tx1) / 2, ty0 + 38, 32, anchor='middle')
rect(tx0, ty0, tx1, ty1)
line([(cx, ty0), (cx, ty1)], K, 3)
for y in range(ty0 + 55, ty1 - 20, 55):
    line([(tx0, y), (tx1, y)], K, 3)
line([(1540, 898), (1540, by0)])
label('PCE[k+1:2]', 1530, 1090, rot=True)
# Port 1, back in Fetch.
line([(380, PCF_Y), (380, 1160), (bx0, 1160)])
label('PCF[k+1:2]', 1150, 1146)
line([(bx0, 1260), (482, 1260), (482, 1283)], B)
label('PrPCSrcF', 1180, 1246, B)
line([(bx0, 1470), (420, 1470), (420, 1378), (450, 1378)])
label('PrBTAF', 1200, 1456)
line([(380, 1060), (110, 1060), (110, 1242), (150, 1242)])
ax4, ay4 = adder(150, 1192, 240)
line([(110, 1382), (150, 1382)])
text('4', 82, 1396, 40, bold=True)
line([(ax4, ay4), (450, ay4)])
label('PCPlus4F', 248, ay4 - 14)
px, py = mux(450, 1260, 169, [('0', 1312), ('1', 1378)])
line([(px, py), (560, py), (560, 1560), (70, 1560), (70, 521), (100, 521)])
label('PredPCF', 80, 1546)

# The check: was the prediction Fetch made for E's instruction right? A
# branch misprediction writes PrPCSrc, a target one PrBTA; either is a
# Mispredict.
XG = bx1 + G
line([(bx1, 1238), (XG, 1238)], B)
label('PrPCSrcE', bx1 + 12, 1224, B)
line([(bx1, 1452), (XG, 1452)])
label('PrBTAE', bx1 + 12, 1438)
line([(PS, 1030), (XG - 60, 1030), (XG - 60, 1202), (XG, 1202)], B)
line([(XG - 60, 1202), (XG - 60, 1340), (XG + 130, 1340), (XG + 130, 1432), (XG + 160, 1432)], B)
line([(PN, 1070), (XG - 80, 1070), (XG - 80, 1488), (XG, 1488)])
xor(XG, 1220)
comparator(XG, 1470)
line([(XG + 70, 1470), (XG + 160, 1470)])
gate_and(XG + 160, 1450)
line([(XG + 74, 1220), (XG + 280, 1220), (XG + 280, 1322), (XG + 320, 1322)], B)
line([(XG + 100, 1220), (XG + 100, 1600), (2110, 1600), (2110, by1)], B)
label('Branch Mispredicted', 2124, 1586, B)
line([(XG + 234, 1450), (XG + 290, 1450), (XG + 290, 1358), (XG + 320, 1358)], B)
line([(XG + 260, 1450), (XG + 260, 1660), (2060, 1660), (2060, by1)], B)
label('BTA Mispredicted', 2124, 1648, B)
gate_or(XG + 320, 1340)
MX = XG + 620
line([(XG + 394, 1340), (MX, 1340), (MX, TOP_MISS), (132, TOP_MISS), (132, 426)], B)
line([(MX, 1340), (MX, HY0)], B)
label('Mispredict', XG + 404, 1326, B)

# The hazard unit: Mispredict in; the stalls and flushes out.
rounded(60, HY0, MX + 60, HY1, B, 30)
text('Hazard Unit', (60 + MX + 60) / 2, HY0 + 60, 46, B, True, 'middle')
for x, y0, name, dx in [(300, 604, 'StallF', -8), (DX + 14, RB + 18, 'StallD', -8), (DX + 28, RB, 'FlushD', 36),
                        (EX + 28, RB, 'FlushE', -8)]:
    line([(x, y0), (x, HY0)], B)
    label(name, x + dx, HY0 - 12, B, rot=True)
label('Mispredict', MX - 8, HY0 - 12, B, rot=True)
W = MX + 100

svg = ('<svg width="%d" height="%d" viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg" overflow="hidden">'
       '<rect width="100%%" height="100%%" fill="#FFFFFF"/>%s</svg>\n') % (W, H, W, H, ''.join(out))
open(OUT, 'w').write(svg)
print('wrote', os.path.relpath(OUT, ROOT))

if '--embed' in sys.argv:
    page = os.path.join(ROOT, 'riscv_simulator.html')
    html = open(page).read()
    inline = re.sub(r'<svg width="\d+" height="\d+" ', '<svg role="img" aria-label="Inside the Branch Predictor" ', svg.strip())
    html, n = re.subn(r'<!-- BP_FIGURE -->.*?<!-- /BP_FIGURE -->',
                      lambda m: '<!-- BP_FIGURE -->' + inline + '<!-- /BP_FIGURE -->', html, flags=re.S)
    assert n == 1, 'BP_FIGURE markers not found'
    open(page, 'w').write(html)
    print('embedded in riscv_simulator.html')
