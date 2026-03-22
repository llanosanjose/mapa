import jsPDF from 'jspdf';

const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

// ── Spanish number-to-words (1–999) ──────────────────────────────────────
const _UNIDADES  = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve',
                    'diez','once','doce','trece','catorce','quince','dieciséis','diecisiete',
                    'dieciocho','diecinueve'];
const _DECENAS   = ['','','veinte','treinta','cuarenta','cincuenta','sesenta','setenta',
                    'ochenta','noventa'];
const _CENTENAS  = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos',
                    'seiscientos','setecientos','ochocientos','novecientos'];

function _decenas(n) {
  if (n < 20) return _UNIDADES[n];
  const d = Math.floor(n / 10), u = n % 10;
  if (d === 2 && u > 0) return 'veinti' + _UNIDADES[u];
  return u === 0 ? _DECENAS[d] : _DECENAS[d] + ' y ' + _UNIDADES[u];
}

export function importeALetras(n) {
  n = Math.round(n);
  if (n === 100) return 'cien euros';
  const c = Math.floor(n / 100), resto = n % 100;
  const centenas = c > 0 ? _CENTENAS[c] + (resto > 0 ? ' ' : '') : '';
  return (centenas + _decenas(resto)).trim() + ' euros';
}

let _logoDataUrl = null;

async function loadLogo() {
  if (_logoDataUrl) return _logoDataUrl;
  try {
    const resp = await fetch(import.meta.env.BASE_URL + 'recibos_logo.jpg');
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
 * Generate a receipts PDF (landscape A4: 297×210 mm).
 *
 * Page layout — 2 members (A, B) per page:
 *
 *   ┌──────────────────┬──────────────────┐
 *   │  Member A        │  Member B        │  ← originals
 *   ├··················┼··················┤  ← dashed cut line
 *   │  Member A        │  Member B        │  ← copies
 *   └──────────────────┴──────────────────┘
 *                       Original para el socio  (outside box)
 */
export async function generateRecibos(members, opts) {
  const { year, month, importe, importeTexto, cobrador, startNum = 1 } = opts;
  const logo = await loadLogo();
  const mes  = MESES[month - 1];

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const PAGE_W = 297, PAGE_H = 210;
  const MARGIN  = 7;
  const COL_GAP = 5;
  const ROW_GAP = 8;   // 8 mm gap — label fits between box bottom and cut line
  const COL_W   = (PAGE_W - 2 * MARGIN - COL_GAP) / 2;  // ≈ 139 mm
  const ROW_H   = (PAGE_H - 2 * MARGIN - ROW_GAP) / 2;  // ≈ 94 mm

  const colX = [MARGIN, MARGIN + COL_W + COL_GAP];
  const rowY = [MARGIN, MARGIN + ROW_H + ROW_GAP];

  let num = startNum;

  for (let i = 0; i < members.length; i += 2) {
    if (i > 0) doc.addPage();

    const mA   = members[i];
    const mB   = (i + 1 < members.length) ? members[i + 1] : null;
    const numA = num++;
    const numB = mB ? num++ : null;

    // TOP ROW: originals
    _drawCopy(doc, logo, mA, numA, year, mes, importe, importeTexto, cobrador,
              colX[0], rowY[0], COL_W, ROW_H, true);
    if (mB !== null) {
      _drawCopy(doc, logo, mB, numB, year, mes, importe, importeTexto, cobrador,
                colX[1], rowY[0], COL_W, ROW_H, true);
    }

    // Horizontal dashed cut line
    _dashedLine(doc,
      MARGIN, rowY[0] + ROW_H + ROW_GAP / 2,
      PAGE_W - MARGIN, rowY[0] + ROW_H + ROW_GAP / 2);

    // BOTTOM ROW: copies
    _drawCopy(doc, logo, mA, numA, year, mes, importe, importeTexto, cobrador,
              colX[0], rowY[1], COL_W, ROW_H, false);
    if (mB !== null) {
      _drawCopy(doc, logo, mB, numB, year, mes, importe, importeTexto, cobrador,
                colX[1], rowY[1], COL_W, ROW_H, false);
    }

    // Vertical dashed separator between member columns
    const sepX = MARGIN + COL_W + COL_GAP / 2;
    _dashedLine(doc, sepX, MARGIN, sepX, PAGE_H - MARGIN);
  }

  doc.save(`recibos_${year}_${mes}.pdf`);
}

// ── Draw a single receipt box ─────────────────────────────────────────────
// Layout (w ≈ 139 mm, h ≈ 94 mm):
//
//  x    LC            NX     rw
//  ├────┼─────────────┬──────┤  y          ← gray fill from LC to rw
//  │    │  RECIBO     │N.º   │  R1a=16
//  │Logo├─────────────┴──────┤  y+R1a
//  │    │ ____de marzo de 26 │  R1b=12     date spans full right width
//  ├────┼────────────────────┤  y+R1       full-width horizontal line
//  │Rec.│ Nombre             │  R2=17
//  │de: │ Dirección          │
//  ├────┴────────────────────┤  y+R1+R2    full-width (no LC divider in R3)
//  │ La cantidad de X euros  │  R3=8
//  ├────┬────────────────────┤  y+R1+R2+R3 full-width
//  │Por:│ Cuota AA.VV...     │  R4=17
//  ├────┼────────────────────┤  y+R1+R2+R3+R4  (LC to rw)
//  │15€ │ Fdo.:              │  R5≈24
//  └────┴────────────────────┘  y+h
//                    Original para el socio   ← OUTSIDE box
//
function _drawCopy(doc, logo, member, num, year, mes, importe, importeTexto, cobrador,
                    x, y, w, h, isOriginal) {
  const rw  = w;
  const LC  = 30;    // left column width
  const PAD = 2.5;   // inner text padding

  // Row heights
  const R1a = 16;                     // header top: RECIBO (gray) + N.º (gray)
  const R1b = 12;                     // header bottom: date row
  const R1  = R1a + R1b;             // 28 mm
  const R2  = 17;                     // Recibí de (left) + name+address (right)
  const R3  = 15;                     // La cantidad (full width, no LC divider)
  const R4  = 7;                      // Por: (left) + Cuota (right)
  const R5  = 22;                     // 15€ + Fdo
  const BH  = R1 + R2 + R3 + R4 + R5; // actual box height (< ROW_H, leaves space for label)

  const NB  = 42;            // number box width
  const NX  = x + rw - NB;  // number box left edge

  // ── Outer border ──────────────────────────────────────────────────────
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5);
  doc.rect(x, y, rw, BH);

  // ── Gray fill: entire right area of R1a (RECIBO + N.º both gray) ──────
  doc.setFillColor(225, 225, 225);
  doc.rect(x + LC, y, rw - LC, R1a, 'F');

  // ── Internal borders ──────────────────────────────────────────────────
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);

  // Left column divider — segment 1: header + Recibí de rows
  doc.line(x + LC, y,               x + LC, y + R1 + R2);
  // Left column divider — segment 2: Por + last row (skips La cantidad row)
  doc.line(x + LC, y + R1 + R2 + R3, x + LC, y + BH);

  // N.º box left border (only R1a tall — N.º box does not extend into date row)
  doc.line(NX, y, NX, y + R1a);

  // Horizontal: between header sub-rows (right area only)
  doc.line(x + LC, y + R1a,            x + rw, y + R1a);
  // Horizontal: bottom of header — full width
  doc.line(x,      y + R1,             x + rw, y + R1);
  // Horizontal: bottom of Recibí de — full width (top of La cantidad)
  doc.line(x,      y + R1 + R2,        x + rw, y + R1 + R2);
  // Horizontal: bottom of La cantidad — full width (top of Por)
  doc.line(x,      y + R1 + R2 + R3,   x + rw, y + R1 + R2 + R3);
  // Horizontal: bottom of Por row — full width
  doc.line(x, y + R1 + R2 + R3 + R4, x + rw, y + R1 + R2 + R3 + R4);

  // ── LOGO (left column, full R1 height, preserving oval aspect ratio) ──
  if (logo) {
    // Oval logo is taller than wide; ratio width/height ≈ 0.78
    const logoH = R1 - 3;              // ≈ 25 mm
    const logoW = logoH * 0.78;        // ≈ 19.5 mm — keeps oval shape
    const logoX = x + (LC - logoW) / 2;
    const logoY = y + (R1 - logoH) / 2;
    doc.addImage(logo, 'JPEG', logoX, logoY, logoW, logoH);
  }

  // ── "RECIBO" — left-aligned within gray cell, vertically centred in R1a ─
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('RECIBO', x + LC + PAD, y + R1a * 0.65);

  // ── N.º X/YEAR — centred in N.º box, within R1a ──────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`N.º ${num}/${year}`, NX + NB / 2, y + R1a * 0.62, { align: 'center' });

  // ── Date row (R1b): blank underline + "de <mes> de YEAR" ─────────────
  // Spans full double-cell width (LC → rw), left-to-right justified:
  // blank line fills the remaining space so the year ends flush at the right edge.
  const dateY      = y + R1a + R1b * 0.72;
  const cellLeft   = x + LC + PAD;
  const cellRight  = x + rw - PAD;
  const cellW      = cellRight - cellLeft;

  const DATE_SIZE    = 10;   // font size for date row
  const DATE_SPACING = 0.8;  // extra character spacing (mm)

  // getTextWidth() ignores charSpace, so add numChars*spacing manually
  const mesText = ` de ${mes} de `;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(DATE_SIZE);
  const mesW  = doc.getTextWidth(mesText) + mesText.length * DATE_SPACING;
  doc.setFont('helvetica', 'bold');   doc.setFontSize(DATE_SIZE);
  const yearStr = String(year);
  const yearW = doc.getTextWidth(yearStr) + yearStr.length * DATE_SPACING;

  const blankW   = cellW - mesW - yearW;
  const blankEnd = cellLeft + blankW;

  // Short underline just for writing the day (no charSpace on line drawing)
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
  doc.line(cellLeft, dateY, blankEnd, dateY);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(DATE_SIZE); doc.setCharSpace(DATE_SPACING);
  doc.setTextColor(0, 0, 0);
  doc.text(mesText, blankEnd, dateY);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(DATE_SIZE);
  doc.setTextColor(0, 0, 0);
  doc.text(yearStr, blankEnd + mesW, dateY);
  doc.setCharSpace(0);

  // ── "Recibí de:" — left column of R2 ─────────────────────────────────
  const recY = y + R1;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Recibí de:', x + PAD, recY + 7);

  // ── Name + address — right cell of R2 ────────────────────────────────
  if (member) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`${member.apellidos}, ${member.nombre}`, x + LC + PAD, recY + 8);
    if (member.dir_display) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      const addrLines = doc.splitTextToSize(member.dir_display, rw - LC - PAD * 2);
      doc.text(addrLines, x + LC + PAD, recY + 14.5);
    }
  } else {
    doc.setDrawColor(160); doc.setLineWidth(0.2);
    doc.line(x + LC + PAD, recY + 7,    x + rw - PAD, recY + 7);
    doc.line(x + LC + PAD, recY + 13.5, x + rw - PAD, recY + 13.5);
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
  }

  // ── "La cantidad de..." — full-width cell, centred, larger with spacing ─
  const cantY = y + R1 + R2;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setCharSpace(0.6);
  doc.setTextColor(0, 0, 0);
  doc.text(`La cantidad de ${importeTexto}`, x + rw / 2, cantY + R3 * 0.65, { align: 'center' });
  doc.setCharSpace(0);

  // ── "Por:" — left column of R4 ───────────────────────────────────────
  const porY = y + R1 + R2 + R3;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('Por:', x + PAD, porY + R4 * 0.65);

  // ── "Cuota AA.VV..." — right cell of R4, with space before year ───────
  const cuotaBase = 'Cuota AA.VV. Llano San José año';
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  const cuotaBaseW = doc.getTextWidth(cuotaBase);
  const spaceW     = doc.getTextWidth(' ');
  doc.text(cuotaBase, x + LC + PAD, porY + R4 * 0.65);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(String(year), x + LC + PAD + cuotaBaseW + spaceW * 2, porY + R4 * 0.65);

  // ── Last row (R5): "15 €uros" in left cell + "Fdo.:" in right cell ────
  const fdoY = y + R1 + R2 + R3 + R4;
  const lineY = fdoY + R5 * 0.58;  // vertical centre of R5

  // "15 €uros" on one line, mixed sizes, centred in left column
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  const wNum = doc.getTextWidth(String(importe));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  const wUnit = doc.getTextWidth(' €uros');
  const textStartX = x + (LC - wNum - wUnit) / 2;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text(String(importe), textStartX, lineY);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(' €uros', textStartX + wNum, lineY);

  // "Fdo.:" — right cell, top of R5
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('Fdo.:', x + LC + PAD, fdoY + 5.5);

  // ── "Original / Copia" label — OUTSIDE the receipt box ───────────────
  const label = isOriginal
    ? 'Original para el socio'
    : cobrador ? `Copia para la Asociación (${cobrador})` : 'Copia para la Asociación';
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text(label, x + rw, y + BH + 3.5, { align: 'right' });
}

// ── Dashed line helper ────────────────────────────────────────────────────
function _dashedLine(doc, x1, y1, x2, y2) {
  doc.setLineDashPattern([3, 2], 0);
  doc.setDrawColor(100, 100, 220); doc.setLineWidth(0.4);
  doc.line(x1, y1, x2, y2);
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(0, 0, 0);
}
