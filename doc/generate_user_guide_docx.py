# -*- coding: utf-8 -*-
"""
Generator Skrip Dokumen Word: Format Tata Letak Skripsi Formal (Revisi Ringkas)
Topik Inti:
1. Pengenalan dan Prinsip Kerja Gateway USR-CANET200 (Tanpa pengkabelan fisik & spesifikasi elektrikal)
2. Format Data NMEA 2000 (CAN Bus Maritim, PGN 29-bit, Transparan 13-byte, PGN Transduser)
3. Format Data NMEA 0183 (Serial ASCII, Struktur $, DPT, MTW, RMC, HDT, Komparasi)
4. Konfigurasi Komunikasi CAN ke TCP dengan Mode Client (Baud 250k, Trigger 10ms/50, Port 20005, Heartbeat)
5. Pengisian dan Integrasi Register Content (Identity Packet, Connect with Sending, Sinkronisasi VMS)

Format Desain:
- Gaya Penulisan Skripsi / Karya Ilmiah Formal
- Tipografi: Times New Roman, Hitam Monokrom Murni (Tanpa kata berwarna / highlight)
- Paragraf: Spasi 1.5, Rata Kiri-Kanan (Justified), Indentasi Baris Pertama 1 cm
- Dilengkapi Halaman Judul, Daftar Isi (TOC) dengan dot leader, dan Daftar Tabel
- Tabel Ilmiah (Three-Line Table APA/IEEE, tanpa garis vertikal)
- Preservasi Background Template Asli User Guide.docx 100%
"""

import os
import io
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

COLOR_BLACK = RGBColor(0, 0, 0)

def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tc_pr.append(tc_mar)

def set_three_line_borders(table):
    """
    Standar Tabel Ilmiah (Three-Line Table APA/IEEE):
    - Garis atas tebal (1.0 pt = sz 8)
    - Garis bawah tebal (1.0 pt = sz 8)
    - Garis pemisah baris judul/header tipis (0.5 pt = sz 4)
    - Tanpa garis vertikal (none)
    """
    tbl_pr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/>'
        f'<w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/>'
        f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        f'<w:insideV w:val="none"/>'
        f'<w:left w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tblBorders>'
    )
    tbl_pr.append(borders)

def add_title(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(14)
    run.font.bold = True
    run.font.color.rgb = COLOR_BLACK
    return p

def add_subtitle(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(18)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    run.font.bold = True
    run.font.color.rgb = COLOR_BLACK
    return p

def add_heading_1(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.keep_with_next = True
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    run.font.bold = True
    run.font.color.rgb = COLOR_BLACK
    return p

def add_heading_2(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.keep_with_next = True
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    run.font.bold = True
    run.font.color.rgb = COLOR_BLACK
    return p

def add_heading_3(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.keep_with_next = True
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    run.font.bold = True
    run.font.color.rgb = COLOR_BLACK
    return p

def add_figure_caption(doc, label, title):
    """Caption gambar gaya skripsi: di bawah gambar, rata tengah."""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(12)
    p.paragraph_format.line_spacing = 1.15
    r1 = p.add_run(label + " ")
    r1.font.name = "Times New Roman"
    r1.font.size = Pt(11)
    r1.font.bold = True
    r1.font.color.rgb = COLOR_BLACK
    r2 = p.add_run(title)
    r2.font.name = "Times New Roman"
    r2.font.size = Pt(11)
    r2.font.italic = True
    r2.font.color.rgb = COLOR_BLACK
    return p

def add_paragraph(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.first_line_indent = Inches(0.39) # 1 cm indentasi formal skripsi
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    run.font.color.rgb = COLOR_BLACK
    return p

def add_bullet_item(doc, text, bold_prefix=None):
    p = doc.add_paragraph(style="List Paragraph")
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.left_indent = Inches(0.5)
    if bold_prefix:
        rb = p.add_run(bold_prefix)
        rb.font.name = "Times New Roman"
        rb.font.size = Pt(12)
        rb.font.bold = True
        rb.font.color.rgb = COLOR_BLACK
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    run.font.color.rgb = COLOR_BLACK
    return p

def add_table_caption(doc, label, title):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.keep_with_next = True
    r1 = p.add_run(label + " ")
    r1.font.name = "Times New Roman"
    r1.font.size = Pt(11)
    r1.font.bold = True
    r1.font.color.rgb = COLOR_BLACK
    r2 = p.add_run(title)
    r2.font.name = "Times New Roman"
    r2.font.size = Pt(11)
    r2.font.italic = True
    r2.font.color.rgb = COLOR_BLACK
    return p

def add_code_snippet(doc, code_str):
    """Kotak teks kode teknis monokrom gaya skripsi."""
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        f'<w:left w:val="single" w:sz="12" w:space="0" w:color="000000"/>'
        f'<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        f'</w:tcBorders>'
    )
    tc_pr.append(borders)
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(code_str)
    run.font.name = "Courier New"
    run.font.size = Pt(9.5)
    run.font.color.rgb = COLOR_BLACK
    sp = doc.add_paragraph()
    sp.paragraph_format.space_before = Pt(0)
    sp.paragraph_format.space_after = Pt(4)

def add_toc_line(doc, title, page_str, level=1):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    
    if level == 1:
        p.paragraph_format.left_indent = Inches(0)
    elif level == 2:
        p.paragraph_format.left_indent = Inches(0.25)
    else:
        p.paragraph_format.left_indent = Inches(0.45)
    
    p_pr = p._p.get_or_add_pPr()
    tabs = parse_xml(
        f'<w:tabs {nsdecls("w")}>'
        f'<w:tab w:val="right" w:leader="dot" w:pos="9360"/>'
        f'</w:tabs>'
    )
    p_pr.append(tabs)
    
    r_text = p.add_run(title)
    r_text.font.name = "Times New Roman"
    r_text.font.size = Pt(11)
    if level == 1:
        r_text.font.bold = True
    r_text.font.color.rgb = COLOR_BLACK

    r_tab = p.add_run("\t" + page_str)
    r_tab.font.name = "Times New Roman"
    r_tab.font.size = Pt(11)
    if level == 1:
        r_tab.font.bold = True
    r_tab.font.color.rgb = COLOR_BLACK

def main():
    docx_path = os.path.join(os.path.dirname(__file__), "User Guide.docx")
    print(f"Loading document: {docx_path}")
    with open(docx_path, "rb") as f:
        file_bytes = io.BytesIO(f.read())
    doc = docx.Document(file_bytes)

    # Bersihkan seluruh paragraf dan tabel isi tanpa menyentuh background/header/section
    while len(doc.paragraphs) > 0:
        p = doc.paragraphs[0]
        p._p.getparent().remove(p._p)
    while len(doc.tables) > 0:
        t = doc.tables[0]
        t._tbl.getparent().remove(t._tbl)

    print("Mengisikan materi terfokus tanpa bagian pengkabelan dan spesifikasi fisik USR...")

    # =========================================================================
    # HALAMAN JUDUL FORMAL
    # =========================================================================
    add_title(doc, "PANDUAN TEKNIS INTEGRASI KOMUNIKASI DATA MARITIM\nMENGGUNAKAN GATEWAY CAN TO ETHERNET TCP CLIENT\nPADA SISTEM PEMANTAUAN KAPAL (VESSEL MONITORING SYSTEM)")
    add_subtitle(doc, "Kajian Implementasi Protokol NMEA 2000, NMEA 0183, dan Mekanisme Registrasi Aset Telemetri")

    # Identitas Ringkas Dokumen (Tabel Formal Monokrom)
    doc_meta = [
        ("Dokumen Acuan Standar", "USR-CANET200 User Manual V1.0.4.01, NMEA 2000 Standard, & NMEA 0183 Standard"),
        ("Sasaran Pengguna", "Teknisi Instrumentasi Kelautan, Field Engineer, dan Tim Pengembang VMS"),
        ("Fokus Pembahasan", "Fungsi Gateway, Format NMEA 2000, Format NMEA 0183, Mode TCP Client, dan Register Content"),
        ("Target Platform Server", "NautiCore Geotekno VMS Gateway (Listening Port: 20005 & 20006)"),
    ]
    tbl_meta = doc.add_table(rows=len(doc_meta), cols=2)
    tbl_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_three_line_borders(tbl_meta)
    for i, (k, v) in enumerate(doc_meta):
        c0 = tbl_meta.cell(i, 0)
        c1 = tbl_meta.cell(i, 1)
        set_cell_margins(c0, 60, 60, 100, 100)
        set_cell_margins(c1, 60, 60, 100, 100)
        p0 = c0.paragraphs[0]
        p0.paragraph_format.line_spacing = 1.15
        r0 = p0.add_run(k)
        r0.font.name = "Times New Roman"
        r0.font.size = Pt(10)
        r0.font.bold = True
        r0.font.color.rgb = COLOR_BLACK

        p1 = c1.paragraphs[0]
        p1.paragraph_format.line_spacing = 1.15
        r1 = p1.add_run(v)
        r1.font.name = "Times New Roman"
        r1.font.size = Pt(10)
        r1.font.color.rgb = COLOR_BLACK

    doc.add_page_break()

    # =========================================================================
    # DAFTAR ISI (TABLE OF CONTENTS)
    # =========================================================================
    h_toc = doc.add_paragraph()
    h_toc.alignment = WD_ALIGN_PARAGRAPH.CENTER
    h_toc.paragraph_format.space_before = Pt(6)
    h_toc.paragraph_format.space_after = Pt(14)
    r_toc = h_toc.add_run("DAFTAR ISI")
    r_toc.font.name = "Times New Roman"
    r_toc.font.size = Pt(13)
    r_toc.font.bold = True
    r_toc.font.color.rgb = COLOR_BLACK

    toc_entries = [
        ("DAFTAR TABEL", "iii", 1),
        ("DAFTAR GAMBAR", "iv", 1),
        ("1. PENGENALAN DAN PRINSIP KERJA GATEWAY USR-CANET200", "1", 1),
        ("   1.1 Gambaran Umum dan Peran Fungsional Gateway", "1", 2),
        ("   1.2 Topologi dan Arsitektur Konversi Data pada Sistem VMS", "1", 2),
        ("2. FORMAT DATA NMEA 2000 PADA JARINGAN CAN BUS MARITIM", "3", 1),
        ("   2.1 Struktur Parameter Group Number (PGN) dan Identifier 29-Bit", "3", 2),
        ("   2.2 Protokol Transmisi Transparan 13-Byte USR-CANET200", "3", 2),
        ("   2.3 Format PGN Utama Telemetri Navigasi dan Transduser", "4", 2),
        ("3. FORMAT DATA NMEA 0183 PADA KOMUNIKASI SERIAL MARITIM", "6", 1),
        ("   3.1 Struktur Kalimat ASCII NMEA 0183", "6", 2),
        ("   3.2 Kalimat Standar Sensor Kedalaman, Suhu, dan Navigasi", "6", 2),
        ("   3.3 Analisis Perbandingan Karakteristik NMEA 2000 dan NMEA 0183", "7", 2),
        ("4. KONFIGURASI KOMUNIKASI CAN KE TCP DENGAN MODE CLIENT", "9", 1),
        ("   4.1 Konsep dan Keunggulan Mode TCP Client pada Jaringan Kapal", "9", 2),
        ("   4.2 Prosedur Pengaturan Parameter Antarmuka CAN", "9", 2),
        ("   4.3 Pengaturan Parameter Soket Jaringan TCP Client", "10", 2),
        ("   4.4 Mekanisme Rekoneksi Otomatis dan Heartbeat Jaringan", "11", 2),
        ("5. PENGISIAN DAN INTEGRASI REGISTER CONTENT (IDENTITY PACKET)", "12", 1),
        ("   5.1 Urgensi Register Content pada Shared Gateway VMS", "12", 2),
        ("   5.2 Prosedur Konfigurasi Identity Packet pada Perangkat", "12", 2),
        ("   5.3 Mekanisme Verifikasi dan Sinkronisasi Sisi Platform VMS", "13", 2),
    ]

    for title_txt, page_no, lvl in toc_entries:
        add_toc_line(doc, title_txt.strip(), page_no, level=lvl)

    doc.add_page_break()

    # =========================================================================
    # DAFTAR TABEL
    # =========================================================================
    h_tot = doc.add_paragraph()
    h_tot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    h_tot.paragraph_format.space_before = Pt(6)
    h_tot.paragraph_format.space_after = Pt(14)
    r_tot = h_tot.add_run("DAFTAR TABEL")
    r_tot.font.name = "Times New Roman"
    r_tot.font.size = Pt(13)
    r_tot.font.bold = True
    r_tot.font.color.rgb = COLOR_BLACK

    tot_entries = [
        ("Tabel 2.1 Struktur Paket Biner Transparan 13-Byte USR-CANET200", "4"),
        ("Tabel 2.2 Parameter Group Number (PGN) Utama pada Sistem VMS", "5"),
        ("Tabel 3.1 Daftar Kalimat Standar NMEA 0183 pada Sistem Navigasi", "8"),
        ("Tabel 3.2 Analisis Perbandingan Antara NMEA 2000 dan NMEA 0183", "9"),
        ("Tabel 4.1 Parameter Konfigurasi Soket TCP Client USR-CANET200", "11"),
        ("Tabel 5.1 Parameter Konfigurasi Identity Packet (Register Content)", "14"),
    ]

    for t_caption, t_page in tot_entries:
        add_toc_line(doc, t_caption, t_page, level=1)

    doc.add_page_break()

    # =========================================================================
    # DAFTAR GAMBAR
    # =========================================================================
    h_tof = doc.add_paragraph()
    h_tof.alignment = WD_ALIGN_PARAGRAPH.CENTER
    h_tof.paragraph_format.space_before = Pt(6)
    h_tof.paragraph_format.space_after = Pt(14)
    r_tof = h_tof.add_run("DAFTAR GAMBAR")
    r_tof.font.name = "Times New Roman"
    r_tof.font.size = Pt(13)
    r_tof.font.bold = True
    r_tof.font.color.rgb = COLOR_BLACK

    add_toc_line(doc, "Gambar 1.1 Arsitektur Sistem Integrasi Telemetri Kapal ke Dashboard Cloud VMS", "2", level=1)

    doc.add_page_break()

    # =========================================================================
    # 1. PENGENALAN DAN PRINSIP KERJA GATEWAY USR-CANET200
    # =========================================================================
    add_heading_1(doc, "1. PENGENALAN DAN PRINSIP KERJA GATEWAY USR-CANET200")

    add_heading_2(doc, "1.1 Gambaran Umum dan Peran Fungsional Gateway")
    add_paragraph(doc, 
        "Perangkat gateway USR-CANET200 merupakan unit konverter industri cerdas yang berfungsi sebagai jembatan komunikasi dua arah "
        "(bi-directional converter) antara jaringan Controller Area Network (CAN bus) dengan jaringan Ethernet berbasis protokol Internet Protocol (TCP/IP). "
        "Di dalam sistem pemantauan kapal terpadu (Vessel Monitoring System / VMS), perangkat ini bertindak sebagai simpul sentral akuisisi data. "
        "Gateway bertugas menangkap aliran paket telemetri navigasi dan instrumentasi kapal dari jaringan backbone NMEA 2000, "
        "mengemas frame-frame biner tersebut ke dalam format paket jaringan standar, dan mengirimkannya secara kontinu menuju server VMS di darat "
        "melalui router internet kapal (Starlink, VSAT, atau router seluler)."
    )
    add_paragraph(doc, 
        "Fungsi konversi ini sangat penting karena protokol CAN bus maritim bekerja pada lapisan fisik kabel diferensial tertutup dengan jangkauan terbatas, "
        "sementara pemantauan armada kapal modern menuntut transmisi jarak jauh berbasis cloud. Dengan mengonversi frame CAN menjadi paket TCP/IP, "
        "seluruh parameter kapal seperti kedalaman air dari transduser suara bawah air, suhu permukaan laut, haluan gyrocompass, koordinat GPS, "
        "dan target lalu lintas AIS dapat dipantau dari stasiun darat secara waktu nyata (real-time)."
    )

    add_heading_2(doc, "1.2 Topologi dan Arsitektur Konversi Data pada Sistem VMS")
    add_paragraph(doc, 
        "Arsitektur sistem integrasi telemetri kapal disusun secara berlapis, dimulai dari instrumen navigasi fisik di atas kapal hingga "
        "data tersaji pada dashboard berbasis cloud di pusat data darat. Secara garis besar, sistem terbagi menjadi dua domain utama, yaitu "
        "domain on-board (jaringan instrumen di atas kapal) dan domain cloud (pusat data darat), yang dihubungkan oleh jaringan internet "
        "berbasis TCP/IP. Gambaran topologi lengkap sistem ditunjukkan pada Gambar 1.1."
    )

    # --- Gambar 1.1 Arsitektur Sistem ---
    img_path = os.path.join(os.path.dirname(__file__), "arsitektur_sistem_vms.png")
    if os.path.exists(img_path):
        sec = doc.sections[0]
        usable_w = sec.page_width - sec.left_margin - sec.right_margin
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(2)
        p_img.paragraph_format.keep_with_next = True
        p_img.add_run().add_picture(img_path, width=usable_w)
    add_figure_caption(doc, "Gambar 1.1", "Arsitektur Sistem Integrasi Telemetri Kapal ke Dashboard Cloud VMS")

    add_paragraph(doc, 
        "Berdasarkan Gambar 1.1, aliran data telemetri bergerak dari kiri ke kanan melalui enam tahapan utama. "
        "Penjelasan fungsi dari masing-masing tahapan adalah sebagai berikut."
    )

    add_heading_3(doc, "a. Perangkat Navigasi")
    add_paragraph(doc, 
        "Tahap pertama merupakan sumber data telemetri, yaitu instrumen navigasi dan sensor kelautan yang terpasang di atas kapal. "
        "GPS/GNSS Receiver menghasilkan data posisi lintang-bujur, kecepatan terhadap dasar (SOG), dan arah gerak (COG). Gyrocompass "
        "menghasilkan data haluan kapal (heading) beserta sudut pitch dan roll. Transducer echosounder (misalnya Garmin GT15M atau Airmar "
        "DST810) mengukur kedalaman air di bawah lunas serta suhu permukaan air laut. Wind sensor mengukur kecepatan dan arah angin, "
        "sedangkan AIS Transponder menerima laporan posisi kapal-kapal lain di sekitarnya. Selain itu, terdapat pula perangkat lama "
        "(legacy) yang hanya mendukung protokol NMEA 0183, seperti echosounder atau radar konvensional."
    )

    add_heading_3(doc, "b. Backbone Jaringan NMEA 2000 dan NMEA 0183")
    add_paragraph(doc, 
        "Seluruh perangkat berbasis NMEA 2000 terhubung secara paralel ke satu jalur tulang punggung (backbone) CAN bus melalui kabel "
        "cabang (drop cable). Backbone ini beroperasi pada kecepatan 250 kbps dan wajib diberi resistor terminasi 120 Ohm pada kedua "
        "ujungnya untuk mencegah pantulan sinyal. Data dikirimkan dalam bentuk frame biner yang diidentifikasi oleh Parameter Group "
        "Number (PGN) 29-bit. Adapun perangkat NMEA 0183 dihubungkan melalui jalur serial terpisah (RS-422/RS-485) dengan kecepatan "
        "4800 bps, di mana data dikirimkan dalam bentuk kalimat teks ASCII seperti $SDDPT, $SDMTW, dan $GPRMC."
    )

    add_heading_3(doc, "c. Gateway USR-CANET200")
    add_paragraph(doc, 
        "USR-CANET200 berperan sebagai jembatan antara jaringan instrumen kapal dan jaringan Ethernet. Port CAN pada gateway terhubung "
        "ke backbone NMEA 2000 melalui jalur CAN_H dan CAN_L, sedangkan port serial menerima kalimat NMEA 0183. Setiap frame CAN yang "
        "diterima dikemas menjadi paket transparan 13-Byte, kemudian dikirimkan melalui koneksi TCP Client menuju server VMS. "
        "Saat koneksi pertama kali terbentuk, gateway mengirimkan Register Content (misalnya \"KM_Uno\") sebagai identitas kapal, "
        "dan secara berkala mengirimkan paket heartbeat setiap 30 detik untuk menjaga koneksi tetap aktif."
    )

    add_heading_3(doc, "d. Router Internet Kapal (Starlink, VSAT, atau Router Seluler)")
    add_paragraph(doc, 
        "Gateway USR-CANET200 terhubung ke router internet kapal (NavBox Gateway) menggunakan kabel LAN RJ45. Router internet ini menyediakan "
        "akses telekomunikasi ke darat dengan memanfaatkan koneksi terminal satelit Starlink Maritime, VSAT (Very Small Aperture Terminal), maupun "
        "modem router seluler multi-SIM (4G/LTE), tergantung zona pelayaran dan ketersediaan sinyal di laut. Router menjalankan fungsi Network Address "
        "Translation (NAT) dan DHCP untuk jaringan lokal kapal, sehingga modul gateway cukup beroperasi menggunakan alamat IP privat. Karena gateway "
        "bekerja dalam mode TCP Client, inisiasi koneksi socket selalu dikirim dari kapal ke server cloud publik, mengeliminasi kebutuhan IP publik statis "
        "pada uplink satelit atau kartu seluler."
    )

    add_heading_3(doc, "e. Jaringan Internet TCP/IP")
    add_paragraph(doc, 
        "Paket data dari router kapal diteruskan melalui jaringan internet publik menuju alamat IP server VMS. Protokol TCP menjamin "
        "bahwa setiap paket diterima secara utuh dan berurutan. Server menyediakan dua port tujuan, yaitu Port 20005 untuk aliran "
        "data NMEA 2000 dari gateway CAN, dan Port 20006 untuk aliran kalimat NMEA 0183."
    )

    add_heading_3(doc, "f. Server dan Dashboard Cloud VMS")
    add_paragraph(doc, 
        "Pada sisi darat, VMS Cloud Server (backend Node.js yang berjalan di atas Docker) menerima koneksi pada port 20005 dan 20006. "
        "Server terlebih dahulu memvalidasi Register Content untuk mengenali kapal pengirim, kemudian mendekode setiap PGN NMEA 2000 "
        "maupun kalimat NMEA 0183 menjadi nilai telemetri yang bermakna. Data hasil dekode disimpan ke basis data PostgreSQL/PostGIS "
        "dan sekaligus disiarkan secara waktu nyata melalui WebSocket. Selanjutnya, Dashboard Web VMS yang diakses melalui browser "
        "menampilkan data tersebut dalam bentuk peta posisi dan lintasan kapal, widget Depth Column (echosounder CHIRP), indikator "
        "heading, angin, dan kecepatan, serta halaman Live Logs dan fitur ekspor data."
    )

    add_paragraph(doc, 
        "Dengan arsitektur berlapis ini, setiap komponen memiliki peran yang jelas dan terpisah, sehingga proses instalasi, "
        "konfigurasi, maupun penelusuran gangguan dapat dilakukan secara terstruktur pada setiap tahapan."
    )

    # =========================================================================
    # 2. FORMAT DATA NMEA 2000 PADA JARINGAN CAN BUS MARITIM
    # =========================================================================
    add_heading_1(doc, "2. FORMAT DATA NMEA 2000 PADA JARINGAN CAN BUS MARITIM")

    add_heading_2(doc, "2.1 Struktur Parameter Group Number (PGN) dan Identifier 29-Bit")
    add_paragraph(doc, 
        "Pada format CAN 2.0B Extended Frame, identifier pesan memiliki panjang 29-bit. Struktur identifier ini dipecah ke dalam beberapa elemen kendali "
        "yang membentuk Parameter Group Number (PGN), yaitu kode acuan standar yang mendefinisikan jenis informasi yang dibawa oleh frame. "
        "Struktur pembagian identifier 29-bit adalah sebagai berikut:"
    )
    add_bullet_item(doc, "Bit 28 s.d. Bit 26 (3 bit) menentukan derajat urgensi pesan di jalur bus (nilai 0 merupakan prioritas tertinggi, nilai 7 terendah).", "Priority (P): ")
    add_bullet_item(doc, "Bit 25 (Reserved) dan Bit 24 (Data Page) digunakan untuk memperluas rentang alokasi kelompok PGN numerik.", "Reserved & Data Page (DP): ")
    add_bullet_item(doc, "Bit 23 s.d. Bit 16 (8 bit) menentukan apakah pesan ditujukan secara khusus ke simpul tertentu (PDU1) atau disiarkan ke seluruh simpul jaringan (PDU2).", "PDU Format (PF): ")
    add_bullet_item(doc, "Bit 15 s.d. Bit 8 (8 bit) berfungsi sebagai alamat tujuan spesifik (Destination Address) pada format PDU1 atau sebagai pengenal grup tambahan pada format PDU2.", "PDU Specific (PS): ")
    add_bullet_item(doc, "Bit 7 s.d. Bit 0 (8 bit) memuat nomor alamat fisik perangkat pemancar data di dalam jaringan bus (Source Address, rentang 0-253).", "Source Address (SA): ")

    add_heading_2(doc, "2.2 Protokol Transmisi Transparan 13-Byte USR-CANET200")
    add_paragraph(doc, 
        "Sesuai dengan Bagian 2.2.4 buku panduan resmi USR-CANET200 User Manual, modul gateway secara otomatis mengonversi setiap frame CAN bus "
        "yang ditangkap menjadi format paket data biner Ethernet sepanjang tepat 13 Byte. Struktur paket ini sangat ringkas, bebas overhead, "
        "dan diproses secara transparan oleh mesin dekoder backend VMS."
    )

    add_table_caption(doc, "Tabel 2.1", "Struktur Paket Biner Transparan 13-Byte USR-CANET200")
    t4_data = [
        ("Indeks Byte", "Nama Elemen Protokol", "Deskripsi dan Pemetaan Bit Data"),
        ("Byte 0", "Frame Information (1 Byte)", "Bit 7: FF (1 = Extended Frame 29-bit), Bit 6: RTR (0 = Data Frame), Bit 3-0: DLC (8 Byte data). Nilai hex default: 0x88."),
        ("Byte 1", "CAN ID Byte 3 (MSB)", "Byte tertinggi dari identifier 29-bit (Priority + Data Page)."),
        ("Byte 2", "CAN ID Byte 2", "Bagian tengah identifier (PDU Format / PGN bagian atas)."),
        ("Byte 3", "CAN ID Byte 1", "Bagian tengah identifier (PDU Specific / PGN bagian bawah)."),
        ("Byte 4", "CAN ID Byte 0 (LSB)", "Byte terendah identifier, memuat Source Address perangkat sensor pengirim."),
        ("Byte 5 s.d. 12", "Data Field (8 Byte)", "8 Byte muatan biner aktual dari sensor navigasi / transduser."),
    ]
    tbl_4 = doc.add_table(rows=len(t4_data), cols=3)
    tbl_4.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_three_line_borders(tbl_4)
    for row_idx, r_items in enumerate(t4_data):
        for col_idx, text_val in enumerate(r_items):
            cell = tbl_4.cell(row_idx, col_idx)
            set_cell_margins(cell, 60, 60, 100, 100)
            p = cell.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(text_val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(10)
            if row_idx == 0:
                run.font.bold = True
            run.font.color.rgb = COLOR_BLACK

    add_paragraph(doc, 
        "Sebagai contoh implementasi nyata, perhatikan aliran heksadesimal mentah yang diterima dari transduser suara bawah air kapal berikut:"
    )
    add_code_snippet(doc, 
        "Contoh Paket Heksadesimal Mentah (13 Byte Transparan):\n"
        "88 09 F5 16 00 FF 56 74 FF FF FF FF FF\n"
        "- Byte 0   : 0x88 (Extended Frame, DLC = 8 Byte Data)\n"
        "- Byte 1-4 : 0x09F51600 -> PGN 130310 (Environmental Parameters), Source Address = 0x00 (Transduser)\n"
        "- Byte 5-12: FF 56 74 FF FF FF FF FF\n"
        "  * Byte 6-7 (0x7456 Little-Endian = 29.782 Kelvin x 0,01) = 297,82 K - 273,15 = 24,67 °C (Suhu Air Laut)\n"
        "  * Byte 8-12 bernilai 0xFF (Parameter suhu udara dan tekanan barometer tidak disediakan oleh transduser)"
    )

    add_heading_2(doc, "2.3 Format PGN Utama Telemetri Navigasi dan Transduser")
    add_paragraph(doc, 
        "Di dalam arsitektur platform VMS, terdapat beberapa PGN utama yang didekode secara aktif guna mendukung fungsionalitas pemantauan kapal. "
        "Tabel 2.2 merangkum daftar PGN standar industri maritim beserta parameter telemetri yang diekstraksi."
    )

    add_table_caption(doc, "Tabel 2.2", "Parameter Group Number (PGN) Utama pada Sistem VMS")
    t5_data = [
        ("Nomor PGN", "Nama Deskripsi PGN", "Frekuensi Pancar", "Muatan Data Navigasi yang Didekode"),
        ("PGN 128267", "Water Depth (Kedalaman Air)", "1 Hz (1 detik)", "Kedalaman air bawah transduser (depth_m) dan offset lunas kapal."),
        ("PGN 130310", "Environmental Parameters", "1 Hz (1 detik)", "Suhu air permukaan laut (water_temp_c) dari transduser akustik."),
        ("PGN 127250", "Vessel Heading (Haluan Kapal)", "10 Hz (100 ms)", "Derajat orientasi haluan kompas gyrocompass kapal (heading_deg)."),
        ("PGN 129025", "Position, Rapid Update", "10 Hz (100 ms)", "Titik koordinat posisi lintang dan bujur real-time (latitude, longitude)."),
        ("PGN 129026", "COG & SOG, Rapid Update", "4 Hz (250 ms)", "Arah gerak Course Over Ground (cog) dan laju Speed Over Ground (sog)."),
        ("PGN 130306", "Wind Data (Kecepatan Angin)", "1 Hz (1 detik)", "Kecepatan angin nyata/relatif (wind_speed) dan sudut datang angin."),
        ("PGN 129038", "AIS Class A Position Report", "Periodik dinamis", "Posisi target navigasi kapal lain di sekitar (MMSI, SOG, Posisi)."),
    ]
    tbl_5 = doc.add_table(rows=len(t5_data), cols=4)
    tbl_5.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_three_line_borders(tbl_5)
    for row_idx, r_items in enumerate(t5_data):
        for col_idx, text_val in enumerate(r_items):
            cell = tbl_5.cell(row_idx, col_idx)
            set_cell_margins(cell, 60, 60, 100, 100)
            p = cell.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(text_val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(10)
            if row_idx == 0:
                run.font.bold = True
            run.font.color.rgb = COLOR_BLACK

    # =========================================================================
    # 3. FORMAT DATA NMEA 0183 PADA KOMUNIKASI SERIAL MARITIM
    # =========================================================================
    add_heading_1(doc, "3. FORMAT DATA NMEA 0183 PADA KOMUNIKASI SERIAL MARITIM")

    add_heading_2(doc, "3.1 Struktur Kalimat ASCII NMEA 0183")
    add_paragraph(doc, 
        "Setiap transmisi data pada NMEA 0183 dibentuk dalam susunan kalimat teks ASCII yang dapat dibaca langsung oleh manusia. "
        "Struktur sintaksis kalimat NMEA 0183 diatur berdasarkan aturan baku berikut:"
    )
    add_bullet_item(doc, "Setiap kalimat diawali karakter tanda dollar ($), atau tanda seru (!) khusus untuk muatan biner AIS enkapsulasi (VDM/VDO).", "Karakter Pembuka: ")
    add_bullet_item(doc, "Terdiri atas 2 karakter pengenal talker (misalnya GP untuk GPS, SD untuk Sounder/Depth, HC untuk Heading/Compass) diikuti 3 karakter pengenal jenis format kalimat (misalnya DPT, MTW, RMC).", "Penanda Talker & Jenis Pesan: ")
    add_bullet_item(doc, "Setiap bidang data nilai numerik maupun alfanumerik dipisahkan secara tegas menggunakan tanda baca koma (,). Kolom data yang tidak tersedia tetap ditandai dengan koma kosong.", "Pemisah Bidang Data: ")
    add_bullet_item(doc, "Kalimat diakhiri dengan tanda bintang (*) diikuti 2 digit karakter heksadesimal checksum, yang diperoleh melalui perhitungan operasi bitwise XOR seluruh karakter di antara '$' dan '*'.", "Checksum Validasi: ")
    add_bullet_item(doc, "Setiap kalimat resmi diakhiri dengan kombinasi karakter non-cetak Carriage Return (CR) dan Line Feed (LF). Panjang maksimum sebuah kalimat NMEA 0183 dibatasi hingga 82 karakter.", "Karakter Penutup: ")

    add_heading_2(doc, "3.2 Kalimat Standar Sensor Kedalaman, Suhu, Navigasi, dan Wind")
    add_paragraph(doc, 
        "Platform VMS mendengarkan aliran kalimat NMEA 0183 melalui listening port TCP 20006 atau konverter serial. "
        "Tabel 3.1 menyajikan daftar kalimat standar NMEA 0183 yang didekode secara aktif oleh sistem, "
        "yang merepresentasikan parameter setara dengan data PGN pada bus NMEA 2000."
    )

    add_table_caption(doc, "Tabel 3.1", "Daftar Kalimat Standar NMEA 0183 pada Sistem Navigasi dan Ekivalensi PGN NMEA 2000")
    t6_data = [
        ("Kalimat NMEA", "Ekivalen PGN", "Fungsi dan Parameter", "Contoh Format Kalimat ASCII Mentah", "Keterangan Hasil Ekstraksi"),
        ("$SDDPT", "PGN 128267", "Kedalaman Air (Depth)", "$SDDPT,05.3,0.0,100.0*57", "Kedalaman air 5,3 meter relatif terhadap transduser akustik."),
        ("$SDDBT", "PGN 128267", "Kedalaman Bawah Transduser", "$SDDBT,40.6,f,12.4,M,6.8,F*34", "Kedalaman air 12,4 meter (40,6 kaki / 6,8 depa)."),
        ("$SDMTW", "PGN 130310", "Suhu Air Laut (Water Temp)", "$SDMTW,24.6,C*0B", "Suhu rata-rata permukaan air laut sebesar 24,6 derajat Celsius."),
        ("$HCHDT", "PGN 127250", "Haluan Kompas (Heading True)", "$HCHDT,237.4,T*2B", "Derajat orientasi haluan kompas sejati kapal (237,4 derajat)."),
        ("$HCHDG", "PGN 127250", "Haluan Kompas Magnetik", "$HCHDG,236.2,0.5,E,0.7,W*64", "Haluan magnetik 236,2° dilengkapi deviasi dan variasi."),
        ("$GPGLL", "PGN 129025", "Posisi Geografis GPS", "$GPGLL,0610.123,S,10653.987,E,025141,A,A*50", "Titik koordinat posisi lintang dan bujur real-time."),
        ("$GPVTG", "PGN 129026", "Arah Gerak (COG) & Laju (SOG)", "$GPVTG,097.5,T,,M,00.0,N,00.0,K,A*2D", "Course Over Ground 97,5° dan Speed Over Ground dalam knot."),
        ("$GPRMC", "PGN 129025/26/92", "Recommended Minimum GPS", "$GPRMC,025141,A,0610.123,S,10653.987,E,00.0,097.5,301026,,,A*7C", "Waktu UTC, status valid, posisi lintang/bujur, SOG, dan COG."),
        ("$GPGGA", "PGN 129029", "GNSS Fix, HDOP, Elevasi", "$GPGGA,025141,0610.123,S,10653.987,E,1,08,1.2,4.5,M,-18.2,M,,*79", "Status fix, 8 satelit aktif, HDOP 1,2, dan elevasi antena 4,5 m."),
        ("$GPZDA", "PGN 126992", "Waktu dan Tanggal UTC", "$GPZDA,025141.00,30,10,2026,00,00*6D", "Waktu jam 02:51:41 UTC dan tanggal kalender atomik satelit."),
        ("$WIMWV", "PGN 130306", "Kecepatan & Arah Angin (Wind)", "$WIMWV,045.0,R,12.5,N,A*17", "Sudut angin relatif 45° dengan kecepatan 12,5 knot."),
        ("!AIVDM", "PGN 129038", "Laporan Posisi Target AIS", "!AIVDM,1,1,,B,13aEO:0P0000h0hK>8=h0?vN0<11,0*26", "Data biner terenkapsulasi posisi dan MMSI kapal lain di sekitar."),
    ]
    tbl_6 = doc.add_table(rows=len(t6_data), cols=5)
    tbl_6.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_three_line_borders(tbl_6)
    for row_idx, r_items in enumerate(t6_data):
        for col_idx, text_val in enumerate(r_items):
            cell = tbl_6.cell(row_idx, col_idx)
            set_cell_margins(cell, 40, 40, 60, 60)
            p = cell.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(text_val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(8.5)
            if row_idx == 0:
                run.font.bold = True
            run.font.color.rgb = COLOR_BLACK
            set_cell_margins(cell, 60, 60, 100, 100)
            p = cell.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(text_val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(9.5)
            if row_idx == 0:
                run.font.bold = True
            run.font.color.rgb = COLOR_BLACK

    add_heading_2(doc, "3.3 Analisis Perbandingan Karakteristik NMEA 2000 dan NMEA 0183")
    add_paragraph(doc, 
        "Pemilihan format telemetri maritim di atas kapal berdampak langsung terhadap kecepatan pembaruan data, efisiensi bandwidth transmisi, "
        "dan keandalan pembacaan instrumen. Tabel 3.2 merangkum perbedaan esensial antara kedua protokol maritim tersebut."
    )

    add_table_caption(doc, "Tabel 3.2", "Analisis Perbandingan Antara NMEA 2000 dan NMEA 0183")
    t7_data = [
        ("Parameter Karakteristik", "Protokol NMEA 2000 (CAN Bus)", "Protokol NMEA 0183 (Serial RS-422)"),
        ("Kecepatan Transmisi Data", "250.000 bps (250 Kbps) - ~52x lebih cepat", "4.800 bps (Standar) atau 38.400 bps (AIS)"),
        ("Format Enkoding Muatan", "Biner murni terkompresi (Sangat efisien)", "Karakter teks ASCII (Overhead tinggi)"),
        ("Topologi Jaringan Komunikasi", "Multi-Master Bus (Seluruh perangkat setara)", "Single-Talker, Multiple-Listener (Titik-ke-titik)"),
        ("Latensi Transmisi Frame", "Sub-milidetik (0,2 ms - 0,5 ms)", "Tinggi (40 ms - 180 ms per kalimat)"),
        ("Kapasitas Aliran Sensor", "Mampu menangani ratusan AIS dan sensor simultan", "Rentan jenuh / buffer overflow pada trafik padat"),
        ("Validasi Integritas Data", "Pemeriksaan CRC 15-bit hardware mikrokontroler", "Perhitungan Checksum XOR 8-bit perangkat lunak"),
    ]
    tbl_7 = doc.add_table(rows=len(t7_data), cols=3)
    tbl_7.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_three_line_borders(tbl_7)
    for row_idx, r_items in enumerate(t7_data):
        for col_idx, text_val in enumerate(r_items):
            cell = tbl_7.cell(row_idx, col_idx)
            set_cell_margins(cell, 60, 60, 100, 100)
            p = cell.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(text_val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(9.5)
            if row_idx == 0:
                run.font.bold = True
            run.font.color.rgb = COLOR_BLACK

    # =========================================================================
    # 4. KONFIGURASI KOMUNIKASI CAN KE TCP DENGAN MODE CLIENT
    # =========================================================================
    add_heading_1(doc, "4. KONFIGURASI KOMUNIKASI CAN KE TCP DENGAN MODE CLIENT")

    add_heading_2(doc, "4.1 Konsep dan Keunggulan Mode TCP Client pada Jaringan Kapal")
    add_paragraph(doc, 
        "Sesuai dengan Bagian 2.3.2 buku panduan USR-CANET200 User Manual, pada mode kerja TCP Client, perangkat gateway secara mandiri bertindak "
        "sebagai pihak pemrakarsa koneksi (initiator). Modul secara proaktif mengirimkan paket permintaan pembukaan sesi jabat tangan tiga arah "
        "(TCP 3-way handshake) menuju alamat IP Publik dan port server VMS yang telah ditentukan."
    )
    add_paragraph(doc, 
        "Keunggulan fundamental dari implementasi mode TCP Client pada operasional kapal adalah kemampuan penembusan translasi alamat jaringan "
        "(Network Address Translation / NAT traversal). Modem seluler 4G/LTE kapal maupun terminal satelit umumnya mendapatkan alamat IP privat "
        "dinamis dari operator telekomunikasi (Carrier-Grade NAT) yang menolak koneksi masuk dari jaringan luar. Dalam mode Client, koneksi diprakarsai "
        "dari arah dalam kapal menuju server darat, sehingga seluruh frame telemetri dapat dialirkan tanpa memerlukan alamat IP publik statis pada kartu SIM di kapal."
    )

    add_heading_2(doc, "4.2 Prosedur Pengaturan Parameter Antarmuka CAN")
    add_paragraph(doc, 
        "Sebelum mengaktifkan komunikasi jaringan TCP, antarmuka pengontrol CAN pada USR-CANET200 wajib dikonfigurasi melalui Web Server perangkat. "
        "Langkah-langkah pengaturan parameter CAN adalah sebagai berikut:"
    )
    add_bullet_item(doc, "Hubungkan laptop teknisi ke port Ethernet modul. Buka browser pada alamat http://192.168.0.7 dengan otentikasi admin/admin.", "1. Akses Antarmuka Web: ")
    add_bullet_item(doc, "Navigasikan ke menu CAN Settings -> CAN1 Basic Parameters. Atur Baud Rate secara mutlak ke nilai 250 Kbps. Pilih Work Mode pada Normal Mode agar gateway dapat menerima dan memancarkan data secara bebas.", "2. Penyetelan Baud Rate: ")
    add_bullet_item(doc, "Pada parameter CAN Package Method, tetapkan Time Trigger sebesar 10 ms dan Length Trigger sebesar 50 frame. Batas waktu 10 ms memastikan frame telemetri tidak tertahan di buffer internal, melainkan segera dibungkus dan dikirimkan tanpa jeda latensi guna mendukung visualisasi gelombang echosounder CHIRP 60 FPS pada platform VMS.", "3. Penyetelan Pemicu Paket: ")
    add_bullet_item(doc, "Pada menu CAN ID Filtering, pastikan opsi filtering dinonaktifkan (Receive All) agar seluruh PGN penting tidak disaring atau dibuang oleh gateway.", "4. Penonaktifan Filter ID: ")

    add_heading_2(doc, "4.3 Pengaturan Parameter Soket Jaringan TCP Client")
    add_paragraph(doc, 
        "Setelah parameter CAN tuntas diatur, langkah selanjutnya adalah mengarahkan aliran data menuju soket server VMS "
        "melalui menu Network Settings -> Socket A Configuration."
    )

    add_table_caption(doc, "Tabel 4.1", "Parameter Konfigurasi Soket TCP Client USR-CANET200")
    t8_data = [
        ("Nama Parameter Pengaturan", "Nilai Konfigurasi Lapangan", "Fungsi dan Ketentuan Teknis"),
        ("Work Mode", "TCP Client", "Mengatur gateway sebagai pemrakarsa koneksi keluar ke server VMS."),
        ("Server Address Mode", "IP Address / Domain Name", "Metode pengalamatan server tujuan VMS."),
        ("Target Server IP / Domain", "Contoh: 103.xxx.xxx.xxx atau domain server", "Alamat IP publik statis server penerima data telemetri."),
        ("Target Port", "20005 (Port Gateway N2K VMS)", "Port listener TCP hybrid pada sistem backend VMS."),
        ("Local Port", "0 (Otomatis / Dinamis)", "Alokasi port acak oleh modul untuk mencegah benturan soket lokal."),
        ("Auto-reconnection Interval", "3 detik (Default pabrik)", "Waktu tunggu modul sebelum mencoba menyambung ulang sesi TCP."),
    ]
    tbl_8 = doc.add_table(rows=len(t8_data), cols=3)
    tbl_8.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_three_line_borders(tbl_8)
    for row_idx, r_items in enumerate(t8_data):
        for col_idx, text_val in enumerate(r_items):
            cell = tbl_8.cell(row_idx, col_idx)
            set_cell_margins(cell, 60, 60, 100, 100)
            p = cell.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(text_val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(10)
            if row_idx == 0:
                run.font.bold = True
            run.font.color.rgb = COLOR_BLACK

    add_heading_2(doc, "4.4 Mekanisme Rekoneksi Otomatis dan Heartbeat Jaringan")
    add_paragraph(doc, 
        "Sinyal seluler maritim rentan terhadap pelemahan sinyal akibat jarak jelajah kapal dari menara pemancar di darat. "
        "USR-CANET200 memiliki mesin rekoneksi otomatis mandiri. Jika koneksi TCP terputus, modul segera beralih ke mode reconnecting "
        "dan mengulang upaya inisiasi koneksi setiap 3 detik. Begitu konektivitas internet kembali pulih, aliran telemetri langsung tersambung "
        "kembali secara otomatis tanpa memerlukan intervensi manual atau proses restart perangkat."
    )
    add_paragraph(doc, 
        "Guna menjaga stabilitas koneksi seluler jangka panjang, teknisi wajib mengaktifkan fungsi Network Heartbeat (Bab 2.5.1 User Manual) "
        "dengan interval 30 detik. Paket denyut nadi berkala ini mencegah pemutusan sepihak (timeout) oleh tabel translasi NAT operator seluler "
        "saat kapal dalam status berlabuh atau lego jangkar tanpa aktivitas pergerakan."
    )

    # =========================================================================
    # 5. PENGISIAN DAN INTEGRASI REGISTER CONTENT (IDENTITY PACKET)
    # =========================================================================
    add_heading_1(doc, "5. PENGISIAN DAN INTEGRASI REGISTER CONTENT (IDENTITY PACKET)")

    add_heading_2(doc, "5.1 Urgensi Register Content pada Shared Gateway VMS")
    add_paragraph(doc, 
        "Pada infrastruktur server modern platform VMS, sistem mengadopsi model Shared Multi-Tenant Gateway pada Port 20005. "
        "Satu port listener TCP digunakan secara terpusat untuk melayani koneksi data dari puluhan hingga ratusan kapal sekaligus. "
        "Karena setiap koneksi masuk berasal dari alamat IP seluler publik acak milik operator, server membutuhkan tanda pengenal awal "
        "untuk memastikan identitas kepemilikan data dari kapal yang bersangkutan."
    )
    add_paragraph(doc, 
        "Untuk memenuhi kebutuhan tersebut, modul USR-CANET200 memanfaatkan fitur Paket Identitas atau Identity Packet (Bab 2.5.2 User Manual), "
        "yang di dalam sistem VMS dinamakan sebagai Register Content. Paket ini memuat untaian karakter unik yang dipancarkan satu kali "
        "oleh gateway tepat saat koneksi soket pertama kali berhasil terbentuk."
    )

    add_heading_2(doc, "5.2 Prosedur Konfigurasi Identity Packet pada Perangkat")
    add_paragraph(doc, 
        "Konfigurasi Register Content dilakukan melalui menu Network Settings -> Identity Packet Setting pada antarmuka web USR-CANET200. "
        "Parameter pengaturan yang wajib dipatuhi dirangkum pada Tabel 5.1."
    )

    add_table_caption(doc, "Tabel 5.1", "Parameter Konfigurasi Identity Packet (Register Content)")
    t9_data = [
        ("Parameter Konfigurasi", "Pilihan Pengaturan Lapangan", "Konsekuensi dan Ketentuan Sistem VMS"),
        ("Identity Packet Type", "User-defined data (User Editable)", "Memungkinkan pengetikan string kode identitas unik kapal."),
        ("Send Condition", "Connect with sending", "WAJIB: Dikirim 1 kali segera setelah jabat tangan TCP selesai."),
        ("Identity Data (String)", "Contoh: KM_Uno atau KM_Geo_Tekno", "String pengenal kapal (panjang < 40 karakter, tanpa spasi)."),
        ("Encoding Format", "ASCII (Plain Text)", "Format teks baku tanpa karakter kontrol atau simbol khusus."),
    ]
    tbl_9 = doc.add_table(rows=len(t9_data), cols=3)
    tbl_9.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_three_line_borders(tbl_9)
    for row_idx, r_items in enumerate(t9_data):
        for col_idx, text_val in enumerate(r_items):
            cell = tbl_9.cell(row_idx, col_idx)
            set_cell_margins(cell, 60, 60, 100, 100)
            p = cell.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(text_val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(10)
            if row_idx == 0:
                run.font.bold = True
            run.font.color.rgb = COLOR_BLACK

    add_paragraph(doc, 
        "Peringatan teknis mutlak: Teknisi dilarang memilih opsi 'Send on the front of every data package'. "
        "Pilihan tersebut akan menyisipkan string identitas di bagian depan setiap frame 13-Byte yang dikirimkan, "
        "yang menyebabkan pergeseran offset data dan menggagalkan seluruh proses dekode NMEA 2000 pada server VMS."
    )

    add_heading_2(doc, "5.3 Mekanisme Verifikasi dan Sinkronisasi Sisi Platform VMS")
    add_paragraph(doc, 
        "Ketika USR-CANET200 berhasil membuka soket TCP ke Port 20005, modul seketika mengirimkan string Register Content, misalnya 'KM_Uno'. "
        "Algoritma gateway pada backend server (agentManager.js) segera memvalidasi paket pembuka ini terhadap basis data aset armada kapal:"
    )
    add_code_snippet(doc, 
        "Alur Logika Sinkronisasi Registrasi Kapal pada Backend VMS:\n"
        "1. Klien TCP terhubung dari IP router internet kapal (Starlink/VSAT/Seluler) pada Port 20005.\n"
        "2. Server menerima pesan registrasi pembuka: \"KM_Uno\".\n"
        "3. Sistem mencocokkan string dengan kolom 'register_content' di tabel basis data kapal.\n"
        "4. Kueri berhasil menemukan rekaman: Kapal 'KM Uno' (ID Aset: vessel_96254061).\n"
        "5. Seluruh frame telemetri NMEA 2000 berikutnya langsung dialirkan ke state kapal KM Uno.\n"
        "6. Status koneksi kapal pada web dashboard monitoring bertransisi menjadi 'Live / Online'."
    )
    add_paragraph(doc, 
        "Melalui integrasi Register Content yang terkonfigurasi secara tepat, sistem pemantauan kapal VMS dapat mengenali dan menyalurkan "
        "telemetri puluhan kapal secara bersamaan pada satu gerbang gateway terpusat dengan tingkat keandalan dan akurasi yang tinggi."
    )

    # Simpan dokumen akhir
    try:
        doc.save(docx_path)
        print("BERHASIL: File User Guide.docx telah diperbarui!")
    except PermissionError:
        temp_path = os.path.join(os.path.dirname(docx_path), "User Guide_updated.docx")
        doc.save(temp_path)
        print(f"PERINGATAN: File User Guide.docx sedang dibuka di Microsoft Word/aplikasi lain.")
        print(f"Dokumen telah berhasil digenerate dan disimpan ke: {temp_path}")

if __name__ == "__main__":
    main()
