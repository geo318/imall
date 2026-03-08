"use client";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFImage, type PDFPage, rgb } from "pdf-lib";
import type { CartItem } from "@/lib/api/cart";
import { DEFAULT_CURRENCY_CODE, formatCurrencyAmount } from "@/lib/utils/currency";
import type { ShippingFormState } from "./types";

type PrintCrystalInstallmentInvoiceInput = {
  buyer: ShippingFormState;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  installmentCommission: number;
  total: number;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const TEMPLATE_IMAGE_PATH = "/crystal-installment-template.png";
const LOGO_IMAGE_PATH = "/crystal-bank-logo.png";
const FONT_REGULAR_PATH = "/fonts/Firago-Regular.ttf";
const FONT_SEMIBOLD_PATH = "/fonts/Firago-SemiBold.ttf";

const PRIMARY_TEXT_COLOR = rgb(0.1, 0.11, 0.14);
const MUTED_TEXT_COLOR = rgb(0.36, 0.4, 0.48);
const BORDER_COLOR = rgb(0.2, 0.22, 0.26);

const sanitize = (value: string) => value.replace(/\s+/g, " ").trim();

async function fetchBinary(path: string): Promise<ArrayBuffer> {
  const response = await fetch(path, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load binary: ${path}`);
  }
  return response.arrayBuffer();
}

async function fetchOptionalBinary(path: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(path, { cache: "force-cache" });
    if (!response.ok) {
      return null;
    }
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

async function embedImage(pdf: PDFDocument, bytes: ArrayBuffer): Promise<PDFImage> {
  const signature = new Uint8Array(bytes.slice(0, 4));
  const isPng = signature[0] === 0x89 && signature[1] === 0x50;
  return isPng ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
}

function drawFallbackTemplate(page: PDFPage) {
  const x = 28;
  const y = 26;
  const w = PAGE_WIDTH - 56;
  const h = PAGE_HEIGHT - 52;

  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderWidth: 1,
    borderColor: rgb(0.68, 0.69, 0.7),
  });

  // Header split
  page.drawLine({
    start: { x: x + w * 0.52, y: y + h - 40 },
    end: { x: x + w * 0.52, y: y + h - 340 },
    thickness: 0.9,
    color: BORDER_COLOR,
  });

  // Table frame
  const tableY = y + 190;
  const tableH = 190;
  page.drawRectangle({
    x: x + 16,
    y: tableY,
    width: w - 32,
    height: tableH,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  });
}

export async function printCrystalInstallmentInvoice(input: PrintCrystalInstallmentInvoiceInput) {
  if (typeof window === "undefined") return;

  const now = new Date();
  const orderCode = `CRY-${now.getTime().toString(36).toUpperCase()}`;

  const [fontRegularBytes, fontSemiboldBytes, logoBytes, templateBytes] = await Promise.all([
    fetchBinary(FONT_REGULAR_PATH),
    fetchBinary(FONT_SEMIBOLD_PATH),
    fetchBinary(LOGO_IMAGE_PATH),
    fetchOptionalBinary(TEMPLATE_IMAGE_PATH),
  ]);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const regular = await pdf.embedFont(fontRegularBytes, { subset: true });
  const semibold = await pdf.embedFont(fontSemiboldBytes, { subset: true });
  const logo = await embedImage(pdf, logoBytes);
  const template = templateBytes ? await embedImage(pdf, templateBytes) : null;

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  if (template) {
    page.drawImage(template, {
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      opacity: 0.3,
    });
  } else {
    drawFallbackTemplate(page);
  }

  // Header: logo + meta
  page.drawImage(logo, {
    x: 36,
    y: PAGE_HEIGHT - 95,
    width: 154,
    height: 28,
  });

  const dateLabel = now.toLocaleDateString("ka-GE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  page.drawText(`განაცხადის კოდი: ${orderCode}`, {
    x: PAGE_WIDTH - 270,
    y: PAGE_HEIGHT - 80,
    size: 11,
    font: semibold,
    color: PRIMARY_TEXT_COLOR,
  });
  page.drawText(`თარიღი: ${dateLabel}`, {
    x: PAGE_WIDTH - 270,
    y: PAGE_HEIGHT - 98,
    size: 10,
    font: regular,
    color: MUTED_TEXT_COLOR,
  });

  // Buyer section
  const buyerX = 42;
  let buyerY = PAGE_HEIGHT - 136;
  page.drawText("მყიდველის ინფორმაცია", {
    x: buyerX,
    y: buyerY,
    size: 11,
    font: semibold,
    color: PRIMARY_TEXT_COLOR,
  });
  buyerY -= 20;

  const buyerRows = [
    `სახელი და გვარი: ${sanitize(`${input.buyer.firstName} ${input.buyer.lastName}`) || "-"}`,
    `ელ-ფოსტა: ${sanitize(input.buyer.email || "-")}`,
    `ტელეფონი: ${sanitize(input.buyer.phone || "-")}`,
    `მისამართი: ${sanitize(input.buyer.address || "-")}`,
    `ქალაქი: ${sanitize(input.buyer.city || "-")}`,
  ];

  for (const row of buyerRows) {
    page.drawText(row, {
      x: buyerX,
      y: buyerY,
      size: 9.8,
      font: regular,
      color: PRIMARY_TEXT_COLOR,
      maxWidth: PAGE_WIDTH - 88,
    });
    buyerY -= 16;
  }

  // Table
  const tableX = 42;
  const tableWidth = PAGE_WIDTH - 84;
  const tableTop = PAGE_HEIGHT - 320;
  const rowHeight = 24;
  const headerHeight = 26;
  const columns: Array<{ label: string; width: number }> = [
    { label: "#", width: 34 },
    { label: "ნივთის დასახელება", width: 227 },
    { label: "რაოდ.", width: 65 },
    { label: "ერთ. ფასი", width: 88 },
    { label: "ჯამი", width: 97 },
  ];

  page.drawRectangle({
    x: tableX,
    y: tableTop - headerHeight,
    width: tableWidth,
    height: headerHeight,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    color: rgb(0.97, 0.97, 0.97),
  });

  let colCursor = tableX;
  for (let index = 0; index < columns.length; index++) {
    const column = columns[index];
    if (!column) continue;

    if (index > 0) {
      page.drawLine({
        start: { x: colCursor, y: tableTop },
        end: { x: colCursor, y: tableTop - headerHeight - rowHeight * 8 },
        thickness: 1,
        color: BORDER_COLOR,
      });
    }

    page.drawText(column.label, {
      x: colCursor + 4,
      y: tableTop - 17,
      size: 8.7,
      font: semibold,
      color: PRIMARY_TEXT_COLOR,
      maxWidth: column.width - 8,
    });
    colCursor += column.width;
  }

  const visibleItems = input.items.slice(0, 8);
  visibleItems.forEach((item, index) => {
    const y = tableTop - headerHeight - rowHeight * (index + 1);
    page.drawRectangle({
      x: tableX,
      y,
      width: tableWidth,
      height: rowHeight,
      borderWidth: 1,
      borderColor: BORDER_COLOR,
    });

    const qty = Number(item.qty ?? 0);
    const unitPrice = Number(item.price ?? 0);
    const lineTotal = qty * unitPrice;

    const values = [
      String(index + 1),
      sanitize(item.productTitle ?? "Item"),
      String(qty),
      formatCurrencyAmount(unitPrice, DEFAULT_CURRENCY_CODE),
      formatCurrencyAmount(lineTotal, DEFAULT_CURRENCY_CODE),
    ] as const;

    let valueX = tableX;
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const value = values[colIndex] ?? "";
      const column = columns[colIndex];
      if (!column) continue;

      page.drawText(value, {
        x: valueX + 4,
        y: y + 7,
        size: 8.5,
        font: regular,
        color: PRIMARY_TEXT_COLOR,
        maxWidth: column.width - 8,
      });
      valueX += column.width;
    }
  });

  if (input.items.length > visibleItems.length) {
    page.drawText(`+ ${input.items.length - visibleItems.length} დამატებითი პოზიცია`, {
      x: tableX,
      y: tableTop - headerHeight - rowHeight * 8 - 16,
      size: 8.5,
      font: regular,
      color: MUTED_TEXT_COLOR,
    });
  }

  // Totals area
  const totalsY = 170;
  const totalsRows: Array<[string, string, boolean]> = [
    ["ქვეჯამი", formatCurrencyAmount(input.subtotal, DEFAULT_CURRENCY_CODE), false],
    ["მიწოდება", formatCurrencyAmount(input.shipping, DEFAULT_CURRENCY_CODE), false],
    [
      "განვადების საკომისიო (12%)",
      formatCurrencyAmount(input.installmentCommission, DEFAULT_CURRENCY_CODE),
      false,
    ],
    ["სულ", formatCurrencyAmount(input.total, DEFAULT_CURRENCY_CODE), true],
  ];

  let totalsCursorY = totalsY;
  for (const [label, value, highlight] of totalsRows) {
    page.drawText(label, {
      x: PAGE_WIDTH - 260,
      y: totalsCursorY,
      size: highlight ? 11 : 10,
      font: highlight ? semibold : regular,
      color: PRIMARY_TEXT_COLOR,
    });
    page.drawText(value, {
      x: PAGE_WIDTH - 120,
      y: totalsCursorY,
      size: highlight ? 11 : 10,
      font: highlight ? semibold : regular,
      color: PRIMARY_TEXT_COLOR,
    });
    totalsCursorY -= 18;
  }

  page.drawText(
    "ინვოისი შეიქმნა Crystal-ის ხელით განვადების განაცხადისთვის. დაბეჭდეთ და მიიტანეთ ფილიალში.",
    {
      x: 42,
      y: 48,
      size: 8.8,
      font: regular,
      color: MUTED_TEXT_COLOR,
      maxWidth: PAGE_WIDTH - 84,
      lineHeight: 11,
    },
  );

  const pdfBytes = await pdf.save();
  const normalizedPdfBytes = Uint8Array.from(pdfBytes);
  const blob = new Blob([normalizedPdfBytes], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);
  const filename = `crystal-invoice-${orderCode}.pdf`;

  const popup = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!popup) {
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename;
    anchor.click();
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 60_000);
}
