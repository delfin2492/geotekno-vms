# -*- coding: utf-8 -*-
"""
Script Generator Dokumentasi PDF Resmi:
STANDAR OPERASIONAL PROSEDUR (SOP) & PANDUAN PENGGUNA (USER GUIDE)
PENGGUNAAN USR-CANET200 GATEWAY, SPESIFIKASI DEKODE NMEA 2000 & 0183,
SERTA PANDUAN LENGKAP FITUR & UX PLATFORM GEOTEKNO VMS (BOX NAVIGASI)

File Output: e:/Delfin/Product Engineer/Box Navigasi/doc/Dokumentasi_Platform_Box_Navigasi_dan_Decode_NMEA.pdf
"""

import os
from datetime import datetime

import reportlab
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

# Palet Warna Korporat & Maritim
NAVY_DARK   = colors.HexColor("#0F172A")  # Slate 900
CRIMSON_RED = colors.HexColor("#DB4040")  # GeoTekno Nautical Accent
BLUE_OCEAN  = colors.HexColor("#0284C7")  # Sky Blue 600
BLUE_LIGHT  = colors.HexColor("#F0F9FF")  # Sky Blue 50
BLUE_BORDER = colors.HexColor("#BAE6FD")  # Sky Blue 200
SLATE_TEXT  = colors.HexColor("#1E293B")  # Slate 800
SLATE_MUTED = colors.HexColor("#64748B")  # Slate 500
SLATE_BG    = colors.HexColor("#F8FAFC")  # Slate 50
BORDER_COL  = colors.HexColor("#E2E8F0")  # Slate 200
CODE_BG     = colors.HexColor("#1E293B")  # Slate 800
CODE_FG     = colors.HexColor("#38BDF8")  # Sky 400
EMERALD     = colors.HexColor("#059669")  # Emerald 600
AMBER       = colors.HexColor("#D97706")  # Amber 600

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas untuk menghasilkan running header, running footer,
    dan nomor halaman dinamis (Halaman X dari Y) secara akurat.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        print(f"[INFO] Total halaman dokumen PDF dibuat: {num_pages}")
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        # Abaikan halaman cover (halaman 1)
        if self._pageNumber == 1:
            return

        self.saveState()
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(SLATE_MUTED)

        # Running Header
        self.drawString(54, 842 - 36, "GEOTEKNO VMS  •  PANDUAN PENGGUNA USR-CANET200 & SPESIFIKASI PLATFORM")
        self.setFont("Helvetica", 7.5)
        self.drawRightString(595 - 54, 842 - 36, "v2.5 Multi-Tenant Enterprise")

        self.setStrokeColor(BORDER_COL)
        self.setLineWidth(0.6)
        self.line(54, 842 - 42, 595 - 54, 842 - 42)

        # Running Footer
        self.line(54, 46, 595 - 54, 46)
        self.setFont("Helvetica", 7.5)
        self.drawString(54, 34, "Dokumen Teknis Resmi  •  PT Geo Tekno Maritim Indonesia  •  Box Navigasi System")
        page_str = f"Halaman {self._pageNumber} dari {page_count}"
        self.drawRightString(595 - 54, 34, page_str)
        self.restoreState()

def create_documentation_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    cover_title = ParagraphStyle(
        'CoverTitle', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=20, leading=26,
        textColor=NAVY_DARK, spaceAfter=6
    )
    
    cover_sub = ParagraphStyle(
        'CoverSubtitle', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9.5, leading=14,
        textColor=SLATE_MUTED, spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'Header1', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=12, leading=16,
        textColor=CRIMSON_RED, spaceBefore=10, spaceAfter=4,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Header2', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=10, leading=13.5,
        textColor=NAVY_DARK, spaceBefore=8, spaceAfter=3,
        keepWithNext=True
    )

    h3_style = ParagraphStyle(
        'Header3', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=9, leading=12,
        textColor=BLUE_OCEAN, spaceBefore=5, spaceAfter=2,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8.0, leading=11.5,
        textColor=SLATE_TEXT, spaceBefore=2, spaceAfter=2
    )

    bullet_style = ParagraphStyle(
        'BulletItem', parent=body_style,
        leftIndent=10, bulletIndent=4,
        spaceBefore=1.5, spaceAfter=1.5
    )

    code_block_style = ParagraphStyle(
        'CodeSnippet', parent=styles['Normal'],
        fontName='Courier', fontSize=7.0, leading=9.5,
        textColor=CODE_FG
    )

    formula_style = ParagraphStyle(
        'FormulaText', parent=styles['Normal'],
        fontName='Courier-Bold', fontSize=7.5, leading=10,
        textColor=NAVY_DARK
    )

    table_cell = ParagraphStyle(
        'TableCell', parent=styles['Normal'],
        fontName='Helvetica', fontSize=7.0, leading=9.5,
        textColor=SLATE_TEXT
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=7.0, leading=9.5,
        textColor=NAVY_DARK
    )

    table_cell_code = ParagraphStyle(
        'TableCellCode', parent=styles['Normal'],
        fontName='Courier-Bold', fontSize=7.0, leading=9.0,
        textColor=NAVY_DARK
    )

    table_head = ParagraphStyle(
        'TableHead', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=7.0, leading=9.5,
        textColor=colors.white
    )

    story = []

    # =========================================================================
    # HALAMAN 1: COVER, RINGKASAN EKSEKUTIF, & DAFTAR ISI
    # =========================================================================
    badge_table = Table(
        [[
            Paragraph("<font color='#DB4040'><b>GEOTEKNO VMS</b></font>  |  BOX NAVIGASI SYSTEM", table_cell_bold),
            Paragraph("<b>STANDAR OPERASIONAL PROSEDUR & USER GUIDE</b>", ParagraphStyle('R', parent=table_cell_bold, alignment=2, textColor=SLATE_MUTED))
        ]],
        colWidths=[260, 227]
    )
    badge_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(badge_table)
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=2, color=CRIMSON_RED, spaceAfter=10, spaceBefore=0))

    story.append(Paragraph("PANDUAN PENGGUNA USR-CANET200 & PLATFORM GEOTEKNO VMS", cover_title))
    story.append(Paragraph(
        "Panduan Komprehensif Konfigurasi Gateway USR-CANET200 dari Web Dashboard, Integrasi Koneksi TCP Handshake, "
        "Spesifikasi Penguraian Sinyal NMEA 2000 (CAN Bus 13-Byte) & NMEA 0183 (Serial RS-485), Serta Panduan Operasional Fitur & UX Seluruh Halaman Platform",
        cover_sub
    ))

    # Metadata Box
    meta_data = [
        [Paragraph("<b>Nama Dokumen</b>", table_cell_bold), Paragraph("User Guide USR-CANET200, Decode Engine & Panduan Platform GeoTekno VMS", table_cell)],
        [Paragraph("<b>Versi Sistem</b>", table_cell_bold), Paragraph("GeoTekno VMS v2.5 (Modular Multi-Tenant Architecture)", table_cell)],
        [Paragraph("<b>Modul Gateway</b>", table_cell_bold), Paragraph("USR-CANET200 Dual CAN/Ethernet/RS-485 Gateway (Baudrate 250k N2K)", table_cell)],
        [Paragraph("<b>Protokol Jaringan</b>", table_cell_bold), Paragraph("TCP Client Socket (Port 20005 CAN & Port 20006 Serial), WebSocket 1 Hz, REST API", table_cell)],
        [Paragraph("<b>Instrumen Navigasi</b>", table_cell_bold), Paragraph("Airmar DST810, Garmin AquaMap, Kompas Gyro, GPS GNSS Fix, AIS Class A/B", table_cell)],
        [Paragraph("<b>Tanggal Terbit</b>", table_cell_bold), Paragraph(datetime.now().strftime("%d %B %Y"), table_cell)],
        [Paragraph("<b>Penyusun</b>", table_cell_bold), Paragraph("Divisi Rekayasa Produk & IoT Maritim, PT Geo Tekno Maritim Indonesia", table_cell)],
    ]
    meta_table = Table(meta_data, colWidths=[110, 377])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SLATE_BG),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COL),
        ('PADDING', (0,0), (-1,-1), 3.0),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("1. RINGKASAN EKSEKUTIF DOKUMEN", h1_style))
    story.append(Paragraph(
        "Dokumen ini memadukan instruksi kerja instalasi modul perangkat keras <b>USR-CANET200 Gateway</b>, "
        "pengaturan parameter jaringan TCP Client melalui Web Dashboard gateway, arsitektur pemrosesan aliran data biner pada backend, "
        "serta panduan operasional pengguna (*User Experience / UX*) pada seluruh halaman antarmuka platform <b>GeoTekno VMS</b>.",
        body_style
    ))
    story.append(Spacer(1, 4))

    # Struktur Bab
    toc_data = [
        [Paragraph("<b>Bab</b>", table_head), Paragraph("<b>Topik Bahasan</b>", table_head), Paragraph("<b>Uraian Cakupan</b>", table_head)],
        [Paragraph("<b>Bab 2</b>", table_cell_bold), Paragraph("Instalasi Fisik & Wiring USR-CANET200", table_cell_bold), Paragraph("Pengkabelan CAN Bus (CAN_H, CAN_L, 120Ω), Serial RS-485, Power DC 9-36V, dan arti LED", table_cell)],
        [Paragraph("<b>Bab 3</b>", table_cell_bold), Paragraph("Konfigurasi Web Dashboard Gateway", table_cell_bold), Paragraph("Langkah setting IP 192.168.0.7, CAN 250k, Serial, TCP Client Socket, dan Identity Token", table_cell)],
        [Paragraph("<b>Bab 4</b>", table_cell_bold), Paragraph("Koneksi & Handshake ke Platform VMS", table_cell_bold), Paragraph("Binding sesi TCP socket per-kapal, deteksi status ONLINE/OFFLINE ber-timestamp", table_cell)],
        [Paragraph("<b>Bab 5</b>", table_cell_bold), Paragraph("Spesifikasi Decode NMEA 2000 & 0183", table_cell_bold), Paragraph("Frame 13-byte, PGN 29-bit, Fast-Packet, ISO-TP, XOR checksum, dan sensor Airmar DST810", table_cell)],
        [Paragraph("<b>Bab 6</b>", table_cell_bold), Paragraph("Panduan Fitur Platform & Panduan UX", table_cell_bold), Paragraph("Overview, Marine Traffic, Assets, Monitoring Canvas, Live Logs, Export, RBAC Multi-Company", table_cell)],
        [Paragraph("<b>Bab 7</b>", table_cell_bold), Paragraph("Troubleshooting & Pengesahan Sistem", table_cell_bold), Paragraph("Matriks solusi kendala lapangan (IP, socket, CAN error, offline) dan lembar verifikasi", table_cell)],
    ]
    toc_table = Table(toc_data, colWidths=[40, 180, 267])
    toc_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY_DARK),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COL),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, SLATE_BG]),
        ('PADDING', (0,0), (-1,-1), 2.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(toc_table)

    story.append(PageBreak())

    # =========================================================================
    # HALAMAN 2: INSTALASI FISIK & KONFIGURASI WEB USR-CANET200
    # =========================================================================
    story.append(Paragraph("2. INSTALASI FISIK & PENGKABELAN USR-CANET200", h1_style))
    story.append(Paragraph(
        "Modul <b>USR-CANET200</b> adalah konverter protokol cerdas dual-CAN dan RS-485 ke Ethernet industrial. "
        "Pemasangan perangkat keras pada kapal wajib mengikuti ketentuan teknis berikut:",
        body_style
    ))
    story.append(Spacer(1, 3))

    wiring_points = [
        "<b>Terminal CAN1 (NMEA 2000 Bus):</b> Hubungkan pin <code>CAN_H</code> ke kabel NET-H (Putih), pin <code>CAN_L</code> ke NET-L (Biru), dan pin <code>GND</code> ke pelindung kabel (Bare/Shield). Pastikan resistor terminasi 120 Ω terpasang di kedua ujung backbone bus.",
        "<b>Terminal RS-485 (NMEA 0183 Serial):</b> Hubungkan pin <code>A+</code> ke NMEA Out (+) dan pin <code>B-</code> ke NMEA Out (-) dari instrumen talker.",
        "<b>Terminal Catu Daya:</b> Sambungkan sumber tegangan DC 9V s/d 36V ke terminal V+ dan V- dengan sekring pengaman (Fuse 1A).",
        "<b>Indikator LED:</b> PWR (Power aktif), WORK (Berkedip normal 1 Hz), CAN1/CAN2 (Aktivitas frame N2K), RS485 (Aktivitas serial NMEA). Tombol Reload berfungsi mereset unit ke setelan pabrik jika ditahan 3-15 detik."
    ]
    for wp in wiring_points:
        story.append(Paragraph(f"• {wp}", bullet_style))
    story.append(Spacer(1, 6))

    story.append(Paragraph("3. PANDUAN KONFIGURASI DASHBOARD WEB USR-CANET200", h1_style))
    story.append(Paragraph(
        "Konfigurasi modul dilakukan melalui Web Browser PC/Laptop teknisi dengan urutan langkah kerja baku:",
        body_style
    ))
    story.append(Spacer(1, 3))

    usr_steps = [
        "<b>Langkah 1 (Persiapan IP Laptop):</b> Hubungkan kabel LAN PC ke port RJ45 gateway. Atur IPv4 PC secara statis ke <code>192.168.0.100</code> dan Subnet Mask <code>255.255.255.0</code>.",
        "<b>Langkah 2 (Akses Web Dashboard):</b> Buka peramban web dan tuju alamat <code>http://192.168.0.7</code>. Masukkan username: <code>admin</code>, password: <code>admin</code>.",
        "<b>Langkah 3 (Network Settings):</b> Tentukan mode IP (Static IP jika memiliki alokasi segmen kapal, atau DHCP jika terhubung ke router onboard berfitur DHCP server).",
        "<b>Langkah 4 (CAN Settings CAN1):</b> Pilih Work Mode <code>Normal Mode</code>; atur Baud Rate tepat <code>250 Kbps</code> (standar N2K); isi CAN Package Time <code>10 ms</code>; Package Length <code>50 frames</code>; Filter Mode <code>Receive All</code>.",
        "<b>Langkah 5 (Serial Settings RS-485):</b> Atur Baud Rate <code>4800 bps</code> (sensor GPS/DPT) atau <code>38400 bps</code> (AIS transponder), 8 Data bits, None Parity, 1 Stop bit.",
        "<b>Langkah 6 (Network Transmission / Socket Mode):</b> Pada menu <i>Socket A</i>, pilih Work Mode <code>TCP Client</code>; masukkan Remote Server IP Platform GeoTekno VMS; isi Remote Port <code>20005</code> (untuk CAN N2K) atau <code>20006</code> (untuk Serial NMEA); aktifkan TCP Keep-Alive <code>30 detik</code>; aktifkan Identity Packet dengan mode <code>Send upon connection</code> dan isi token kapal (contoh: <code>KM_ESP32\\r\\n</code> atau <code>KM_Geo_Tekno\\r\\n</code>).",
        "<b>Langkah 7 (Simpan & Reboot):</b> Klik tombol <code>Save</code> pada tiap submenu, lalu masuk ke menu <i>Device Management</i> dan klik <code>Restart Device</code> agar setelan aktif permanen."
    ]
    for us in usr_steps:
        story.append(Paragraph(f"• {us}", bullet_style))
    story.append(Spacer(1, 5))

    # Box Code Konfigurasi
    conf_box = [
        [Paragraph(
            "<b>Ringkasan Parameter Konfigurasi USR-CANET200:</b><br/>"
            "IP Default: 192.168.0.7 (admin/admin)  |  CAN Baud Rate: 250 Kbps  |  Filter: Receive All<br/>"
            "Socket Mode: TCP Client  |  Destination: IP Platform VMS  |  Port: 20005 (CAN) / 20006 (Serial)<br/>"
            "Keep-Alive: 30s  |  Identity Packet: Send on connection -> 'KM_ESP32\\r\\n'",
            code_block_style
        )]
    ]
    cb_table = Table(conf_box, colWidths=[487])
    cb_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CODE_BG),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_COL),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(cb_table)

    story.append(PageBreak())

    # =========================================================================
    # HALAMAN 3: KONEKSI PLATFORM & DECODE NMEA 0183
    # =========================================================================
    story.append(Paragraph("4. KONEKSI & VERIFIKASI KE PLATFORM GEOTEKNO VMS", h1_style))
    story.append(Paragraph(
        "Backend GeoTekno VMS membuka port listener TCP 20005 dan 20006. Saat gateway terhubung:\n"
        "1. <b>Mekanisme Handshake & Binding Sesi:</b> Modul <code>agentManager.js</code> mendeteksi paket identity pertama. "
        "String registrasi dicocokkan ke database kapal (<code>core_assets</code>). "
        "Sesi soket TCP tersebut secara otomatis diikat (*bound*) ke ID kapal terkait, menjamin data antar-kapal tidak tertukar (*no cross-talk*).\n"
        "2. <b>Status ONLINE / OFFLINE Ber-Timestamp:</b> Status kapal menjadi <b>ONLINE (Hijau)</b> saat telemetri mengalir aktif. "
        "Jika data terputus melebihi batas waktu toleransi maritim, status otomatis menjadi <b>OFFLINE (Abu-abu / Merah)</b> "
        "disertai tanggal dan jam data terakhir yang tercatat.",
        body_style
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("5. SPESIFIKASI DEKODE NMEA 0183 (SERIAL RS-485)", h1_style))
    story.append(Paragraph(
        "Protokol <b>NMEA 0183</b> menggunakan kalimat teks ASCII format <code>$AABBB,d1,d2...*hh&lt;CR&gt;&lt;LF&gt;</code> "
        "dengan validasi 8-bit XOR checksum. Koordinat format NMEA (DDMM.MMMM) dikonversi ke derajat desimal menggunakan rumus:\n"
        "<code>Lat = (DD + MM.MMMM / 60.0) * (Jika S maka -1)</code> dan <code>Lon = (DDD + MM.MMMM / 60.0) * (Jika W maka -1)</code>.",
        body_style
    ))
    story.append(Spacer(1, 4))

    nmea_data = [
        [Paragraph("Kalimat", table_head), Paragraph("Kategori & Parameter", table_head), Paragraph("Field Utama yang Diurai", table_head), Paragraph("Variabel Digital Twin", table_head)],
        [
            Paragraph("<b>$GPRMC</b>", table_cell_code),
            Paragraph("Navigasi Utama GPS", table_cell),
            Paragraph("Status (A/V), Lat, N/S, Lon, E/W, SOG (kn), COG (°), Tanggal", table_cell),
            Paragraph("<code>latitude, longitude, sog, cog</code>", table_cell)
        ],
        [
            Paragraph("<b>$GPGGA</b>", table_cell_code),
            Paragraph("Kualitas Fix GNSS", table_cell),
            Paragraph("Fix Quality (1=GPS, 2=DGPS), Jumlah Satelit, HDOP, Ketinggian", table_cell),
            Paragraph("<code>gnss_fix, satellites, hdop</code>", table_cell)
        ],
        [
            Paragraph("<b>$HEHDT</b>", table_cell_code),
            Paragraph("Haluan True Gyro", table_cell),
            Paragraph("Sudut Haluan (° True)", table_cell),
            Paragraph("<code>heading, heading_ref='True'</code>", table_cell)
        ],
        [
            Paragraph("<b>$HCHDG</b>", table_cell_code),
            Paragraph("Kompas Magnetik", table_cell),
            Paragraph("Haluan Magnetik, Sudut Deviasi, Sudut Variasi", table_cell),
            Paragraph("<code>heading, deviation, variation</code>", table_cell)
        ],
        [
            Paragraph("<b>$SDDPT</b>", table_cell_code),
            Paragraph("Kedalaman Echosounder", table_cell),
            Paragraph("Kedalaman air di bawah transduser (m), Offset lunas (m)", table_cell),
            Paragraph("<code>depth, depth_offset</code>", table_cell)
        ],
        [
            Paragraph("<b>$WIMWV</b>", table_cell_code),
            Paragraph("Arah & Kecepatan Angin", table_cell),
            Paragraph("Sudut Angin (0–359°), Referensi (R/T), Kecepatan (kn)", table_cell),
            Paragraph("<code>wind_angle, wind_speed</code>", table_cell)
        ],
        [
            Paragraph("<b>$TIROT</b>", table_cell_code),
            Paragraph("Laju Putar (Rate of Turn)", table_cell),
            Paragraph("Laju Putar (°/menit), Status Validitas (A/V)", table_cell),
            Paragraph("<code>rot = rot_min / 60.0</code>", table_cell)
        ],
        [
            Paragraph("<b>!AIVDM</b>", table_cell_code),
            Paragraph("Laporan AIS Kapal Sekitar", table_cell),
            Paragraph("Payload 6-bit: MMSI, SOG, COG, Heading, Koordinat Posisi", table_cell),
            Paragraph("<code>aisTargets (Peta Radar AIS)</code>", table_cell)
        ],
    ]
    tbl_n183 = Table(nmea_data, colWidths=[55, 120, 182, 130])
    tbl_n183.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY_DARK),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COL),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, SLATE_BG]),
        ('PADDING', (0,0), (-1,-1), 2.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(tbl_n183)

    story.append(PageBreak())

    # =========================================================================
    # HALAMAN 4: DECODE NMEA 2000 (FRAME 13-BYTE, PGN, FAST-PACKET)
    # =========================================================================
    story.append(Paragraph("6. SPESIFIKASI DEKODE NMEA 2000 (CAN BUS 13-BYTE)", h1_style))
    story.append(Paragraph(
        "Setiap frame CAN biner 13-byte dari USR-CANET200 diurai menjadi PGN dan nilai metrik terkalibrasi:\n"
        "• <b>Byte 0 (0x88):</b> Extended 29-bit CAN ID dan DLC 8 byte data.\n"
        "• <b>Byte 1..4 (CAN ID):</b> Format Big-Endian diekstrak menjadi PGN (PDU1 jika PF &lt; 240, PDU2 jika PF &ge; 240).\n"
        "• <b>Byte 5..12 (CAN Data):</b> Muatan data 8-byte format <b>Little-Endian</b>.",
        body_style
    ))
    story.append(Spacer(1, 4))

    pgn_data = [
        [Paragraph("PGN & Nama Parameter", table_head), Paragraph("Byte Offset", table_head), Paragraph("Resolusi / Skala", table_head), Paragraph("Formula Konversi Backend", table_head)],
        [
            Paragraph("<b>PGN 129025</b><br/>GNSS Position (Fix)", table_cell_bold),
            Paragraph("B[0..3]: Lat<br/>B[4..7]: Lon", table_cell_code),
            Paragraph("1e-7 deg / bit<br/>(32-bit signed int)", table_cell),
            Paragraph("<code>Lat = readInt32LE(0) * 1e-7</code><br/><code>Lon = readInt32LE(4) * 1e-7</code>", table_cell_code)
        ],
        [
            Paragraph("<b>PGN 129026</b><br/>COG & SOG Rapid", table_cell_bold),
            Paragraph("B[2..3]: COG<br/>B[4..5]: SOG", table_cell_code),
            Paragraph("COG: 0.0001 rad<br/>SOG: 0.01 m/s", table_cell),
            Paragraph("<code>COG(°) = readUInt16LE(2) * 0.0001 * (180/π)</code><br/><code>SOG(kn) = (readUInt16LE(4) * 0.01) * 1.943844</code>", table_cell_code)
        ],
        [
            Paragraph("<b>PGN 127250</b><br/>Vessel Heading", table_cell_bold),
            Paragraph("B[1..2]: Heading<br/>B[7]: Reference", table_cell_code),
            Paragraph("0.0001 rad / bit<br/>(16-bit uint)", table_cell),
            Paragraph("<code>Heading(°) = readUInt16LE(1) * 0.0001 * (180/π)</code><br/><code>Ref = (B[7] & 0x03) == 0 ? 'True' : 'Magnetic'</code>", table_cell_code)
        ],
        [
            Paragraph("<b>PGN 127257</b><br/>Attitude (Pitch/Roll)", table_cell_bold),
            Paragraph("B[3..4]: Pitch<br/>B[5..6]: Roll", table_cell_code),
            Paragraph("0.0001 rad / bit<br/>(16-bit signed int)", table_cell),
            Paragraph("<code>Pitch(°) = readInt16LE(3) * 0.0001 * (180/π)</code><br/><code>Roll(°)  = readInt16LE(5) * 0.0001 * (180/π)</code>", table_cell_code)
        ],
        [
            Paragraph("<b>PGN 128267</b><br/>Water Depth", table_cell_bold),
            Paragraph("B[1..4]: Depth<br/>B[5..6]: Offset", table_cell_code),
            Paragraph("Depth: 0.01 m<br/>Offset: 0.001 m", table_cell),
            Paragraph("<code>Depth(m) = readUInt32LE(1) * 0.01</code><br/><code>Offset(m) = readInt16LE(5) * 0.001</code>", table_cell_code)
        ],
        [
            Paragraph("<b>PGN 130306</b><br/>Wind Data", table_cell_bold),
            Paragraph("B[1..2]: Speed<br/>B[3..4]: Angle", table_cell_code),
            Paragraph("Speed: 0.01 m/s<br/>Angle: 0.0001 rad", table_cell),
            Paragraph("<code>WindSpeed(kn) = (readUInt16LE(1) * 0.01) * 1.943844</code><br/><code>WindAngle(°) = readUInt16LE(3) * 0.0001 * (180/π)</code>", table_cell_code)
        ],
        [
            Paragraph("<b>PGN 130310</b><br/>Environmental Temp", table_cell_bold),
            Paragraph("B[1..2]: Water<br/>B[3..4]: Air", table_cell_code),
            Paragraph("0.01 Kelvin / bit<br/>(16-bit uint)", table_cell),
            Paragraph("<code>WaterTemp(°C) = (readUInt16LE(1) * 0.01) - 273.15</code><br/><code>AirTemp(°C)   = (readUInt16LE(3) * 0.01) - 273.15</code>", table_cell_code)
        ],
        [
            Paragraph("<b>PGN 127488</b><br/>Engine Parameters", table_cell_bold),
            Paragraph("B[1..2]: RPM<br/>B[5]: Load %", table_cell_code),
            Paragraph("RPM: 0.25 rpm<br/>Load: 1 %", table_cell),
            Paragraph("<code>RPM = readUInt16LE(1) * 0.25</code><br/><code>EngineLoad(%) = readUInt8(5)</code>", table_cell_code)
        ],
    ]
    tbl_pgn = Table(pgn_data, colWidths=[110, 85, 102, 190])
    tbl_pgn.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY_DARK),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COL),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, SLATE_BG]),
        ('PADDING', (0,0), (-1,-1), 2.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(tbl_pgn)
    story.append(Spacer(1, 4))

    story.append(Paragraph(
        "• <b>Fast-Packet Reassembly (ISO 11783-3):</b> Mengurai pesan multi-frame berkapasitas besar seperti AIS PGN 129038 (28 byte) dan PGN 129794 (74 byte) berdasarkan Sequence ID dan Frame Index hingga buffer utuh terangkai.<br/>"
        "• <b>Integrasi Sensor Airmar DST810:</b> Menggabungkan kedalaman ultrasonik 235 kHz, kecepatan air STW 5 Hz, suhu air laut, dan dinamika ombak (Pitch & Roll 5 Hz).",
        body_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # HALAMAN 5: PANDUAN FITUR PLATFORM & PANDUAN UX (BAGIAN 1)
    # =========================================================================
    story.append(Paragraph("7. PANDUAN FITUR PLATFORM & PANDUAN UX (BAGIAN 1)", h1_style))
    
    story.append(Paragraph("7.1. Halaman Fleet Operations Overview", h2_style))
    story.append(Paragraph(
        "Halaman Overview berfungsi sebagai pusat kendali eksekutif pemantauan armada kapal:\n"
        "• <b>UX Auto-Refresh Background:</b> Data telemetri diperbarui secara otomatis di latar belakang tanpa me-refresh seluruh halaman peramban web, menjaga interaksi pengguna tetap stabil tanpa flicker.\n"
        "• <b>4 KPI Cards:</b> Menyajikan My Fleet Status (Underway vs Moored), Fleet Navigation (SOG rata-rata), Surrounding AIS Traffic (jumlah kapal dan target terdekat), serta Telemetry Health.\n"
        "• <b>Status Kapal Maritim:</b> Status <code>ONLINE</code> hijau saat stream data masuk, dan <code>OFFLINE</code> abu-abu/merah bila terputus melebihi threshold, lengkap dengan catatan tanggal dan jam terakhir data diterima (contoh: 28 Okt 2026 10:45).\n"
        "• <b>Digital Twin Snapshot & Mini Radar AIS:</b> Menampilkan pembacaan instrumen instan kapal aktif dan radar target kapal terdekat.",
        body_style
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("7.2. Halaman Marine Traffic (Situational Awareness AIS)", h2_style))
    story.append(Paragraph(
        "Peta radar interaktif situasi lalu lintas pelayaran berbasis OpenMapTiles:\n"
        "• <b>4 Pilihan Visual Peta:</b> Liberty Marine, Dark Nautical, Positron Light, dan Satellite Imagery.\n"
        "• <b>Own Ship Tracking:</b> Pelacakan posisi kapal sendiri dengan orientasi arah dan jejak rute historis 120 titik koordinat.\n"
        "• <b>Radar AIS Kapal Sekitar (Class A & B):</b> Menampilkan kapal target sekitar lengkap dengan nama, MMSI, Call Sign, IMO, kecepatan SOG, dan haluan COG.\n"
        "• <b>Peringatan Dini Tubrukan (CPA & TCPA Risk):</b> Sistem otomatis menghitung Closest Point of Approach (CPA) dan Time to CPA (TCPA). Peringatan darurat aktif otomatis jika target kapal mendekat dalam radius &le; 1.0 NM.",
        body_style
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("7.3. Halaman Vessel Assets & Dynamic Attributes", h2_style))
    story.append(Paragraph(
        "Pengelolaan kembaran digital kapal, gateway agen perantara, dan registrasi sinyal sensor:\n"
        "• <b>Manajemen Aset Kapal:</b> Formulir pendaftaran nama kapal, nomor IMO, MMSI, Call Sign, Tipe Kapal, dan Perusahaan Pemilik.\n"
        "• <b>Konfigurasi TCP Gateway Agent:</b> Mengatur pemetaan IP, port, dan token identitas gateway (contoh: <code>KM_ESP32</code>) ke kapal.\n"
        "• <b>Tab Overview vs Attributes:</b> Memisahkan identitas administratif dengan daftar parameter telemetri aktif kapal.\n"
        "• <b>Scan Signals & Dynamic Mapping:</b> Memindai sinyal baru yang masuk dari jaringan CAN/Serial dan mendaftarkan atribut sensor kustom tanpa mengubah skema tabel database SQL.\n"
        "• <b>Nama Atribut Bersih:</b> Semua nama variabel ditampilkan menggunakan display name ramah pengguna tanpa karakter underscore (_) seperti <i>Apparent Wind Speed</i> dan <i>Water Depth Below Keel</i>.",
        body_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # HALAMAN 6: PANDUAN FITUR PLATFORM & PANDUAN UX (BAGIAN 2)
    # =========================================================================
    story.append(Paragraph("7. PANDUAN FITUR PLATFORM & PANDUAN UX (BAGIAN 2)", h1_style))

    story.append(Paragraph("7.4. Halaman Monitoring Dashboard (Customizable Dynamic Canvas)", h2_style))
    story.append(Paragraph(
        "Dashboard instrumen visualisasi navigasi paling fleksibel berbasis Responsive Grid 12-kolom:\n"
        "• <b>Mode Edit (Modify Layout):</b> Tombol 'Modify Layout' membuka sidebar widget palette interaktif untuk menambah, memindahkan, atau menghapus widget drag-and-drop.\n"
        "• <b>Ragam Instrumen Maritim Lengkap:</b>\n"
        "  - <i>Speedometer Gauge:</i> Jarum kecepatan SOG / STW / RPM mesin dengan zona ambang batas warna.\n"
        "  - <i>Compass Rose Dial:</i> Kompas putar haluan kapal (Heading) dan arah gerak (COG).\n"
        "  - <i>Attitude Horizon Dial:</i> Indikator sudut oleng ombak (Roll / Heel) dan sudut angguk haluan (Pitch / Trim).\n"
        "  - <i>Airmar DST810 Triducer 3-in-1 Dial:</i> Dial multi-fungsi terpadu yang menampilkan kecepatan air pada jarum, serta kedalaman dan suhu air pada pill box SVG.\n"
        "  - <i>Echosounder / Sonar Water Column Bar Chart:</i> Visualisasi profil kolom kedalaman air laut vertikal dengan auto-zoom.\n"
        "  - <i>Dynamic Telemetry Card:</i> Kartu numerik dengan angka besar, satuan, ikon kategori, dan indikator data live.\n"
        "  - <i>Trend Line Chart:</i> Grafik tren historis nilai telemetri dari waktu ke waktu.\n"
        "  - <i>Telemetry Table Matrix:</i> Tabel matriks seluruh parameter sensor kapal terfilter per kategori.\n"
        "• <b>UX Penggantian Atribut Fleksibel per-Slot:</b> Pada widget multi-atribut (Triducer, Attitude, Compass), pengguna dapat mengklik langsung slot atribut yang ingin diganti (Slot 1 Primary, Slot 2 Secondary, atau Slot 3 Tertiary) tanpa mereset pilihan lainnya.\n"
        "• <b>UX Nama Variabel Bersih:</b> Di seluruh widget dial dan pill display, nama variabel otomatis mengambil nama display atribut asli tanpa tanda underscore (_) (contoh: <b>Apparent Wind Speed 3.8kn</b> bukan <code>wind_speed 3.8kn</code>). Lebar pill SVG otomatis menyesuaikan panjang teks secara adaptif.\n"
        "• <b>Auto-Save Snapshot & Publish Layout:</b> Perubahan tata letak kanvas tersimpan aman dalam snapshot draft dan dapat dipublikasikan ke seluruh tim pengguna melalui tombol 'Save Layout'.",
        body_style
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("7.5. Halaman Live Logs, Data Export, & User Management (RBAC)", h2_style))
    story.append(Paragraph(
        "• <b>Live Logs (Inspektur Paket Data Biner):</b> Terminal log streaming realtime dengan toggle auto-scroll dan tombol jeda. Menampilkan representasi frame biner heksadesimal USR-CANET200 13-byte dan kalimat ASCII serial NMEA berdampingan dengan decode JSON. Dilengkapi filter kapal, gateway, dan status koneksi live socket.\n"
        "• <b>Data Export (Audit & Arsip Telemetri Historis):</b> Modul pengunduhan data historis dengan pemilihan kapal dan multi-atribut. Mendukung pilihan rentang waktu cepat (1 Jam, 24 Jam, 7 Hari, 30 Hari, Custom Date Picker) dan interval downsampling (Raw hingga 1 Jam). Pratinjau tabel interaktif sebelum unduh ke format CSV dan JSON.\n"
        "• <b>User Management & Multi-Company Tenancy (RBAC):</b> Manajemen pengguna multi-organisasi dengan hierarki peran (Superadmin, Company Admin, Fleet Operator, Viewer). Seluruh endpoint memfilter data berdasarkan izin kapal pengguna (*Vessel Permission Scoping*), menjamin isolasi data antar-perusahaan pelayaran terisolasi aman tanpa risiko kebocoran (*Multi-Tenant Data Isolation*).",
        body_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # HALAMAN 7: TROUBLESHOOTING & LEMBAR PENGESAHAN DOKUMEN
    # =========================================================================
    story.append(Paragraph("8. PANDUAN TROUBLESHOOTING KENDALA LAPANGAN", h1_style))
    story.append(Paragraph(
        "Matriks identifikasi gejala masalah lapangan beserta tindakan korektif dan solusi teknisnya:",
        body_style
    ))
    story.append(Spacer(1, 4))

    tr_data = [
        [Paragraph("Gejala Kendala Lapangan", table_head), Paragraph("Kemungkinan Penyebab", table_head), Paragraph("Tindakan Solusi Teknis", table_head)],
        [
            Paragraph("<b>Web 192.168.0.7 tidak terbuka</b>", table_cell_bold),
            Paragraph("IP laptop tidak satu segmen dengan gateway, atau kabel LAN longgar.", table_cell),
            Paragraph("Atur IPv4 laptop ke IP statis 192.168.0.100 subnet 255.255.255.0. Uji dengan perintah ping. Bila gagal, tahan tombol Reload 5 detik untuk reset pabrik.", table_cell)
        ],
        [
            Paragraph("<b>Gateway gagal connect ke server VMS</b>", table_cell_bold),
            Paragraph("IP tujuan atau port salah, atau router onboard memblokir port 20005/20006.", table_cell),
            Paragraph("Periksa konfigurasi Socket A USR-CANET200 (Remote Port 20005 untuk CAN dan 20006 untuk Serial). Pastikan firewall router mengizinkan koneksi outbound.", table_cell)
        ],
        [
            Paragraph("<b>LED CAN1 mati / Data N2K tidak masuk</b>", table_cell_bold),
            Paragraph("Baudrate bukan 250k, kabel CAN_H/CAN_L terbalik, atau resistor 120 Ω tidak ada.", table_cell),
            Paragraph("Pastikan baudrate CAN1 diset tepat 250 Kbps. Periksa kontinuitas kabel CAN. Ukur resistansi antar CAN_H dan CAN_L saat daya mati (harus ~60 Ω karena dua resistor 120 Ω paralel).", table_cell)
        ],
        [
            Paragraph("<b>Status kapal selalu OFFLINE</b>", table_cell_bold),
            Paragraph("Identity token pada gateway tidak cocok dengan nama token agent kapal.", table_cell),
            Paragraph("Periksa menu Identity Packet pada USR-CANET200. Pastikan token (contoh: 'KM_ESP32\\r\\n') sama persis dengan Agent Token di halaman Vessel Assets platform VMS.", table_cell)
        ],
    ]
    tbl_tr = Table(tr_data, colWidths=[120, 160, 207])
    tbl_tr.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY_DARK),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COL),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, SLATE_BG]),
        ('PADDING', (0,0), (-1,-1), 3.0),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(tbl_tr)
    story.append(Spacer(1, 10))

    story.append(Paragraph("9. KESIMPULAN & LEMBAR PENGESAHAN DOKUMEN", h1_style))
    story.append(Paragraph(
        "Penerapan Standar Operasional Prosedur (SOP) dan Panduan Pengguna ini menjamin integrasi modul telemetri USR-CANET200 "
        "ke sistem GeoTekno VMS berjalan presisi, stabil, dan aman. Dengan menerapkan parameter baudrate 250 Kbps N2K, "
        "koneksi TCP Client port 20005/20006 ber-handshake token, serta pemanfaatan antarmuka kanvas monitoring fleksibel tanpa underscore, "
        "pengawasan operasional armada maritim dapat terlaksana secara realtime dengan standar industri maritim internasional.",
        body_style
    ))
    story.append(Spacer(1, 20))

    # Tanda Tangan & Persetujuan Dokumen
    sign_data = [
        [
            Paragraph("<b>Dipersiapkan & Disusun Oleh:</b><br/><br/><br/><br/><u>Tim Product Engineering & IoT Maritim</u><br/>PT Geo Tekno Maritim Indonesia", table_cell),
            Paragraph("<b>Diverifikasi & Disahkan Oleh:</b><br/><br/><br/><br/><u>Head of Marine Technology & Operations</u><br/>PT Geo Tekno Maritim Indonesia", table_cell),
        ]
    ]
    sign_table = Table(sign_data, colWidths=[243, 244])
    sign_table.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,-1), 1, BORDER_COL),
        ('PADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(KeepTogether(sign_table))

    # Build PDF menggunakan NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[SUCCESS] PDF berhasil digenerate di: {output_path}")

if __name__ == '__main__':
    out_dir = os.path.join(os.path.dirname(__file__), "..", "doc")
    os.makedirs(out_dir, exist_ok=True)
    target_pdf = os.path.abspath(os.path.join(out_dir, "Dokumentasi_Platform_Box_Navigasi_dan_Decode_NMEA.pdf"))
    create_documentation_pdf(target_pdf)
