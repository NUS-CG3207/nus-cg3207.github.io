#!/usr/bin/env python3
"""Build the pipelined datapath drawings riscv_simulator.html animates.

From the lecture's Microarch_pipelined.svg this makes:

  full  the pipeline with the lui/auipc/jal/jalr hardware added: an ALUSrcA
        mux beside the ALU, three-input ALUSrcB and PC-base muxes, and the
        PCE, 0, 4 and RD1FwdE wires. Exported as Microarch_pipelined_full.svg.
  bp    the same with branch prediction: a Branch Predictor block below the
        instruction memory and a Mispredict mux in front of the PC; the
        next-PC adder only ever computes PCNextE. Exported as
        Microarch_pipelined_bp.svg.
  inside the bp drawing's fetch side with the Branch Predictor block opened,
        shown when the block is clicked. Exported as BranchPred.svg.

For the page, every wire is exploded into straight pieces, split at
T-junctions and at each stage register's edges (the run through a register
is dropped), and each route the animation lights is given as waypoints whose
pieces are found by coverage.

  python3 tools/pdp_build.py --embed    rewrite the drawings and tables in the page
  python3 tools/pdp_build.py --export   write the standalone SVGs
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'Microarch_pipelined.svg')
PAGE = os.path.join(ROOT, 'riscv_simulator.html')
src = open(SRC).read()
OPEN = '<g transform="translate(21 -429)">'
OX, OY = 21, -429
BODY = src[src.index(OPEN) + len(OPEN):src.rindex('</g>')]
TAGS = re.findall(r'<(?:path|text|rect)\b[^>]*?(?:/>|>[^<]*</text>)', BODY)

WIRE_W = ' stroke="#000000" stroke-width="6.875" stroke-miterlimit="8" fill="none"'
CTRL_W = ' stroke="#0070C0" stroke-width="3.4375" stroke-miterlimit="8" fill="none"'
BLOCK_W = ' stroke="#0070C0" stroke-width="8.02083" stroke-miterlimit="8" fill="none"'
TEXT_B = '<text font-family="Arial,Arial_MSFontService,sans-serif" font-weight="%s" font-size="%s" transform="matrix(1 0 0 1 %g %g)">%s</text>'
TEXT_C = '<text fill="#0070C0" font-family="Arial,Arial_MSFontService,sans-serif" font-weight="%s" font-size="%s" transform="matrix(1 0 0 1 %g %g)">%s</text>'
TEXT_R = '<text %sfont-family="Arial,Arial_MSFontService,sans-serif" font-weight="400" font-size="%s" transform="matrix(-1.83697e-16 -1 1 -1.83697e-16 %g %g)">%s</text>'


def nums_of(d):
    return [float(x) for x in re.findall(r'-?\d+\.?\d*(?:e-?\d+)?', d)]


def abs_pts(tag):
    d = re.search(r' d="([^"]*)"', tag).group(1)
    n = nums_of(d)
    m = re.search(r'transform="matrix\(([^)]*)\)"', tag)
    A, B, C, D, E, F = (float(v) for v in m.group(1).split()) if m else (1, 0, 0, 1, 0, 0)
    return [(A * n[k] + C * n[k + 1] + E + OX, B * n[k] + D * n[k + 1] + F + OY) for k in range(0, len(n) - 1, 2)]


def text_pos(tag):
    v = [float(x) for x in re.search(r'transform="matrix\(([^)]*)\)"', tag).group(1).split()]
    return v[4] + OX, v[5] + OY


def text(label, x, y, size=37, ctrl=False, bold=False):
    return (TEXT_C if ctrl else TEXT_B) % (700 if bold else 400, size, x - OX, y - OY, label)


def rtext(label, x, y, size=37, ctrl=False):
    return TEXT_R % ('fill="#0070C0" ' if ctrl else '', size, x - OX, y - OY, label)


def shape(pts, closed=True, attrs=' stroke="#000000" stroke-width="6.875" stroke-miterlimit="8" fill="none"'):
    d = 'M' + ' '.join('%g %g' % (round(x - OX, 2), round(y - OY, 2)) for x, y in pts) + ('Z' if closed else '')
    return '<path d="%s"%s/>' % (d, attrs)


def rounded(x0, y0, x1, y1, r, attrs=BLOCK_W):
    x0, y0, x1, y1 = x0 - OX, y0 - OY, x1 - OX, y1 - OY
    d = ('M%g %gL%g %gC%g %g %g %g %g %gL%g %gC%g %g %g %g %g %gL%g %gC%g %g %g %g %g %gL%g %gC%g %g %g %g %g %gZ' % (
        x0 + r, y0, x1 - r, y0, x1, y0, x1, y0, x1, y0 + r, x1, y1 - r, x1, y1, x1, y1, x1 - r, y1,
        x0 + r, y1, x0, y1, x0, y1, x0, y1 - r, x0, y0 + r, x0, y0, x0, y0, x0 + r, y0))
    return '<path d="%s"%s/>' % (d, attrs)


def shift_tag(t, dx, only_x_from=None):
    """Move an element right by dx; with only_x_from, only its points at or
    right of that x (stretching a shape that spans it)."""
    if t.startswith('<text'):
        return re.sub(r'(matrix\([^ ]+ [^ ]+ [^ ]+ [^ ]+ )([-\d.e]+)', lambda m: m.group(1) + '%g' % (float(m.group(2)) + dx), t)
    if t.startswith('<rect'):
        return re.sub(r' x="([^"]*)"', lambda m: ' x="%g"' % (float(m.group(1)) + dx), t)
    if 'transform=' in t:
        m = re.search(r'matrix\(([^)]*)\)', t)
        v = [float(x) for x in m.group(1).split()]
        v[4] += dx
        return t.replace(m.group(0), 'matrix(%s)' % ' '.join('%g' % x for x in v))
    d = re.search(r' d="([^"]*)"', t).group(1)

    def fix(m):
        n = nums_of(m.group(2))
        out = []
        for k in range(0, len(n), 2):
            if only_x_from is None or n[k] + OX >= only_x_from:
                n[k] += dx
            out.append('%g %g' % (n[k], n[k + 1]))
        return m.group(1) + ' '.join(out)
    d2 = re.sub(r'([MLCZ]?)([-\d.e ]+)', lambda m: fix(m) if m.group(2).strip() else m.group(0), d)
    return t.replace('d="%s"' % d, 'd="%s"' % d2)


# ---------------------------------------------------------------- variants
SHIFT_X, SHIFT = 2144, 140      # the gap opened in Execute for the ALUSrcA mux
ALIGN_B = 19                    # the ALUSrcB mux, in line with ALUSrcA's


def sx(x):
    return x + SHIFT if x >= SHIFT_X else x


def lecture():
    wires, others = [], []      # wires: [key, p, q, attrs]; others: (key, tag)
    for i, t in enumerate(TAGS):
        if t.startswith('<path') and re.fullmatch(r'M[-\d.e ]+', re.search(r' d="([^"]*)"', t).group(1).strip()):
            P = abs_pts(t)
            attrs = re.sub(r' transform="[^"]*"', '', re.sub(r' d="[^"]*"', '', t))[len('<path'):-2]
            for k in range(len(P) - 1):
                wires.append([i, P[k], P[k + 1], attrs])
        else:
            if i == 247:    # ExtImmE on the far left: outside its wire, clear of RD1FwdE
                t = shift_tag(t, -47)
            # Bus labels sat 5 units above their wires, inside a lit stroke.
            if i in (211, 212, 213, 222, 245, 246, 248):
                t = re.sub(r'(matrix\([^ ]+ [^ ]+ [^ ]+ [^ ]+ [-\d.e]+ )([-\d.e]+)', lambda m: m.group(1) + '%g' % (float(m.group(2)) - 6), t)
            others.append((i, t))
    return wires, others


def build_full():
    wires, others = lecture()
    REMOVE = {140, 205, 210, 227, 202, 203, 204, 120, 121, 125, 138}
    wires = [w for w in wires if w[0] not in REMOVE]
    others = [(i, t) for i, t in others if i not in REMOVE]
    # Open the gap in Execute: everything right of the ForwardAE mux moves.
    for w in wires:
        w[1] = (sx(w[1][0]), w[1][1]); w[2] = (sx(w[2][0]), w[2][1])
        if w[0] in (123, 124): w[2] = (w[2][0] + ALIGN_B, w[2][1])
        if w[0] == 122: w[1] = (w[1][0] + ALIGN_B, w[1][1])
    moved = []
    for i, t in others:
        if t.startswith('<text'):
            if text_pos(t)[0] >= SHIFT_X:
                t = shift_tag(t, SHIFT)
        elif t.startswith('<rect'):
            if float(re.search(r' x="([^"]*)"', t).group(1)) + OX >= SHIFT_X - 4:
                t = shift_tag(t, SHIFT)
        elif 'transform=' in t:
            v = [float(x) for x in re.search(r'matrix\(([^)]*)\)', t).group(1).split()]
            if v[4] + OX >= SHIFT_X - 30:
                t = shift_tag(t, SHIFT)
        else:
            P = abs_pts(t)
            if min(p[0] for p in P) >= SHIFT_X - 4:
                t = shift_tag(t, SHIFT + (ALIGN_B if i == 119 else 0))
            elif max(p[0] for p in P) >= SHIFT_X:
                t = shift_tag(t, SHIFT, only_x_from=SHIFT_X)
        if i in (108, 238):
            t = t.replace('ALUSrcB', 'ALUSrcA')
        moved.append((i, t))
    others = moved

    add_w, add_o = [], []

    def W(*pts, ctrl=False):
        for k in range(len(pts) - 1):
            add_w.append(['x', pts[k], pts[k + 1], CTRL_W if ctrl else WIRE_W])
    # ALUSrcA: RD1 (forwarded), 0 or PCE into SrcA, beside the ALU. Its
    # control takes the upper line, so ALUSrcB's, below it, crosses nothing
    # on the way down.
    add_o.append(('muxA', shape([(2300, 860.5), (2365, 906.7), (2365, 983.3), (2300, 1029.5)])))
    add_o += [text('01', 2305, 911, 32), text('x0', 2305, 959, 32), text('11', 2305, 1006, 32)]
    W((2143.5, 946.5), (2155, 946.5), (2300, 946.5))
    W((2365, 946.5), (2384.6, 946.5))
    W((2280, 899.5), (2300, 899.5)); add_o.append(text('0', 2254, 913, 40))
    W((1837.5, 1525), (2205, 1525), (2205, 994.5), (2300, 994.5)); add_o.append(text('PCE', 1985, 1513))
    W((1451, 573.5), (2332.5, 573.5), (2332.5, 883.6), ctrl=True)
    W((1451, 612), (2230, 612), (2230, 1062), (2333, 1062), (2333, 1111.6), ctrl=True)
    add_o += [text('ALUSrcBD', 1464.7, 606, ctrl=True), text('ALUSrcBE', 2042.4, 606, ctrl=True)]
    # jalr: the forwarded RD1 is the target adder's base.
    W((2155, 946.5), (2155, 1740), (72, 1740), (72, 992), (169.5, 992)); add_o.append(text('RD1FwdE', 560, 1729))
    # PC base mux: PCF, PCE or RD1FwdE.
    add_o.append(('muxPC', shape([(169.5, 905), (234.5, 951.2), (234.5, 1027.8), (169.5, 1074)])))
    add_o += [('lblPC01', text('01', 176, 956, 32)), ('lblPC11', text('11', 176, 1003, 32)), ('lblPC00', text('00', 176, 1051, 32))]
    W((101.5, 944), (169.5, 944))
    W((102.5, 944), (102.5, 1558))
    add_w.append(['sel', (209.5, 933.4), (209.5, 636.5), CTRL_W])
    # ALUSrcB: RD2 (forwarded), 4 or ExtImmE.
    add_o += [text('x0', 2305, 1144, 32), text('01', 2305, 1191, 32), text('11', 2305, 1238, 32)]
    W((2281, 1175.5), (2300.5, 1175.5)); add_o.append(text('4', 2257, 1191, 40))
    # Which bits of PCSrcE each mux takes.
    add_o += [('idx0', text('[0]', 166, 715, 30, ctrl=True)), ('idx10', text('[1:0]', 145, 896, 30, ctrl=True))]
    wires += add_w
    others += [t if isinstance(t, tuple) else ('x%d' % k, t) for k, t in enumerate(add_o)]
    return wires, others, 3320 + SHIFT


# The PC register and what hangs off it move right to make room for the
# Mispredict mux in front of it.
PC_GROUP = {1, 49, 278, 250, 31, 32, 33, 282}
PC_DX = 40


def build_bp():
    wires, others, width = build_full()
    GONE_W = {126, 127, 206, 117, 105, 'sel'}
    GONE_O = {'muxPC', 'lblPC01', 'lblPC11', 'lblPC00', 'idx10', 129, 213}
    wires = [w for w in wires if w[0] not in GONE_W]
    others = [(k, t) for k, t in others if k not in GONE_O]
    for w in wires:
        if w[0] in (264, 32):   # StallF and the PC's clock line
            w[1] = (w[1][0] + PC_DX, w[1][1]); w[2] = (w[2][0] + PC_DX, w[2][1])
        if w[0] == 2:
            w[1] = (w[1][0] + PC_DX, w[1][1])
    others = [(k, shift_tag(t, PC_DX) if k in PC_GROUP else t) for k, t in others]
    # PCF's label, between the PC and the PCSrcE line down to the predictor.
    others = [(k, re.sub(r'font-size="\d+"', 'font-size="32"', shift_tag(t, 32)) if k == 182 else t) for k, t in others]
    # The hazard unit's PCSrcE input becomes Mispredict.
    others = [(k, t.replace('>PCSrcE<', '>Mispredict<') if k == 306 else t) for k, t in others]

    add_w, add_o = [], []

    def W(*pts, ctrl=False):
        for k in range(len(pts) - 1):
            add_w.append(['b', pts[k], pts[k + 1], CTRL_W if ctrl else WIRE_W])
    # The next-PC adder's base: PCE, or RD1FwdE for jalr. Its output is PCNextE.
    # Where the full drawing's three-input mux is, at the same size, with its
    # inputs where every other 2:1 mux has them.
    MOVE = {(101.5, 944): (101.5, 957), (169.5, 944): (169.5, 957), (102.5, 944): (102.5, 957),
            (72, 992): (72, 1030), (169.5, 992): (169.5, 1030)}
    for w in wires:
        if w[0] == 'x':
            w[1] = MOVE.get(w[1], w[1]); w[2] = MOVE.get(w[2], w[2])
    add_o.append(('muxPC', shape([(169.5, 905), (234.5, 951.2), (234.5, 1027.8), (169.5, 1074)])))
    add_o += [text('0', 178.9, 971.5), text('1', 178.9, 1044.5)]
    W((234.5, 998.5), (264.8, 998.5))
    W((209.5, 933.4), (209.5, 636.5), ctrl=True)
    # Mispredict picks the PC: PCNextE to recover, else the prediction.
    add_o.append(('muxM', shape([(398, 865), (433, 885), (433, 960), (398, 980)])))
    add_o += [text('1', 403, 912, 28), text('0', 403, 956, 28)]
    W((339.5, 901.5), (362, 901.5), (398, 901.5))
    W((433, 922.5), (462, 922.5))
    W((362, 901.5), (362, 1455), (640, 1455), (640, 1435))
    add_o.append(rtext('PCNextE', 352, 1210, 32))
    W((575, 1305), (380, 1305), (380, 945), (398, 945))
    add_o.append(text('PredPCF', 387, 1297, 28))
    W((575, 1250), (415.5, 1250), (415.5, 970), ctrl=True)
    add_o.append(rtext('Mispredict', 444, 1238, 28, ctrl=True))
    # The predictor: PCF to predict, PCE, PCNextE and PCSrcE to check.
    add_o.append(('bp', rounded(575, 1215, 890, 1435, 14)))
    add_o += [text('Branch', 712, 1318, 34, ctrl=True, bold=True), text('Predictor', 712, 1358, 34, ctrl=True, bold=True),
              text('(BHT)', 760, 1395, 28, ctrl=True)]
    W((554.5, 1390), (575, 1390))
    add_o.append(text('PCF', 585, 1400, 28))
    W((605, 57.5), (605, 1195), (800, 1195), (800, 1215), ctrl=True)
    add_o.append(text('PCSrcE', 760, 1247, 28, ctrl=True))
    W((760, 1551.5), (760, 1435))
    add_o += [text('PCE', 743, 1427, 28), text('PCNextE', 600, 1427, 28)]
    add_o += [text('Mispredict', 585, 1260, 28), text('PredPCF', 585, 1313, 28)]
    add_o.append(('idx1', text('[1]', 217, 915, 30, ctrl=True)))
    wires += add_w
    others += [t if isinstance(t, tuple) else ('b%d' % k, t) for k, t in enumerate(add_o)]
    return wires, others, width



# ---------------------------------------------------------------- inside
# BranchPred.svg: the fetch side of the bp drawing, with the Branch Predictor
# block opened. Decode's interior is dropped and the stage closed up by
# IN_DX; E is cut to D's height, PC Logic sits beside it, and the empty band
# above is cropped off (IN_TOP). The block stays in Fetch, under the
# instruction memory as in the bp drawing: D and everything after it move
# right by IN_SHIFT (everything at or right of IN_SPLIT); the block comes down
# by IN_BOX_DY to clear the memory, and the lanes, the registers' feet and the
# hazard unit by IN_DROP (everything at or below IN_FLOOR) to pass under it.
IN_DX, IN_X, IN_TOP = 550, 1100, 540
IN_BX0, IN_BW, IN_SPLIT = 575, 1380, 880
IN_DROP, IN_FLOOR, IN_BOX_DY = 260, 1480, 230
IN_SHIFT = IN_BX0 + IN_BW + 40 - 911
KEEP_O = {0, 1, 16, 17, 18, 31, 33, 40, 41, 42, 43, 44, 47, 48, 49, 51, 61, 62, 73, 180, 181, 182, 211, 212, 222,
          223, 247, 248, 249, 250, 251, 265, 266, 268, 278, 279, 280, 281, 'muxPC', 'b1', 'b2', 'muxM', 'b4',
          'b5', 'b6', 'b8', 'idx0', 'idx1'}
KEEP_W = {2, 3, 19, 20, 21, 32, 106, 107, 201, 207, 208, 209, 118, 28, 85, 226, 267}
HALF_DX = {211, 212, 222}       # bus labels that keep to the closed-up gap's middle
E_TOP, HZ_DY = 761, 0           # E's new top; the hazard unit's drop


def ins_x(x):
    return x - IN_DX if x >= IN_X else x


def fin(p):
    """A closed-up point's place once Decode on moves right of the block."""
    return (p[0] + IN_SHIFT, p[1]) if p[0] >= IN_SPLIT else p


def x_min(t):
    if t.startswith('<text'):
        return text_pos(t)[0]
    if t.startswith('<rect'):
        return float(re.search(r' x="([^"]*)"', t).group(1)) + OX
    return min(p[0] for p in abs_pts(t))


def drop_tag(t):
    """Drop an element below IN_FLOOR by IN_DROP; a rect reaching past it grows."""
    if t.startswith('<text'):
        top = bot = text_pos(t)[1]
    elif t.startswith('<rect'):
        top = float(re.search(r' y="([^"]*)"', t).group(1)) + OY
        h = float(re.search(r' height="([^"]*)"', t).group(1))
        if top < IN_FLOOR <= top + h:
            return re.sub(r' height="[^"]*"', ' height="%g"' % (h + IN_DROP), t)
        bot = top + h
    else:
        ys = [p[1] for p in abs_pts(t)]
        top, bot = min(ys), max(ys)
        assert not top < IN_FLOOR <= bot, t
    return '<g transform="translate(0 %g)">%s</g>' % (IN_DROP, t) if top >= IN_FLOOR else t


def drop_pt(p):
    return (p[0], p[1] + IN_DROP) if p[1] >= IN_FLOOR else p


def move(t, dx, dy):
    """Move a text, rect or untransformed path by (dx, dy)."""
    if 'transform="matrix(' in t:
        m = re.search(r'matrix\(([^)]*)\)', t)
        v = [float(x) for x in m.group(1).split()]
        v[4] += dx; v[5] += dy
        return t.replace(m.group(0), 'matrix(%s)' % ' '.join('%g' % x for x in v))
    if t.startswith('<rect'):
        t = re.sub(r' x="([^"]*)"', lambda m: ' x="%g"' % (float(m.group(1)) + dx), t)
        return re.sub(r' y="([^"]*)"', lambda m: ' y="%g"' % (float(m.group(1)) + dy), t)
    d = re.search(r' d="([^"]*)"', t).group(1)
    out, k = [], 0
    for tok in re.split(r'(-?\d+\.?\d*(?:e-?\d+)?)', d):
        if re.fullmatch(r'-?\d+\.?\d*(?:e-?\d+)?', tok):
            out.append('%g' % (float(tok) + (dx if k % 2 == 0 else dy))); k += 1
        else:
            out.append(tok)
    return t.replace('d="%s"' % d, 'd="%s"' % ''.join(out))


def gate(kind, x, y, attrs=WIRE_W):
    """A gate facing right, back edge at x, inputs at y -/+ 18."""
    X, Y = x - OX, y - OY
    if kind == 'and':
        d = 'M%g %gL%g %gA40 40 0 0 1 %g %gL%g %gZ' % (X, Y - 40, X + 34, Y - 40, X + 34, Y + 40, X, Y + 40)
        return '<path d="%s"%s/>' % (d, attrs)
    d = 'M%g %gQ%g %g %g %gQ%g %g %g %gQ%g %g %g %gZ' % (
        X, Y - 40, X + 50, Y - 40, X + 74, Y, X + 50, Y + 40, X, Y + 40, X + 17, Y, X, Y - 40)
    out = '<path d="%s"%s/>' % (d, attrs)
    if kind == 'xor':
        out += '<path d="M%g %gQ%g %g %g %g"%s/>' % (X - 12, Y - 40, X + 5, Y, X - 12, Y + 40, attrs)
    return out


def build_inside():
    wires, others, _ = build_bp()
    src_o = dict(others)
    keep = []
    for k, t in others:
        if k not in KEEP_O:
            continue
        dx = IN_DX // 2 if k in HALF_DX else IN_DX
        if t.startswith('<text'):
            moved = text_pos(t)[0] >= IN_X
        elif t.startswith('<rect'):
            moved = float(re.search(r' x="([^"]*)"', t).group(1)) + OX >= IN_X
        else:
            moved = min(p[0] for p in abs_pts(t)) >= IN_X
        keep.append((k, shift_tag(t, -dx) if moved else t))
    # E, cut to D's height; its clock and letter come down with its top.
    e_dy = E_TOP - 123
    keep.append((224, re.sub(r' height="[^"]*"', ' height="%g"' % (1512 - E_TOP),
                             re.sub(r' y="[^"]*"', ' y="%g"' % (E_TOP - OY), shift_tag(src_o[224], -IN_DX)))))
    keep += [(k, move(shift_tag(src_o[k], -IN_DX), 0, e_dy)) for k in (252, 269)]
    keep.append((271, move(shift_tag(src_o[271], -IN_DX), 0, e_dy - 16)))
    # PC Logic, beside E: PCSE leaves E at y 800, and PCSrcE runs back to
    # Fetch above the registers at y 600.
    PL_X, PL_Y, PCS_Y, TOP_Y = 1940 - IN_DX, 715, 800, 600
    keep += [(k, move(src_o[k], PL_X - 2435, PL_Y - 86)) for k in (80, 81, 82)]
    keep.append((88, move(src_o[88], 1065 - 1463.8, PCS_Y - 170.5)))      # PCSD, where its wire starts
    keep.append((92, move(src_o[92], 0, TOP_Y - 57.5)))
    keep.append((228, move(src_o[228], 0, 790 - 702)))      # below the line it now meets
    # The hazard unit's labels drop with it.
    keep += [(k, move(shift_tag(src_o[k], -IN_DX) if k == 285 else src_o[k], 0, HZ_DY)) for k in (282, 283, 284, 285)]

    ws = []
    for key, a, b, attrs in wires:
        if key in KEEP_W:
            ws.append([key, (ins_x(a[0]), a[1]), (ins_x(b[0]), b[1]), attrs])
        if key in (261, 262, 263, 264):       # stalls and flushes, from the lowered hazard unit
            ws.append([key, (ins_x(a[0]), a[1] + HZ_DY), (ins_x(b[0]), b[1]), attrs])
        if key == 270:                        # E's clock
            ws.append([key, (ins_x(a[0]), a[1] + e_dy), (ins_x(b[0]), b[1] + e_dy), attrs])
    for w in ws:
        if w[0] == 118: w[1] = (1868.5 - IN_DX, 1348)                   # ExtImmE from E only
        if w[0] == 85: w[1] = (158.5, TOP_Y - 3)
    STAY = [((101.5, 957), (169.5, 957)), ((102.5, 957), (102.5, 1558)), ((72, 1030), (169.5, 1030)),
            ((234.5, 998.5), (264.8, 998.5)), ((209.5, 933.4), (209.5, 636.5)), ((339.5, 901.5), (362, 901.5)),
            ((362, 901.5), (398, 901.5)), ((433, 922.5), (462, 922.5))]
    for key, a, b, attrs in wires:
        if key in ('x', 'b') and any(abs(a[0] - p[0]) + abs(a[1] - p[1]) + abs(b[0] - q[0]) + abs(b[1] - q[1]) < 1 for p, q in STAY):
            ws.append([key + 's%d' % len(ws), a, b, attrs])
    n = [0]

    def W(*pts, ctrl=False):
        n[0] += 1
        for k in range(len(pts) - 1):
            ws.append(['n%d' % n[0], pts[k], pts[k + 1], CTRL_W if ctrl else WIRE_W])
    add = []

    def T(*a, **kw):
        add.append(text(*a, **kw))

    def R(*a, **kw):
        add.append(rtext(*a, **kw))
    PL_R = PL_X + 128
    W((1051.5, PCS_Y), (PL_X, PCS_Y), ctrl=True)
    T('PCSE', PL_X - 107, PCS_Y - 6, ctrl=True)
    W((PL_R, PCS_Y), (PL_R + 27, PCS_Y), (PL_R + 27, TOP_Y), (156.5, TOP_Y), ctrl=True)
    W((PL_X + 102.5, PL_Y + 197), (PL_X + 102.5, 1080))
    R('ALUFlags', PL_X + 135, 1080)
    # RD1FwdE comes from Execute's forwarding mux, off this drawing.
    W((1900 - IN_DX, 1650), (72, 1650), (72, 1030))
    T('RD1FwdE', 1000, 1639)
    for w in ws:
        w[1], w[2] = fin(w[1]), fin(w[2])
    keep = [(k, shift_tag(t, IN_SHIFT) if x_min(t) >= IN_SPLIT else t) for k, t in keep]
    add = [shift_tag(t, IN_SHIFT) if x_min(t) >= IN_SPLIT else t for t in add]
    HZ_R = fin((PL_R + 27, 0))[0] + 40
    for w in ws:
        w[1], w[2] = drop_pt(w[1]), drop_pt(w[2])
    keep = [(k, drop_tag(t)) for k, t in keep]
    add = [drop_tag(t) for t in add]
    ws0, add0 = len(ws), len(add)

    BX0, BY0, BY1 = IN_BX0, 970, 1466
    BX1 = BX0 + IN_BW

    def u(x):
        return BX0 + x
    add.append(rounded(BX0, BY0, BX1, BY1, 14))
    T('Branch Predictor', u(25), BY0 + 40, 34, ctrl=True, bold=True)
    # Fetch's lanes: the prediction out, PCNextE in, Mispredict out.
    T('PredPCF', 600, 1689); T('PCNextE', 600, 1739); T('Mispredict', 600, 1789, ctrl=True)

    # The BHT: read at PCF for Fetch and at PCE for Execute's check; each
    # column written at PCE when its half of the check fails.
    BT, BB, BL, BR = 1052, 1258, u(310), u(850)
    add.append('<rect x="%g" y="%g" width="%g" height="%g" stroke="#000000" stroke-width="8.02083" stroke-miterlimit="8" fill="none"/>' % (BL - OX, BT - OY, BR - BL, BB - BT))
    W((u(460), BT - 41), (u(460), BT))
    add.append(shape([(u(478.5), BT + 1), (u(460), BT + 25), (u(441.5), BT + 1)], attrs=' stroke="#000000" stroke-width="3.4375" stroke-miterlimit="8" fill="#FFFFFF"'))
    T('CLK', u(428), BT - 48)
    T('BHT', u(330), 1236, 46, bold=True)
    tx0, tx1, ty0, cx = u(540), u(830), 1067, u(685)
    add.append('<rect x="%g" y="%g" width="%g" height="%g" stroke="#000000" stroke-width="3.4375" fill="none"/>' % (tx0 - OX, ty0 - OY, tx1 - tx0, BB - ty0))
    T('PrBTA', tx0 + 30, ty0 + 30, 28); T('PrPCSrc', cx + 20, ty0 + 30, 28)
    add.append(shape([(cx, ty0), (cx, BB)], False, ' stroke="#000000" stroke-width="3" fill="none"'))
    for y in range(ty0 + 38, BB - 40, 36):
        add.append(shape([(tx0, y), (tx1, y)], False, ' stroke="#000000" stroke-width="3" fill="none"'))
    W((u(30), 1551.5), (u(30), 1100), (BL, 1100))
    R('PCE[k+1:2]', u(68), 1450, 32)
    T('RA/WA', u(320), 1110, 28)
    W((u(85), 1496.5), (u(85), 1160), (BL, 1160))
    R('PCF[k+1:2]', u(123), 1450, 32)
    T('RA', u(320), 1170, 28)

    # Fetch's prediction: PCF + 4, or the predicted target.
    BW = BLOCK_W.replace('#0070C0', '#000000')
    AT = 1195
    add.append(shape([(u(190), AT), (u(271), AT + 38.4), (u(271), AT + 201.6), (u(190), AT + 240)], attrs=BW))
    add.append(shape([(u(190), AT + 98), (u(220), AT + 120), (u(190), AT + 142)], attrs=BW))
    add.append(shape([(u(178), AT + 98), (u(208), AT + 120), (u(178), AT + 142)], attrs=' stroke="#FFFFFF" stroke-width="8.02083" stroke-miterlimit="8" fill="#FFFFFF"'))
    T('+', u(228), AT + 132, 46, bold=True)
    W((u(85), AT + 50), (u(190), AT + 50))
    W((u(165), AT + 190), (u(190), AT + 190)); T('4', u(140), AT + 204, 40, bold=True)
    MT = 1340
    add.append(shape([(u(335), MT), (u(370), MT + 20), (u(370), MT + 95), (u(335), MT + 115)]))
    T('1', u(340), MT + 47, 28); T('0', u(340), MT + 91, 28)
    W((u(271), AT + 120), (u(290), AT + 120), (u(290), MT + 80), (u(335), MT + 80))
    # Every port of a column leaves or enters at its foot: Fetch's read (RD),
    # and the write data and enable.
    W((u(565), BB), (u(565), 1295), (u(312), 1295), (u(312), MT + 36.5), (u(335), MT + 36.5))
    T('PrBTAF', u(400), 1288, 24)
    W((u(715), BB), (u(715), 1330), (u(352.5), 1330), (u(352.5), MT + 10), ctrl=True)
    T('PrPCSrcF', u(400), 1323, 24, ctrl=True)
    W((u(370), MT + 57.5), (u(390), MT + 57.5), (u(390), 1700), (380, 1700), (380, 945), (398, 945))

    # Execute's check. PCSrcE is two bits; either set means E redirects.
    G = 1035
    W((u(910), TOP_Y), (u(910), G + 18), (u(972), G + 18), ctrl=True)
    W((u(910), G - 18), (u(972), G - 18), ctrl=True)
    T('PCSrcE', u(920), 650, ctrl=True)
    T('[1]', u(918), G - 27, 30, ctrl=True); T('[0]', u(918), G + 53, 30, ctrl=True)
    add.append(gate('or', u(965), G))
    XY, CY = 1114, 1213                       # the XOR's and the comparator's centres
    W((u(1039), G), (u(1055), G), (u(1055), 1360), (u(805), 1360), (u(805), BB), ctrl=True)
    W((u(1055), XY - 18), (u(1074), XY - 18), ctrl=True)
    W((u(1055), CY + 36), (u(1080), CY + 36), ctrl=True)
    T('TakenE', u(815), 1353, 26, ctrl=True)
    W((BR, XY + 18), (u(1074), XY + 18), ctrl=True)
    T('PrPCSrcE', u(860), XY + 10, 28, ctrl=True)
    add.append(gate('xor', u(1080), XY))
    W((BR, CY - 18), (u(960), CY - 18))
    T('PrBTAE', u(858), CY - 26, 26)
    W((362, 901.5), (362, 1750), (u(615), 1750), (u(615), BB))
    W((u(615), 1452), (u(930), 1452), (u(930), CY + 18), (u(960), CY + 18))
    add.append(shape([(u(960), CY - 44), (u(1030), CY), (u(960), CY + 44)]))
    T('≠', u(970), CY + 13, 38, bold=True)
    W((u(1030), CY), (u(1080), CY))
    add.append(gate('and', u(1080), CY + 18))
    OY_ = (XY + CY + 18) // 2                 # the final OR's centre
    W((u(1154), XY), (u(1200), XY), (u(1200), OY_ - 18), (u(1247), OY_ - 18), ctrl=True)
    W((u(1154), CY + 18), (u(1220), CY + 18), (u(1220), OY_ + 18), (u(1247), OY_ + 18), ctrl=True)
    add.append(gate('or', u(1240), OY_))
    W((u(1180), XY), (u(1180), 1393), (u(760), 1393), (u(760), BB), ctrl=True)
    T('Branch Mispredicted', u(945), 1386, 22, ctrl=True)
    W((u(1200), CY + 18), (u(1200), 1426), (u(660), 1426), (u(660), BB), ctrl=True)
    T('BTA Mispredicted', u(945), 1419, 22, ctrl=True)
    # Each column's ports, under it.
    for x, s in ((565, 'RD'), (615, 'WD'), (660, 'WE'), (715, 'RD'), (760, 'WE'), (805, 'WD')):
        T(s, u(x) - 16, BB - 13, 24)
    W((u(1314), OY_), (u(1350), OY_), (u(1350), 1800), (415.5, 1800), (415.5, 970), ctrl=True)
    W((u(1350), 1800), (u(1350), 1949 + HZ_DY), ctrl=True)
    R('Mispredict', u(1342), 1440, 37, ctrl=True)

    keep.append((243, move(shift_tag(src_o[243], (136 + HZ_R) / 2 - (136 + 3381) / 2), 0, HZ_DY + IN_DROP)))
    # The block and its lanes were laid out a drop higher: all of it comes
    # down, but not where it meets Fetch's muxes.
    for w in ws[ws0:]:
        for i in (1, 2):
            x, y = w[i]
            if y >= IN_FLOOR:
                w[i] = (x, y + IN_DROP)
            elif x >= BX0 and y >= BY0:
                w[i] = (x, y + IN_BOX_DY)
    add[add0:] = [drop_tag(t) if t.startswith('<text') and text_pos(t)[1] >= IN_FLOOR else
                  '<g transform="translate(0 %g)">%s</g>' % (IN_BOX_DY, t) for t in add[add0:]]
    add.append(rounded(136, 1949 + HZ_DY + IN_DROP, HZ_R, 2036 + HZ_DY + IN_DROP, 14.5))
    keep += [('in%d' % i, t) for i, t in enumerate(add)]
    return ws, keep, HZ_R + 40

REGS_LEC = {'D': (911, 965, 761, 1510), 'E': (1768, 1823, 123, 1512), 'M': (2488, 2542, 268, 1512), 'W': (3027, 3081, 267, 1510)}
REGS = {k: (sx(a), sx(b) if a >= SHIFT_X else b, c, d) for k, (a, b, c, d) in REGS_LEC.items()}


def on_seg(pt, a, b, tol=5, margin=3):
    (x, y), (x1, y1), (x2, y2) = pt, a, b
    if abs(y1 - y2) < 3 and abs(y - (y1 + y2) / 2) < tol and min(x1, x2) + margin < x < max(x1, x2) - margin:
        return (x, (y1 + y2) / 2)
    if abs(x1 - x2) < 3 and abs(x - (x1 + x2) / 2) < tol and min(y1, y2) + margin < y < max(y1, y2) - margin:
        return ((x1 + x2) / 2, y)
    return None


def register_cuts(a, b):
    cuts = []
    if abs(a[1] - b[1]) < 3:
        for (x0, x1, y0, y1) in REGS.values():
            if y0 < a[1] < y1:
                for x in (x0, x1):
                    q = on_seg((x, a[1]), a, b, tol=2, margin=1)
                    if q: cuts.append(q)
    return cuts


def inside_register(p, q):
    return abs(p[1] - q[1]) < 3 and any(y0 < p[1] < y1 and abs(min(p[0], q[0]) - x0) < 1.5 and abs(max(p[0], q[0]) - x1) < 1.5
                                        for (x0, x1, y0, y1) in REGS.values())


def split(wires):
    ends = [p for w in wires for p in (w[1], w[2])]
    pieces, cnt = [], {}
    for key, a, b, attrs in wires:
        cuts = [q for p in ends for q in [on_seg(p, a, b)] if q] + register_cuts(a, b)
        cs = sorted(set((round(x, 1), round(y, 1)) for x, y in cuts), key=lambda q: abs(q[0] - a[0]) + abs(q[1] - a[1]))
        chain = [a] + cs + [b]
        for m in range(len(chain) - 1):
            n = cnt.get(key, 0); cnt[key] = n + 1
            p, q = chain[m], chain[m + 1]
            # A wire's run across a stage register is the register itself.
            if inside_register(p, q):
                continue
            pieces.append({'id': '%s.%d' % (key, n), 'p': p, 'q': q, 'attrs': attrs})
    return pieces


def svg_body(pieces, others):
    out = [re.sub(r'^<(path|rect|text)', lambda m: '<%s data-e="%s"' % (m.group(1), key), t) for key, t in others]
    for pc in pieces:
        (x1, y1), (x2, y2) = pc['p'], pc['q']
        out.append('<path data-e="%s" d="M%g %g %g %g"%s/>' % (pc['id'], round(x1 - OX, 2), round(y1 - OY, 2), round(x2 - OX, 2), round(y2 - OY, 2), pc['attrs']))
    return ''.join(out)


# ---------------------------------------------------------------- routes
# Waypoints from a value's source to where it is used, in the lecture's
# coordinates; the drawings map them through sx() and override the ones
# their own hardware changes.
RW = [(3253.5, 1360.5), (3299.5, 1360.5), (3299.5, 1650.5)]      # ResultW down to its bus
ROUTES = {
    # Fetch
    'f_pc':       [(501.5, 903.5), (622, 903.5)],
    'f_pcf_mux':  [(501.5, 903.5), (554.5, 903.5), (554.5, 1151.5), (138.5, 1151.5), (138.5, 1039.5), (170.6, 1039.5)],
    'f_pcf_d':    [(501.5, 903.5), (554.5, 903.5), (554.5, 1496.5), (911, 1496.5)],
    'f_four':     [(56.5, 762.5), (123.6, 762.5)],
    'f_addA':     [(187.5, 797.5), (265.5, 797.5)],
    'f_addB':     [(232.5, 998.5), (264.8, 998.5)],
    'f_pcin':     [(339.5, 901.5), (426.5, 901.5)],
    'f_instr':    [(853.5, 944.5), (911, 944.5)],
    # Decode
    'd_funct3':   [(965, 944.5), (1026, 944.5), (1026, 238.5), (1219.7, 238.5)],
    'd_op':       [(965, 944.5), (1026, 944.5), (1026, 379.5), (1219.9, 379.5)],
    'd_funct7':   [(965, 944.5), (1026, 944.5), (1026, 511.5), (1219.9, 511.5)],
    'd_rs1':      [(965, 944.5), (1026, 944.5), (1026, 905.5), (1209.5, 905.5)],
    'd_rs2':      [(965, 944.5), (1026, 944.5), (1026, 1020.5), (1205, 1020.5)],
    'd_rd':       [(965, 944.5), (1026, 944.5), (1026, 1143.5), (1081.5, 1143.5), (1081.5, 1447.5), (1768, 1447.5)],
    'd_imm':      [(965, 944.5), (1026, 944.5), (1026, 1350.5), (1352, 1350.5)],
    'd_immsrc':   [(1445.5, 656.5), (1445.5, 651.6), (1596.5, 651.6), (1596.5, 1268.5), (1465.5, 1268.5), (1465.5, 1306.4)],
    'd_ext':      [(1561.5, 1350.5), (1768, 1350.5)],
    'd_rd1':      [(1569.5, 946.5), (1648, 946.5)],
    'd_rd2':      [(1569.5, 1128.5), (1648, 1128.5)],
    'd_rd1_e':    [(1713.5, 992.5), (1743.5, 992.5), (1743.5, 899.5), (1768, 899.5)],
    'd_rd2_e':    [(1712.5, 1175.5), (1746.5, 1175.5), (1746.5, 1080.5), (1768, 1080.5)],
    'd_pcd':      [(965, 1496.5), (1768, 1496.5)],
    'd_pcs':      [(1451, 170.5), (1768, 170.5)],
    'd_regwrite': [(1451, 311.5), (1768, 311.5)],
    'd_memtoreg': [(1451, 372.5), (1768, 372.5)],
    'd_memwrite': [(1451, 435.5), (1768, 435.5)],
    'd_aluctl':   [(1454.5, 506.5), (1768, 506.5)],
    'd_alusrcb':  [(1454.5, 573.5), (1768, 573.5)],
    # Execute
    'e_rd1':      [(1823, 899.5), (2077.9, 899.5)],
    'e_rd2':      [(1823, 1080.5), (1994.4, 1080.5)],
    'e_srca':     [(2143.5, 946.5), (2244.6, 946.5)],
    'e_fwdb':     [(2056.5, 1128.5), (2145.2, 1128.5)],
    'e_wd':       [(2056.5, 1128.5), (2078.5, 1128.5), (2078.5, 1278.5), (2488, 1278.5)],
    'e_ext':      [(1823, 1350.5), (1868.5, 1350.5), (1868.5, 1223.5), (2145, 1223.5)],
    'e_ext_pc':   [(1823, 1350.5), (1868.5, 1350.5), (1868.5, 1600.5), (42.5, 1600.5), (42.5, 835.5), (123.9, 835.5)],
    'e_pce':      [(1823, 1496.5), (1837.5, 1496.5), (1837.5, 1551.5), (102.5, 1551.5), (102.5, 964.5), (168.6, 964.5)],
    'e_srcb':     [(2202.5, 1175.5), (2252.6, 1175.5)],
    'e_alu':      [(2369.5, 1024.5), (2488, 1024.5)],
    'e_flags':    [(2368.5, 936.5), (2397.5, 936.5), (2397.5, 279.5)],
    'e_rd':       [(1823, 1447.5), (2488, 1447.5)],
    'e_pcs':      [(1823, 170.5), (2293, 170.5)],
    'e_regwrite': [(1823, 311.5), (2488, 311.5)],
    'e_memtoreg': [(1823, 372.5), (2488, 372.5)],
    'e_memwrite': [(1823, 435.5), (2488, 435.5)],
    'e_aluctl':   [(1823, 506.5), (2312.5, 506.5), (2312.5, 881.6)],
    'e_alusrcb':  [(1823, 573.5), (2175.5, 573.5), (2175.5, 1119.7)],
    'e_pcsrc_top': [(2421.5, 170.5), (2470.5, 170.5), (2470.5, 57.5), (158.5, 57.5), (158.5, 733.8)],
    'e_pcsrc_low': [(2421.5, 170.5), (2470.5, 170.5), (2470.5, 57.5), (158.5, 57.5), (158.5, 638.5), (209.5, 638.5), (209.5, 941.7)],
    # Memory
    'm_addr':     [(2542, 1024.5), (2736.4, 1024.5)],
    'm_alu_w':    [(2542, 1024.5), (2575.5, 1024.5), (2575.5, 1408.5), (3027, 1408.5)],
    'm_fwd_ae':   [(2542, 1024.5), (2575.5, 1024.5), (2575.5, 1560.5), (1944.5, 1560.5), (1944.5, 994.5), (2078.8, 994.5)],
    'm_fwd_be':   [(2542, 1024.5), (2575.5, 1024.5), (2575.5, 1560.5), (1944.5, 1560.5), (1944.5, 1174.5), (1991.2, 1174.5)],
    'm_wd':       [(2542, 1278.5), (2644.2, 1278.5)],
    'm_dmwd':     [(2706.5, 1307.5), (2739.2, 1307.5)],
    'm_rdata':    [(2971.5, 1021.5), (3027, 1021.5)],
    'm_rd':       [(2542, 1447.5), (3027, 1447.5)],
    'm_regwrite': [(2542, 311.5), (3027, 311.5)],
    'm_memtoreg': [(2542, 372.5), (3027, 372.5)],
    'm_memwrite': [(2542, 435.5), (2858.5, 435.5), (2858.5, 961.2)],
    # Writeback
    'w_rdata':    [(3081, 1021.5), (3134.5, 1021.5), (3134.5, 1330.5), (3185.8, 1330.5)],
    'w_alu':      [(3081, 1408.5), (3189.1, 1408.5)],
    'w_memtoreg': [(3081, 372.5), (3222.5, 372.5), (3222.5, 1303)],
    'w_result':   RW,
    'w_rf':       RW + [(1164.5, 1650.5), (1164.5, 1199.5), (1213.1, 1199.5)],
    'w_fwd_1d':   RW + [(1613.5, 1650.5), (1613.5, 1040.5), (1649, 1040.5)],
    'w_fwd_2d':   RW + [(1613.5, 1650.5), (1613.5, 1222.5), (1647.5, 1222.5)],
    'w_fwd_ae':   RW + [(1905.5, 1650.5), (1905.5, 947.5), (2078.6, 947.5)],
    'w_fwd_be':   RW + [(1905.5, 1650.5), (1905.5, 1129.5), (1992.7, 1129.5)],
    'w_fwd_m':    RW + [(2607.5, 1650.5), (2607.5, 1341.5), (2646.7, 1341.5)],
    'w_rd':       [(3081, 1447.5), (3110.5, 1447.5), (3110.5, 1704.5), (1124.5, 1704.5), (1124.5, 1142.5), (1209.7, 1142.5)],
    'w_regwrite': [(3081, 311.5), (3224.5, 311.5), (3224.5, 4.5), (1156.5, 4.5), (1156.5, 730.5), (1428.5, 730.5), (1428.5, 831.7)],
    # Hazard unit outputs
    'h_stallf':   [(463.5, 1948.4), (463.5, 1013.5)],
    'h_stalld':   [(927.5, 1945.8), (927.5, 1522.5)],
    'h_flushd':   [(956.5, 1949.6), (956.5, 1513.5)],
    'h_flushe':   [(1797.5, 1947.6), (1797.5, 1511.5)],
    'h_fwd_1d':   [(1730.5, 1951.1), (1730.5, 1081.5), (1683.5, 1081.5), (1683.5, 1051.5)],
    'h_fwd_2d':   [(1678.5, 1950), (1678.5, 1233.5)],
    'h_fwd_ae':   [(2113.5, 1946.8), (2113.5, 1002.5)],
    'h_fwd_be':   [(2028.5, 1950.5), (2028.5, 1185.5)],
    'h_fwd_m':    [(2680.5, 1953.7), (2680.5, 1361.5)],
}
FULL_ROUTES = {         # already in the full drawing's coordinates
    'e_srca':     [(2143.5, 946.5), (2300, 946.5)],
    'e_srca_alu': [(2365, 946.5), (2384.6, 946.5)],
    'e_zero':     [(2280, 899.5), (2300, 899.5)],
    'e_pce_a':    [(1823, 1496.5), (1837.5, 1496.5), (1837.5, 1525), (2205, 1525), (2205, 994.5), (2300, 994.5)],
    'e_fwdb':     [(2056.5, 1128.5), (2304.2, 1128.5)],
    'e_ext':      [(1823, 1350.5), (1868.5, 1350.5), (1868.5, 1223.5), (2304, 1223.5)],
    'e_srcb':     [(2361.5, 1175.5), (2392.6, 1175.5)],
    'e_rd1_pc':   [(2143.5, 946.5), (2155, 946.5), (2155, 1740), (72, 1740), (72, 992), (169.5, 992)],
    'e_pce':      [(1823, 1496.5), (1837.5, 1496.5), (1837.5, 1551.5), (102.5, 1551.5), (102.5, 944), (169.5, 944)],
    'e_pcsrc_low': [(2561.5, 170.5), (2610.5, 170.5), (2610.5, 57.5), (158.5, 57.5), (158.5, 638.5), (209.5, 638.5), (209.5, 933.4)],
    'd_alusrca':  [(1454.5, 573.5), (1768, 573.5)],
    'd_alusrcb':  [(1451, 612), (1768, 612)],
    'e_alusrcb':  [(1823, 612), (2230, 612), (2230, 1062), (2333, 1062), (2333, 1111.6)],
    'e_alusrca':  [(1823, 573.5), (2332.5, 573.5), (2332.5, 883.6)],
    'e_four':     [(2281, 1175.5), (2300.5, 1175.5)],
}
X = PC_DX
BP_ROUTES = {
    'f_pc':       [(501.5 + X, 903.5), (622, 903.5)],
    'f_pcf_d':    [(501.5 + X, 903.5), (554.5, 903.5), (554.5, 1496.5), (911, 1496.5)],
    'f_pcin':     [(433, 922.5), (462, 922.5)],
    'f_addB':     [(234.5, 998.5), (264.8, 998.5)],
    'e_pcsrc_low': [(2561.5, 170.5), (2610.5, 170.5), (2610.5, 57.5), (158.5, 57.5), (158.5, 638.5), (209.5, 638.5), (209.5, 933.4)],
    'e_pce':      [(1823, 1496.5), (1837.5, 1496.5), (1837.5, 1551.5), (102.5, 1551.5), (102.5, 957), (169.5, 957)],
    'e_rd1_pc':   [(2143.5, 946.5), (2155, 946.5), (2155, 1740), (72, 1740), (72, 1030), (169.5, 1030)],
    'e_nextpc':   [(339.5, 901.5), (398, 901.5)],
    'e_nextpc_bp': [(339.5, 901.5), (362, 901.5), (362, 1455), (640, 1455), (640, 1435)],
    'bp_pred':    [(575, 1305), (380, 1305), (380, 945), (398, 945)],
    'bp_miss':    [(575, 1250), (415.5, 1250), (415.5, 970)],
    'bp_pcf':     [(501.5 + X, 903.5), (554.5, 903.5), (554.5, 1390), (575, 1390)],
    'bp_pcsrc':   [(2561.5, 170.5), (2610.5, 170.5), (2610.5, 57.5), (605, 57.5), (605, 1195), (800, 1195), (800, 1215)],
    'bp_pce':     [(1823, 1496.5), (1837.5, 1496.5), (1837.5, 1551.5), (760, 1551.5), (760, 1435)],
    'h_stallf':   [(463.5 + X, 1948.4), (463.5 + X, 1013.5)],
}
BP_DROP = {'f_pcf_mux'}

MUXES = {
    'pcTop':  (16, {'0': (124.5, 762.5), '1': (124.5, 835.5)}, (189.5, 797.5)),
    'fwd1D':  (149, {'0': (1648.5, 946.5), '1': (1648.5, 1040.5)}, (1713.5, 992.5)),
    'fwd2D':  (156, {'0': (1648.5, 1128.5), '1': (1648.5, 1222.5)}, (1713.5, 1175.5)),
    'fwdAE':  (139, {'00': (2076.5, 899.5), '01': (2076.5, 947.5), '10': (2076.5, 994.5)}, (2141.5, 946.5)),
    'fwdBE':  (143, {'00': (1992.5, 1080.5), '01': (1992.5, 1129.5), '10': (1992.5, 1174.5)}, (2057.5, 1128.5)),
    'fwdM':   (130, {'0': (2644.5, 1278.5), '1': (2644.5, 1341.5)}, (2708.5, 1307.5)),
    'result': (8, {'1': (3187.5, 1330.5), '0': (3187.5, 1408.5)}, (3252.5, 1360.5)),
}
FULL_MUXES = {
    'pcLow':  ('muxPC', {'00': (169.5, 1039.5), '01': (169.5, 944), '11': (169.5, 992)}, (234.5, 998.5)),
    'aluSrcA': ('muxA', {'01': (2300, 899.5), 'x0': (2300, 946.5), '11': (2300, 994.5)}, (2365, 946.5)),
    'aluSrcB': (119, {'x0': (2300.5, 1128.5), '01': (2300.5, 1175.5), '11': (2300.5, 1223.5)}, (2365.5, 1175.5)),
}
BP_MUXES = {
    'pcLow':  ('muxPC', {'0': (169.5, 957), '1': (169.5, 1030)}, (234.5, 998.5)),
    'pcM':    ('muxM', {'1': (398, 901.5), '0': (398, 945)}, (433, 922.5)),
}
BLOCKS = {'pc': 1, 'im': 0, 'rf': 4, 'decoder': 86, 'extend': 26, 'alu': 55, 'pcLogic': 82, 'dm': 7,
          'regD': 223, 'regE': 224, 'regM': 225, 'regW': 217, 'hazard': 242, 'adder': 41}


def on_poly(pt, poly, tol=4.5):
    for k in range(len(poly) - 1):
        (x1, y1), (x2, y2) = poly[k], poly[k + 1]
        if abs(y1 - y2) < 1 and abs(pt[1] - y1) < tol and min(x1, x2) - tol <= pt[0] <= max(x1, x2) + tol: return True
        if abs(x1 - x2) < 1 and abs(pt[0] - x1) < tol and min(y1, y2) - tol <= pt[1] <= max(y1, y2) + tol: return True
    return False


def cover(pieces, poly):
    ids = []
    for pc in pieces:
        mid = ((pc['p'][0] + pc['q'][0]) / 2, (pc['p'][1] + pc['q'][1]) / 2)
        if on_poly(pc['p'], poly) and on_poly(pc['q'], poly) and on_poly(mid, poly):
            ids.append(pc['id'])
    return ids


def tables(variant):
    wires, others, width = build_bp() if variant == 'bp' else build_full()
    pieces = split(wires)
    routes = {n: [(sx(x), y) for x, y in pts] for n, pts in ROUTES.items()}
    routes.update(FULL_ROUTES)
    muxes = {n: (e, {k: (sx(x), y) for k, (x, y) in ins.items()}, (sx(o[0]), o[1])) for n, (e, ins, o) in MUXES.items()}
    muxes.update(FULL_MUXES)
    blocks = dict(BLOCKS)
    if variant == 'bp':
        routes.update(BP_ROUTES)
        for n in BP_DROP: routes.pop(n)
        muxes.update(BP_MUXES)
        blocks['bp'] = 'bp'
    table = {}
    for name, pts in routes.items():
        segs = cover(pieces, pts)
        if not segs: print('EMPTY route', variant, name, file=sys.stderr)
        table[name] = {'segs': segs, 'pts': [[round(x, 1), round(y, 1)] for x, y in pts]}
    mx = {n: {'e': str(e), 'ins': ins, 'out': o} for n, (e, ins, o) in muxes.items()}
    return {'svg': svg_body(pieces, others), 'width': width, 'routes': table, 'muxes': mx,
            'blocks': {k: str(v) for k, v in blocks.items()}}


def drawing(variant):
    """The drawing for the slides: the original's structure and styles, each
    wire one polyline again, and no runs through the stage registers. Returns
    its width, height and the group holding it."""
    global REGS
    wires, others, width = {'bp': build_bp, 'full': build_full, 'inside': build_inside}[variant]()
    saved = REGS
    if variant == 'inside':
        REGS = {k: (fin((ins_x(a), 0))[0], fin((ins_x(b), 0))[0], E_TOP if k == 'E' else c, d + IN_DROP) for k, (a, b, c, d) in REGS.items() if k in 'DE'}
    segs = []
    for key, a, b, attrs in wires:
        chain = [a] + sorted(register_cuts(a, b), key=lambda q: abs(q[0] - a[0])) + [b]
        for m in range(len(chain) - 1):
            if not inside_register(chain[m], chain[m + 1]):
                segs.append([key, chain[m], chain[m + 1], attrs])
    polys = []
    for key, a, b, attrs in segs:
        last = polys[-1] if polys else None
        if last and last[0] == key and last[2] == attrs and abs(last[1][-1][0] - a[0]) < 0.5 and abs(last[1][-1][1] - a[1]) < 0.5:
            last[1].append(b)
        else:
            polys.append([key, [a, b], attrs])
    out = [t for _, t in others]
    for _, pts, attrs in polys:
        out.append('<path d="M%s"%s/>' % (' '.join('%g %g' % (round(x - OX, 2), round(y - OY, 2)) for x, y in pts), attrs))
    height, group = 2050, OPEN
    if variant == 'inside':
        height = 2036 + HZ_DY + IN_DROP + 20 - IN_TOP
        group = '<g transform="translate(%g %g)">' % (OX, OY - IN_TOP)
    REGS = saved
    return width, height, group + ''.join(out) + '</g>'


def export(variant, path):
    width, height, body = drawing(variant)
    head = re.sub(r'height="\d+"', 'height="%d"' % height,
                  re.sub(r'width="\d+"', 'width="%d"' % width, src[:src.index(OPEN)], count=1), count=1)
    open(path, 'w').write(head + body + '</svg>')
    print('exported', os.path.relpath(path, ROOT), file=sys.stderr)


SVG_IDS = {'full': ('dpPipeSvg', 'The 5-stage pipelined RISC-V datapath'),
           'bp': ('dpPipeBpSvg', 'The 5-stage pipelined RISC-V datapath with branch prediction')}


def embed(built):
    page = open(PAGE).read()
    for v, (id_, label) in SVG_IDS.items():
        el = ('<svg class="dp-svg dp-pipe-svg" id="%s" viewBox="0 -130 %d 2180" preserveAspectRatio="xMidYMid meet" '
              'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="%s"><g transform="translate(21 -429)">%s</g>'
              '<g class="dp-overlay"></g></svg>') % (id_, built[v]['width'], label, built[v]['svg'])
        start = page.find('<svg class="dp-svg dp-pipe-svg" id="%s"' % id_)
        if start < 0:
            anchor = page.index('<div class="dp-timeline" id="dpTimeline">')
            page = page[:anchor] + el + page[anchor:]
        else:
            end = page.index('</svg>', start) + 6
            page = page[:start] + el + page[end:]
    # The Branch Predictor's dialog shows BranchPred.svg.
    width, height, body = drawing('inside')
    fig = ('<svg role="img" aria-label="Inside the Branch Predictor" viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg" '
           'overflow="hidden"><rect width="100%%" height="100%%" fill="#FFFFFF"/>%s</svg>') % (width, height, body)
    page, n = re.subn(r'<!-- BP_FIGURE -->.*?<!-- /BP_FIGURE -->', lambda m: '<!-- BP_FIGURE -->' + fig + '<!-- /BP_FIGURE -->',
                      page, flags=re.S)
    assert n == 1, 'BP_FIGURE markers not found'
    data = {v: {k: built[v][k] for k in ('width', 'routes', 'muxes', 'blocks')} for v in built}
    a = page.index('    const PDP_DRAW = ')
    b = page.index('\n', a)
    page = page[:a] + '    const PDP_DRAW = ' + json.dumps(data, separators=(',', ':')) + ';' + page[b:]
    open(PAGE, 'w').write(page)
    print('embedded', ', '.join(built), file=sys.stderr)


if __name__ == '__main__':
    built = {v: tables(v) for v in ('full', 'bp')}
    for v, t in built.items():
        print(v, len(t['routes']), 'routes', file=sys.stderr)
    if '--embed' in sys.argv:
        embed(built)
    if '--export' in sys.argv:
        export('full', os.path.join(ROOT, 'Microarch_pipelined_full.svg'))
        export('bp', os.path.join(ROOT, 'Microarch_pipelined_bp.svg'))
        export('inside', os.path.join(ROOT, 'BranchPred.svg'))
    if '--dump' in sys.argv:
        json.dump(built, open(sys.argv[sys.argv.index('--dump') + 1], 'w'))
