# -*- coding: utf-8 -*-
"""
Gambar Arsitektur Sederhana (Box + Ikon) Sistem Telemetri Kapal -> Dashboard Cloud VMS
Output: doc/arsitektur_sistem_vms.png
"""

import os
from PIL import Image, ImageDraw, ImageFont

W, H = 2480, 1060
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "arsitektur_sistem_vms.png")

INK = "#1E293B"
SOFT = "#64748B"
REGION_FILL = "#F5F7FA"
REGION_LINE = "#94A3B8"
FONT_DIR = r"C:\Windows\Fonts"

img = Image.new("RGB", (W, H), "#FFFFFF")
d = ImageDraw.Draw(img)


def font(size, bold=False):
    return ImageFont.truetype(os.path.join(FONT_DIR, "arialbd.ttf" if bold else "arial.ttf"), size)


def center_text(cx, y, txt, f, fill=INK):
    b = d.textbbox((0, 0), txt, font=f)
    d.text((cx - (b[2] - b[0]) / 2, y), txt, font=f, fill=fill)


def dashed_line(p1, p2, fill=INK, width=4, dash=16, gap=10):
    (x1, y1), (x2, y2) = p1, p2
    L = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
    if L == 0:
        return
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    t = 0.0
    while t < L:
        e = min(t + dash, L)
        d.line([(x1 + ux * t, y1 + uy * t), (x1 + ux * e, y1 + uy * e)], fill=fill, width=width)
        t += dash + gap


def dashed_rect(box):
    x1, y1, x2, y2 = box
    for a, b in [((x1, y1), (x2, y1)), ((x2, y1), (x2, y2)), ((x2, y2), (x1, y2)), ((x1, y2), (x1, y1))]:
        dashed_line(a, b, REGION_LINE, 3)


def arrow(p1, p2, width=6, head=22, dashed=False):
    (x1, y1), (x2, y2) = p1, p2
    L = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    bx, by = x2 - ux * head, y2 - uy * head
    if dashed:
        dashed_line((x1, y1), (bx, by), INK, width)
    else:
        d.line([(x1, y1), (bx, by)], fill=INK, width=width)
    px, py = -uy, ux
    d.polygon([(x2, y2), (bx + px * head * .55, by + py * head * .55), (bx - px * head * .55, by - py * head * .55)], fill=INK)


# ------------------------------------------------------------------ ikon
def icon_gps(cx, cy, s):  # pin lokasi
    r = s * 0.32
    d.ellipse((cx - r, cy - s * 0.42 - r, cx + r, cy - s * 0.42 + r), fill=INK)
    d.polygon([(cx - r * 0.92, cy - s * 0.30), (cx + r * 0.92, cy - s * 0.30), (cx, cy + s * 0.38)], fill=INK)
    ri = r * 0.42
    d.ellipse((cx - ri, cy - s * 0.42 - ri, cx + ri, cy - s * 0.42 + ri), fill="#FFFFFF")
    d.ellipse((cx - s * 0.30, cy + s * 0.34, cx + s * 0.30, cy + s * 0.46), outline=INK, width=4)


def icon_compass(cx, cy, s):
    r = s * 0.45
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=INK, width=6)
    d.polygon([(cx, cy - r * 0.8), (cx + r * 0.22, cy), (cx - r * 0.22, cy)], fill=INK)
    d.polygon([(cx, cy + r * 0.8), (cx + r * 0.22, cy), (cx - r * 0.22, cy)], outline=INK, width=4)
    d.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill="#FFFFFF", outline=INK, width=3)


def icon_sonar(cx, cy, s):  # transducer + gelombang
    d.rounded_rectangle((cx - s * 0.22, cy - s * 0.45, cx + s * 0.22, cy - s * 0.18), radius=6, fill=INK)
    for k, rr in enumerate([0.22, 0.38, 0.54]):
        r = s * rr
        d.arc((cx - r, cy - s * 0.18 - r, cx + r, cy - s * 0.18 + r), start=40, end=140, fill=INK, width=5)


def icon_wind(cx, cy, s):
    for i, (yo, ln) in enumerate([(-0.25, 0.75), (0.0, 0.9), (0.25, 0.6)]):
        y = cy + s * yo
        x1, x2 = cx - s * 0.45, cx - s * 0.45 + s * ln
        d.line([(x1, y), (x2 - s * 0.08, y)], fill=INK, width=6)
        r = s * 0.09
        d.arc((x2 - s * 0.08 - r, y - 2 * r, x2 - s * 0.08 + r, y), start=-90, end=180, fill=INK, width=6)


def icon_ais(cx, cy, s):  # antena + gelombang radio
    d.line([(cx, cy - s * 0.25), (cx, cy + s * 0.45)], fill=INK, width=7)
    d.line([(cx, cy + s * 0.05), (cx - s * 0.2, cy + s * 0.45)], fill=INK, width=5)
    d.line([(cx, cy + s * 0.05), (cx + s * 0.2, cy + s * 0.45)], fill=INK, width=5)
    d.ellipse((cx - 10, cy - s * 0.25 - 10, cx + 10, cy - s * 0.25 + 10), fill=INK)
    for rr in (0.2, 0.36):
        r = s * rr
        d.arc((cx - r, cy - s * 0.25 - r, cx + r, cy - s * 0.25 + r), start=200, end=250, fill=INK, width=5)
        d.arc((cx - r, cy - s * 0.25 - r, cx + r, cy - s * 0.25 + r), start=290, end=340, fill=INK, width=5)


def icon_display(cx, cy, s):  # perangkat NMEA 0183 (layar)
    d.rounded_rectangle((cx - s * 0.45, cy - s * 0.35, cx + s * 0.45, cy + s * 0.25), radius=8, outline=INK, width=6)
    d.line([(cx - s * 0.3, cy + s * 0.05), (cx - s * 0.1, cy - s * 0.12), (cx + s * 0.08, cy), (cx + s * 0.3, cy - s * 0.18)], fill=INK, width=5)
    d.rectangle((cx - s * 0.12, cy + s * 0.25, cx + s * 0.12, cy + s * 0.38), fill=INK)
    d.rectangle((cx - s * 0.25, cy + s * 0.38, cx + s * 0.25, cy + s * 0.44), fill=INK)


def icon_gateway(cx, cy, s):  # modul industri dengan port
    d.rounded_rectangle((cx - s * 0.48, cy - s * 0.32, cx + s * 0.48, cy + s * 0.32), radius=10, outline=INK, width=6)
    for i in range(4):  # terminal CAN
        x = cx - s * 0.36 + i * s * 0.12
        d.rectangle((x, cy - s * 0.2, x + s * 0.08, cy - s * 0.06), fill=INK)
    d.rectangle((cx + s * 0.12, cy - s * 0.2, cx + s * 0.38, cy + s * 0.04), outline=INK, width=5)  # RJ45
    for i in range(4):  # LED
        x = cx - s * 0.34 + i * s * 0.12
        d.ellipse((x, cy + s * 0.12, x + s * 0.07, cy + s * 0.19), fill=INK)


def icon_router(cx, cy, s):
    # Ikon Router Internet Kapal: Bodi router + Dish Satelit (Starlink/VSAT) + Antena Seluler
    # Bodi router
    d.rounded_rectangle((cx - s * 0.44, cy + s * 0.04, cx + s * 0.44, cy + s * 0.40), radius=8, outline=INK, width=6)
    for i in range(4):
        x = cx - s * 0.28 + i * s * 0.13
        d.ellipse((x, cy + s * 0.18, x + s * 0.07, cy + s * 0.25), fill=INK)
    # Antena seluler (kanan)
    d.line([(cx + s * 0.24, cy + s * 0.04), (cx + s * 0.32, cy - s * 0.42)], fill=INK, width=6)
    d.ellipse((cx + s * 0.32 - 5, cy - s * 0.42 - 5, cx + s * 0.32 + 5, cy - s * 0.42 + 5), fill=INK)
    # Piringan Satelit / Dish Starlink / VSAT (kiri)
    # Tiang penyangga
    d.line([(cx - s * 0.22, cy + s * 0.04), (cx - s * 0.18, cy - s * 0.18)], fill=INK, width=5)
    # Busur parabola
    d.arc((cx - s * 0.42, cy - s * 0.46, cx + s * 0.06, cy + s * 0.02), start=130, end=330, fill=INK, width=6)
    # LNB / Feed horn satelit
    d.line([(cx - s * 0.18, cy - s * 0.22), (cx - s * 0.32, cy - s * 0.36)], fill=INK, width=4)
    d.ellipse((cx - s * 0.35, cy - s * 0.39, cx - s * 0.29, cy - s * 0.33), fill=INK)


def icon_cloud(cx, cy, s, fill="#E2E8F0"):
    for ex, ey, r in [(-0.32, 0.08, 0.28), (0.0, -0.12, 0.36), (0.32, 0.06, 0.28), (-0.1, 0.2, 0.28), (0.16, 0.2, 0.26)]:
        d.ellipse((cx + s * ex - s * r, cy + s * ey - s * r, cx + s * ex + s * r, cy + s * ey + s * r), fill=fill)


def icon_server(cx, cy, s):
    for i in range(3):
        y = cy - s * 0.42 + i * s * 0.3
        d.rounded_rectangle((cx - s * 0.4, y, cx + s * 0.4, y + s * 0.24), radius=6, outline=INK, width=5)
        d.ellipse((cx - s * 0.3, y + s * 0.08, cx - s * 0.22, y + s * 0.16), fill=INK)
        d.line([(cx - s * 0.05, y + s * 0.12), (cx + s * 0.3, y + s * 0.12)], fill=INK, width=4)


def icon_dashboard(cx, cy, s):
    d.rounded_rectangle((cx - s * 0.48, cy - s * 0.38, cx + s * 0.48, cy + s * 0.26), radius=8, outline=INK, width=6)
    d.line([(cx - s * 0.48, cy - s * 0.24), (cx + s * 0.48, cy - s * 0.24)], fill=INK, width=4)
    for i, h in enumerate([0.1, 0.2, 0.14, 0.28]):  # grafik batang
        x = cx - s * 0.36 + i * s * 0.12
        d.rectangle((x, cy + s * 0.16 - s * h, x + s * 0.08, cy + s * 0.16), fill=INK)
    d.ellipse((cx + s * 0.12, cy - s * 0.16, cx + s * 0.38, cy + s * 0.1), outline=INK, width=5)  # gauge
    d.rectangle((cx - s * 0.1, cy + s * 0.26, cx + s * 0.1, cy + s * 0.38), fill=INK)
    d.rectangle((cx - s * 0.24, cy + s * 0.38, cx + s * 0.24, cy + s * 0.44), fill=INK)


def device_box(box, icon_fn, label):
    x1, y1, x2, y2 = box
    d.rounded_rectangle(box, radius=14, fill="#FFFFFF", outline=INK, width=3)
    h = y2 - y1
    icon_fn(x1 + h / 2 + 6, (y1 + y2) / 2, h * 0.62)
    b = d.textbbox((0, 0), label, font=font(24, True))
    d.text((x1 + h + 14, (y1 + y2) / 2 - (b[3] - b[1]) / 2 - 4), label, font=font(24, True), fill=INK)


def main_box(box, icon_fn, label, sublabel=None):
    x1, y1, x2, y2 = box
    d.rounded_rectangle(box, radius=18, fill="#FFFFFF", outline=INK, width=4)
    if sublabel:
        icon_fn((x1 + x2) / 2, y1 + (y2 - y1) * 0.36, (x2 - x1) * 0.46)
        center_text((x1 + x2) / 2, y2 - 76, label, font(24, True))
        center_text((x1 + x2) / 2, y2 - 40, sublabel, font(18), fill=SOFT)
    else:
        icon_fn((x1 + x2) / 2, y1 + (y2 - y1) * 0.42, (x2 - x1) * 0.52)
        center_text((x1 + x2) / 2, y2 - 58, label, font(26, True))


# ------------------------------------------------------------------ judul & region
center_text(W / 2, 28, "Arsitektur Sistem Telemetri Kapal ke Dashboard Cloud VMS", font(40, True))

SHIP = (40, 110, 1440, 1010)
CLOUD = (1700, 110, 2440, 1010)
for r in (SHIP, CLOUD):
    d.rectangle(r, fill=REGION_FILL)
    dashed_rect(r)
center_text((SHIP[0] + SHIP[2]) / 2, SHIP[3] - 50, "KAPAL", font(26, True), fill=SOFT)
center_text((CLOUD[0] + CLOUD[2]) / 2, CLOUD[3] - 50, "CLOUD", font(26, True), fill=SOFT)

# ------------------------------------------------------------------ perangkat navigasi
devices = [
    (icon_gps, "GPS / GNSS"),
    (icon_compass, "Gyrocompass"),
    (icon_sonar, "Transducer"),
    (icon_wind, "Wind Sensor"),
    (icon_ais, "AIS"),
    (icon_display, "Perangkat 0183"),
]
DX1, DX2, DY0, STEP, DH = 80, 420, 150, 135, 110
cys = []
for i, (fn, lb) in enumerate(devices):
    y1 = DY0 + i * STEP
    device_box((DX1, y1, DX2, y1 + DH), fn, lb)
    cys.append(y1 + DH / 2)

# ------------------------------------------------------------------ backbone NMEA 2000
BUS_X = 540
top, bot = cys[0] - 25, cys[4] + 25
d.line([(BUS_X, top), (BUS_X, bot)], fill=INK, width=12)
d.rectangle((BUS_X - 26, top - 14, BUS_X + 26, top), fill=INK)
d.rectangle((BUS_X - 26, bot, BUS_X + 26, bot + 14), fill=INK)
for cy in cys[:5]:
    d.line([(DX2, cy), (BUS_X, cy)], fill=INK, width=4)
    d.ellipse((BUS_X - 9, cy - 9, BUS_X + 9, cy + 9), fill=INK)

# ------------------------------------------------------------------ gateway, router
GW = (700, 410, 960, 670)
RT = (1100, 410, 1360, 670)
main_box(GW, icon_gateway, "USR-CANET200")
main_box(RT, icon_router, "Router Internet", "Starlink / VSAT / Selular")

MID = 540
d.line([(BUS_X, MID), (GW[0] - 22, MID)], fill=INK, width=6)
arrow((GW[0] - 40, MID), (GW[0], MID))
d.ellipse((BUS_X - 11, MID - 11, BUS_X + 11, MID + 11), fill=INK)
center_text((BUS_X + GW[0]) / 2, MID - 40, "NMEA 2000", font(22, True))

c6 = cys[5]
SER = 630
dashed_line((DX2, c6), (620, c6), width=5)
dashed_line((620, c6), (620, SER), width=5)
arrow((620, SER), (GW[0], SER), width=5, dashed=True)
d.text((DX2 + 20, c6 - 36), "NMEA 0183", font=font(22, True), fill=INK)

arrow((GW[2], MID), (RT[0], MID))
center_text((GW[2] + RT[0]) / 2, MID - 40, "LAN", font(22, True))

# ------------------------------------------------------------------ internet
ICX = 1570
icon_cloud(ICX, MID - 10, 230)
center_text(ICX, MID - 30, "Internet", font(26, True))
center_text(ICX, MID + 4, "TCP/IP", font(22), fill=SOFT)
arrow((RT[2], MID), (ICX - 95, MID))

# ------------------------------------------------------------------ server & dashboard (vertikal)
SV = (1940, 170, 2200, 430)
DB = (1940, 640, 2200, 900)
main_box(SV, icon_server, "VMS Server")
main_box(DB, icon_dashboard, "Dashboard Web")

# internet -> server
d.line([(ICX + 95, MID), (1820, MID)], fill=INK, width=6)
d.line([(1820, MID), (1820, (SV[1] + SV[3]) / 2)], fill=INK, width=6)
arrow((1820, (SV[1] + SV[3]) / 2), (SV[0], (SV[1] + SV[3]) / 2))
center_text(1760, MID - 40, "Port 20005", font(20, True))

arrow(((SV[0] + SV[2]) / 2, SV[3]), ((SV[0] + SV[2]) / 2, DB[1]))
d.text(((SV[0] + SV[2]) / 2 + 18, (SV[3] + DB[1]) / 2 - 14), "WebSocket", font=font(22, True), fill=INK)

img.save(OUT, "PNG", dpi=(300, 300))
print("Saved:", OUT)
