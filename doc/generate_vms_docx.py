# -*- coding: utf-8 -*-
"""
Script Generator Dokumen Word Resmi:
STANDAR OPERASIONAL PROSEDUR (SOP) & PANDUAN PENGGUNA (USER GUIDE)
PENGGUNAAN USR-CANET200 GATEWAY, SPESIFIKASI DEKODE NMEA 2000 & 0183,
DAN PANDUAN LENGKAP FITUR & UX PLATFORM GEOTEKNO VMS (BOX NAVIGASI)

File Output: e:/Delfin/Product Engineer/Box Navigasi/doc/VMS.docx
"""

import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

# Palet Warna Korporat
HEX_NAVY    = "0F172A"  # Slate 900
HEX_CRIMSON = "DB4040"  # GeoTekno Accent
HEX_BLUE    = "0284C7"  # Sky Blue 600
HEX_SLATE   = "334155"  # Slate 700
HEX_LIGHTBG = "F8FAFC"  # Slate 50
HEX_BORDER  = "CBD5E1"  # Slate 300
HEX_CODEBG  = "1E293B"  # Slate 800
HEX_CODEFG  = "38BDF8"  # Sky 400
HEX_CALLOUT = "F0F9FF"  # Sky 50

COLOR_NAVY    = RGBColor(15, 23, 42)
COLOR_CRIMSON = RGBColor(219, 64, 64)
COLOR_BLUE    = RGBColor(2, 132, 199)
COLOR_SLATE   = RGBColor(51, 65, 85)
COLOR_MUTED   = RGBColor(100, 116, 139)

def set_cell_background(cell, hex_color):
    """Set background color of a table cell."""
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tc_pr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Set inner cell padding in dxa (1 pt = 20 dxa)."""
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

def set_table_borders(table, hex_color=HEX_BORDER):
    """Set subtle modern borders for a table."""
    tbl_pr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{hex_color}"/>'
        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="{hex_color}"/>'
        f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="{hex_color}"/>'
        f'<w:insideV w:val="none"/>'
        f'<w:left w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tblBorders>'
    )
    tbl_pr.append(borders)

def add_callout_box(doc, text, title="CATATAN PENTING & BEST PRACTICE"):
    """Tambahkan kotak informasi / callout berbingkai rapi."""
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, HEX_CALLOUT)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="{HEX_CRIMSON}"/>'
        f'<w:top w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'<w:bottom w:val="none"/>'
        f'</w:tcBorders>'
    )
    tc_pr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    run_title = p.add_run(f"📌 {title}\n")
    run_title.bold = True
    run_title.font.name = "Arial"
    run_title.font.size = Pt(9.5)
    run_title.font.color.rgb = COLOR_CRIMSON
    
    run_body = p.add_run(text)
    run_body.font.name = "Arial"
    run_body.font.size = Pt(8.5)
    run_body.font.color.rgb = COLOR_SLATE
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def add_code_box(doc, code_text):
    """Tambahkan kotak cuplikan kode / konfigurasi biner / ASCII."""
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, HEX_CODEBG)
    set_cell_margins(cell, top=100, bottom=100, left=160, right=160)
    
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:left w:val="single" w:sz="12" w:space="0" w:color="{HEX_BLUE}"/>'
        f'<w:top w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'<w:bottom w:val="none"/>'
        f'</w:tcBorders>'
    )
    tc_pr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.05
    run = p.add_run(code_text)
    run.font.name = "Consolas"
    run.font.size = Pt(8.0)
    run.font.color.rgb = RGBColor(56, 189, 248) # Sky 400
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def main():
    target_docx = "e:/Delfin/Product Engineer/Box Navigasi/doc/VMS.docx"
    doc = docx.Document()
    
    # Atur Margin Halaman A4
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)
        section.page_width = Inches(8.27)  # A4 Width
        section.page_height = Inches(11.69) # A4 Height

    # =========================================================================
    # HALAMAN COVER & IDENTITAS DOKUMEN
    # =========================================================================
    # Header Mini
    p_header = doc.add_paragraph()
    p_header.paragraph_format.space_before = Pt(0)
    p_header.paragraph_format.space_after = Pt(4)
    run_tag = p_header.add_run("GEOTEKNO VMS  •  BOX NAVIGASI SYSTEM  |  STANDAR OPERASIONAL PROSEDUR")
    run_tag.bold = True
    run_tag.font.name = "Arial"
    run_tag.font.size = Pt(8.5)
    run_tag.font.color.rgb = COLOR_CRIMSON

    # Garis Pembatas
    p_line = doc.add_paragraph()
    p_line.paragraph_format.space_after = Pt(18)
    run_hr = p_line.add_run("―" * 58)
    run_hr.font.color.rgb = COLOR_CRIMSON
    run_hr.bold = True

    # Gambar Cover jika tersedia
    cover_img_path = "e:/Delfin/Product Engineer/Box Navigasi/doc/extracted_media/word/media/image2.jpeg"
    if os.path.exists(cover_img_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(0)
        p_img.paragraph_format.space_after = Pt(14)
        run_img = p_img.add_run()
        run_img.add_picture(cover_img_path, width=Inches(3.8))

    # Judul Utama
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(6)
    p_title.paragraph_format.space_after = Pt(6)
    run_title = p_title.add_run("STANDAR OPERASIONAL PROSEDUR\nUSER GUIDE USR-CANET200 & GEOTEKNO VMS")
    run_title.bold = True
    run_title.font.name = "Arial"
    run_title.font.size = Pt(18)
    run_title.font.color.rgb = COLOR_NAVY

    # Subjudul
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(16)
    run_sub = p_sub.add_run(
        "Panduan Komprehensif Instalasi & Konfigurasi Gateway USR-CANET200, "
        "Mekanisme Handshake Koneksi TCP, Arsitektur Penguraian Sinyal NMEA 2000 (CAN Bus 13-Byte) "
        "& NMEA 0183 (Serial RS-485), Serta Panduan Operasional Fitur & UX Seluruh Halaman Platform"
    )
    run_sub.font.name = "Arial"
    run_sub.font.size = Pt(9.5)
    run_sub.font.color.rgb = COLOR_SLATE

    # Metadata Ringkas
    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    tbl_meta = doc.add_table(rows=6, cols=2)
    tbl_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_meta)
    
    meta_rows = [
        ("Nomor Dokumen", "SOP/ENG-VMS/2026/001 (Rev 2.5)"),
        ("Tanggal Efektif", "28 Oktober 2026"),
        ("Sistem Target", "Box Navigasi - Telemetry & Marine Vessel Management System (GeoTekno VMS)"),
        ("Gateway & Sensor", "USR-CANET200 Dual CAN/RS-485 Gateway, Airmar DST810, Garmin AquaMap, AIS Class A/B"),
        ("Protokol Komunikasi", "TCP Client (Port 20005 CAN & Port 20006 NMEA), WebSocket 1 Hz, REST API JSON"),
        ("Penyusun & Otorisasi", "Divisi Product Engineering & IoT Maritim, PT Geo Tekno Maritim Indonesia"),
    ]
    
    col_widths = [Inches(1.8), Inches(4.8)]
    for r_idx, (lbl, val) in enumerate(meta_rows):
        row = tbl_meta.rows[r_idx]
        set_cell_background(row.cells[0], HEX_LIGHTBG)
        set_cell_margins(row.cells[0], top=80, bottom=80, left=120, right=120)
        set_cell_margins(row.cells[1], top=80, bottom=80, left=120, right=120)
        row.cells[0].width = col_widths[0]
        row.cells[1].width = col_widths[1]
        
        p0 = row.cells[0].paragraphs[0]
        p0.paragraph_format.space_before = Pt(0)
        p0.paragraph_format.space_after = Pt(0)
        r0 = p0.add_run(lbl)
        r0.bold = True
        r0.font.name = "Arial"
        r0.font.size = Pt(8.5)
        r0.font.color.rgb = COLOR_NAVY
        
        p1 = row.cells[1].paragraphs[0]
        p1.paragraph_format.space_before = Pt(0)
        p1.paragraph_format.space_after = Pt(0)
        r1 = p1.add_run(val)
        r1.font.name = "Arial"
        r1.font.size = Pt(8.5)
        r1.font.color.rgb = COLOR_SLATE

    doc.add_page_break()

    # =========================================================================
    # DAFTAR ISI SISTEMATIS
    # =========================================================================
    p_toc_head = doc.add_paragraph()
    p_toc_head.paragraph_format.space_before = Pt(12)
    p_toc_head.paragraph_format.space_after = Pt(6)
    r_toc = p_toc_head.add_run("DAFTAR ISI STANDAR OPERASIONAL PROSEDUR")
    r_toc.bold = True
    r_toc.font.name = "Arial"
    r_toc.font.size = Pt(13)
    r_toc.font.color.rgb = COLOR_CRIMSON

    toc_items = [
        ("A. IDENTITAS SOP", "Informasi legalitas dokumen, kepemilikan proses, dan otorisasi sistem"),
        ("B. TUJUAN SOP", "Sasaran operasional dan teknis integrasi gateway hardware ke platform cloud VMS"),
        ("C. ALAT DAN BAHAN", "Daftar spesifikasi perangkat keras, sensor maritim, perkabelan, dan platform"),
        ("D. LANGKAH PELAKSANAAN", "Panduan langkah kerja teknis dan operasional secara end-to-end:"),
        ("   D.1. Instalasi Fisik & Pengkabelan Box Navigasi", "Topologi kabel CAN Bus, Serial RS-485, Power DC, dan indikator LED"),
        ("   D.2. Konfigurasi USR-CANET200 via Web Dashboard", "Langkah setting IP, CAN 250k, Serial, Socket TCP Client, dan Identity Token"),
        ("   D.3. Verifikasi Koneksi ke Platform GeoTekno VMS", "Mekanisme handshake session, status ONLINE/OFFLINE, dan logging soket"),
        ("   D.4. Spesifikasi & Logika Penguraian (Decode Engine)", "Format frame 13-byte, PGN N2K, Fast-Packet, NMEA 0183 XOR, dan sensor DST810"),
        ("   D.5. Panduan Fitur Platform per Halaman & Desain UX", "Tata cara penggunaan Overview, Marine Traffic, Asset, Monitoring, Live Logs, Export, RBAC"),
        ("E. TROUBLESHOOTING & DIAGNOSTIK KENDALA LAPANGAN", "Solusi penanganan kendala jaringan, socket error, baudrate mismatch, dan offline"),
        ("F. KESIMPULAN LANGKAH KERJA & VERIFIKASI DOKUMEN", "Rangkuman kesiapan operasional dan lembar tanda tangan persetujuan"),
    ]

    tbl_toc = doc.add_table(rows=len(toc_items), cols=2)
    tbl_toc.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_toc)
    for idx, (sect, desc) in enumerate(toc_items):
        row = tbl_toc.rows[idx]
        set_cell_margins(row.cells[0], top=60, bottom=60, left=100, right=100)
        set_cell_margins(row.cells[1], top=60, bottom=60, left=100, right=100)
        row.cells[0].width = Inches(2.8)
        row.cells[1].width = Inches(3.8)
        if idx % 2 == 1:
            set_cell_background(row.cells[0], HEX_LIGHTBG)
            set_cell_background(row.cells[1], HEX_LIGHTBG)
            
        p_s = row.cells[0].paragraphs[0]
        p_s.paragraph_format.space_after = Pt(0)
        r_s = p_s.add_run(sect)
        r_s.bold = True
        r_s.font.name = "Arial"
        r_s.font.size = Pt(8.5)
        r_s.font.color.rgb = COLOR_NAVY if not sect.startswith("   ") else COLOR_SLATE
        
        p_d = row.cells[1].paragraphs[0]
        p_d.paragraph_format.space_after = Pt(0)
        r_d = p_d.add_run(desc)
        r_d.font.name = "Arial"
        r_d.font.size = Pt(8.0)
        r_d.font.color.rgb = COLOR_MUTED

    doc.add_page_break()

    # =========================================================================
    # A. IDENTITAS SOP
    # =========================================================================
    h_a = doc.add_paragraph()
    h_a.paragraph_format.space_before = Pt(14)
    h_a.paragraph_format.space_after = Pt(4)
    r_ha = h_a.add_run("A. IDENTITAS STANDAR OPERASIONAL PROSEDUR")
    r_ha.bold = True
    r_ha.font.name = "Arial"
    r_ha.font.size = Pt(13)
    r_ha.font.color.rgb = COLOR_CRIMSON

    p_a1 = doc.add_paragraph()
    p_a1.paragraph_format.line_spacing = 1.15
    p_a1.paragraph_format.space_after = Pt(6)
    r_a1 = p_a1.add_run(
        "Dokumen Standar Operasional Prosedur (SOP) ini diterbitkan secara resmi oleh PT Geo Tekno Maritim Indonesia "
        "sebagai acuan baku tata cara implementasi perangkat keras gateway telemetri, konfigurasi komunikasi jaringan kapal, "
        "penguraian protokol sensor navigasi laut (NMEA 2000 dan NMEA 0183), serta penggunaan sistem pemantauan terintegrasi "
        "GeoTekno Vessel Management System (Box Navigasi)."
    )
    r_a1.font.name = "Arial"
    r_a1.font.size = Pt(9.0)
    r_a1.font.color.rgb = COLOR_SLATE

    tbl_id = doc.add_table(rows=7, cols=2)
    tbl_id.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_id)
    id_rows = [
        ("Nama Institusi", "PT Geo Tekno Maritim Indonesia"),
        ("Divisi Pelaksana", "Product Engineering & Marine IoT Solutions"),
        ("Judul Prosedur", "Prosedur Baku Konfigurasi USR-CANET200 & Pengoperasian Platform VMS"),
        ("Klasifikasi Dokumen", "Dokumen Teknis Resmi & User Guide Operasional (Level 1 Internal & Client)"),
        ("Masa Berlaku", "Tahun Operasional 2026 s/d Tinjauan Berikutnya"),
        ("Distribusi Dokumen", "Marine Electronics Field Engineer, Commissioning Team, Fleet Operator, Superadmin"),
        ("Referensi Standar", "NMEA 2000 Standard (IEC 61162-3), NMEA 0183 (IEC 61162-1), SAE J1939, ITU-R M.1371"),
    ]
    for r_idx, (k, v) in enumerate(id_rows):
        row = tbl_id.rows[r_idx]
        row.cells[0].width = Inches(1.8)
        row.cells[1].width = Inches(4.8)
        set_cell_margins(row.cells[0], top=60, bottom=60, left=100, right=100)
        set_cell_margins(row.cells[1], top=60, bottom=60, left=100, right=100)
        if r_idx % 2 == 1:
            set_cell_background(row.cells[0], HEX_LIGHTBG)
            set_cell_background(row.cells[1], HEX_LIGHTBG)
        p0 = row.cells[0].paragraphs[0]
        p0.paragraph_format.space_after = Pt(0)
        r0 = p0.add_run(k)
        r0.bold = True
        r0.font.name = "Arial"
        r0.font.size = Pt(8.5)
        r0.font.color.rgb = COLOR_NAVY
        p1 = row.cells[1].paragraphs[0]
        p1.paragraph_format.space_after = Pt(0)
        r1 = p1.add_run(v)
        r1.font.name = "Arial"
        r1.font.size = Pt(8.5)
        r1.font.color.rgb = COLOR_SLATE

    # =========================================================================
    # B. TUJUAN SOP
    # =========================================================================
    h_b = doc.add_paragraph()
    h_b.paragraph_format.space_before = Pt(14)
    h_b.paragraph_format.space_after = Pt(4)
    r_hb = h_b.add_run("B. TUJUAN STANDAR OPERASIONAL PROSEDUR")
    r_hb.bold = True
    r_hb.font.name = "Arial"
    r_hb.font.size = Pt(13)
    r_hb.font.color.rgb = COLOR_CRIMSON

    b_points = [
        "Menstandarkan tata cara pengkabelan, proteksi kelistrikan, dan konfigurasi modul gateway USR-CANET200 pada kapal.",
        "Menghilangkan risiko kesalahan pengaturan baud rate CAN Bus (250 kbps) dan port serial RS-485 yang dapat menyebabkan bus-off atau kegagalan penyerapan data sensor.",
        "Menjamin keandalan koneksi TCP Client menuju server cloud GeoTekno VMS menggunakan mekanisme handshake identitas dan keep-alive connection.",
        "Menyediakan panduan lengkap logika decoding matematis terhadap parameter navigasi NMEA 2000 biner 13-byte dan kalimat serial NMEA 0183.",
        "Memberikan instruksi kerja interaktif per halaman antarmuka platform (Overview, Marine Traffic, Vessel Assets, Monitoring Canvas, Live Logs, Data Export, dan User Management).",
        "Menjelaskan fitur UX terbaru: fleksibilitas penataan kanvas 12-kolom, penggantian slot atribut instrumen secara mandiri tanpa mereset pilihan lainnya, dan penggunaan nama atribut yang bersih tanpa tanda underscore (_) sesuai tampilan ramah pengguna."
    ]
    for pt in b_points:
        p_pt = doc.add_paragraph(style='List Bullet')
        p_pt.paragraph_format.space_before = Pt(1)
        p_pt.paragraph_format.space_after = Pt(2)
        p_pt.paragraph_format.line_spacing = 1.15
        r_pt = p_pt.add_run(pt)
        r_pt.font.name = "Arial"
        r_pt.font.size = Pt(8.5)
        r_pt.font.color.rgb = COLOR_SLATE

    # =========================================================================
    # C. ALAT DAN BAHAN
    # =========================================================================
    h_c = doc.add_paragraph()
    h_c.paragraph_format.space_before = Pt(14)
    h_c.paragraph_format.space_after = Pt(4)
    r_hc = h_c.add_run("C. ALAT DAN BAHAN KERJA")
    r_hc.bold = True
    r_hc.font.name = "Arial"
    r_hc.font.size = Pt(13)
    r_hc.font.color.rgb = COLOR_CRIMSON

    p_c_desc = doc.add_paragraph()
    p_c_desc.paragraph_format.line_spacing = 1.15
    p_c_desc.paragraph_format.space_after = Pt(6)
    r_cd = p_c_desc.add_run(
        "Sebelum melaksanakan pekerjaan komisioning lapangan atau pengujian laboratorium, "
        "teknisi wajib memastikan ketersediaan dan kelayakan komponen perangkat keras dan perangkat lunak berikut:"
    )
    r_cd.font.name = "Arial"
    r_cd.font.size = Pt(9.0)
    r_cd.font.color.rgb = COLOR_SLATE

    tbl_tools = doc.add_table(rows=8, cols=3)
    tbl_tools.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_tools)
    
    # Table Header
    hdr_cells = tbl_tools.rows[0].cells
    hdr_cells[0].width = Inches(1.8)
    hdr_cells[1].width = Inches(1.8)
    hdr_cells[2].width = Inches(3.0)
    for c_i, h_txt in enumerate(["Kategori Komponen", "Nama Komponen / Alat", "Spesifikasi Teknis & Fungsi"]):
        set_cell_background(hdr_cells[c_i], HEX_NAVY)
        set_cell_margins(hdr_cells[c_i], top=80, bottom=80, left=100, right=100)
        p = hdr_cells[c_i].paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h_txt)
        r.bold = True
        r.font.name = "Arial"
        r.font.size = Pt(8.0)
        r.font.color.rgb = RGBColor(255, 255, 255)

    tools_data = [
        ("Gateway Komunikasi", "USR-CANET200 Gateway", "Dual CAN interface (CAN1/CAN2) + 1x RS-485 to 10/100M Ethernet RJ45. Catu daya DC 9-36V."),
        ("Sensor Maritim", "Airmar DST810 Smart Sensor", "Multi-sensor NMEA 2000: Akustik Kedalaman 235 kHz, Paddlewheel STW 5 Hz, Suhu Air Laut, Attitude 3-axis."),
        ("Sumber Data Navigasi", "Garmin AquaMap / GPS / AIS", "Perangkat Chartplotter dan Transponder AIS penyedia data posisi NMEA 2000 / NMEA 0183."),
        ("Aksesori Jaringan", "Kabel CAN Twisted Shielded", "Kabel NMEA 2000 micro-C atau kabel twisted pair industri berpelindung ground untuk jalur CAN_H dan CAN_L."),
        ("Terminasi Bus", "Resistor Terminasi 120 Ω", "Resistor 120 Ohm 1/4W dipasang di kedua ujung backbone bus untuk mencegah pantulan gelombang sinyal CAN."),
        ("Konektivitas IP", "Kabel LAN RJ45 Cat5e/6", "Kabel ethernet untuk menghubungkan gateway ke router onboard / switch LAN atau langsung ke laptop teknisi."),
        ("Platform Pemantauan", "GeoTekno VMS (Box Navigasi)", "Stack backend Node.js/TypeScript (TCP Ingestion port 20005 & 20006) dan frontend web modern berbasis React 19."),
    ]
    for r_idx, (cat, name, spec) in enumerate(tools_data, start=1):
        row = tbl_tools.rows[r_idx]
        row.cells[0].width = Inches(1.8)
        row.cells[1].width = Inches(1.8)
        row.cells[2].width = Inches(3.0)
        for c_i in range(3):
            set_cell_margins(row.cells[c_i], top=60, bottom=60, left=100, right=100)
            if r_idx % 2 == 0:
                set_cell_background(row.cells[c_i], HEX_LIGHTBG)
        p0 = row.cells[0].paragraphs[0]
        p0.paragraph_format.space_after = Pt(0)
        r0 = p0.add_run(cat)
        r0.bold = True
        r0.font.name = "Arial"
        r0.font.size = Pt(8.0)
        r0.font.color.rgb = COLOR_NAVY
        
        p1 = row.cells[1].paragraphs[0]
        p1.paragraph_format.space_after = Pt(0)
        r1 = p1.add_run(name)
        r1.font.name = "Arial"
        r1.font.size = Pt(8.0)
        r1.font.color.rgb = COLOR_SLATE
        
        p2 = row.cells[2].paragraphs[0]
        p2.paragraph_format.space_after = Pt(0)
        r2 = p2.add_run(spec)
        r2.font.name = "Arial"
        r2.font.size = Pt(8.0)
        r2.font.color.rgb = COLOR_MUTED

    doc.add_page_break()

    # =========================================================================
    # D. LANGKAH PELAKSANAAN (USER GUIDE LENGKAP)
    # =========================================================================
    h_d = doc.add_paragraph()
    h_d.paragraph_format.space_before = Pt(14)
    h_d.paragraph_format.space_after = Pt(4)
    r_hd = h_d.add_run("D. PANDUAN LANGKAH PELAKSANAAN (USER GUIDE TEKNIS & OPERASIONAL)")
    r_hd.bold = True
    r_hd.font.name = "Arial"
    r_hd.font.size = Pt(13)
    r_hd.font.color.rgb = COLOR_CRIMSON

    # -------------------------------------------------------------------------
    # D.1. INSTALASI FISIK & PENGKABELAN
    # -------------------------------------------------------------------------
    h_d1 = doc.add_paragraph()
    h_d1.paragraph_format.space_before = Pt(8)
    h_d1.paragraph_format.space_after = Pt(2)
    r_hd1 = h_d1.add_run("D.1. Instalasi Fisik & Pengkabelan Box Navigasi")
    r_hd1.bold = True
    r_hd1.font.name = "Arial"
    r_hd1.font.size = Pt(10.5)
    r_hd1.font.color.rgb = COLOR_NAVY

    p_d1 = doc.add_paragraph()
    p_d1.paragraph_format.line_spacing = 1.15
    p_d1.paragraph_format.space_after = Pt(4)
    r_d1 = p_d1.add_run(
        "Modul USR-CANET200 berfungsi sebagai jembatan fisik (*physical bridge*) yang mengonversi sinyal jaringan bus kapal "
        "menjadi paket soket Ethernet TCP/IP. Ikuti petunjuk pengkabelan terminal berikut:"
    )
    r_d1.font.name = "Arial"
    r_d1.font.size = Pt(8.5)
    r_d1.font.color.rgb = COLOR_SLATE

    d1_steps = [
        "<b>Terminal CAN1 (NMEA 2000 Bus):</b> Hubungkan pin <code>CAN_H</code> gateway ke kabel putih (NET-H) NMEA 2000, pin <code>CAN_L</code> ke kabel biru (NET-L), dan pin <code>GND</code> ke pelindung kabel (Shield/Bare). Pastikan resistor terminasi 120 Ω terpasang di ujung jalur bus.",
        "<b>Terminal RS-485 (NMEA 0183 Serial):</b> Hubungkan pin <code>A+</code> gateway ke TX+ / NMEA Out (+) dari instrumen GPS/Sounder/AIS, dan pin <code>B-</code> ke TX- / NMEA Out (-).",
        "<b>Terminal Catu Daya (Power Supply):</b> Hubungkan tegangan DC 9V s/d 36V ke terminal V+ dan V-. Gunakan sumber daya dari baterai kapal dengan perlindungan sekring (fuse 1A).",
        "<b>Port Ethernet RJ45:</b> Hubungkan kabel LAN dari port RJ45 modul USR-CANET200 ke router kapal atau modem satelit maritim."
    ]
    for s in d1_steps:
        p_s = doc.add_paragraph(style='List Bullet')
        p_s.paragraph_format.space_before = Pt(1)
        p_s.paragraph_format.space_after = Pt(2)
        p_s.paragraph_format.line_spacing = 1.15
        r_s = p_s.add_run(s)
        r_s.font.name = "Arial"
        r_s.font.size = Pt(8.5)
        r_s.font.color.rgb = COLOR_SLATE

    add_callout_box(
        doc,
        "Arti Lampu Indikator LED pada USR-CANET200:\n"
        "• PWR (Merah): Menyala solid menandakan input tegangan DC normal.\n"
        "• WORK (Hijau): Berkedip teratur 1 detik sekali menandakan sistem mikroprosesor modul bekerja normal.\n"
        "• CAN1 / CAN2 (Hijau): Berkedip cepat saat menerima atau mengirimkan paket data CAN frame.\n"
        "• RS485 (Hijau): Berkedip saat ada aktivitas lalu lintas serial NMEA 0183.\n"
        "• Tombol Reload: Tahan selama 3 hingga 15 detik saat modul hidup untuk mereset seluruh parameter ke setelan pabrik default.",
        "INDIKATOR STATUS HARDWARE & RESET PABRIK"
    )

    # -------------------------------------------------------------------------
    # D.2. KONFIGURASI USR-CANET200 VIA WEB DASHBOARD
    # -------------------------------------------------------------------------
    h_d2 = doc.add_paragraph()
    h_d2.paragraph_format.space_before = Pt(8)
    h_d2.paragraph_format.space_after = Pt(2)
    r_hd2 = h_d2.add_run("D.2. Panduan Konfigurasi USR-CANET200 melalui Dashboard Web")
    r_hd2.bold = True
    r_hd2.font.name = "Arial"
    r_hd2.font.size = Pt(10.5)
    r_hd2.font.color.rgb = COLOR_NAVY

    p_d2_desc = doc.add_paragraph()
    p_d2_desc.paragraph_format.line_spacing = 1.15
    p_d2_desc.paragraph_format.space_after = Pt(4)
    r_d2d = p_d2_desc.add_run(
        "Konfigurasi USR-CANET200 dilakukan melalui antarmuka Web Server terintegrasi. "
        "Ikuti langkah-langkah terstruktur di bawah ini:"
    )
    r_d2d.font.name = "Arial"
    r_d2d.font.size = Pt(8.5)
    r_d2d.font.color.rgb = COLOR_SLATE

    d2_steps = [
        "<b>Langkah 1 (Persiapan Jaringan PC):</b> Hubungkan port LAN laptop/PC langsung ke port Ethernet USR-CANET200 menggunakan kabel UTP. Atur IPv4 PC secara statis ke IP <code>192.168.0.100</code> dan Subnet Mask <code>255.255.255.0</code>.",
        "<b>Langkah 2 (Akses Web Dashboard):</b> Buka peramban web (Google Chrome / Microsoft Edge) dan ketik alamat default: <code>http://192.168.0.7</code>. Masukkan username: <code>admin</code> dan password: <code>admin</code> untuk masuk ke halaman beranda web server.",
        "<b>Langkah 3 (Pengaturan Jaringan / IP Config):</b> Buka menu <i>Network Settings</i>. Tentukan mode IP gateway:\n"
        "  - Jika terhubung ke router kapal berfitur DHCP: Pilih mode <code>DHCP</code> agar otomatis menerima IP.\n"
        "  - Jika menggunakan segmen jaringan statis kapal: Pilih <code>Static IP</code>, masukkan IP yang telah dialokasikan (misal: <code>192.168.1.150</code>, Subnet: <code>255.255.255.0</code>, Gateway: <code>192.168.1.1</code>).",
        "<b>Langkah 4 (Pengaturan Port CAN / CAN Settings):</b> Buka menu <i>CAN Settings -> CAN1</i>:\n"
        "  - <i>Work Mode:</i> Pilih <code>Normal Mode</code> (dapat menerima dan mengirim data).\n"
        "  - <i>Baud Rate:</i> Wajib pilih <code>250 Kbps</code> (kecepatan standar baku bus NMEA 2000 laut).\n"
        "  - <i>Package Time:</i> Isi <code>10 ms</code> (toleransi akumulasi buffer sebelum dikirim ke socket TCP).\n"
        "  - <i>Package Length:</i> Isi <code>50 frames</code> (maksimum paket CAN per stream TCP).\n"
        "  - <i>CAN Filter:</i> Biarkan default <code>Receive All</code> agar seluruh PGN sensor navigasi dapat masuk tanpa terblokir.",
        "<b>Langkah 5 (Pengaturan Port Serial RS-485 / Serial Settings):</b> Jika menggunakan data serial NMEA 0183, buka menu <i>Serial Settings</i>:\n"
        "  - <i>Baud Rate:</i> Pilih <code>4800 bps</code> (standar instrumen GPS/Echosounder NMEA 0183) atau <code>38400 bps</code> (standar transponder AIS NMEA 0183).\n"
        "  - <i>Data Bits:</i> 8, <i>Parity:</i> None, <i>Stop Bits:</i> 1 (8-N-1).\n"
        "  - <i>Serial Package Time:</i> <code>10 ms</code>, <i>Package Length:</i> <code>500 bytes</code>.",
        "<b>Langkah 6 (Pengaturan Mode Kerja Soket / Socket Mode):</b> Buka menu <i>Network Transmission -> Socket A</i>:\n"
        "  - <i>Work Mode:</i> Wajib pilih <code>TCP Client</code> (gateway bertindak sebagai klien yang membuka koneksi keluar menuju server GeoTekno VMS).\n"
        "  - <i>Remote Server IP:</i> Masukkan alamat IP host / domain server GeoTekno VMS (misal: <code>103.150.xxx.xxx</code> atau IP server lokal pelabuhan <code>192.168.1.50</code>).\n"
        "  - <i>Remote Port CAN:</i> Masukkan port <code>20005</code> untuk stream biner CAN NMEA 2000.\n"
        "  - <i>Remote Port Serial:</i> Masukkan port <code>20006</code> untuk stream serial NMEA 0183.\n"
        "  - <i>Local Port:</i> Biarkan <code>0</code> (dinamis otomatis).\n"
        "  - <i>TCP Keep-Alive:</i> Aktifkan (Enable) dengan interval <code>30 detik</code> untuk mendeteksi terputusnya jaringan dan melakukan auto-reconnect otomatis saat kapal keluar masuk area sinyal seluler/satelit.\n"
        "  - <i>Identity Packet / Registration Packet:</i> Aktifkan mode <code>Send upon connection</code>, masukkan string identitas kapal (contoh: <code>KM_ESP32\\r\\n</code> atau <code>KM_Geo_Tekno\\r\\n</code>) sesuai token yang didaftarkan pada sistem VMS.",
        "<b>Langkah 7 (Simpan & Restart / Save & Reboot):</b> Klik tombol <code>Save</code> pada setiap submenu. Terakhir, buka menu <i>Device Management</i> dan klik <code>Restart Device</code> agar konfigurasi baru aktif."
    ]
    for s in d2_steps:
        p_s = doc.add_paragraph()
        p_s.paragraph_format.space_before = Pt(2)
        p_s.paragraph_format.space_after = Pt(3)
        p_s.paragraph_format.line_spacing = 1.15
        r_s = p_s.add_run(s)
        r_s.font.name = "Arial"
        r_s.font.size = Pt(8.5)
        r_s.font.color.rgb = COLOR_SLATE

    add_code_box(
        doc,
        "# RINGKASAN PARAMETER KONFIGURASI USR-CANET200\n"
        "Web Dashboard IP   : 192.168.0.7 (Default, Port 80)\n"
        "Kredensial Login   : admin / admin\n"
        "CAN1 Baud Rate     : 250 Kbps (NMEA 2000 Standard)\n"
        "CAN Package Buffer : Time 10ms, Length 50 frames, Filter: Receive All\n"
        "Serial RS-485      : 4800 bps (GPS/DPT) / 38400 bps (AIS), 8-N-1\n"
        "Work Mode          : TCP Client\n"
        "Server Destination : IP Server Platform GeoTekno VMS\n"
        "Destination Port   : Port 20005 (CANET200 Binary 13-Byte) | Port 20006 (NMEA 0183 Serial)\n"
        "Keep-Alive Packet  : 30 Seconds Auto-Heartbeat\n"
        "Identity Packet    : Send on connection -> 'KM_ESP32\\r\\n' / 'KM_Geo_Tekno\\r\\n'"
    )

    # -------------------------------------------------------------------------
    # D.3. VERIFIKASI KONEKSI KE PLATFORM VMS
    # -------------------------------------------------------------------------
    h_d3 = doc.add_paragraph()
    h_d3.paragraph_format.space_before = Pt(8)
    h_d3.paragraph_format.space_after = Pt(2)
    r_hd3 = h_d3.add_run("D.3. Verifikasi Koneksi & Handshake ke Platform GeoTekno VMS")
    r_hd3.bold = True
    r_hd3.font.name = "Arial"
    r_hd3.font.size = Pt(10.5)
    r_hd3.font.color.rgb = COLOR_NAVY

    p_d3 = doc.add_paragraph()
    p_d3.paragraph_format.line_spacing = 1.15
    p_d3.paragraph_format.space_after = Pt(4)
    r_d3 = p_d3.add_run(
        "Begitu gateway USR-CANET200 berhasil membuka soket TCP Client ke port 20005 atau 20006, backend VMS menjalankan alur berikut:\n"
        "1. <b>Deteksi Handshake Token:</b> Modul backend <code>backend/src/agents/agentManager.js</code> membaca paket identitas pertama kali. "
        "String registrasi (contoh: <code>KM_ESP32</code>) dicocokkan ke tabel aset <code>core_assets</code>. "
        "Sesi soket TCP tersebut secara otomatis diikat (*bound*) ke ID kapal yang bersangkutan sehingga transmisi multi-kapal pada port yang sama tidak saling tercampur (*no cross-talk*).\n"
        "2. <b>Deteksi Status Kapal (ONLINE / OFFLINE):</b>\n"
        "  - Status <b>ONLINE (Hijau)</b>: Dinyatakan aktif apabila soket TCP terhubung dan terdapat data telemetri yang mengalir masuk dalam kurun waktu live (threshold < 90 detik).\n"
        "  - Status <b>OFFLINE (Abu-abu / Merah)</b>: Dinyatakan tidak aktif apabila soket TCP terputus atau tidak ada data telemetri yang masuk melebihi batas waktu toleransi maritim. Platform akan mencatat dan menampilkan timestamp tanggal dan jam terakhir data diterima (contoh: <i>Offline • 28 Okt 2026 10:45</i>)."
    )
    r_d3.font.name = "Arial"
    r_d3.font.size = Pt(8.5)
    r_d3.font.color.rgb = COLOR_SLATE

    doc.add_page_break()

    # -------------------------------------------------------------------------
    # D.4. SPESIFIKASI & LOGIKA PENGURAIAN (DECODE ENGINE)
    # -------------------------------------------------------------------------
    h_d4 = doc.add_paragraph()
    h_d4.paragraph_format.space_before = Pt(10)
    h_d4.paragraph_format.space_after = Pt(4)
    r_hd4 = h_d4.add_run("D.4. Spesifikasi & Logika Penguraian Data (Decode Engine)")
    r_hd4.bold = True
    r_hd4.font.name = "Arial"
    r_hd4.font.size = Pt(11)
    r_hd4.font.color.rgb = COLOR_CRIMSON

    # NMEA 2000
    p_n2k_title = doc.add_paragraph()
    p_n2k_title.paragraph_format.space_before = Pt(4)
    p_n2k_title.paragraph_format.space_after = Pt(2)
    r_n2kt = p_n2k_title.add_run("1. Dekode NMEA 2000 (Frame Biner USR-CANET200 13-Byte & Ekstraksi PGN)")
    r_n2kt.bold = True
    r_n2kt.font.name = "Arial"
    r_n2kt.font.size = Pt(9.5)
    r_n2kt.font.color.rgb = COLOR_NAVY

    p_n2k_desc = doc.add_paragraph()
    p_n2k_desc.paragraph_format.line_spacing = 1.15
    p_n2k_desc.paragraph_format.space_after = Pt(4)
    r_n2kd = p_n2k_desc.add_run(
        "Gateway USR-CANET200 membungkus setiap frame CAN fisik berkapasitas 8 byte menjadi struktur biner 13-byte:\n"
        "• <b>Byte [0] (Frame Info):</b> Nilai standar NMEA 2000 adalah <code>0x88</code> (Bit 7 = 1 menandakan Extended 29-bit CAN ID, DLC = 8 byte payload).\n"
        "• <b>Byte [1..4] (CAN Identifier):</b> Format 32-bit Big-Endian. Diurai dengan <code>buffer.readUInt32BE(1)</code> untuk menghasilkan Priority (bit 28..26), Data Page (bit 24), PDU Format (bit 23..16), PDU Specific (bit 15..8), dan Source Address (bit 7..0).\n"
        "  - Jika PDU Format < 240 (PDU1 / Addressable): <code>PGN = (DataPage << 16) | (PDU_Format << 8)</code>.\n"
        "  - Jika PDU Format >= 240 (PDU2 / Broadcast): <code>PGN = (DataPage << 16) | (PDU_Format << 8) | PDU_Specific</code>.\n"
        "• <b>Byte [5..12] (CAN Data Payload):</b> 8 byte data NMEA 2000 dengan urutan byte <b>Little-Endian</b>."
    )
    r_n2kd.font.name = "Arial"
    r_n2kd.font.size = Pt(8.5)
    r_n2kd.font.color.rgb = COLOR_SLATE

    tbl_pgn = doc.add_table(rows=8, cols=4)
    tbl_pgn.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_pgn)
    
    pgn_headers = ["PGN & Nama Parameter", "Byte Offset", "Skala / Resolusi", "Formula Konversi Nilai Terbaca"]
    for c_i, h in enumerate(pgn_headers):
        set_cell_background(tbl_pgn.rows[0].cells[c_i], HEX_NAVY)
        set_cell_margins(tbl_pgn.rows[0].cells[c_i], top=60, bottom=60, left=80, right=80)
        p = tbl_pgn.rows[0].cells[c_i].paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.bold = True
        r.font.name = "Arial"
        r.font.size = Pt(7.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    pgn_rows = [
        ("PGN 129025\nGNSS Position (Fix)", "B[0..3]: Lat\nB[4..7]: Lon", "1e-7 deg / bit\n(32-bit signed int)", "Lat = readInt32LE(0) * 1e-7\nLon = readInt32LE(4) * 1e-7"),
        ("PGN 129026\nCOG & SOG Rapid", "B[2..3]: COG\nB[4..5]: SOG", "COG: 0.0001 rad\nSOG: 0.01 m/s", "COG(°) = readUInt16LE(2) * 0.0001 * (180/π)\nSOG(kn) = (readUInt16LE(4) * 0.01) * 1.943844"),
        ("PGN 127250\nVessel Heading", "B[1..2]: Heading\nB[7]: Reference", "0.0001 rad / bit\n(16-bit uint)", "Heading(°) = readUInt16LE(1) * 0.0001 * (180/π)\nRef = (B[7] & 0x03) == 0 ? 'True' : 'Magnetic'"),
        ("PGN 127257\nAttitude (Pitch/Roll)", "B[3..4]: Pitch\nB[5..6]: Roll", "0.0001 rad / bit\n(16-bit signed int)", "Pitch(°) = readInt16LE(3) * 0.0001 * (180/π)\nRoll(°) = readInt16LE(5) * 0.0001 * (180/π)"),
        ("PGN 128267\nWater Depth", "B[1..4]: Depth\nB[5..6]: Offset", "Depth: 0.01 m\nOffset: 0.001 m", "Depth(m) = readUInt32LE(1) * 0.01\nOffset(m) = readInt16LE(5) * 0.001"),
        ("PGN 130306\nWind Data", "B[1..2]: Speed\nB[3..4]: Angle", "Speed: 0.01 m/s\nAngle: 0.0001 rad", "WindSpeed(kn) = (readUInt16LE(1) * 0.01) * 1.943844\nWindAngle(°) = readUInt16LE(3) * 0.0001 * (180/π)"),
        ("PGN 130310\nEnvironmental Temp", "B[1..2]: Water\nB[3..4]: Air", "0.01 Kelvin / bit\n(16-bit uint)", "WaterTemp(°C) = (readUInt16LE(1) * 0.01) - 273.15\nAirTemp(°C) = (readUInt16LE(3) * 0.01) - 273.15"),
    ]
    for r_idx, (p_pgn, p_off, p_scale, p_form) in enumerate(pgn_rows, start=1):
        row = tbl_pgn.rows[r_idx]
        for c_i, val in enumerate([p_pgn, p_off, p_scale, p_form]):
            set_cell_margins(row.cells[c_i], top=50, bottom=50, left=80, right=80)
            if r_idx % 2 == 0:
                set_cell_background(row.cells[c_i], HEX_LIGHTBG)
            p = row.cells[c_i].paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.05
            r = p.add_run(val)
            r.font.name = "Consolas" if c_i in [1, 3] else "Arial"
            r.font.size = Pt(7.0) if c_i == 3 else Pt(7.5)
            r.bold = True if c_i == 0 else False
            r.font.color.rgb = COLOR_NAVY if c_i == 0 else COLOR_SLATE

    # Fast-Packet & NMEA 0183
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    p_fast_desc = doc.add_paragraph()
    p_fast_desc.paragraph_format.line_spacing = 1.15
    p_fast_desc.paragraph_format.space_after = Pt(4)
    r_fd = p_fast_desc.add_run(
        "• <b>Protokol Fast-Packet (ISO 11783-3):</b> Paket AIS seperti PGN 129038 (28 byte) dan PGN 129794 (74 byte) "
        "dikirim dalam beberapa frame pecahan. Byte 0 memuat Sequence ID (bit 7..5) dan Frame Index (bit 4..0). "
        "Modul <code>FastPacketReassembler</code> di backend mengumpulkan dan menggabungkan seluruh frame potongan hingga mencapai <code>Total Bytes</code> sebelum diserahkan ke decoder AIS.\n"
        "• <b>Dekode NMEA 0183 (Serial RS-485):</b> Format kalimat teks ASCII <code>$AABBB,d1,d2...*hh<CR><LF></code>. "
        "Backend memvalidasi keutuhan pesan menggunakan algoritma 8-bit XOR checksum (seluruh karakter antara '$' dan '*'). "
        "Koordinat posisi format NMEA (DDMM.MMMM) dikonversi ke derajat desimal menggunakan rumus: "
        "<code>Lat_Desimal = DD + (MM.MMMM / 60.0) * (Jika S maka -1)</code> dan "
        "<code>Lon_Desimal = DDD + (MM.MMMM / 60.0) * (Jika W maka -1)</code>.\n"
        "• <b>Integrasi Sensor Airmar DST810:</b> Mengirimkan data telemetri 3-in-1: Kedalaman akustik PGN 128267, Kecepatan STW PGN 128259, Suhu air PGN 130310, dan Sikap dinamika ombak (Pitch & Roll 5 Hz) PGN 127257."
    )
    r_fd.font.name = "Arial"
    r_fd.font.size = Pt(8.5)
    r_fd.font.color.rgb = COLOR_SLATE

    doc.add_page_break()

    # -------------------------------------------------------------------------
    # D.5. PANDUAN FITUR PLATFORM PER HALAMAN & DESAIN UX
    # -------------------------------------------------------------------------
    h_d5 = doc.add_paragraph()
    h_d5.paragraph_format.space_before = Pt(10)
    h_d5.paragraph_format.space_after = Pt(4)
    r_hd5 = h_d5.add_run("D.5. Panduan Fitur Platform per Halaman & Desain UX (User Experience)")
    r_hd5.bold = True
    r_hd5.font.name = "Arial"
    r_hd5.font.size = Pt(11)
    r_hd5.font.color.rgb = COLOR_CRIMSON

    pages_guide = [
        ("1. Halaman Fleet Operations Overview (Pusat Kendali Eksekutif)",
         "Menyajikan ringkasan kesehatan operasional seluruh armada kapal secara komprehensif.\n"
         "• UX Auto-Refresh Background: Data telemetri diperbarui secara otomatis di latar belakang tanpa me-refresh seluruh halaman web, menjaga interaksi pengguna tetap mulus tanpa flicker.\n"
         "• 4 KPI Cards: Menampilkan My Fleet Status (Underway vs Moored), Fleet Navigation (SOG rata-rata armada), Surrounding AIS Traffic (jumlah kapal sekitar dan target terdekat), serta Telemetry Health.\n"
         "• Status Online/Offline Maritim: Menampilkan status ONLINE hijau saat data live mengalir, dan status OFFLINE abu-abu/merah apabila data tidak masuk, lengkap dengan label timestamp tanggal dan jam (contoh: 28 Okt 2026 10:45).\n"
         "• Digital Twin Snapshot & Mini Radar: Menampilkan pembacaan instrumen instan kapal yang dipilih beserta radar target AIS kapal-kapal di sekitarnya yang diurutkan berdasarkan jarak terdekat."),

        ("2. Halaman Marine Traffic (Situational Awareness AIS & Radar Navigasi)",
         "Peta pelacakan geografis dan radar lalu lintas kapal di perairan sekitar berbasis OpenMapTiles.\n"
         "• 4 Mode Tampilan Peta: Mendukung visualisasi Liberty Marine, Dark Nautical, Positron Light, dan Satellite Imagery.\n"
         "• Own Ship Tracking & Breadcrumb Route: Memetakan posisi presisi kapal sendiri beserta jejak historis lintasan pelayaran.\n"
         "• Radar AIS Kapal Sekitar (Class A & B): Memetakan kapal target sekitar lengkap dengan nama, MMSI, Call Sign, IMO, tipe kapal, kecepatan SOG, dan haluan COG.\n"
         "• Peringatan Dini Tabrakan (CPA & TCPA Collision Risk): Sistem secara otomatis menghitung titik pendekatan terdekat (Closest Point of Approach) dan estimasi waktu benturan (Time to CPA). Peringatan bahaya aktif jika target kapal mendekat dalam radius <= 1.0 NM."),

        ("3. Halaman Vessel Assets & Dynamic Telemetry Attributes",
         "Pusat pengelolaan identitas kapal, gateway agen perantara, dan registrasi sinyal telemetri sensor.\n"
         "• Manajemen Aset Kapal: Formulir pembuatan dan pengeditan kapal (Nama, IMO, MMSI, Call Sign, Tipe Kapal, Perusahaan Pemilik).\n"
         "• Konfigurasi TCP Gateway Agent: Mengelola pemetaan IP, port, dan token identitas gateway ke masing-masing kapal.\n"
         "• Tab Overview vs Tab Attributes: Memisahkan detail identitas kapal dengan daftar parameter telemetri aktif.\n"
         "• Pemindaian Sinyal (Scan Signals) & Registrasi Dinamis: Operator dapat memindai sinyal baru dari CAN Bus / NMEA serial dan mendaftarkan atribut sensor kustom tanpa mengubah skema tabel database SQL.\n"
         "• Standarisasi Nama Atribut Bersih: Seluruh nama atribut ditampilkan menggunakan Display Name yang ramah pengguna tanpa karakter underscore (_) seperti 'Apparent Wind Speed' dan 'Water Depth Below Keel'."),

        ("4. Halaman Monitoring Page (Customizable Dynamic Canvas Dashboard)",
         "Dasbor instrumen visualisasi navigasi paling fleksibel dengan tata letak kanvas grid 12-kolom yang dapat disesuaikan sepenuhnya.\n"
         "• Mode Edit (Modify Layout): Tombol 'Modify Layout' membuka sidebar widget palette interaktif untuk menambah, memindahkan, atau menghapus widget.\n"
         "• Ragam Pilihan Widget Maritim:\n"
         "  - Speedometer Gauge Dial: Indikator jarum kecepatan SOG / STW / RPM mesin dengan zona warna ambang batas (thresholds).\n"
         "  - Compass Rose Dial: Indikator kompas putar menampilkan Haluan Kapal (Heading) dan lintasan gerak (COG).\n"
         "  - Attitude Horizon Dial: Indikator sudut oleng ombak (Roll / Heel) dan sudut angguk haluan (Pitch / Trim).\n"
         "  - Airmar DST810 Triducer 3-in-1 Dial: Dial multi-fungsi terpadu yang menampilkan kecepatan air pada jarum dial, serta kedalaman akustik dan suhu air pada pill box terkalibrasi.\n"
         "  - Echosounder / Sonar Water Column Bar Chart: Visualisasi profil kolom kedalaman air laut secara vertikal dengan fitur zoom level otomatis.\n"
         "  - Dynamic Telemetry Card: Kartu telemetri numerik dengan angka besar, satuan, ikon kategori, dan indikator data live.\n"
         "  - Trend Line Chart: Grafik garis tren historis nilai telemetri dari waktu ke waktu.\n"
         "  - Telemetry Table Matrix: Tabel matriks seluruh parameter sensor kapal yang dapat difilter per kategori (Navigation, Environment, Machinery, System).\n"
         "• UX Penggantian Atribut Fleksibel per-Slot: Pada widget yang memiliki lebih dari satu pilihan atribut (seperti Triducer, Attitude, dan Compass), pengguna dapat mengklik langsung slot atribut yang ingin diganti (Slot 1 Primary, Slot 2 Secondary, atau Slot 3 Tertiary) tanpa mereset pilihan lainnya.\n"
         "• UX Nama Variabel Bersih: Di dalam seluruh widget dial dan pill display, nama variabel otomatis mengambil nama display atribut asli tanpa tanda underscore (_) (contoh: 'Apparent Wind Speed 3.8kn' bukan 'wind_speed 3.8kn'). Lebar pill SVG otomatis menyesuaikan panjang teks nama atribut secara proporsional.\n"
         "• Auto-Save Snapshot & Publish Layout: Perubahan susunan kanvas tersimpan secara aman dalam snapshot draft dan dapat dipublikasikan ke seluruh tim pengguna melalui tombol 'Save Layout'."),

        ("5. Halaman Live Logs (Inspektur Paket Data Biner & Serial Realtime)",
         "Fasilitas diagnostik dan audit teknis untuk memverifikasi paket data yang masuk dari gateway TCP secara langsung.\n"
         "• Streaming Terminal Log: Menampilkan aliran paket realtime dengan fitur auto-scroll toggle dan tombol jeda (pause) untuk inspeksi mendalam.\n"
         "• Dual Stream Inspector: Menampilkan representasi frame heksadesimal mentah USR-CANET200 13-byte dan kalimat serial NMEA 0183 berdampingan dengan payload JSON hasil dekodenya.\n"
         "• Filter Multidimensi: Menyaring log berdasarkan Gateway Agent, Kapal, Protokol Pengurai (NMEA2000 / NMEA0183), dan Tingkat Keparahan (Info, Warning, Error).\n"
         "• Status Live Gateway Socket: Menampilkan daftar soket gateway TCP yang sedang tersambung aktif ke server."),

        ("6. Halaman Data Export (Audit, Analitik, & Unduh Arsip Telemetri)",
         "Modul pengunduhan arsip data telemetri historis untuk analisis efisiensi bahan bakar dan pelaporan pelayaran (voyage reporting).\n"
         "• Pemilihan Kapal & Multi-Sensor: Fleksibilitas memilih kapal dan mencentang parameter telemetri spesifik yang ingin diekspor.\n"
         "• Filter Rentang Waktu Fleksibel: Pilihan preset cepat (1 Jam, 24 Jam, 7 Hari, 30 Hari) serta Custom Date Range Picker kalender.\n"
         "• Pilihan Interval Downsampling: Pilihan resolusi data mentah (Raw Live), 10 detik, 1 menit, 5 menit, 15 menit, hingga 1 jam untuk mempercepat pengunduhan rentang waktu panjang.\n"
         "• Pratinjau Tabel Interaktif & Ekspor Multi-Format: Tampilan tabel pratinjau data sebelum diunduh, dengan tombol ekspor langsung ke format CSV dan JSON."),

        ("7. Halaman User Management & Multi-Company Tenancy (RBAC)",
         "Manajemen pengguna dan tata kelola keamanan akses armada kapal berbasis peran (Role-Based Access Control).\n"
         "• Hierarki Peran Pengguna:\n"
         "  - Superadmin: Hak akses penuh ke seluruh armada kapal, seluruh perusahaan, pengaturan gateway agent, dan manajemen user global.\n"
         "  - Company Admin: Mengelola kapal, pengguna, dan dashboard yang berada di bawah naungan perusahaannya.\n"
         "  - Fleet Operator: Memantau navigasi kapal, memodifikasi tata letak dashboard monitoring kapal, dan melakukan ekspor data.\n"
         "  - Viewer: Hak akses hanya-baca (read-only) untuk memantau instrumen kapal tanpa izin mengubah layout atau data kapal.\n"
         "• Isolasi Data Multi-Tenant (Data Isolation): Seluruh endpoint API memfilter data berdasarkan izin kapal pengguna, menjamin data pelayaran antar-perusahaan pelayaran terisolasi aman tanpa risiko kebocoran.")
    ]

    for p_title, p_body in pages_guide:
        p_h = doc.add_paragraph()
        p_h.paragraph_format.space_before = Pt(8)
        p_h.paragraph_format.space_after = Pt(2)
        r_ph = p_h.add_run(p_title)
        r_ph.bold = True
        r_ph.font.name = "Arial"
        r_ph.font.size = Pt(9.5)
        r_ph.font.color.rgb = COLOR_NAVY

        p_b = doc.add_paragraph()
        p_b.paragraph_format.line_spacing = 1.15
        p_b.paragraph_format.space_after = Pt(4)
        r_pb = p_b.add_run(p_body)
        r_pb.font.name = "Arial"
        r_pb.font.size = Pt(8.5)
        r_pb.font.color.rgb = COLOR_SLATE

    doc.add_page_break()

    # =========================================================================
    # E. TROUBLESHOOTING & DIAGNOSTIK KENDALA LAPANGAN
    # =========================================================================
    h_e = doc.add_paragraph()
    h_e.paragraph_format.space_before = Pt(14)
    h_e.paragraph_format.space_after = Pt(4)
    r_he = h_e.add_run("E. PANDUAN TROUBLESHOOTING & DIAGNOSTIK KENDALA LAPANGAN")
    r_he.bold = True
    r_he.font.name = "Arial"
    r_he.font.size = Pt(13)
    r_he.font.color.rgb = COLOR_CRIMSON

    p_e_desc = doc.add_paragraph()
    p_e_desc.paragraph_format.line_spacing = 1.15
    p_e_desc.paragraph_format.space_after = Pt(6)
    r_ed = p_e_desc.add_run(
        "Tabel berikut menyajikan matriks identifikasi gejala kendala lapangan yang sering terjadi beserta langkah solusi perbaikannya:"
    )
    r_ed.font.name = "Arial"
    r_ed.font.size = Pt(9.0)
    r_ed.font.color.rgb = COLOR_SLATE

    tbl_trouble = doc.add_table(rows=6, cols=3)
    tbl_trouble.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_trouble)

    tr_headers = ["Gejala Masalah Lapangan", "Kemungkinan Penyebab", "Tindakan Korektif & Solusi Teknis"]
    for c_i, h in enumerate(tr_headers):
        set_cell_background(tbl_trouble.rows[0].cells[c_i], HEX_NAVY)
        set_cell_margins(tbl_trouble.rows[0].cells[c_i], top=80, bottom=80, left=100, right=100)
        p = tbl_trouble.rows[0].cells[c_i].paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.bold = True
        r.font.name = "Arial"
        r.font.size = Pt(8.0)
        r.font.color.rgb = RGBColor(255, 255, 255)

    trouble_data = [
        ("Dashboard Web USR 192.168.0.7 tidak dapat dibuka di browser",
         "IP PC tidak satu subnet dengan gateway, atau kabel LAN longgar/rusak.",
         "Atur IPv4 PC ke static IP 192.168.0.100, Subnet 255.255.255.0. Lakukan uji 'ping 192.168.0.7'. Jika gagal, tekan tombol Reload 5 detik untuk reset pabrik."),

        ("Lampu WORK pada gateway tidak berkedip normal",
         "Catu daya DC drop di bawah 9V atau unit gateway mengalami kegagalan boot.",
         "Ukur tegangan terminal V+ dan V- dengan multimeter (wajib 9V-36V DC stabil). Matikan power 10 detik lalu nyalakan kembali."),

        ("Gateway tidak tersambung ke platform VMS (Socket Error)",
         "IP tujuan server atau port salah, atau router onboard memblokir port 20005/20006.",
         "Verifikasi Remote IP dan Remote Port di menu Socket A USR-CANET200 (wajib port 20005 untuk CAN dan 20006 untuk Serial). Pastikan firewall router mengizinkan koneksi keluar (outbound)."),

        ("Lampu CAN1 tidak berkedip / data N2K tidak terdeteksi",
         "Baudrate salah, polaritas CAN_H/CAN_L terbalik, atau resistor 120 Ω tidak ada.",
         "Pastikan baudrate CAN1 diset tepat 250 Kbps. Periksa kontinuitas kabel CAN_H dan CAN_L. Ukur resistansi antar CAN_H dan CAN_L saat power mati (harus sekitar 60 Ω karena dua resistor 120 Ω paralel)."),

        ("Status kapal di platform selalu 'OFFLINE' padahal gateway hidup",
         "Identity packet token pada gateway tidak cocok dengan nama token agent pada database kapal.",
         "Periksa menu Identity Packet pada USR-CANET200. Pastikan string identitas (contoh: 'KM_ESP32\\r\\n') sama persis dengan Agent Token yang terdaftar di halaman Vessel Assets platform VMS.")
    ]

    for r_idx, (sym, cause, sol) in enumerate(trouble_data, start=1):
        row = tbl_trouble.rows[r_idx]
        row.cells[0].width = Inches(2.0)
        row.cells[1].width = Inches(2.0)
        row.cells[2].width = Inches(2.6)
        for c_i in range(3):
            set_cell_margins(row.cells[c_i], top=60, bottom=60, left=100, right=100)
            if r_idx % 2 == 0:
                set_cell_background(row.cells[c_i], HEX_LIGHTBG)
        p0 = row.cells[0].paragraphs[0]
        p0.paragraph_format.space_after = Pt(0)
        r0 = p0.add_run(sym)
        r0.bold = True
        r0.font.name = "Arial"
        r0.font.size = Pt(8.0)
        r0.font.color.rgb = COLOR_CRIMSON
        
        p1 = row.cells[1].paragraphs[0]
        p1.paragraph_format.space_after = Pt(0)
        r1 = p1.add_run(cause)
        r1.font.name = "Arial"
        r1.font.size = Pt(8.0)
        r1.font.color.rgb = COLOR_SLATE
        
        p2 = row.cells[2].paragraphs[0]
        p2.paragraph_format.space_after = Pt(0)
        r2 = p2.add_run(sol)
        r2.font.name = "Arial"
        r2.font.size = Pt(8.0)
        r2.font.color.rgb = COLOR_SLATE

    # =========================================================================
    # F. KESIMPULAN LANGKAH KERJA & LEMBAR PERSETUJUAN
    # =========================================================================
    h_f = doc.add_paragraph()
    h_f.paragraph_format.space_before = Pt(14)
    h_f.paragraph_format.space_after = Pt(4)
    r_hf = h_f.add_run("F. KESIMPULAN LANGKAH KERJA & LEMBAR PENGESAHAN DOKUMEN")
    r_hf.bold = True
    r_hf.font.name = "Arial"
    r_hf.font.size = Pt(13)
    r_hf.font.color.rgb = COLOR_CRIMSON

    p_f_desc = doc.add_paragraph()
    p_f_desc.paragraph_format.line_spacing = 1.15
    p_f_desc.paragraph_format.space_after = Pt(8)
    r_fd = p_f_desc.add_run(
        "Penerapan Standar Operasional Prosedur (SOP) dan Panduan Pengguna ini menjamin integrasi modul telemetri USR-CANET200 "
        "ke sistem GeoTekno VMS berjalan presisi, stabil, dan aman. Dengan menerapkan parameter baudrate 250 Kbps N2K, "
        "koneksi TCP Client port 20005/20006 ber-handshake token, serta pemanfaatan antarmuka kanvas monitoring fleksibel tanpa underscore, "
        "pengawasan operasional armada maritim dapat terlaksana secara realtime dengan standar industri maritim internasional."
    )
    r_fd.font.name = "Arial"
    r_fd.font.size = Pt(9.0)
    r_fd.font.color.rgb = COLOR_SLATE

    # Lembar Tanda Tangan Pengesahan
    doc.add_paragraph().paragraph_format.space_after = Pt(10)
    tbl_sign = doc.add_table(rows=2, cols=2)
    tbl_sign.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_sign)
    
    col_w = Inches(3.3)
    for row in tbl_sign.rows:
        row.cells[0].width = col_w
        row.cells[1].width = col_w

    set_cell_margins(tbl_sign.rows[0].cells[0], top=80, bottom=40, left=100, right=100)
    set_cell_margins(tbl_sign.rows[0].cells[1], top=80, bottom=40, left=100, right=100)
    set_cell_margins(tbl_sign.rows[1].cells[0], top=40, bottom=80, left=100, right=100)
    set_cell_margins(tbl_sign.rows[1].cells[1], top=40, bottom=80, left=100, right=100)

    p_s1 = tbl_sign.rows[0].cells[0].paragraphs[0]
    p_s1.paragraph_format.space_after = Pt(40)
    r_s1 = p_s1.add_run("Dipersiapkan & Disusun Oleh:\nTim Product Engineering & IoT Maritim")
    r_s1.bold = True
    r_s1.font.name = "Arial"
    r_s1.font.size = Pt(8.5)
    r_s1.font.color.rgb = COLOR_NAVY

    p_s1_b = tbl_sign.rows[1].cells[0].paragraphs[0]
    p_s1_b.paragraph_format.space_after = Pt(0)
    r_s1_b = p_s1_b.add_run("Nama: Delfin / Lead Product Engineer\nTanggal: 28 Oktober 2026")
    r_s1_b.font.name = "Arial"
    r_s1_b.font.size = Pt(8.0)
    r_s1_b.font.color.rgb = COLOR_MUTED

    p_s2 = tbl_sign.rows[0].cells[1].paragraphs[0]
    p_s2.paragraph_format.space_after = Pt(40)
    r_s2 = p_s2.add_run("Diverifikasi & Disahkan Oleh:\nHead of Technology & Marine Operations")
    r_s2.bold = True
    r_s2.font.name = "Arial"
    r_s2.font.size = Pt(8.5)
    r_s2.font.color.rgb = COLOR_NAVY

    p_s2_b = tbl_sign.rows[1].cells[1].paragraphs[0]
    p_s2_b.paragraph_format.space_after = Pt(0)
    r_s2_b = p_s2_b.add_run("Nama: Management PT Geo Tekno Maritim\nTanggal: 28 Oktober 2026")
    r_s2_b.font.name = "Arial"
    r_s2_b.font.size = Pt(8.0)
    r_s2_b.font.color.rgb = COLOR_MUTED

    # Simpan File
    doc.save(target_docx)
    print(f"[SUCCESS] Dokumen VMS.docx berhasil digenerate di: {target_docx}")

if __name__ == "__main__":
    main()
