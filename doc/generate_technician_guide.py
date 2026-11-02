# -*- coding: utf-8 -*-
"""
Generator Panduan Praktis Teknisi Lapangan (Field Technical Guide)
Instalasi & Konfigurasi Gateway USR-CANET200 pada Sistem VMS Kapal
Output: doc/Panduan_Teknisi_Lapangan.docx
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
    out_docx = os.path.join(base_dir, "Panduan_Teknisi_Lapangan.docx")
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
    r_t = p_title.add_run("PANDUAN TEKNISI LAPANGAN\nINSTALASI DAN KONFIGURASI GATEWAY USR-CANET200\nPADA SISTEM VESSEL MONITORING SYSTEM (VMS)")
    r_t.font.name = "Times New Roman"
    r_t.font.size = Pt(16)
    r_t.font.bold = True
    r_t.font.color.rgb = COLOR_BLACK

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.line_spacing = 1.3
    p_sub.paragraph_format.space_after = Pt(28)
    r_sub = p_sub.add_run("Standar Operasional Prosedur (SOP) Penyiapan Perangkat Konverter CAN ke TCP,\nIntegrasi Uplink Router Internet (Starlink/VSAT/Seluler), dan Uji Kelaikan Operasional di Kapal")
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
    r_foot = p_foot.add_run("DIVISI OPERASIONAL DAN ENGINEERING VMS\nTAHUN 2026")
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
        ("1. PENDAHULUAN DAN TOPOLOGI INSTALASI KAPAL", "1", 1),
        ("   1.1 Gambaran Umum Pekerjaan Instalasi Lapangan", "1", 2),
        ("   1.2 Diagram Topologi Sistem di Kapal", "1", 2),
        ("   1.3 Daftar Periksa Perlengkapan Teknisi", "2", 2),
        ("2. PROSEDUR KONFIGURASI WEB MANAGEMENT USR-CANET200", "3", 1),
        ("   2.1 Akses Awal Antarmuka Web Modul Gateway", "3", 2),
        ("   2.2 Konfigurasi Parameter Antarmuka CAN (Baud Rate & Filtering)", "3", 2),
        ("   2.3 Pengaturan Parameter Jaringan Mode TCP Client", "4", 2),
        ("   2.4 Konfigurasi Paket Heartbeat Jaringan", "5", 2),
        ("3. PENGISIAN REGISTER CONTENT (IDENTITY PACKET KAPAL)", "6", 1),
        ("   3.1 Aturan Penamaan Identitas Kapal (Asset Tag)", "6", 2),
        ("   3.2 Prosedur Input Identity Packet pada Gateway", "6", 2),
        ("4. VERIFIKASI INSTALASI DAN PEMECAHAN MASALAH LAPANGAN", "7", 1),
        ("   4.1 Pemeriksaan Status Lampu Indikator LED", "7", 2),
        ("   4.2 Uji Ping dan Jalur Uplink Internet Kapal", "7", 2),
        ("   4.3 Verifikasi Status Online pada Dashboard Cloud VMS", "8", 2),
        ("   4.4 Matriks Pemecahan Masalah Cepat di Lapangan (Troubleshooting)", "8", 2),
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

    add_toc_line(doc, "Tabel 1.1 Daftar Periksa Perlengkapan Kerja Teknisi Lapangan", "2", level=1)
    add_toc_line(doc, "Tabel 2.1 Parameter Konfigurasi Port CAN1 USR-CANET200", "4", level=1)
    add_toc_line(doc, "Tabel 2.2 Parameter Konfigurasi Soket Jaringan TCP Client", "5", level=1)
    add_toc_line(doc, "Tabel 3.1 Parameter Konfigurasi Identity Packet Kapal", "6", level=1)
    add_toc_line(doc, "Tabel 4.1 Arti dan Status Lampu Indikator LED Diagnostik", "7", level=1)
    add_toc_line(doc, "Tabel 4.2 Matriks Masalah dan Solusi Cepat Lapangan", "9", level=1)

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

    add_toc_line(doc, "Gambar 1.1 Diagram Topologi Aliran Data Telemetri Navigasi Kapal ke Cloud", "2", level=1)

    doc.add_page_break()

    # -------------------------------------------------------------------------
    # BAB 1
    # -------------------------------------------------------------------------
    add_heading_1(doc, "1. PENDAHULUAN DAN TOPOLOGI INSTALASI KAPAL")

    add_heading_2(doc, "1.1 Gambaran Umum Pekerjaan Instalasi Lapangan")
    add_paragraph(doc, 
        "Dokumen ini disusun sebagai Standar Operasional Prosedur (SOP) bagi teknisi lapangan dalam melaksanakan instalasi, "
        "konfigurasi, dan verifikasi modul konverter gateway USR-CANET200 di atas kapal. Tugas utama teknisi adalah mengintegrasikan "
        "jaringan instrumen navigasi kapal (backbone NMEA 2000 dan jalur serial NMEA 0183) dengan router internet kapal (Starlink, VSAT, "
        "atau modem seluler), sehingga data telemetri dapat terkirim secara kontinu ke server cloud Vessel Monitoring System (VMS)."
    )

    add_heading_2(doc, "1.2 Diagram Topologi Sistem di Kapal")
    add_paragraph(doc, 
        "Secara garis besar, topologi sistem terdiri atas tiga segmen: instrumen navigasi kapal, modul gateway USR-CANET200, "
        "dan router internet kapal sebagai pintu gerbang telekomunikasi menuju darat. Gambar 1.1 memperlihatkan hubungan antar komponen."
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
        add_figure_caption(doc, "Gambar 1.1", "Diagram Topologi Aliran Data Telemetri Navigasi Kapal ke Cloud")

    add_heading_2(doc, "1.3 Daftar Periksa Perlengkapan Teknisi")
    add_paragraph(doc, 
        "Sebelum menaiki kapal, teknisi wajib memastikan seluruh peralatan kerja dan perangkat lunak pendukung telah siap. "
        "Tabel 1.1 merangkum daftar periksa perlengkapan standar teknisi."
    )

    add_table_caption(doc, "Tabel 1.1", "Daftar Periksa Perlengkapan Kerja Teknisi Lapangan")
    t1_data = [
        ("No", "Nama Alat / Perlengkapan", "Spesifikasi / Kegunaan", "Status Kesiapan"),
        ("1", "Laptop Teknisi", "Dilengkapi port RJ45 / USB-to-LAN, browser Google Chrome/Edge.", "Wajib"),
        ("2", "Kabel LAN UTP Patch Cord", "Kategori Cat5e / Cat6 panjang 2-3 meter (kondisi prima).", "Wajib"),
        ("3", "Perangkat USR-CANET200", "Unit konverter gateway beserta adaptor catu daya 12V/24V DC.", "Wajib"),
        ("4", "Data Aset Kapal (Work Order)", "Memuat Nama Resmi Kapal, ID Registrasi (Asset Tag), dan Port Tujuan.", "Wajib"),
        ("5", "Akses Router Kapal", "Koneksi internet aktif (Starlink, VSAT maritim, atau kartu SIM 4G).", "Wajib"),
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

    # -------------------------------------------------------------------------
    # BAB 2
    # -------------------------------------------------------------------------
    add_heading_1(doc, "2. PROSEDUR KONFIGURASI WEB MANAGEMENT USR-CANET200")

    add_heading_2(doc, "2.1 Akses Awal Antarmuka Web Modul Gateway")
    add_paragraph(doc, 
        "Untuk melakukan konfigurasi awal, hubungkan laptop teknisi secara langsung ke port Ethernet USR-CANET200 menggunakan kabel LAN. "
        "Lakukan langkah penyetelan alamat IP berikut:"
    )
    add_bullet_item(doc, "Buka pengaturan Network Connections pada laptop teknisi. Atur alamat IPv4 secara manual (statis) ke: IP Address: 192.168.0.50, Subnet Mask: 255.255.255.0, Default Gateway: 192.168.0.1.", "1. Konfigurasi IP Laptop: ")
    add_bullet_item(doc, "Buka peramban web (browser) dan ketikkan alamat IP bawaan pabrik modul: http://192.168.0.7.", "2. Buka Halaman Web: ")
    add_bullet_item(doc, "Ketika kotak dialog otentikasi muncul, masukkan Username: admin dan Password: admin.", "3. Login Web Manajemen: ")

    add_heading_2(doc, "2.2 Konfigurasi Parameter Antarmuka CAN (Baud Rate & Filtering)")
    add_paragraph(doc, 
        "Pada bilah menu sebelah kiri, masuk ke menu CAN Settings -> CAN1 Basic Parameters. Lakukan pengaturan parameter sesuai Tabel 2.1."
    )

    add_table_caption(doc, "Tabel 2.1", "Parameter Konfigurasi Port CAN1 USR-CANET200")
    t2_data = [
        ("Parameter Konfigurasi", "Nilai yang Harus Diisi", "Penjelasan Fungsi Lapangan"),
        ("Port Status", "Enable", "Mengaktifkan antarmuka kanal CAN1."),
        ("Baud Rate", "250 Kbps", "Kecepatan komunikasi standar mutlak bus NMEA 2000."),
        ("Work Mode", "Normal", "Modus operasional aktif menerima dan mengirim frame bus."),
        ("Time Trigger", "10 ms", "Batas waktu tunggu paket; menjamin data segera dikirim tanpa lag."),
        ("Length Trigger", "50 Frame", "Batas jumlah frame per paket transmisi."),
        ("CAN ID Filtering", "Disable (Receive All)", "Mematikan filter agar seluruh PGN sensor navigasi tidak dibuang."),
    ]
    tbl_2 = doc.add_table(rows=len(t2_data), cols=3)
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

    add_heading_2(doc, "2.3 Pengaturan Parameter Jaringan Mode TCP Client")
    add_paragraph(doc, 
        "Pindah ke menu Network Settings. Gateway harus diatur dalam mode TCP Client agar secara mandiri menghubungi server cloud VMS "
        "melalui koneksi internet kapal. Rincian pengisian parameter disajikan pada Tabel 2.2."
    )

    add_table_caption(doc, "Tabel 2.2", "Parameter Konfigurasi Soket Jaringan TCP Client")
    t3_data = [
        ("Parameter Jaringan", "Nilai Konfigurasi", "Keterangan Operasional"),
        ("Work Mode", "TCP Client", "Gateway aktif membuka soket ke server darat."),
        ("Remote Server IP", "IP Publik / Domain Server VMS", "Alamat IP publik statis cloud VMS."),
        ("Remote Port (CAN)", "20005", "Port listening server untuk data biner NMEA 2000."),
        ("Remote Port (Serial)", "20006", "Port listening server untuk data ASCII NMEA 0183."),
        ("Local Port", "0 (Acak / Dinamis)", "Port lokal ditetapkan acak oleh modul."),
        ("TCP Auto-Disconnect", "0 (Disable)", "Mencegah pemutusan soket saat jalur hening."),
        ("Reconnection Interval", "5 detik", "Jeda waktu untuk mencoba menyambung ulang saat sinyal hilang."),
    ]
    tbl_3 = doc.add_table(rows=len(t3_data), cols=3)
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

    add_heading_2(doc, "2.4 Konfigurasi Paket Heartbeat Jaringan")
    add_paragraph(doc, 
        "Koneksi internet di laut melalui terminal Starlink, VSAT, atau router seluler melewati firewall NAT. Apabila tidak ada data yang lewat "
        "dalam rentang waktu tertentu, firewall router akan menutup sesi transmisi. Oleh karena itu, fitur Heartbeat Packet wajib diaktifkan:"
    )
    add_bullet_item(doc, "Pilih opsi 'Send to Network Server' agar paket dikirim ke arah cloud.", "Heartbeat Direction: ")
    add_bullet_item(doc, "Ketikkan teks identifikasi singkat, misalnya 'HEARTBEAT'.", "Heartbeat Content: ")
    add_bullet_item(doc, "Tetapkan interval pengiriman sebesar 30 detik.", "Heartbeat Interval: ")

    # -------------------------------------------------------------------------
    # BAB 3
    # -------------------------------------------------------------------------
    add_heading_1(doc, "3. PENGISIAN REGISTER CONTENT (IDENTITY PACKET KAPAL)")

    add_heading_2(doc, "3.1 Aturan Penamaan Identitas Kapal (Asset Tag)")
    add_paragraph(doc, 
        "Karena gateway bekerja di balik router internet dengan IP privat, server VMS tidak dapat mengenali identitas fisik kapal "
        "hanya dari alamat IP pengirim. Oleh karena itu, server mengandalkan paket Register Content (Identity Packet) yang dikirimkan "
        "pertama kali saat koneksi terbentuk."
    )
    add_paragraph(doc, 
        "Teknisi WAJIB mengisi Register Content dengan nama kapal yang terdaftar di basis data VMS tanpa kesalahan ketik (case-sensitive). "
        "Contoh: Jika nama kapal di sistem adalah 'KM_Uno', maka input harus berupa 'KM_Uno' (bukan 'km uno' atau 'KAPAL_1')."
    )

    add_heading_2(doc, "3.2 Prosedur Input Identity Packet pada Gateway")
    add_paragraph(doc, 
        "Pada antarmuka web, navigasikan ke menu Identity Packet Settings / Registration Packet. Lakukan penyetelan sesuai Tabel 3.1."
    )

    add_table_caption(doc, "Tabel 3.1", "Parameter Konfigurasi Identity Packet Kapal")
    t4_data = [
        ("Parameter Registrasi", "Pilihan Nilai", "Deskripsi Tindakan"),
        ("Identity Packet Type", "Connect Send (Register Data)", "Paket identitas dikirimkan otomatis saat soket TCP pertama kali tersambung."),
        ("Packet Format", "ASCII Plain Text", "Format teks biasa agar terbaca oleh server backend."),
        ("Identity Content", "Contoh: KM_Uno", "Nama/kode unik kapal sesuai Surat Penugasan Lapangan."),
    ]
    tbl_4 = doc.add_table(rows=len(t4_data), cols=3)
    tbl_4.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_three_line_borders(tbl_4)
    for r_idx, row_vals in enumerate(t4_data):
        for c_idx, val in enumerate(row_vals):
            c = tbl_4.cell(r_idx, c_idx)
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
        "Setelah seluruh nilai terisi, klik tombol Save and Restart Module pada pojok bawah menu web. Tunggu sekitar 15 detik "
        "hingga perangkat melakukan reboot dan memulai kembali proses inisialisasi dengan parameter baru."
    )

    # -------------------------------------------------------------------------
    # BAB 4
    # -------------------------------------------------------------------------
    add_heading_1(doc, "4. VERIFIKASI INSTALASI DAN PEMECAHAN MASALAH LAPANGAN")

    add_heading_2(doc, "4.1 Pemeriksaan Status Lampu Indikator LED")
    add_paragraph(doc, 
        "Langkah pertama verifikasi fisik adalah mengamati perilaku lampu LED diagnostik pada panel depan perangkat USR-CANET200. "
        "Tabel 4.1 memuat panduan interpretasi status lampu LED."
    )

    add_table_caption(doc, "Tabel 4.1", "Arti dan Status Lampu Indikator LED Diagnostik")
    t5_data = [
        ("Nama LED", "Status Normal Operasional", "Tindakan Jika Status Abnormal"),
        ("PWR (Power)", "Menyala Hijau Solid", "Periksa koneksi jack adaptor catu daya 12V/24V DC dan sekring panel."),
        ("WORK (System)", "Berkedip Teratur (~1 Hz)", "Jika mati atau menyala diam tanpa kedip, tekan tombol Reset 10 detik."),
        ("CAN1 (Data CAN)", "Berkedip Cepat / Aktif", "Jika mati, periksa jalur CAN_H dan CAN_L ke backbone NMEA 2000."),
        ("Link/Act (Ethernet)", "Menyala Hijau & Berkedip Oranye", "Periksa kabel LAN RJ45 ke router kapal; pastikan port router menyala."),
    ]
    tbl_5 = doc.add_table(rows=len(t5_data), cols=3)
    tbl_5.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_three_line_borders(tbl_5)
    for r_idx, row_vals in enumerate(t5_data):
        for c_idx, val in enumerate(row_vals):
            c = tbl_5.cell(r_idx, c_idx)
            set_cell_margins(c, 50, 50, 80, 80)
            p = c.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(10)
            if r_idx == 0:
                run.font.bold = True
            run.font.color.rgb = COLOR_BLACK

    add_heading_2(doc, "4.2 Uji Ping dan Jalur Uplink Internet Kapal")
    add_paragraph(doc, 
        "Hubungkan laptop ke jaringan router kapal (melalui WiFi kapal atau port LAN switch). Lakukan uji koneksi menggunakan Command Prompt:"
    )
    add_code_snippet(doc, 
        "Uji Konektivitas Jaringan Kapal ke Cloud:\n"
        "1. ping 192.168.1.1        -> Memastikan koneksi laptop ke Router Kapal normal.\n"
        "2. ping 8.8.8.8            -> Memastikan Router Kapal memiliki koneksi internet aktif.\n"
        "3. telnet [IP_SERVER] 20005 -> Memastikan port TCP 20005 server VMS dapat diakses dari kapal."
    )

    add_heading_2(doc, "4.3 Verifikasi Status Online pada Dashboard Cloud VMS")
    add_paragraph(doc, 
        "Buka dashboard web pemantauan VMS melalui peramban laptop. Periksa status operasional kapal yang bersangkutan:"
    )
    add_bullet_item(doc, "Indikator status kapal harus bertransisi menjadi 'Online' (Warna Hijau).", "1. Status Koneksi: ")
    add_bullet_item(doc, "Ikon kapal muncul pada peta GPS sesuai koordinat dermaga/posisi kapal saat ini.", "2. Posisi Peta GPS: ")
    add_bullet_item(doc, "Widget Depth Column menampilkan angka kedalaman air bawah lunas secara dinamis.", "3. Instrumen Echosounder: ")
    add_bullet_item(doc, "Widget Heading dan Kecepatan menampilkan nilai kompas haluan dan SOG yang valid.", "4. Instrumen Navigasi: ")

    add_heading_2(doc, "4.4 Matriks Pemecahan Masalah Cepat di Lapangan (Troubleshooting)")
    add_paragraph(doc, 
        "Apabila ditemukan kendala operasional, teknisi dapat merujuk pada Tabel 4.2 untuk diagnosa cepat."
    )

    add_table_caption(doc, "Tabel 4.2", "Matriks Masalah dan Solusi Cepat Lapangan")
    t6_data = [
        ("Gejala Gangguan", "Kemungkinan Penyebab", "Langkah Perbaikan Lapangan"),
        ("LED CAN1 Mati Total", "Kabel CAN terbalik atau baud rate keliru", "Balik kutub CAN_H dan CAN_L; pastikan baud rate disetel 250 Kbps."),
        ("Status Kapal 'Offline' di Web", "IP Server atau Port salah ketik", "Masuk kembali ke menu USR; periksa apakah IP Server VMS dan Port 20005 sudah benar."),
        ("Status 'Unknown Asset'", "Register Content tidak cocok", "Sesuaikan penulisan nama kapal di Identity Packet persis dengan database VMS."),
        ("Data Sering Terputus di Laut", "Koneksi satelit Starlink/VSAT terhalang", "Periksa kondisi cuaca, posisi antena satelit di masthead kapal, dan cek kuota internet."),
    ]
    tbl_6 = doc.add_table(rows=len(t6_data), cols=3)
    tbl_6.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_three_line_borders(tbl_6)
    for r_idx, row_vals in enumerate(t6_data):
        for c_idx, val in enumerate(row_vals):
            c = tbl_6.cell(r_idx, c_idx)
            set_cell_margins(c, 50, 50, 80, 80)
            p = c.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(10)
            if r_idx == 0:
                run.font.bold = True
            run.font.color.rgb = COLOR_BLACK

    doc.save(out_docx)
    print(f"BERHASIL: Panduan Teknisi Lapangan disimpan ke: {out_docx}")


if __name__ == "__main__":
    main()

