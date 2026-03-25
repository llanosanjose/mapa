import jsPDF from 'jspdf';

// ── Logo ──────────────────────────────────────────────────────────────────────
let _logoCache = null;
async function loadLogo() {
  if (_logoCache) return _logoCache;
  try {
    const resp = await fetch(import.meta.env.BASE_URL + 'recibos_logo.jpg');
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload  = () => { _logoCache = reader.result; resolve(_logoCache); };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ── Paleta ────────────────────────────────────────────────────────────────────
const C_HEAD   = [51,  65,  85];   // slate-700
const C_ALT    = [248, 250, 252];  // slate-50
const C_BORDER = [203, 213, 225];  // slate-300
const C_TEXT   = [15,  23,  42];   // slate-900
const C_MUTED  = [100, 116, 139];  // slate-500
const C_DIM    = [148, 163, 184];  // slate-400
const C_GREEN  = [5,   150, 105];  // emerald-600
const C_RED    = [225, 29,  72];   // rose-600

// ── Medidas (mm, A4 portrait) ─────────────────────────────────────────────────
const PAGE_W   = 210;
const PAGE_H   = 297;
const MARGIN   = 13;
const USABLE_W = PAGE_W - 2 * MARGIN;
const ROW_H    = 7;
const HEAD_H   = 8;    // cabecera de tabla
const FOOT_H   = 11;   // pie de página
const TITLE_H  = 28;   // bloque de título (solo pág. 1)

// ── Columnas ──────────────────────────────────────────────────────────────────
function buildCols({ numFila, casilla }) {
  const cols = [];
  if (casilla) cols.push({ id: 'check', w: 8,  label: ''           });
  if (numFila) cols.push({ id: 'num',   w: 10, label: 'N.'         });
  const fixed = cols.reduce((s, c) => s + c.w, 0) + 50 + 24;
  cols.push({ id: 'name',  w: USABLE_W - fixed, label: 'NOMBRE Y APELLIDOS' });
  cols.push({ id: 'addr',  w: 50,               label: 'DIRECCION'           });
  cols.push({ id: 'cuota', w: 24,               label: 'CUOTA'               });
  return cols;
}

// ── Cabecera de tabla ─────────────────────────────────────────────────────────
function drawTableHeader(doc, cols, y) {
  doc.setFillColor(...C_HEAD);
  doc.rect(MARGIN, y, USABLE_W, HEAD_H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);

  let x = MARGIN;
  for (const col of cols) {
    if (!col.label) { x += col.w; continue; }
    const centered = col.id === 'num' || col.id === 'cuota';
    doc.text(col.label, centered ? x + col.w / 2 : x + 2.5, y + HEAD_H * 0.65,
      { align: centered ? 'center' : 'left' });
    x += col.w;
  }
}

// ── Fila de socio ─────────────────────────────────────────────────────────────
function drawRow(doc, cols, member, num, y, isAlt) {
  const inactive = !!member.fecha_baja;

  if (isAlt) {
    doc.setFillColor(...C_ALT);
    doc.rect(MARGIN, y, USABLE_W, ROW_H, 'F');
  }

  // Línea inferior de fila
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.1);
  doc.line(MARGIN, y + ROW_H, MARGIN + USABLE_W, y + ROW_H);

  const ty = y + ROW_H * 0.68; // baseline de texto
  let x = MARGIN;

  for (const col of cols) {
    const cx = x + col.w / 2;

    if (col.id === 'check') {
      // Casilla de verificación vacía
      const sz = 3.2;
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.35);
      doc.rect(cx - sz / 2, y + (ROW_H - sz) / 2, sz, sz);

    } else if (col.id === 'num') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...(inactive ? C_DIM : C_MUTED));
      doc.text(String(num), cx, ty, { align: 'center' });

    } else if (col.id === 'name') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...(inactive ? C_DIM : C_TEXT));
      const label = `${member.apellidos ?? ''}, ${member.nombre ?? ''}`;
      doc.text(doc.splitTextToSize(label, col.w - 3)[0], x + 2.5, ty);

    } else if (col.id === 'addr') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...(inactive ? C_DIM : C_MUTED));
      doc.text(doc.splitTextToSize(member.dir_display ?? '-', col.w - 3)[0], x + 2.5, ty);

    } else if (col.id === 'cuota') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);

      if (inactive) {
        doc.setTextColor(...C_DIM);
        doc.text('Baja', cx, ty, { align: 'center' });
      } else {
        // Pequeño círculo indicador + año
        const dotR = 1.1;
        const dotX  = x + 4.5;
        const dotY  = y + ROW_H / 2;
        const anno  = String(member.anno_cuota ?? '');

        if (member.cuota_pagada) {
          doc.setFillColor(...C_GREEN);
          doc.setDrawColor(...C_GREEN);
          doc.circle(dotX, dotY, dotR, 'FD');
          doc.setTextColor(...C_GREEN);
        } else {
          doc.setDrawColor(...C_RED);
          doc.setLineWidth(0.45);
          doc.circle(dotX, dotY, dotR, 'S');
          doc.setTextColor(...C_RED);
        }
        doc.text(anno, dotX + dotR + 2, ty);
      }
    }

    x += col.w;
  }
}

// ── Pie de página ─────────────────────────────────────────────────────────────
function drawFooter(doc, page, totalPages, totalMembers) {
  const fy = PAGE_H - MARGIN / 2 - 2;
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, fy - 4, PAGE_W - MARGIN, fy - 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C_DIM);
  doc.text(`Pagina ${page} de ${totalPages}`, MARGIN, fy);
  doc.text(`${totalMembers} socios`, PAGE_W - MARGIN, fy, { align: 'right' });
}

// ── Bloque de título (pág. 1) ─────────────────────────────────────────────────
function drawTitle(doc, members, logo) {
  const y = MARGIN;

  // Logo a la izquierda (ratio oval ≈ 0.78 ancho/alto)
  if (logo) {
    const lh = 16;
    const lw = lh * 0.78;
    doc.addImage(logo, 'JPEG', MARGIN, y + 0.5, lw, lh);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...C_TEXT);
  doc.text('ASOCIACION DE VECINOS', PAGE_W / 2, y + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C_MUTED);
  doc.text('Llano San Jose  -  Elche', PAGE_W / 2, y + 14, { align: 'center' });

  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y + 17, PAGE_W - MARGIN, y + 17);

  const dateStr = new Date().toLocaleDateString('es-ES',
    { year: 'numeric', month: 'long', day: 'numeric' });
  const activos = members.filter(m => !m.fecha_baja).length;
  const bajas   = members.length - activos;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_TEXT);
  doc.text('Listado de socios', MARGIN, y + 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MUTED);
  doc.text(dateStr, MARGIN, y + 27.5);

  const stats = bajas > 0
    ? `${activos} activos · ${bajas} bajas · ${members.length} total`
    : `${activos} socios activos`;
  doc.text(stats, PAGE_W - MARGIN, y + 27.5, { align: 'right' });
}

// ── Función principal ─────────────────────────────────────────────────────────
export async function generateListado(members, opts = {}) {
  const { numFila = true, casilla = true } = opts;
  const logo = await loadLogo();
  const cols = buildCols({ numFila, casilla });

  // Filas disponibles por página
  const rowsP1 = Math.floor(
    (PAGE_H - MARGIN - TITLE_H - HEAD_H - FOOT_H - MARGIN) / ROW_H
  );
  const rowsPN = Math.floor(
    (PAGE_H - 2 * MARGIN - HEAD_H - FOOT_H) / ROW_H
  );

  // Pre-calcular páginas
  const pages = [];
  let remaining = [...members];
  pages.push(remaining.splice(0, rowsP1));
  while (remaining.length > 0) pages.push(remaining.splice(0, rowsPN));

  const totalPages = pages.length;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  pages.forEach((pageMembers, pi) => {
    if (pi > 0) doc.addPage();

    // Título solo en la primera página
    if (pi === 0) drawTitle(doc, members, logo);

    const tableY = pi === 0 ? MARGIN + TITLE_H : MARGIN;
    drawTableHeader(doc, cols, tableY);

    let rowY = tableY + HEAD_H;
    const offset = pages.slice(0, pi).reduce((s, p) => s + p.length, 0);

    pageMembers.forEach((m, i) => {
      drawRow(doc, cols, m, offset + i + 1, rowY, i % 2 === 1);
      rowY += ROW_H;
    });

    // Marco exterior de la tabla
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, tableY, USABLE_W, rowY - tableY);

    drawFooter(doc, pi + 1, totalPages, members.length);
  });

  const fecha = new Date().toISOString().slice(0, 10);
  doc.save(`listado_socios_${fecha}.pdf`);
}
