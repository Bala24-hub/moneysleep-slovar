"""Подготовка картинок кухни для приложения (запускается вручную, в приложение не входит).

  python3 tools/prepare_scenes.py

Берёт оригиналы из assets/scenes/ и пишет в assets/scenes/app/:
  kitchen.jpg, kitchen_table.jpg      — сцены с залитыми белыми углами
  kitchen_table_empty.jpg             — стол без предметов (скатерть + дерево дорисованы)
  kitchen_table_<item>.png            — предметы стола отдельными слоями (cup — оригинал художника)
и обновляет зоны нажатия (полигоны) и слои в content/rooms/kitchen.json.
Нужны: opencv-python-headless, numpy.
"""
import json
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
OUT = 'assets/scenes/app'
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- сегментация
SCENES = {
    'kitchen': ('assets/scenes/kitchen.png', {
        'kitchen.fridge':        (46, 148, 270, 410),
        'kitchen.frying_pan':    (940, 22, 1042, 192),
        'kitchen.kitchen_towel': (928, 436, 1094, 610),
        'kitchen.chair':         (20, 416, 280, 754),
        'kitchen.table':         (290, 424, 848, 752),
        'kitchen.cup':           (398, 390, 514, 477),
        'kitchen.bowl':          (624, 396, 738, 474),
        'kitchen.plate':         (480, 481, 658, 585),
        'kitchen.fork':          (420, 482, 480, 590),
        'kitchen.spoon':           (660, 482, 722, 590),
        'kitchen.pot':             (872, 208, 1128, 360),
        'kitchen.stove':           (852, 322, 1146, 656),
    }),
    'kitchen.table': ('assets/scenes/kitchen_table.jpg', {
        'kitchen.fork':  (122, 200, 244, 534),
        'kitchen.plate': (258, 204, 622, 530),
        'kitchen.spoon': (632, 200, 764, 534),
        'kitchen.cup':   (850, 104, 1104, 334),
        'kitchen.bowl':  (848, 358, 1112, 600),
    }),
}
# Уточнение по цвету (OpenCV HSV: H 0..180)
COLOR = {
    'fork':  lambda H, S, V: (H >= 84) & (H <= 110) & (S > 60),
    'spoon': lambda H, S, V: (H >= 84) & (H <= 110) & (S > 60),
    ('kitchen', 'kitchen.plate'): lambda H, S, V: ((H <= 14) | (H >= 170)) & (S > 70),
    'chair': lambda H, S, V: (H >= 8) & (H <= 32) & (S > 125),
    'pot': lambda H, S, V: (H >= 3) & (H <= 22) & (S > 110),
}


def segment(img, scene, wid, rect):
    x0, y0, x1, y1 = rect
    mask = np.zeros(img.shape[:2], np.uint8)
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.setRNGSeed(1)
    cv2.grabCut(img, mask, (x0, y0, x1 - x0, y1 - y0), bgd, fgd, 8, cv2.GC_INIT_WITH_RECT)
    m = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(int)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    cond = COLOR.get((scene, wid), COLOR.get(wid.split('.')[-1]))
    if cond is not None:
        box = np.zeros_like(m)
        box[y0:y1, x0:x1] = 255
        m = np.where(cond(H, S, V) & (box > 0), 255, 0).astype(np.uint8)
    if wid.endswith('frying_pan'):
        m = np.where((m > 0) & ((V < 236) | (S > 80)), 255, 0).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    if n > 1:
        m = np.where(lab == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    filled = np.zeros_like(m)
    cv2.drawContours(filled, cnts, -1, 255, -1)
    c = max(cnts, key=cv2.contourArea)
    poly = cv2.approxPolyDP(c, 2.0, True)[:, 0, :].tolist()
    return filled, poly


# Где сегментация по цвету не годится (окно того же цвета, что стена) — полигон вручную.
MANUAL = {
    ('kitchen', 'kitchen.window'): [[336, 88], [812, 88], [812, 343], [830, 346], [830, 372], [318, 372], [318, 346], [336, 343]],
}

masks, polys = {}, {}
for scene, (path, items) in SCENES.items():
    img = cv2.imread(path)
    for wid, rect in items.items():
        masks[(scene, wid)], polys[(scene, wid)] = segment(img, scene, wid, rect)
for key, poly in MANUAL.items():
    polys[key] = poly

# ---------------------------------------------------------------- белые углы
def fill_corners(img, r=80):
    h, w = img.shape[:2]
    white = (img.astype(int).min(axis=2) > 236).astype(np.uint8) * 255
    corner = np.zeros((h, w), np.uint8)
    for (x, y) in [(0, 0), (w - r, 0), (0, h - r), (w - r, h - r)]:
        corner[y:y + r, x:x + r] = 255
    m = cv2.dilate(cv2.bitwise_and(white, corner), np.ones((5, 5), np.uint8))
    return cv2.inpaint(img, m, 9, cv2.INPAINT_TELEA)


def ell(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def quadfit(valid, val, W, H):
    ys, xs = np.where(valid)
    X = np.stack([np.ones_like(xs), xs / W, ys / H, (xs / W) ** 2, (ys / H) ** 2, xs * ys / (W * H)], 1)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    F = np.stack([np.ones_like(xx), xx / W, yy / H, (xx / W) ** 2, (yy / H) ** 2, xx * yy / (W * H)], -1)
    out = np.zeros((H, W, 3), np.float32)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(X, val[ys, xs, c].astype(np.float64), rcond=None)
        out[..., c] = (F @ coef).astype(np.float32)
    return out


def hole_of(mask, W, H, grow=7, sx=5, sy=12, sgrow=10):
    """Маска предмета + его тень (тень падает вниз-вправо)."""
    a = cv2.dilate(mask, ell(grow))
    sh = cv2.warpAffine(mask, np.float32([[1, 0, sx], [0, 1, sy]]), (W, H))
    return cv2.bitwise_or(a, cv2.dilate(sh, ell(sgrow)))


# ---------------------------------------------------------------- пустой стол
def mat_corners(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    m = ((hsv[..., 0] >= 25) & (hsv[..., 0] <= 60) & (hsv[..., 1] > 60)).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cnts, key=cv2.contourArea)[:, 0, :]
    x, y, w, h = cv2.boundingRect(c)
    sides = [c[(c[:, 1] < y + 15) & (c[:, 0] > x + 70) & (c[:, 0] < x + w - 70)],
             c[(c[:, 0] > x + w - 40) & (c[:, 1] > y + 70) & (c[:, 1] < y + h - 70)],
             c[(c[:, 1] > y + h - 15) & (c[:, 0] > x + 70) & (c[:, 0] < x + w - 70)],
             c[(c[:, 0] < x + 40) & (c[:, 1] > y + 70) & (c[:, 1] < y + h - 70)]]
    lines = [cv2.fitLine(s.astype(np.float32), cv2.DIST_L2, 0, 0.01, 0.01).ravel() for s in sides]

    def inter(a, b):
        A = np.array([[a[0], -b[0]], [a[1], -b[1]]])
        t = np.linalg.solve(A, [b[2] - a[2], b[3] - a[3]])
        return [a[2] + a[0] * t[0], a[3] + a[1] * t[0]]
    return np.float32([inter(lines[3], lines[0]), inter(lines[0], lines[1]),
                       inter(lines[1], lines[2]), inter(lines[2], lines[3])])


def best_shift(a, b, maxs=22):
    """s, при котором b(x + s) ≈ a(x), с шагом 0.1 px."""
    a = a - a.mean()
    b = b - b.mean()
    x = np.arange(len(b), dtype=np.float32)
    best = None
    for s10 in range(-maxs * 10, maxs * 10 + 1):
        bb = np.interp(x + s10 / 10, x, b)
        c = float((a[30:-30] * bb[30:-30]).mean())
        if best is None or c > best[0]:
            best = (c, s10 / 10)
    return best[1]


def dp_rows(sig, rows, cand, lam=0.6):
    """Для каждой строки дыры подбирает строку-источник; переход на соседнюю строку бесплатный."""
    C = np.stack([np.abs(sig[cand] - sig[y][None]).reshape(len(cand), -1).mean(1) for y in rows])
    C = C / C.mean()
    K = len(cand)
    idx = {int(c): i for i, c in enumerate(cand)}
    nxt = np.array([idx.get(int(c) + 1, -1) for c in cand])
    dp = C[0].copy()
    back = np.zeros((len(rows), K), int)
    for r in range(1, len(rows)):
        bi = int(np.argmin(dp))
        new = np.full(K, dp[bi] + lam)
        bk = np.full(K, bi)
        ok = np.where(nxt >= 0)[0]
        tgt = nxt[ok]
        better = dp[ok] < new[tgt]
        new[tgt[better]] = dp[ok][better]
        bk[tgt[better]] = ok[better]
        dp = new + C[r]
        back[r] = bk
    path = [int(np.argmin(dp))]
    for r in range(len(rows) - 1, 0, -1):
        path.append(int(back[r][path[-1]]))
    return [int(cand[i]) for i in path[::-1]]


def empty_table():
    img = cv2.imread('assets/scenes/kitchen_table_nocup.jpg')
    H, W = img.shape[:2]
    f = img.astype(np.float32)
    mk = lambda n: masks[('kitchen.table', 'kitchen.' + n)]

    # --- скатерть: выпрямляем перспективу, дорисовываем клетку по строкам, возвращаем обратно
    src = mat_corners(img)
    MW, MH = 830, 518
    dst = np.float32([[0, 0], [MW, 0], [MW, MH], [0, MH]])
    Hm = cv2.getPerspectiveTransform(src, dst)
    Hi = np.linalg.inv(Hm)
    R = cv2.warpPerspective(f, Hm, (MW, MH), flags=cv2.INTER_CUBIC)
    hole_img = hole_of(mk('fork'), W, H, grow=11, sgrow=13)
    hole_img = cv2.bitwise_or(hole_img, hole_of(mk('plate'), W, H, grow=13, sx=4, sy=10, sgrow=16))
    hole_img = cv2.bitwise_or(hole_img, hole_of(mk('spoon'), W, H, grow=11, sgrow=13))
    hole = (cv2.warpPerspective(hole_img, Hm, (MW, MH), flags=cv2.INTER_NEAREST) > 0)
    inner = np.zeros((MH, MW), bool)
    inner[14:MH - 14, 14:MW - 14] = True
    P = 45
    valid = (inner & ~hole).astype(np.float32)
    num = cv2.boxFilter(R * valid[..., None], -1, (P, P), normalize=False)
    den = cv2.boxFilter(valid, -1, (P, P), normalize=False)
    avg = num / np.maximum(den, 1)[..., None]
    L = quadfit(cv2.erode(valid, np.ones((P, P), np.uint8)) > 0, avg, MW, MH)
    N = R / L
    ys, xs = np.where(hole)
    hy0, hy1 = ys.min(), ys.max()
    hx0, hx1 = xs.min(), xs.max()
    # Дрейф вертикальных полос (остаток перспективы): сдвиг s(u) на dv строк вниз
    G = cv2.cvtColor(np.clip(R, 0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
    top_v, bot_v = (18, 70), (MH - 78, MH - 18)
    dv = (bot_v[0] + bot_v[1]) / 2 - (top_v[0] + top_v[1]) / 2
    us, ss = [], []
    for u0 in range(20, MW - 140, 40):
        a = G[top_v[0]:top_v[1], u0:u0 + 120].mean(0)
        b = G[bot_v[0]:bot_v[1], u0:u0 + 120].mean(0)
        us.append(u0 + 60)
        ss.append(best_shift(a, b))
    drift = np.poly1d(np.polyfit(us, ss, 2))(np.arange(MW)) / dv   # px на строку
    # Подбор строк-источников по горизонтальным полосам (средние по блокам столбцов)
    lb = np.arange(18, 18 + 50 * max(1, (hx0 - 22) // 50))
    rb = np.arange(MW - 18 - 50 * max(1, (MW - 22 - hx1) // 50), MW - 18)
    sig = np.stack([N[:, lb].mean(1), N[:, rb].mean(1)], 1)          # (MH, 2, 3)
    cand = np.array([y for y in range(18, MH - 18) if y < hy0 - 1 or y > hy1 + 1])
    rows = np.arange(max(18, hy0 - 10), min(MH - 18, hy1 + 11))
    path = dp_rows(sig, rows, cand, lam=0.25)
    pred = R.copy()
    uu = np.arange(MW, dtype=np.float32)
    for y, yb in zip(rows, path):
        su = uu - drift * (y - yb)
        for ch in range(3):
            pred[y, :, ch] = np.interp(su, uu, N[yb, :, ch]) * L[y, :, ch]
    # Выравнивание яркости по кольцу вокруг дырки
    hole8 = hole.astype(np.uint8) * 255
    ring = (cv2.dilate(hole8, ell(9)) > 0) & ~(cv2.dilate(hole8, ell(3)) > 0) & inner
    rowmask = np.zeros_like(ring)
    rowmask[rows] = True
    ring &= rowmask
    ratio = np.where(ring[..., None], R / np.maximum(pred, 1), 0).astype(np.float32)
    w = ring.astype(np.float32)
    k = (0, 0)
    num = cv2.GaussianBlur(ratio, k, 22)
    den = cv2.GaussianBlur(w, k, 22)[..., None]
    gain = np.where(den > 1e-4, num / np.maximum(den, 1e-6), 1.0)
    fillR = R.copy()
    fillR[hole] = (pred * gain)[hole]
    back = cv2.warpPerspective(fillR, Hi, (W, H), flags=cv2.INTER_CUBIC)
    soft = cv2.GaussianBlur(cv2.dilate(hole_img, ell(2)).astype(np.float32) / 255, (0, 0), 1.2)[..., None]
    out = back * soft + f * (1 - soft)

    # --- дерево под миской: копия сверху с выравниванием освещения
    bm = mk('bowl')
    hb = np.zeros_like(bm)
    cv2.fillConvexPoly(hb, cv2.convexHull(cv2.findNonZero(bm)), 255)
    wood_hole = cv2.bitwise_or(cv2.dilate(hb, ell(16)),
                               cv2.dilate(cv2.warpAffine(hb, np.float32([[1, 0, -4], [0, 1, 26]]), (W, H)), ell(20)))
    region = np.zeros_like(bm)
    region[60:640, 862:1112] = 255
    Lw = quadfit((region > 0) & (wood_hole == 0), cv2.GaussianBlur(f, (0, 0), 6), W, H)
    D = 300
    ys, xs = np.where(wood_hole > 0)
    fill = out.copy()
    # правый край стола идёт наискосок (~0.053 px на строку): копируем со сдвигом вдоль него
    DX = int(round(0.0533 * D))
    fill[ys, xs] = (out[ys - D, xs - DX] / Lw[ys - D, xs - DX]) * Lw[ys, xs]
    soft = cv2.GaussianBlur((wood_hole > 0).astype(np.float32), (0, 0), 3)[..., None]
    out = fill * soft + out * (1 - soft)
    return np.clip(out, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------- вырезки
def cutout(img, mask):
    x, y, w, h = cv2.boundingRect(mask)
    pad = 4
    x0, y0 = max(0, x - pad), max(0, y - pad)
    x1, y1 = min(img.shape[1], x + w + pad), min(img.shape[0], y + h + pad)
    a = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 0.8)
    rgba = np.dstack([img, np.clip(a, 0, 255).astype(np.uint8)])[y0:y1, x0:x1]
    return rgba, [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]


def main():
    k = cv2.imread('assets/scenes/kitchen.png')
    t = cv2.imread('assets/scenes/kitchen_table.jpg')
    q = [cv2.IMWRITE_JPEG_QUALITY, 88]
    cv2.imwrite(f'{OUT}/kitchen.jpg', fill_corners(k), q)
    cv2.imwrite(f'{OUT}/kitchen_table.jpg', fill_corners(t), q)
    cv2.imwrite(f'{OUT}/kitchen_table_empty.jpg', fill_corners(empty_table()), q)
    sprites = {}
    for n in ['plate', 'fork', 'spoon', 'bowl']:
        rgba, box = cutout(t, masks[('kitchen.table', 'kitchen.' + n)])
        cv2.imwrite(f'{OUT}/kitchen_table_{n}.png', rgba, [cv2.IMWRITE_PNG_COMPRESSION, 9])
        sprites['kitchen.' + n] = box
    cup = cv2.imread('assets/scenes/kitchen_table_cup.png', cv2.IMREAD_UNCHANGED)
    cv2.imwrite(f'{OUT}/kitchen_table_cup.png', cup, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    sprites['kitchen.cup'] = [855, 110, cup.shape[1], cup.shape[0]]  # совпадение по шаблону

    room_path = 'content/rooms/kitchen.json'
    room = json.load(open(room_path, encoding='utf-8'))
    for w in room['words']:
        w['zones'] = {s: polys[(s, w['id'])] for s in SCENES if (s, w['id']) in polys}
        if w['id'] in sprites:
            n = w['id'].split('.')[-1]
            x, y, ww, hh = sprites[w['id']]
            w['sprite'] = {'scene': 'kitchen.table', 'image': f'assets/scenes/app/kitchen_table_{n}.png',
                           'x': x, 'y': y, 'w': ww, 'h': hh}
    with open(room_path, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(room, ensure_ascii=False, indent=2, separators=(',', ': ')) + '\n')
    print('ok:', ', '.join(sorted(os.listdir(OUT))))


if __name__ == '__main__':
    main()
