import jsPDF from 'jspdf';

const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

let _logoDataUrl = null;

async function loadLogo() {
  if (_logoDataUrl) return _logoDataUrl;
  try {
    const resp = await fetch('/recibos_logo.jpg');
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => { _logoDataUrl = reader.result; resolve(_logoDataUrl); };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

/**
 * Generate a receipts PDF.
 * @param {Array<Object|null>} members - Member objects, or [null,...] for blank receipts
 * @param {Object} opts
 * @param {number} opts.year
 * @param {number} opts.month  - 1-12
 * @param {number} opts.importe
 * @param {string} opts.importeTexto
 * @param {string} opts.cobrador
 * @param {number} opts.startNum - starting receipt number (default 1)
 */
export async function generateRecibos(members, opts) {
  const { year, month, importe, importeTexto, cobrador, startNum = 1 } = opts;
  const logo = await loadLogo();
  const mes  = MESES[month - 1];

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── Layout constants ────────────────────────────────────────────────────
  const PAGE_W = 210, PAGE_H = 297;
  const MARGIN   = 7;       // page margin
  const COPY_GAP = 5;       // gap between two copies (dashed separator)
  const ROW_GAP  = 10;      // gap between two receipt rows (dashed separator)
  const COPY_W   = (PAGE_W - 2 * MARGIN - COPY_GAP) / 2;  // ~96mm
  const ROW_H    = (PAGE_H - 2 * MARGIN - ROW_GAP)  / 2;  // ~135mm

  let num = startNum;

  for (let i = 0; i < members.length; i += 2) {
    if (i > 0) doc.addPage();

    const topY = MARGIN;
    const botY = MARGIN + ROW_H + ROW_GAP;

    // Top receipt (original + copy)
    _drawPair(doc, logo, members[i], num, year, mes, importe, importeTexto, cobrador,
              MARGIN, topY, COPY_W, ROW_H, COPY_GAP);
    num++;

    // Dashed horizontal separator between rows
    _dashedLine(doc, MARGIN, topY + ROW_H + ROW_GAP / 2, PAGE_W - MARGIN, topY + ROW_H + ROW_GAP / 2);

    // Bottom receipt (if present)
    if (i + 1 < members.length) {
      _drawPair(doc, logo, members[i + 1], num, year, mes, importe, importeTexto, cobrador,
                MARGIN, botY, COPY_W, ROW_H, COPY_GAP);
      num++;
    }
  }

  doc.save(`recibos_${year}_${mes}.pdf`);
}

// ── Draw a pair (original + copy) for one member ─────────────────────────
function _drawPair(doc, logo, member, num, year, mes, importe, importeTexto, cobrador, x, y, copyW, h, gap) {
  _drawCopy(doc, logo, member, num, year, mes, importe, importeTexto, cobrador,
            x, y, copyW, h, true);
  _dashedLine(doc, x + copyW + gap / 2, y, x + copyW + gap / 2, y + h, true);
  _drawCopy(doc, logo, member, num, year, mes, importe, importeTexto, cobrador,
            x + copyW + gap, y, copyW, h, false);
}

// ── Draw a single receipt copy ───────────────────────────────────────────
function _drawCopy(doc, logo, member, num, year, mes, importe, importeTexto, cobrador,
                    x, y, w, h, isOriginal) {
  // Reserve right strip for rotated label text
  const STRIP = 9;
  const rw = w - STRIP;   // receipt box width

  // ── Column widths ────────────────────────────────────────────────────────
  const LC = 22;           // left column (logo + euros)

  // ── Row heights ──────────────────────────────────────────────────────────
  const R1 = 27;           // header: logo | RECIBO | number box
  const R2 = 30;           // Recibí de + name + address
  const R3 = 10;           // La cantidad...
  const R4 = 27;           // Por: + Fdo.:
  const R5 = h - R1 - R2 - R3 - R4;  // €uros (rest ≈ 41mm)

  // ── Number box width (top-right of header) ───────────────────────────────
  const NB = 44;           // number box width
  const NX = x + rw - NB; // number box x

  // ── Outer border ─────────────────────────────────────────────────────────
  doc.setDrawColor(0); doc.setLineWidth(0.5);
  doc.rect(x, y, rw, h);

  // ── Gray fill for number box ──────────────────────────────────────────────
  doc.setFillColor(225, 225, 225);
  doc.rect(NX, y, NB, R1, 'F');

  // ── Internal borders ─────────────────────────────────────────────────────
  doc.setLineWidth(0.3);
  // Vertical left column divider (full height)
  doc.line(x + LC, y, x + LC, y + h);
  // Number box left border (already has outer border on right/top)
  doc.line(NX, y, NX, y + R1);
  // Horizontal after header
  doc.line(x, y + R1, x + rw, y + R1);
  // Horizontal after Recibí de
  doc.line(x + LC, y + R1 + R2, x + rw, y + R1 + R2);
  // Horizontal after La cantidad
  doc.line(x + LC, y + R1 + R2 + R3, x + rw, y + R1 + R2 + R3);
  // Horizontal after Por/Fdo
  doc.line(x + LC, y + R1 + R2 + R3 + R4, x + rw, y + R1 + R2 + R3 + R4);

  const PAD = 3;

  // ── LOGO ─────────────────────────────────────────────────────────────────
  if (logo) {
    const ls = Math.min(LC - 2, R1 - 2);
    doc.addImage(logo, 'JPEG', x + (LC - ls) / 2, y + (R1 - ls) / 2, ls, ls);
  }

  // ── RECIBO title ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
  doc.setTextColor(0);
  doc.text('RECIBO', x + LC + PAD + 1, y + R1 * 0.62);

  // ── Number box content ────────────────────────────────────────────────────
  // Line 1: "N.º X/YEAR" bold
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text(`N.º ${num}/${year}`, NX + NB / 2, y + 8, { align: 'center' });
  // Line 2: "de octubre" normal
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(`de ${mes}`, NX + NB / 2, y + 16, { align: 'center' });
  // Line 3: "de " normal + "YEAR" bold — centred together
  const prefix3 = 'de ';
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const prefix3W = doc.getTextWidth(prefix3);
  doc.setFont('helvetica', 'bold');
  const year3W   = doc.getTextWidth(String(year));
  const line3TotalW  = prefix3W + year3W;
  const line3StartX  = NX + (NB - line3TotalW) / 2;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(prefix3, line3StartX, y + 23);
  doc.setFont('helvetica', 'bold');
  doc.text(String(year), line3StartX + prefix3W, y + 23);

  // ── Recibí de ─────────────────────────────────────────────────────────────
  const recY = y + R1;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text('Recibí de:', x + LC + PAD, recY + 7);

  if (member) {
    const name = `${member.apellidos}, ${member.nombre}`;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text(name, x + LC + PAD, recY + 15);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    if (member.dir_display) {
      const addrLines = doc.splitTextToSize(member.dir_display, rw - LC - PAD * 2);
      doc.text(addrLines, x + LC + PAD, recY + 23);
    }
  } else {
    // Blank: underlines for writing
    doc.setDrawColor(160); doc.setLineWidth(0.2);
    doc.line(x + LC + PAD + 22, recY + 15, x + rw - PAD, recY + 15);
    doc.line(x + LC + PAD,      recY + 24, x + rw - PAD, recY + 24);
    doc.setDrawColor(0); doc.setLineWidth(0.3);
  }

  // ── La cantidad ───────────────────────────────────────────────────────────
  const cantY = y + R1 + R2;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text(`La cantidad de ${importeTexto}`, x + LC + PAD, cantY + 7);

  // ── Por + Fdo ─────────────────────────────────────────────────────────────
  const porY = y + R1 + R2 + R3;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text('Por:', x + LC + PAD, porY + 7);
  // "Cuota AA.VV. Llano San José año " + bold year
  const porPrefix = `Cuota AA.VV. Llano San José año `;
  const porPrefW  = doc.getTextWidth(porPrefix);
  doc.text(porPrefix, x + LC + PAD, porY + 14);
  doc.setFont('helvetica', 'bold');
  doc.text(String(year), x + LC + PAD + porPrefW, porY + 14);
  doc.setFont('helvetica', 'normal');
  doc.text('Fdo.:', x + LC + PAD, porY + 22);

  // ── 15 €uros (left column, bottom) ───────────────────────────────────────
  const euroY = y + R1 + R2 + R3 + R4;
  const euroCX = x + LC / 2;
  // Number (large, bold)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  doc.text(String(importe), euroCX, euroY + R5 * 0.40, { align: 'center' });
  // "€uros" (smaller)
  doc.setFontSize(9);
  doc.text('€uros', euroCX, euroY + R5 * 0.40 + 7, { align: 'center' });

  // ── Rotated label (right strip) ───────────────────────────────────────────
  const label = isOriginal
    ? 'Original para el socio'
    : `Copia para la Asociación (${cobrador || ''})`;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
  doc.setTextColor(60);
  // Place centered in the strip, rotated 90° CCW (reads bottom→top)
  doc.text(label, x + rw + STRIP / 2, y + h / 2, { angle: 90, align: 'center' });
  doc.setTextColor(0);
}

// ── Dashed line helper ────────────────────────────────────────────────────
function _dashedLine(doc, x1, y1, x2, y2) {
  doc.setLineDashPattern([3, 2], 0);
  doc.setDrawColor(140); doc.setLineWidth(0.3);
  doc.line(x1, y1, x2, y2);
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(0);
}
