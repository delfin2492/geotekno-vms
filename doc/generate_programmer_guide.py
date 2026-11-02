# -*- coding: utf-8 -*-
"""
Generator Spesifikasi Integrasi Sistem & Parsing Telemetri Navigasi (Developer Integration Guide)
Spesifikasi Protokol USR-CANET200, Socket Ingestion, PGN Decoding & Streaming VMS
Output: doc/Spesifikasi_Integrasi_Programmer.docx
"""

import io
import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

COLOR_BLACK = RGBColor(0, 0, 0)
COLOR_GRAY = RGBColor(80, 80, 80)
BG_CODE = "F4F6F8"
BORDER_COLOR = "000000"


def set_cell_margins(cell, top=80, bottom=80, left=120, right=120):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)


def set_three_line_borders(table):
    tblPr = table._tbl.tblPr
    for child in list(tblPr):
        if child.tag.endswith('tblBorders'):
            tblPr.remove(child)
    borders_elm = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>\n'
        f'  <w:top w:val="single" w:sz="12" w:space="0" w:color="{BORDER_COLOR}"/>\n'
        f'  <w:bottom w:val="single" w:sz="12" w:space="0" w:color="{BORDER_COLOR}"/>\n'
        f'  <w:insideH w:val="none"/>\n'
        f'  <w:insideV w:val="none"/>\n'
        f'  <w:left w:val="none"/>\n'
        f'  <w:right w:val="none"/>\n'
        f'</w:tblBorders>'
    )
    tblPr.append(borders_elm)
    if len(table.rows) > 0:
        hdr_cells = table.rows[0].cells
        for cell in hdr_cells:
            tcPr = cell._tc.get_or_add_tcPr()
            tcBorders = parse_xml(
                f'<w:tcBorders {nsdecls("w")}>\n'
                f'  <w:bottom w:val="single" w:sz="8" w:space="0" w:color="{BORDER_COLOR}"/>\n'
                f'</w:tcBorders>'
            )
            tcPr.append(tcBorders)


def add_paragraph(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.first_line_indent = Inches(0.4)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    run.font.color.rgb = COLOR_BLACK
    return p


def add_bullet_item(doc, text, bold_prefix=""):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.left_indent = Inches(0.5)
    p.paragraph_format.first_line_indent = Inches(-0.25)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r_bullet = p.add_run("•  ")
    r_bullet.font.name = "Times New Roman"
    r_bullet.font.size = Pt(12)
    r_bullet.font.color.rgb = COLOR_BLACK
    if bold_prefix:
        r_prefix = p.add_run(bold_prefix)
        r_prefix.font.name = "Times New Roman"
        r_prefix.font.size = Pt(12)
        r_prefix.font.bold = True
        r_prefix.font.color.rgb = COLOR_BLACK
    r_body = p.add_run(text)
    r_body.font.name = "Times New Roman"
    r_body.font.size = Pt(12)
    r_body.font.color.rgb = COLOR_BLACK
    return p


def add_heading_1(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(8)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(14)
    run.font.bold = True
    run.font.color.rgb = COLOR_BLACK
    return p


def add_heading_2(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    run.font.bold = True
    run.font.color.rgb = COLOR_BLACK
    return p


def add_heading_3(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(2)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    run.font.bold = True
    run.font.italic = True
    run.font.color.rgb = COLOR_BLACK
    return p


def add_table_caption(doc, label, title):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(4)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r1 = p.add_run(f"{label} ")
    r1.font.name = "Times New Roman"
    r1.font.size = Pt(11)
    r1.font.bold = True
    r1.font.color.rgb = COLOR_BLACK
    r2 = p.add_run(title)
    r2.font.name = "Times New Roman"
    r2.font.size = Pt(11)
    r2.font.color.rgb = COLOR_BLACK
    return p


def add_figure_caption(doc, label, title):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(10)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r1 = p.add_run(f"{label} ")
    r1.font.name = "Times New Roman"
    r1.font.size = Pt(11)
    r1.font.bold = True
    r1.font.color.rgb = COLOR_BLACK
    r2 = p.add_run(title)
    r2.font.name = "Times New Roman"
    r2.font.size = Pt(11)
    r2.font.color.rgb = COLOR_BLACK
    return p


def add_code_snippet(doc, text):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_margins(cell, 100, 100, 140, 140)
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{BG_CODE}"/>')
    tcPr.append(shd)
    tcBorders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>\n'
        f'  <w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>\n'
        f'  <w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>\n'
        f'  <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>\n'
        f'  <w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>\n'
        f'</w:tcBorders>'
    )
    tcPr.append(tcBorders)
    p = cell.paragraphs[0]
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(text)
    run.font.name = "Consolas"
    run.font.size = Pt(9.5)
    run.font.color.rgb = COLOR_BLACK
    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(0)
    p_sp.paragraph_format.space_after = Pt(4)


def add_toc_line(doc, title, page_str, level=1):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.3
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.space_after = Pt(1)
    pPr = p._p.get_or_add_pPr()
    tabs = OxmlElement('w:tabs')
    tab = OxmlElement('w:tab')
    tab.set(qn('w:val'), 'right')
    tab.set(qn('w:leader'), 'dot')
    tab.set(qn('w:pos'), '9360')
    tabs.append(tab)
    pPr.append(tabs)
    r1 = p.add_run(title)
    r1.font.name = "Times New Roman"
    r1.font.size = Pt(11)
    r1.font.color.rgb = COLOR_BLACK
    if level == 1:
        r1.font.bold = True
    r2 = p.add_run(f"\t{page_str}")
    r2.font.name = "Times New Roman"
    r2.font.size = Pt(11)
    r2.font.color.rgb = COLOR_BLACK
    if level == 1:
        r2.font.bold = True


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    source_docx = os.path.join(base_dir, "User Guide.docx")
    out_docx = os.path.join(base_dir, "Spesifikasi_Integrasi_Programmer.docx")
    diag_img = os.path.join(base_dir, "arsitektur_sistem_vms.png")

    print(f"Membaca template dari: {source_docx}")
    with open(source_docx, "rb") as f:
        file_stream = io.BytesIO(f.read())
    doc = docx.Document(file_stream)

    for p in list(doc.paragraphs):
        p._p.getparent().remove(p._p)
    for t in list(doc.tables):
        t._tbl.getparent().remove(t._tbl)

    # -------------------------------------------------------------------------
    # HALAMAN JUDUL
    # -------------------------------------------------------------------------
    for _ in range(4):
        p_sp = doc.add_paragraph()
        p_sp.paragraph_format.space_after = Pt(12)

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.line_spacing = 1.3
    p_title.paragraph_format.space_after = Pt(16)
    r_t = p_title.add_run("SPESIFIKASI TEKNIS INTEGRASI DAN PARSING DATA\nINGESTION TELEMETRI NAVIGASI MARITIM (NMEA 2000 & NMEA 0183)\nPADA CLOUD PLATFORM VESSEL MONITORING SYSTEM (VMS)")
    r_t.font.name = "Times New Roman"
    r_t.font.size = Pt(15)
    r_t.font.bold = True
    r_t.font.color.rgb = COLOR_BLACK

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.line_spacing = 1.3
    p_sub.paragraph_format.space_after = Pt(28)
    r_sub = p_sub.add_run("Panduan Arsitektur Rekayasa Perangkat Lunak: Socket TCP Ingestion, Protokol 13-Byte USR-CANET200,\nEkstraksi Identifier 29-bit & PGN, Format Little-Endian, Dekoder NMEA 0183, dan Realtime Streaming")
    r_sub.font.name = "Times New Roman"
    r_sub.font.size = Pt(12)
    r_sub.font.italic = True
    r_sub.font.color.rgb = COLOR_BLACK

    for _ in range(5):
        p_sp = doc.add_paragraph()
        p_sp.paragraph_format.space_after = Pt(12)

    p_foot = doc.add_paragraph()
    p_foot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_foot.paragraph_format.line_spacing = 1.3
    r_foot = p_foot.add_run("TIM PENGEMBANG SOFTWARE DAN SISTEM CLOUD VMS\nTAHUN 2026")
    r_foot.font.name = "Times New Roman"
    r_foot.font.size = Pt(12)
    r_foot.font.bold = True
    r_foot.font.color.rgb = COLOR_BLACK

    doc.add_page_break()

    # -------------------------------------------------------------------------
    # DAFTAR ISI
    # -------------------------------------------------------------------------
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
        ("DAFTAR TABEL", "ii", 1),
        ("DAFTAR GAMBAR", "iii", 1),
        ("1. ARSITEKTUR INGESTION DAN MODEL KONEKSI TCP", "1", 1),
        ("   1.1 Model Socket Ingestion Terdistribusi", "1", 2),
        ("   1.2 Alokasi Port Layanan Backend (Port 20005 & 20006)", "1", 2),
        ("   1.3 Pipeline Pengolahan Data Platform VMS", "2", 2),
        ("2. PROTOKOL HANDSHAKE DAN MANAJEMEN SESI (SESSION LIFECYCLE)", "3", 1),
        ("   2.1 Handshake Pembuka: Register Content & Asset Mapping", "3", 2),
        ("   2.2 Penanganan Paket Heartbeat dan Buffer Sanitation", "4", 2),
        ("   2.3 State Machine Kapal, Deteksi Timeout, dan Rekoneksi", "4", 2),
        ("3. SPESIFIKASI PROTOKOL BINER 13-BYTE USR-CANET200", "6", 1),
        ("   3.1 Struktur Paket Biner 13-Byte", "6", 2),
        ("   3.2 Algoritma Bit-Masking Identifier 29-Bit (Ekstraksi PGN)", "7", 2),
        ("   3.3 Penanganan Format Data Little-Endian dan Multiplier", "8", 2),
        ("4. KAMUS DAN FORMULA DECODING PARAMETER GROUP NUMBER (PGN)", "9", 1),
        ("   4.1 PGN Sensor Navigasi dan Posisi Kapal (GPS, Gyro, dan AIS)", "9", 2),
        ("   4.2 PGN Sensor Transduser Akustik Bawah Air (Depth & Water Temp)", "10", 2),
        ("   4.3 PGN Sensor Angin / Wind Data (Kecepatan & Sudut Angin)", "11", 2),
        ("5. SPESIFIKASI PARSING FORMAT NMEA 0183 (SERIAL ASCII)", "12", 1),
        ("   5.1 Struktur Sintaks Kalimat ASCII dan Validasi Checksum XOR", "12", 2),
        ("   5.2 Kamus Kalimat NMEA 0183 Ekivalen PGN Navigasi, Transduser, dan Wind", "13", 2),
        ("6. INTEGRASI BASIS DATA DAN REAL-TIME STREAMING", "15", 1),
        ("   6.1 Skema Basis Data Relasional & Time-Series (PostgreSQL/PostGIS)", "15", 2),
        ("   6.2 Real-time Broadcasting via WebSocket ke Frontend Dashboard", "16", 2),
        ("   6.3 Contoh Implementasi Parser Backend (Node.js & Python)", "17", 2),
    ]
    for t_title, p_num, lvl in toc_entries:
        add_toc_line(doc, t_title, p_num, level=lvl)

    doc.add_page_break()

    # -------------------------------------------------------------------------
    # DAFTAR TABEL & GAMBAR
    # -------------------------------------------------------------------------
    h_tot = doc.add_paragraph()
    h_tot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    h_tot.paragraph_format.space_before = Pt(6)
    h_tot.paragraph_format.space_after = Pt(14)
    r_tot = h_tot.add_run("DAFTAR TABEL")
    r_tot.font.name = "Times New Roman"
    r_tot.font.size = Pt(13)
    r_tot.font.bold = True
    r_tot.font.color.rgb = COLOR_BLACK

    add_toc_line(doc, "Tabel 1.1 Spesifikasi Alokasi Port Listening TCP Server Ingestion", "2", level=1)
    add_toc_line(doc, "Tabel 3.1 Struktur Paket Biner Transparan 13-Byte USR-CANET200", "6", level=1)
    add_toc_line(doc, "Tabel 3.2 Pemetaan Bit Identifier CAN 29-Bit", "7", level=1)
    add_toc_line(doc, "Tabel 4.1 Kamus Lengkap PGN Telemetri Navigasi Utama VMS", "9", level=1)
    add_toc_line(doc, "Tabel 5.1 Format Kalimat NMEA 0183 yang Didukung Backend", "14", level=1)
    add_toc_line(doc, "Tabel 5.2 Perbandingan Komparatif Format NMEA 2000 dan NMEA 0183", "15", level=1)

    doc.add_page_break()

    h_tof = doc.add_paragraph()
    h_tof.alignment = WD_ALIGN_PARAGRAPH.CENTER
    h_tof.paragraph_format.space_before = Pt(6)
    h_tof.paragraph_format.space_after = Pt(14)
    r_tof = h_tof.add_run("DAFTAR GAMBAR")
    r_tof.font.name = "Times New Roman"
    r_tof.font.size = Pt(13)
    r_tof.font.bold = True
    r_tof.font.color.rgb = COLOR_BLACK

    add_toc_line(doc, "Gambar 1.1 Arsitektur Aliran Data Telemetri Maritim dari Kapal ke Cloud Dashboard", "2", level=1)

    doc.add_page_break()

    # -------------------------------------------------------------------------
    # BAB 1
    # -------------------------------------------------------------------------
    add_heading_1(doc, "1. ARSITEKTUR INGESTION DAN MODEL KONEKSI TCP")

    add_heading_2(doc, "1.1 Model Socket Ingestion Terdistribusi")
    add_paragraph(doc, 
        "Platform Vessel Monitoring System (VMS) mengadopsi model Ingestion Server berbasis soket TCP persisten. "
        "Skema ini dipilih karena koneksi internet di kapal (seperti terminal Starlink, VSAT, atau modem seluler 4G/LTE) "
        "menggunakan alamat IP lokal biasa. Jika server di darat yang diminta mencari kapal, koneksi akan terhalang oleh firewall internet kapal. "
        "Namun, dengan menjadikan gateway USR-CANET200 di kapal sebagai pihak yang aktif menghubungi (TCP Client) server di cloud, "
        "seluruh data telemetri dapat terkirim secara kontinu tanpa memerlukan alokasi IP publik statis yang mahal pada armada kapal."
    )
    add_paragraph(doc, 
        "Di sisi darat, server backend dirancang agar mampu menerima dan melayani banyak koneksi kapal secara bersamaan tanpa saling tunggu. "
        "Setiap kapal yang terhubung dialokasikan satu jalur komunikasi khusus (koneksi soket aktif) yang dikelola dalam tabel koneksi memori, "
        "sehingga data posisi dan sensor navigasi dari puluhan kapal dapat masuk dan diproses secara langsung (real-time)."
    )

    add_heading_2(doc, "1.2 Alokasi Port Layanan Backend (Port 20005 & 20006)")
    add_paragraph(doc, 
        "Untuk mencegah tumpang-tindih format data biner dan ASCII, backend menyediakan dua port TCP listening terpisah sebagaimana "
        "dijabarkan pada Tabel 1.1."
    )

    add_table_caption(doc, "Tabel 1.1", "Spesifikasi Alokasi Port Listening TCP Server Ingestion")
    t1_data = [
        ("Nomor Port", "Tipe Protokol", "Format Muatan Masuk", "Deskripsi Pemrosesan Backend"),
        ("TCP 20005", "NMEA 2000 CAN", "Paket Biner 13-Byte", "Menerima aliran frame biner CAN bus dari gateway USR-CANET200 CAN1."),
        ("TCP 20006", "NMEA 0183 Serial", "Stream Teks ASCII", "Menerima aliran kalimat teks NMEA 0183 dari port serial gateway."),
    ]
    tbl_1 = doc.add_table(rows=len(t1_data), cols=4)
    tbl_1.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_three_line_borders(tbl_1)
    for r_idx, row_vals in enumerate(t1_data):
        for c_idx, val in enumerate(row_vals):
            c = tbl_1.cell(r_idx, c_idx)
            set_cell_margins(c, 50, 50, 80, 80)
            p = c.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(10)
            if r_idx == 0:
                run.font.bold = True
            run.font.color.rgb = COLOR_BLACK

    add_heading_2(doc, "1.3 Pipeline Pengolahan Data Platform VMS")
    add_paragraph(doc, 
        "Alur pemrosesan data di dalam platform mengikuti rantai sekuensial yang ketat: Ingest -> Sanitize -> Decode -> Store -> Broadcast. "
        "Gambar 1.1 memperlihatkan arsitektur makro aliran data telemetri."
    )

    if os.path.exists(diag_img):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(4)
        run_img = p_img.add_run()
        sec = doc.sections[0]
        usable_w = sec.page_width - sec.left_margin - sec.right_margin
        run_img.add_picture(diag_img, width=usable_w)
        add_figure_caption(doc, "Gambar 1.1", "Arsitektur Aliran Data Telemetri Maritim dari Kapal ke Cloud Dashboard")

    # -------------------------------------------------------------------------
    # BAB 2
    # -------------------------------------------------------------------------
    add_heading_1(doc, "2. PROTOKOL HANDSHAKE DAN MANAJEMEN SESI (SESSION LIFECYCLE)")

    add_heading_2(doc, "2.1 Handshake Pembuka: Register Content & Asset Mapping")
    add_paragraph(doc, 
        "Ketika modul USR-CANET200 pertama kali berhasil membuka soket TCP ke Port 20005, perangkat seketika memancarkan paket teks pembuka "
        "yang disebut Register Content (Identity Packet), misalnya 'KM_Uno'. Backend wajib mengimplementasikan state machine handshake berikut:"
    )
    add_code_snippet(doc, 
        "Pseudocode Handshake & Session Binding Backend:\n"
        "on tcp_client_connect(socket):\n"
        "    socket.state = 'AWAITING_REGISTRATION'\n"
        "    socket.set_timeout(10.0) // Drop jika tidak mengirim register dalam 10 detik\n\n"
        "on data_received(socket, buffer):\n"
        "    if socket.state == 'AWAITING_REGISTRATION':\n"
        "        register_content = buffer.toString('utf-8').trim()\n"
        "        vessel = db.query('SELECT id, name FROM vessels WHERE register_code = ?', register_content)\n"
        "        if vessel:\n"
        "            socket.vessel_id = vessel.id\n"
        "            socket.state = 'AUTHENTICATED'\n"
        "            session_pool.bind(vessel.id, socket)\n"
        "            update_vessel_status(vessel.id, 'ONLINE')\n"
        "        else:\n"
        "            log_security_warning('Unknown Register Content:', register_content)\n"
        "            socket.destroy()"
    )

    add_heading_2(doc, "2.2 Penanganan Paket Heartbeat dan Buffer Sanitation")
    add_paragraph(doc, 
        "Setiap 30 detik, modul USR-CANET200 memancarkan paket Heartbeat (misalnya teks 'HEARTBEAT') untuk mencegah timeout NAT. "
        "Programmer parser WAJIB menyaring dan membuang string ASCII ini sebelum memasukkan buffer ke antrean pembedahan biner 13-Byte. "
        "Apabila paket heartbeat tidak disaring, byte string ASCII akan menggeser alignment buffer 13-Byte sehingga memicu error framing framing cascade."
    )
    add_paragraph(doc, 
        "Kedatangan paket heartbeat digunakan oleh backend sebagai pemicu pembaruan cap waktu Last Seen kapal pada sistem pemantauan."
    )

    add_heading_2(doc, "2.3 State Machine Kapal, Deteksi Timeout, dan Rekoneksi")
    add_paragraph(doc, 
        "Karena kapal sering melewati zona blindspot komunikasi satelit/seluler, backend harus menerapkan siklus transisi status kapal "
        "secara dinamis berdasarkan selang waktu telemetri terakhir:"
    )
    add_bullet_item(doc, "Ditetapkan jika paket data diterima dalam rentang waktu < 30 detik terakhir.", "Status Online: ")
    add_bullet_item(doc, "Ditetapkan jika tidak ada data baru selama 30 hingga 90 detik (indikasi sinyal melemah / handover satelit).", "Status Warning: ")
    add_bullet_item(doc, "Ditetapkan jika tidak ada data melebihi 90 detik. Sesi soket lama ditutup untuk mencegah memory leak, dan sistem menunggu inisiasi soket baru.", "Status Offline: ")

    # -------------------------------------------------------------------------
    # BAB 3
    # -------------------------------------------------------------------------
    add_heading_1(doc, "3. SPESIFIKASI PROTOKOL BINER 13-BYTE USR-CANET200")

    add_heading_2(doc, "3.1 Struktur Paket Biner 13-Byte")
    add_paragraph(doc, 
        "Pada mode transparan CAN-to-TCP, setiap frame CAN NMEA 2000 dibungkus oleh gateway menjadi paket biner sepanjang tepat 13 Byte. "
        "Rincian struktur byte disajikan pada Tabel 3.1."
    )

    add_table_caption(doc, "Tabel 3.1", "Struktur Paket Biner Transparan 13-Byte USR-CANET200")
    t2_data = [
        ("Indeks Offset", "Nama Elemen", "Tipe Data", "Deskripsi dan Nilai Standar"),
        ("Byte 0", "Frame Information", "uint8", "Bit 7: FF (1 = Extended 29-bit), Bit 6: RTR (0 = Data), Bit 3-0: DLC (8 Byte data). Nilai konstan: 0x88."),
        ("Byte 1", "CAN ID Byte 3 (MSB)", "uint8", "Byte tertinggi identifier 29-bit (Priority + Data Page)."),
        ("Byte 2", "CAN ID Byte 2", "uint8", "Byte tengah identifier (PDU Format / PGN bagian atas)."),
        ("Byte 3", "CAN ID Byte 1", "uint8", "Byte tengah identifier (PDU Specific / PGN bagian bawah)."),
        ("Byte 4", "CAN ID Byte 0 (LSB)", "uint8", "Byte terendah identifier, memuat Source Address instrumen kapal."),
        ("Byte 5 s.d. 12", "Payload Data Field", "8 x uint8", "8 Byte muatan data telemetri aktual (format Little-Endian)."),
    ]
    tbl_2 = doc.add_table(rows=len(t2_data), cols=4)
    tbl_2.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_three_line_borders(tbl_2)
    for r_idx, row_vals in enumerate(t2_data):
        for c_idx, val in enumerate(row_vals):
            c = tbl_2.cell(r_idx, c_idx)
            set_cell_margins(c, 50, 50, 80, 80)
            p = c.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(10)
            if r_idx == 0:
                run.font.bold = True
            run.font.color.rgb = COLOR_BLACK

    add_heading_2(doc, "3.2 Algoritma Bit-Masking Identifier 29-Bit (Ekstraksi PGN)")
    add_paragraph(doc, 
        "CAN Identifier 29-bit disusun oleh 4 byte pertama (Byte 1 s.d. 4) dengan urutan Big-Endian. "
        "Programmer harus menyatukan keempat byte tersebut ke dalam satu integer 32-bit (can_id), kemudian melakukan operasi bitwise masking "
        "sesuai rumus pada Tabel 3.2."
    )

    add_table_caption(doc, "Tabel 3.2", "Pemetaan Bit Identifier CAN 29-Bit")
    t3_data = [
        ("Komponen CAN ID", "Posisi Bit", "Operasi Bit-Masking & Shifting", "Fungsi Nilai Hasil"),
        ("Priority (P)", "Bit 28-26 (3 bit)", "(can_id >> 26) & 0x07", "Tingkat prioritas pesan di bus (0 = tertinggi)."),
        ("Data Page (DP)", "Bit 24 (1 bit)", "(can_id >> 24) & 0x01", "Ekspansi penomoran PGN."),
        ("PDU Format (PF)", "Bit 23-16 (8 bit)", "(can_id >> 16) & 0xFF", "Format PDU (PDU1 jika < 240, PDU2 jika >= 240)."),
        ("PDU Specific (PS)", "Bit 15-8 (8 bit)", "(can_id >> 8) & 0xFF", "Destination Address (PDU1) atau Group Extension (PDU2)."),
        ("Source Address (SA)", "Bit 7-0 (8 bit)", "can_id & 0xFF", "Alamat fisik instrumen sensor pengirim di bus kapal."),
    ]
    tbl_3 = doc.add_table(rows=len(t3_data), cols=4)
    tbl_3.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_three_line_borders(tbl_3)
    for r_idx, row_vals in enumerate(t3_data):
        for c_idx, val in enumerate(row_vals):
            c = tbl_3.cell(r_idx, c_idx)
            set_cell_margins(c, 50, 50, 80, 80)
            p = c.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(10)
            if r_idx == 0:
                run.font.bold = True
            run.font.color.rgb = COLOR_BLACK

    add_paragraph(doc, 
        "Rumus Baku Penentuan Nilai PGN:\n"
        "• Jika PF < 240 (Format PDU1): PGN = (DP << 16) | (PF << 8)\n"
        "• Jika PF >= 240 (Format PDU2): PGN = (DP << 16) | (PF << 8) | PS"
    )

    add_heading_2(doc, "3.3 Penanganan Format Data Little-Endian dan Multiplier")
    add_paragraph(doc, 
        "Muatan data 8-Byte (Byte 5 s.d. 12) dikodekan menggunakan aturan Little-Endian (Least Significant Byte tiba lebih dahulu). "
        "Sebagai contoh, nilai integer 16-bit dibentuk dengan rumus: raw_val = Byte[A] | (Byte[A+1] << 8). "
        "Nilai mentah integer tersebut kemudian wajib dikalikan dengan konstanta faktor pengali (multiplier/scale factor) standar NMEA 2000 "
        "untuk memperoleh satuan metrik fisik yang akurat."
    )

    # -------------------------------------------------------------------------
    # BAB 4
    # -------------------------------------------------------------------------
    add_heading_1(doc, "4. KAMUS DAN FORMULA DECODING PARAMETER GROUP NUMBER (PGN)")

    add_paragraph(doc, 
        "Di dalam sistem pemantauan kapal VMS ini, lingkup telemetri difokuskan secara khusus pada tiga pilar utama instrumen maritim: "
        "sensor navigasi dan posisi (GPS, Gyrocompass, AIS), sensor transduser akustik bawah air (kedalaman dan suhu air laut), "
        "serta sensor angin (anemometer). Tabel 4.1 menyajikan kamus resmi PGN NMEA 2000 untuk ketiga domain tersebut beserta "
        "lokasi byte payload dan rumus konversi metriknya."
    )

    add_table_caption(doc, "Tabel 4.1", "Kamus Lengkap PGN Telemetri Navigasi, Transduser, dan Sensor Angin pada Sistem VMS")
    t4_data = [
        ("Nomor PGN", "Nama Parameter Telemetri", "Domain Instrumen", "Frekuensi", "Formula & Multiplier Scaling", "Satuan Metrik"),
        ("PGN 129025", "Rapid Position (GPS)", "Navigasi (GNSS)", "10 Hz", "int32 LE x 1e-7 (Lat & Lon)", "Derajat Desimal WGS84"),
        ("PGN 129026", "COG & SOG (Arah & Laju)", "Navigasi (GNSS)", "4 Hz", "SOG x 0.01 m/s, COG x 0.0001 rad", "Knot & Derajat True"),
        ("PGN 127250", "Vessel Heading (Haluan)", "Navigasi (Gyro)", "10 Hz", "uint16 LE x 0.0001 x (180/π)", "Derajat Kompas (0-360°)"),
        ("PGN 129029", "GNSS Position Data", "Navigasi (GNSS)", "1 Hz", "Lat/Lon, Altitude, HDOP, Satelit", "Geografis Presisi Tinggi"),
        ("PGN 126992", "System Time (Waktu UTC)", "Navigasi (Satelit)", "1 Hz", "uint16 Hari sejak 1970, uint32 ms", "Waktu UTC Terkalibrasi"),
        ("PGN 129038", "AIS Class A Position", "Navigasi (AIS)", "Dinamis", "MMSI, Lintang, Bujur, SOG, COG", "Target Navigasi Sekitar"),
        ("PGN 128267", "Water Depth (Kedalaman)", "Transduser Sonar", "1 Hz", "uint32 LE x 0.01", "Meter Bawah Sensor (m)"),
        ("PGN 130310", "Water Temperature (Suhu)", "Transduser Akustik", "1 Hz", "(uint16 LE x 0.01) - 273.15", "Derajat Celsius (°C)"),
        ("PGN 130306", "Wind Data (Kecepatan Angin)", "Sensor Angin (Wind)", "1 Hz", "Speed x 0.01 m/s, Dir x 0.0001 rad", "Knot & Derajat Datang"),
    ]
    tbl_4 = doc.add_table(rows=len(t4_data), cols=6)
    tbl_4.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_three_line_borders(tbl_4)
    for r_idx, row_vals in enumerate(t4_data):
        for c_idx, val in enumerate(row_vals):
            c = tbl_4.cell(r_idx, c_idx)
            set_cell_margins(c, 50, 50, 70, 70)
            p = c.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(9.5)
            if r_idx == 0:
                run.font.bold = True
            run.font.color.rgb = COLOR_BLACK

    add_heading_2(doc, "4.1 PGN Sensor Navigasi dan Posisi Kapal (GPS, Gyro, dan AIS)")
    add_paragraph(doc, 
        "Kelompok data navigasi bertanggung jawab menyajikan pergerakan dinamis kapal dan kondisi lalu lintas di sekeliling kapal:"
    )
    add_bullet_item(doc, "PGN 129025 (Position, Rapid Update): Dipancarkan pada frekuensi tinggi 10 Hz oleh GPS. Byte 5-8 memuat Latitude dan Byte 9-12 memuat Longitude dalam format signed integer 32-bit (int32 Little-Endian) berskala 1e-7 derajat WGS84. Nilai negatif menandakan Lintang Selatan / Bujur Barat.", "Koordinat Posisi GPS: ")
    add_bullet_item(doc, "PGN 129026 (COG & SOG, Rapid Update): Dipancarkan 4 Hz. Byte 7-8 memuat Course Over Ground (uint16 x 0,0001 rad) dan Byte 9-10 memuat Speed Over Ground (uint16 x 0,01 m/s, dikalikan 1,94384 untuk menghasilkan satuan knot).", "Arah & Laju Kapal (COG/SOG): ")
    add_bullet_item(doc, "PGN 127250 (Vessel Heading): Dipancarkan 10 Hz oleh kompas gyro. Byte 6-7 berupa uint16 Little-Endian dalam satuan radian (skala 0,0001 rad). Konversi ke derajat kompas: heading_deg = raw_val * 0.0001 * (180 / π).", "Haluan Kapal (Heading): ")
    add_bullet_item(doc, "PGN 129029 (GNSS Position Data): Menyajikan informasi posisi GPS komprehensif pada frekuensi 1 Hz, termasuk nilai Horizontal Dilution of Precision (HDOP) untuk memverifikasi tingkat akurasi posisi kapal di laut lepas.", "Kualitas Sinyal GNSS: ")
    add_bullet_item(doc, "PGN 126992 (System Time): Menyediakan sumber waktu absolut UTC yang disinkronkan langsung ke jam atomik satelit GPS guna menjamin keakuratan stempel waktu (timestamping) seluruh rekaman log telemetri.", "Waktu Sistem UTC: ")
    add_bullet_item(doc, "PGN 129038 (AIS Class A Position Report): Membawa laporan posisi dinamis target kapal lain di sekitar (MMSI 9-digit, koordinat posisi, SOG, COG, status navigasi, dan laju putar haluan).", "Target Navigasi AIS: ")

    add_heading_2(doc, "4.2 PGN Sensor Transduser Akustik Bawah Air (Depth & Water Temp)")
    add_paragraph(doc, 
        "Transduser echosounder memancarkan pulsa gelombang akustik berfrekuensi tinggi (misalnya CHIRP 50/200 kHz) ke dasar laut "
        "untuk mengukur kedalaman air dan suhu permukaan laut secara kontinu:"
    )
    add_bullet_item(doc, "PGN 128267 (Water Depth): Dipancarkan pada frekuensi 1 Hz. Offset Byte 5 memuat Sequence ID (1 Byte), Byte 6 s.d. 9 memuat nilai kedalaman air mentah (Water Depth) dalam uint32 Little-Endian dengan resolusi 0,01 meter (1 cm), dan Byte 10 s.d. 11 memuat nilai offset lunas kapal (transducer-to-keel offset). Jika Byte 6-9 bernilai 0xFFFFFFFF, artinya transduser tidak menerima pantulan dasar laut (out-of-range).", "Kedalaman Air Bawah Transduser: ")
    add_bullet_item(doc, "PGN 130310 (Environmental Parameters - Water Temperature): Byte 6 s.d. 7 memuat suhu air laut dalam format uint16 Little-Endian dengan resolusi 0,01 Kelvin. Dekoder backend mengonversi nilai tersebut ke derajat Celsius melalui rumus: temp_c = (raw_val * 0.01) - 273.15.", "Suhu Permukaan Air Laut: ")

    add_heading_2(doc, "4.3 PGN Sensor Angin / Wind Data (Kecepatan & Sudut Angin)")
    add_paragraph(doc, 
        "Sensor angin (anemometer cup atau sensor ultrasonik) dipasang pada tiang tertinggi kapal (masthead) untuk mengukur "
        "kekuatan dan arah angin laut secara waktu nyata:"
    )
    add_bullet_item(doc, "PGN 130306 (Wind Data): Dipancarkan pada frekuensi 1 Hz. Offset Byte 5 memuat Sequence ID (1 Byte). Byte 6 s.d. 7 memuat Kecepatan Angin (Wind Speed) dalam format uint16 Little-Endian dengan resolusi 0,01 meter per detik (m/s). Untuk konversi ke satuan knot: wind_speed_knots = raw_speed * 0.01 * 1.94384.", "Kecepatan Angin (Wind Speed): ")
    add_bullet_item(doc, "Byte 8 s.d. 9 memuat Sudut Datang Angin (Wind Angle) dalam format uint16 Little-Endian dengan resolusi 0,0001 radian. Konversi ke derajat busur: wind_angle_deg = raw_angle * 0.0001 * (180 / π).", "Sudut Datang Angin (Wind Angle): ")
    add_bullet_item(doc, "Byte 10 memuat Referensi Angin (Wind Reference): Nilai 0 menandakan Angin Nyata (True Wind - dikoreksi terhadap haluan dan laju kapal), sedangkan nilai 2 menandakan Angin Relatif (Apparent Wind - angin yang dirasakan langsung di atas geladak kapal).", "Referensi Angin (True vs Apparent): ")

    # -------------------------------------------------------------------------
    # BAB 5
    # -------------------------------------------------------------------------
    add_heading_1(doc, "5. SPESIFIKASI PARSING FORMAT NMEA 0183 (SERIAL ASCII)")

    add_heading_2(doc, "5.1 Struktur Sintaks Kalimat ASCII dan Validasi Checksum XOR")
    add_paragraph(doc, 
        "Data NMEA 0183 yang masuk pada Port 20006 berbentuk baris teks ASCII. Sebelum membedah kolom data, backend WAJIB melakukan validasi checksum. "
        "Checksum dihitung dengan melakukan operasi bitwise XOR terhadap seluruh karakter yang berada di antara tanda '$' dan '*'."
    )
    add_code_snippet(doc, 
        "Fungsi Validasi Checksum NMEA 0183 (JavaScript):\n"
        "function validateNmeaChecksum(sentence) {\n"
        "    const match = sentence.match(/^\\$([^*]+)\\*([0-9A-Fa-f]{2})/);\n"
        "    if (!match) return false;\n"
        "    const payload = match[1];\n"
        "    const expectedChecksum = parseInt(match[2], 16);\n"
        "    let computed = 0;\n"
        "    for (let i = 0; i < payload.length; i++) {\n"
        "        computed ^= payload.charCodeAt(i);\n"
        "    }\n"
        "    return computed === expectedChecksum;\n"
        "}"
    )

    add_heading_2(doc, "5.2 Kamus Kalimat NMEA 0183 Ekivalen PGN Navigasi, Transduser, dan Wind")
    add_paragraph(doc, 
        "Tabel 5.1 merangkum format kalimat NMEA 0183 yang didekode oleh backend VMS pada Port 20006. "
        "Seluruh kalimat ini dipetakan secara setara dengan data PGN NMEA 2000 (Navigasi, Transduser, dan Wind) "
        "sehingga menghasilkan format keluaran data metrik yang seragam pada basis data dan dashboard pemantauan."
    )

    add_table_caption(doc, "Tabel 5.1", "Format Kalimat NMEA 0183 yang Didukung Backend dan Ekivalensi PGN NMEA 2000")
    t5_data = [
        ("Kalimat NMEA", "Ekivalen PGN", "Parameter Telemetri", "Contoh String ASCII Mentah", "Indeks Kolom Array (Split Koma)"),
        ("$SDDPT", "PGN 128267", "Kedalaman Air & Offset Lunas", "$SDDPT,12.4,0.0,100.0*5E", "tokens[1] = Kedalaman (m), tokens[2] = Offset (m)"),
        ("$SDDBT", "PGN 128267", "Kedalaman Bawah Transduser", "$SDDBT,40.6,f,12.4,M,6.8,F*34", "tokens[3] = Kedalaman (m), tokens[1] = Kaki (feet)"),
        ("$SDMTW", "PGN 130310", "Suhu Permukaan Air Laut", "$SDMTW,25.8,C*04", "tokens[1] = Suhu (°C), tokens[2] = Satuan ('C')"),
        ("$HCHDT", "PGN 127250", "Haluan Kompas Sejati (True)", "$HCHDT,248.5,T*1F", "tokens[1] = Derajat Haluan, tokens[2] = 'T' (True)"),
        ("$HCHDG", "PGN 127250", "Haluan Kompas Magnetik", "$HCHDG,247.2,0.5,E,0.8,W*68", "tokens[1] = Heading Magnetik, [2-5] = Deviasi/Variasi"),
        ("$GPGLL", "PGN 129025", "Posisi Geografis Lintang/Bujur", "$GPGLL,0611.23,S,10650.12,E,031205,A,A*4C", "tokens[1-2] = Lat S/N, tokens[3-4] = Lon E/W, [6] = Valid"),
        ("$GPVTG", "PGN 129026", "Arah Gerak (COG) & Laju (SOG)", "$GPVTG,085.4,T,,M,12.4,N,22.9,K,A*23", "tokens[1] = COG (° True), tokens[5] = SOG (Knot)"),
        ("$GPRMC", "PGN 129025/26/92", "Paket Navigasi Lengkap GPS", "$GPRMC,031205,A,0611.23,S,10650.12,E,12.4,085.4,021126,,,A*7B", "tokens[1]=Time, [3-6]=Lat/Lon, [7]=SOG, [8]=COG, [9]=Date"),
        ("$GPGGA", "PGN 129029", "GNSS Fix, HDOP, Satelit, Alt", "$GPGGA,031205,0611.23,S,10650.12,E,1,08,1.1,5.2,M,-18.2,M,,*7E", "tokens[6]=Fix, [7]=Satelit, [8]=HDOP, [9]=Elevasi (m)"),
        ("$GPZDA", "PGN 126992", "Waktu dan Tanggal UTC", "$GPZDA,031205,02,11,2026,00,00*66", "tokens[1]=Waktu UTC, [2]=Hari, [3]=Bulan, [4]=Tahun"),
        ("$WIMWV", "PGN 130306", "Kecepatan & Sudut Angin (Wind)", "$WIMWV,045.0,R,14.2,N,A*18", "tokens[1]=Sudut (°), [2]=Ref ('R'/'T'), [3]=Speed, [4]='N'"),
        ("!AIVDM", "PGN 129038", "Laporan Posisi Target AIS", "!AIVDM,1,1,,B,13aEO:0P0000h0hK>8=h0?vN0<11,0*26", "tokens[5]=Payload Biner Terenkapsulasi 6-bit ASCII"),
    ]
    tbl_5 = doc.add_table(rows=len(t5_data), cols=5)
    tbl_5.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_three_line_borders(tbl_5)
    for r_idx, row_vals in enumerate(t5_data):
        for c_idx, val in enumerate(row_vals):
            c = tbl_5.cell(r_idx, c_idx)
            set_cell_margins(c, 40, 40, 60, 60)
            p = c.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(8.5)
            if r_idx == 0:
                run.font.bold = True
            run.font.color.rgb = COLOR_BLACK

    # -------------------------------------------------------------------------
    # BAB 6
    # -------------------------------------------------------------------------
    add_heading_1(doc, "6. INTEGRASI BASIS DATA DAN REAL-TIME STREAMING")

    add_heading_2(doc, "6.1 Skema Basis Data Relasional & Time-Series (PostgreSQL/PostGIS)")
    add_paragraph(doc, 
        "Data telemetri yang telah didekode disimpan ke basis data PostgreSQL dengan ekstensi PostGIS. "
        "Tabel telemetry_logs menyimpan riwayat telemetri time-series dengan indexing spasial pada kolom koordinat geografis:"
    )
    add_code_snippet(doc, 
        "DDL Skema Tabel Telemetri Kapal (PostgreSQL / PostGIS):\n"
        "CREATE TABLE vessel_telemetry (\n"
        "    id BIGSERIAL PRIMARY KEY,\n"
        "    vessel_id VARCHAR(50) NOT NULL REFERENCES vessels(id),\n"
        "    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n"
        "    geom GEOMETRY(Point, 4326),  -- Koordinat WGS84 GPS (Lon, Lat)\n"
        "    speed_knots NUMERIC(5, 2),\n"
        "    heading_deg NUMERIC(5, 1),\n"
        "    water_depth_m NUMERIC(6, 2),\n"
        "    water_temp_c NUMERIC(4, 2),\n"
        "    source_protocol VARCHAR(20)  -- 'NMEA2000' atau 'NMEA0183'\n"
        ");\n"
        "CREATE INDEX idx_telemetry_vessel_time ON vessel_telemetry(vessel_id, recorded_at DESC);\n"
        "CREATE INDEX idx_telemetry_geom ON vessel_telemetry USING GIST(geom);"
    )

    add_heading_2(doc, "6.2 Real-time Broadcasting via WebSocket ke Frontend Dashboard")
    add_paragraph(doc, 
        "Untuk menghadirkan animasi instrumen navigasi yang halus (misalnya pembaruan visual gelombang echosounder 60 FPS "
        "dan pergerakan jarum kompas gyro), backend menyiarkan data telemetri secara instan ke browser pengguna menggunakan WebSocket (Socket.io). "
        "Payload WebSocket dikemas dalam objek JSON terstruktur:"
    )
    add_code_snippet(doc, 
        "Payload JSON Siaran WebSocket ke Frontend:\n"
        "{\n"
        "  \"event\": \"vessel_telemetry_update\",\n"
        "  \"vessel_id\": \"KM_Uno\",\n"
        "  \"timestamp\": \"2026-11-02T09:30:00.125Z\",\n"
        "  \"navigation\": {\n"
        "    \"latitude\": -6.102345,\n"
        "    \"longitude\": 106.883412,\n"
        "    \"sog_knots\": 12.4,\n"
        "    \"cog_deg\": 85.2,\n"
        "    \"heading_deg\": 86.0\n"
        "  },\n"
        "  \"instruments\": {\n"
        "    \"water_depth_m\": 18.42,\n"
        "    \"water_temp_c\": 26.5,\n"
        "    \"keel_offset_m\": 0.0\n"
        "  }\n"
        "}"
    )

    add_heading_2(doc, "6.3 Contoh Implementasi Parser Backend (Node.js & Python)")
    add_paragraph(doc, 
        "Berikut adalah implementasi dasar pembedahan buffer biner 13-Byte NMEA 2000 dalam bahasa Node.js (JavaScript):"
    )
    add_code_snippet(doc, 
        "Implementasi Parser Biner 13-Byte (Node.js):\n"
        "function parseCanFrame13Byte(buf) {\n"
        "    if (buf.length !== 13 || buf[0] !== 0x88) return null;\n"
        "    // 1. Ekstrak CAN Identifier 29-bit\n"
        "    const canId = (buf[1] << 24) | (buf[2] << 16) | (buf[3] << 8) | buf[4];\n"
        "    const priority = (canId >> 26) & 0x07;\n"
        "    const dp = (canId >> 24) & 0x01;\n"
        "    const pf = (canId >> 16) & 0xFF;\n"
        "    const ps = (canId >> 8) & 0xFF;\n"
        "    const sourceAddress = canId & 0xFF;\n"
        "    const pgn = (pf < 240) ? ((dp << 16) | (pf << 8)) : ((dp << 16) | (pf << 8) | ps);\n\n"
        "    // 2. Ekstrak Data Payload 8-Byte (Byte 5 s.d. 12)\n"
        "    const payload = buf.slice(5, 13);\n"
        "    let result = { pgn, sourceAddress, timestamp: new Date() };\n\n"
        "    if (pgn === 128267) { // Transduser: Water Depth\n"
        "        const rawDepth = payload.readUInt32LE(1);\n"
        "        result.depth_m = (rawDepth === 0xFFFFFFFF) ? null : rawDepth * 0.01;\n"
        "    } else if (pgn === 130310) { // Transduser: Water Temperature\n"
        "        const rawTemp = payload.readUInt16LE(1);\n"
        "        result.water_temp_c = (rawTemp === 0xFFFF) ? null : (rawTemp * 0.01) - 273.15;\n"
        "    } else if (pgn === 127250) { // Navigasi: Vessel Heading (Gyro)\n"
        "        const rawHeading = payload.readUInt16LE(1);\n"
        "        result.heading_deg = (rawHeading === 0xFFFF) ? null : (rawHeading * 0.0001) * (180 / Math.PI);\n"
        "    } else if (pgn === 129025) { // Navigasi: Rapid Position GPS\n"
        "        result.latitude = payload.readInt32LE(0) * 1e-7;\n"
        "        result.longitude = payload.readInt32LE(4) * 1e-7;\n"
        "    } else if (pgn === 129026) { // Navigasi: COG & SOG\n"
        "        const rawCog = payload.readUInt16LE(2);\n"
        "        const rawSog = payload.readUInt16LE(4);\n"
        "        result.cog_deg = (rawCog === 0xFFFF) ? null : (rawCog * 0.0001) * (180 / Math.PI);\n"
        "        result.sog_knots = (rawSog === 0xFFFF) ? null : rawSog * 0.01 * 1.94384;\n"
        "    } else if (pgn === 130306) { // Wind Data: Sensor Angin\n"
        "        const rawSpeed = payload.readUInt16LE(1);\n"
        "        const rawAngle = payload.readUInt16LE(3);\n"
        "        result.wind_speed_knots = (rawSpeed === 0xFFFF) ? null : rawSpeed * 0.01 * 1.94384;\n"
        "        result.wind_angle_deg = (rawAngle === 0xFFFF) ? null : (rawAngle * 0.0001) * (180 / Math.PI);\n"
        "        result.wind_reference = (payload[5] === 0) ? 'True' : 'Apparent';\n"
        "    }\n"
        "    return result;\n"
        "}"
    )

    try:
        doc.save(out_docx)
        print(f"BERHASIL: Spesifikasi Integrasi Programmer disimpan ke: {out_docx}")
    except PermissionError:
        temp_docx = os.path.join(os.path.dirname(out_docx), "Spesifikasi_Integrasi_Programmer_updated.docx")
        doc.save(temp_docx)
        print(f"PERINGATAN: File {out_docx} sedang dibuka di Microsoft Word/aplikasi lain.")
        print(f"Dokumen berhasil disimpan sementara ke: {temp_docx}")


if __name__ == "__main__":
    main()

