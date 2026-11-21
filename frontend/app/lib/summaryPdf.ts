import type { Classification, TranscriptLine, Urgency } from "./calls";

export type CallSummaryData = {
  incident: string;
  location: string;
  startedAt: Date | null;
  duration: string;
  status: "In progress" | "Ended";
  classification: Classification;
  notes: string;
  lines: TranscriptLine[];
};

const urgencyColor: Record<Urgency, [number, number, number]> = {
  Low: [16, 185, 129],
  Medium: [245, 158, 11],
  High: [249, 115, 22],
  Critical: [239, 68, 68],
};

const PAGE_MARGIN = 18;
const LINE_HEIGHT = 5;

// The built-in PDF fonts only cover basic Latin, so swap common typographic characters.
function plain(text: string) {
  return text
    .replace(/[—–]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...");
}

// Loaded on demand so jsPDF stays out of the initial page bundle.
export async function downloadCallSummary(data: CallSummaryData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const generatedAt = new Date();
  let y = PAGE_MARGIN;

  function ensureSpace(height: number) {
    if (y + height <= pageHeight - PAGE_MARGIN) return;
    doc.addPage();
    y = PAGE_MARGIN;
  }

  function heading(text: string) {
    ensureSpace(14);
    y += 4;
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(15, 23, 42);
    doc.text(text, PAGE_MARGIN, y);
    y += 2;
    doc.setDrawColor(203, 213, 225).line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
    y += 6;
  }

  function paragraph(text: string, x = PAGE_MARGIN, width = contentWidth) {
    const wrapped: string[] = doc.splitTextToSize(plain(text), width);
    for (const row of wrapped) {
      ensureSpace(LINE_HEIGHT);
      doc.text(row, x, y);
      y += LINE_HEIGHT;
    }
  }

  // Header band
  doc.setFillColor(220, 38, 38).rect(0, 0, pageWidth, 26, "F");
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(255, 255, 255);
  doc.text("Emergency Call Summary", PAGE_MARGIN, 16);
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(`Generated ${generatedAt.toLocaleString()}`, pageWidth - PAGE_MARGIN, 16, { align: "right" });
  y = 36;

  // Assessment headline: urgency and ambulance
  const { classification: c } = data;
  const boxWidth = (contentWidth - 6) / 2;
  const [ur, ug, ub] = urgencyColor[c.urgency];
  doc.setFillColor(ur, ug, ub).roundedRect(PAGE_MARGIN, y, boxWidth, 20, 2, 2, "F");
  const [ar, ag, ab] = c.ambulance ? urgencyColor.Critical : urgencyColor.Low;
  doc.setFillColor(ar, ag, ab);
  doc.roundedRect(PAGE_MARGIN + boxWidth + 6, y, boxWidth, 20, 2, 2, "F");
  doc.setTextColor(255, 255, 255).setFont("helvetica", "normal").setFontSize(9);
  doc.text("URGENCY", PAGE_MARGIN + 4, y + 6);
  doc.text("AMBULANCE", PAGE_MARGIN + boxWidth + 10, y + 6);
  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text(`${c.urgency}  (${c.urgencyScore}/100)`, PAGE_MARGIN + 4, y + 15);
  doc.text(c.ambulance ? "Yes - dispatch" : "No", PAGE_MARGIN + boxWidth + 10, y + 15);
  y += 28;

  heading("Call details");
  const details: [string, string][] = [
    ["Incident", data.incident],
    ["Location", data.location],
    ["Call started", data.startedAt ? data.startedAt.toLocaleString() : "-"],
    ["Duration", data.duration],
    ["Status", data.status],
  ];
  doc.setFontSize(10);
  for (const [label, value] of details) {
    doc.setFont("helvetica", "bold").setTextColor(71, 85, 105);
    ensureSpace(LINE_HEIGHT);
    doc.text(label, PAGE_MARGIN, y);
    doc.setFont("helvetica", "normal").setTextColor(15, 23, 42);
    paragraph(value, PAGE_MARGIN + 38, contentWidth - 38);
    y += 1;
  }

  heading("Assessment");
  ensureSpace(LINE_HEIGHT * 2);
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(71, 85, 105);
  doc.text("Detected indicators", PAGE_MARGIN, y);
  y += LINE_HEIGHT;
  doc.setFont("helvetica", "normal").setTextColor(15, 23, 42);
  paragraph(c.indicators.length ? c.indicators.map((i) => `- ${i}`).join("\n") : "None detected");

  heading("Dispatcher notes");
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(15, 23, 42);
  paragraph(data.notes.trim() || "No notes were entered.");

  heading("Transcript");
  doc.setFontSize(10);
  for (const line of data.lines) {
    ensureSpace(LINE_HEIGHT * 2);
    const isCaller = line.speaker === "Caller";
    doc.setFont("helvetica", "bold");
    if (isCaller) doc.setTextColor(15, 23, 42);
    else doc.setTextColor(3, 105, 161);
    doc.text(line.speaker, PAGE_MARGIN, y);
    doc.setFont("helvetica", "normal").setTextColor(15, 23, 42);
    paragraph(line.text, PAGE_MARGIN + 22, contentWidth - 22);
    y += 1.5;
  }

  // Page numbers
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(148, 163, 184);
    doc.text(`Page ${p} of ${pages}`, pageWidth - PAGE_MARGIN, pageHeight - 8, { align: "right" });
  }

  const stamp = generatedAt.toISOString().slice(0, 16).replace(/[:T]/g, "-");
  doc.save(`call-summary-${stamp}.pdf`);
}
