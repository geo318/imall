"use client";

import jsPDF from "jspdf";
import type { CartItem } from "@/lib/api/cart";
import type { ShippingFormState } from "./types";

/**
 * Exact-match strategy:
 * Use the original scanned form as a full-page background image,
 * then place dynamic text into precise coordinates.
 */

export type CrystalTableRow = {
  itemName?: string;
  unit?: string;
  quantity?: string | number;
  price?: string | number;
  valueWithoutVat?: string | number;
  vatAmount?: string | number;
  totalWithVat?: string | number;
};

export type CrystalPdfData = {
  sellerHeader?: string;
  sellerSubHeader?: string;
  invoiceType?: string;
  invoiceNumber?: string;
  operationDate?: string;
  sellerName?: string;
  buyerName?: string;
  address?: string;
  sellerId?: string;
  buyerId?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  transportInfo?: string;
  basis?: string;
  waybillNumber?: string;
  waybillDate?: string;
  rows?: CrystalTableRow[];
  total?: string | number;
};

export type GenerateCrystalPdfOptions = {
  logoImageUrl?: string;
  templateImageUrl?: string;
  fileName?: string;
  openInNewTab?: boolean;
  offsets?: {
    x?: number;
    y?: number;
  };
};

export type PrintCrystalInstallmentInvoiceInput = {
  buyer: ShippingFormState;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  installmentCommission: number;
  total: number;
};

const A4_WIDTH = 210;
const A4_HEIGHT = 297;
const DEFAULT_TEMPLATE_IMAGE = "/templates/crystal-template.png";
const DEFAULT_FILE_NAME = "crystal-invoice.pdf";
const DEFAULT_LOGO_IMAGE = "/crystal-bank-logo.png";
const DEFAULT_FONT_REGULAR_URL = "/fonts/Firago-Regular.ttf";
const DEFAULT_FONT_BOLD_URL = "/fonts/Firago-SemiBold.ttf";
const PDF_FONT_FAMILY = "Firago";
const PDF_FONT_REGULAR_FILE = "Firago-Regular.ttf";
const PDF_FONT_BOLD_FILE = "Firago-SemiBold.ttf";
const GEL_SYMBOL = "₾";
const IMALL_LEGAL_NAME = "შპს ონლაინ შოპინგის პლატფორმა";
const IMALL_COMPANY_ID = "416393478";
const IMALL_BRAND_NAME = "iMall";
const IMALL_CONTACT_EMAIL = "contact@imall.ge";
const TEMPLATE_CANDIDATES = [
  "/templates/crystal-template.png",
  "/crystal-installment-template.png",
] as const;
let georgianFontDataPromise: Promise<{ regular: string; bold: string } | null> | null = null;

function formatMoney(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function withGelSymbol(value: string) {
  const normalized = value.trim();
  if (!normalized) return normalized;
  if (normalized.includes(GEL_SYMBOL)) return normalized;
  return `${normalized} ${GEL_SYMBOL}`;
}

function formatMoneyWithGel(value: number) {
  return withGelSymbol(formatMoney(value));
}

function normalizeMoneyCell(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return value;
  if (typeof value === "number") {
    return formatMoneyWithGel(value);
  }
  return withGelSymbol(value);
}

function drawText(
  pdf: jsPDF,
  text: string | number | undefined,
  x: number,
  y: number,
  options?: {
    fontSize?: number;
    maxWidth?: number;
    align?: "left" | "center" | "right";
    bold?: boolean;
    fontFamily?: string;
  },
) {
  if (text === undefined || text === null || text === "") return;

  const value = String(text);
  pdf.setFont(options?.fontFamily ?? "helvetica", options?.bold ? "bold" : "normal");
  pdf.setFontSize(options?.fontSize ?? 9);

  if (options?.maxWidth) {
    const lines = pdf.splitTextToSize(value, options.maxWidth);
    pdf.text(lines, x, y, { align: options?.align ?? "left" });
    return;
  }

  pdf.text(value, x, y, { align: options?.align ?? "left" });
}

function arrayBufferToBinaryString(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return binary;
}

async function loadImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load template image: ${url}`);
  }

  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadBinaryAsset(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load binary asset: ${url}`);
  }
  const buffer = await response.arrayBuffer();
  return arrayBufferToBinaryString(buffer);
}

async function resolveGeorgianFontFamily(pdf: jsPDF) {
  try {
    if (!georgianFontDataPromise) {
      georgianFontDataPromise = Promise.all([
        loadBinaryAsset(DEFAULT_FONT_REGULAR_URL),
        loadBinaryAsset(DEFAULT_FONT_BOLD_URL),
      ])
        .then(([regular, bold]) => ({ regular, bold }))
        .catch(() => null);
    }

    const fontData = await georgianFontDataPromise;
    if (!fontData) {
      return "helvetica";
    }

    pdf.addFileToVFS(PDF_FONT_REGULAR_FILE, fontData.regular);
    pdf.addFont(PDF_FONT_REGULAR_FILE, PDF_FONT_FAMILY, "normal");
    pdf.addFileToVFS(PDF_FONT_BOLD_FILE, fontData.bold);
    pdf.addFont(PDF_FONT_BOLD_FILE, PDF_FONT_FAMILY, "bold");
    return PDF_FONT_FAMILY;
  } catch {
    return "helvetica";
  }
}

async function resolveTemplateImage(
  preferredTemplateImageUrl?: string,
): Promise<{ sourceUrl: string; dataUrl: string } | null> {
  const candidates = Array.from(
    new Set(
      [preferredTemplateImageUrl, ...TEMPLATE_CANDIDATES].filter((value): value is string =>
        Boolean(value),
      ),
    ),
  );

  for (const url of candidates) {
    try {
      return { sourceUrl: url, dataUrl: await loadImageAsDataUrl(url) };
    } catch {
      // try next candidate
    }
  }

  return null;
}

function drawFallbackTemplateBackground(pdf: jsPDF) {
  // Base frame
  pdf.setDrawColor(30, 30, 30);
  pdf.setLineWidth(0.3);
  pdf.rect(8, 8, A4_WIDTH - 16, A4_HEIGHT - 16);

  // Split layout lines matching the coordinate map used for dynamic text.
  pdf.line(108, 8, 108, 100);
  pdf.line(8, 46, 108, 46);
  pdf.line(108, 46, 202, 46);
  pdf.line(8, 100, 202, 100);

  // Table block
  pdf.rect(8, 115, A4_WIDTH - 16, 167);
  pdf.line(8, 125, A4_WIDTH - 8, 125);
  const colStops = [73, 92, 106, 122, 146, 170];
  for (const x of colStops) {
    pdf.line(x, 115, x, 282);
  }

  // Total box
  pdf.rect(170, 282, 32, 7);
}

function drawTableHeader(
  draw: (
    text: string | number | undefined,
    x: number,
    y: number,
    options?: {
      fontSize?: number;
      maxWidth?: number;
      align?: "left" | "center" | "right";
      bold?: boolean;
    },
  ) => void,
) {
  // Table header is slightly raised so rows sit tighter under it.
  const headerY = 120;

  draw("ნივთის დასახელება", 12, headerY, { fontSize: 7, maxWidth: 58, bold: true });
  draw("ერთეული", 82.5, headerY, { fontSize: 7, maxWidth: 14, align: "center", bold: true });
  draw("რაოდ.", 99, headerY, { fontSize: 7, maxWidth: 10, align: "center", bold: true });
  draw("ფასი", 114, headerY, { fontSize: 7, maxWidth: 14, align: "center", bold: true });
  draw("ღირებ. დღგ-ს გარეშე", 134, headerY, {
    fontSize: 7,
    maxWidth: 20,
    align: "center",
    bold: true,
  });
  draw("დღგ", 158, headerY, { fontSize: 7, maxWidth: 20, align: "center", bold: true });
  draw("სულ", 186, headerY, { fontSize: 7, maxWidth: 28, align: "center", bold: true });
}

function drawBuyerPanel(
  draw: (
    text: string | number | undefined,
    x: number,
    y: number,
    options?: {
      fontSize?: number;
      maxWidth?: number;
      align?: "left" | "center" | "right";
      bold?: boolean;
    },
  ) => void,
  data: CrystalPdfData,
  ox: number,
  oy: number,
) {
  const rightX = 114 + ox;
  const startY = 55 + oy;
  const lineGap = 7;
  const labelWidth = 34;
  const valueWidth = 49;
  const fields = [
    { label: "მყიდველი:", value: data.buyerName },
    { label: "პირადი ნომერი:", value: data.buyerId },
    { label: "მისამართი:", value: data.address },
    { label: "ტელეფონი:", value: data.buyerPhone },
    { label: "ელ-ფოსტა:", value: data.buyerEmail },
  ];

  for (const [index, field] of fields.entries()) {
    const y = startY + index * lineGap;
    draw(field.label, rightX, y, { fontSize: 8, maxWidth: labelWidth, bold: true });
    draw(field.value, rightX + labelWidth, y, { fontSize: 8, maxWidth: valueWidth });
  }
}

export async function generateCrystalTemplatePdf(
  data: CrystalPdfData,
  options?: GenerateCrystalPdfOptions,
) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const fontFamily = await resolveGeorgianFontFamily(pdf);
  const draw = (
    text: string | number | undefined,
    x: number,
    y: number,
    options?: {
      fontSize?: number;
      maxWidth?: number;
      align?: "left" | "center" | "right";
      bold?: boolean;
    },
  ) => drawText(pdf, text, x, y, { ...options, fontFamily });

  const resolvedTemplate = await resolveTemplateImage(
    options?.templateImageUrl ?? DEFAULT_TEMPLATE_IMAGE,
  );
  const logoImageUrl = options?.logoImageUrl ?? DEFAULT_LOGO_IMAGE;
  const logoImage = logoImageUrl ? await loadImageAsDataUrl(logoImageUrl).catch(() => null) : null;

  if (resolvedTemplate) {
    pdf.addImage(resolvedTemplate.dataUrl, "PNG", 0, 0, A4_WIDTH, A4_HEIGHT, undefined, "FAST");
  } else {
    drawFallbackTemplateBackground(pdf);
  }

  if (logoImage) {
    pdf.addImage(logoImage, "PNG", 13, 11, 41, 8, undefined, "FAST");
  }

  const ox = options?.offsets?.x ?? 0;
  const oy = options?.offsets?.y ?? 0;
  const invoiceTitle = data.operationDate
    ? `${data.invoiceType ?? "ინვოისი"} - ${data.operationDate}`
    : (data.invoiceType ?? "ინვოისი");

  draw(data.sellerHeader, 14 + ox, 29 + oy, { fontSize: 8, maxWidth: 92 });
  draw(data.sellerSubHeader, 14 + ox, 35 + oy, { fontSize: 8, maxWidth: 92 });
  draw(invoiceTitle, 118 + ox, 29 + oy, { fontSize: 10, maxWidth: 84, bold: true });
  draw(data.invoiceNumber, 118 + ox, 35 + oy, { fontSize: 9, maxWidth: 84, bold: true });

  draw(data.invoiceNumber, 29 + ox, 55 + oy, {
    fontSize: 10,
    maxWidth: 36,
    align: "center",
  });
  draw(data.sellerName, 14 + ox, 62 + oy, { fontSize: 9, maxWidth: 86 });
  // draw(data.address, 14 + ox, 69 + oy, { fontSize: 9, maxWidth: 86 });
  draw(data.sellerId, 14 + ox, 69 + oy, { fontSize: 9, maxWidth: 86 });
  draw(data.transportInfo, 14 + ox, 76 + oy, { fontSize: 9, maxWidth: 86 });

  draw(data.basis, 14 + ox, 83 + oy, { fontSize: 9, maxWidth: 85 });
  draw(data.waybillNumber, 24 + ox, 168.3 + oy, { fontSize: 9, maxWidth: 42 });
  draw(data.waybillDate, 78 + ox, 168.3 + oy, { fontSize: 9, maxWidth: 18 });
  drawBuyerPanel(draw, data, ox, oy);
  drawTableHeader(draw);

  const rows = data.rows ?? [];
  // Move rows up and keep all numeric content inside column bounds.
  const rowStartY = 130;
  const rowHeight = 8.8;
  const colX = {
    itemName: 14,
    unit: 82.5,
    quantity: 98,
    price: 120,
    valueWithoutVat: 144,
    vatAmount: 168,
    totalWithVat: 200,
  };

  rows.slice(0, 8).forEach((row, index) => {
    const y = rowStartY + index * rowHeight + oy;

    draw(row.itemName, colX.itemName + ox, y, { fontSize: 8.3, maxWidth: 56 });
    draw(row.unit, colX.unit + ox, y, { fontSize: 8.5, maxWidth: 14, align: "center" });
    draw(row.quantity, colX.quantity + ox, y, {
      fontSize: 8.5,
      maxWidth: 10,
      align: "center",
    });
    draw(normalizeMoneyCell(row.price), colX.price + ox, y, {
      fontSize: 8.5,
      maxWidth: 14,
      align: "right",
    });
    draw(normalizeMoneyCell(row.valueWithoutVat), colX.valueWithoutVat + ox, y, {
      fontSize: 8.5,
      maxWidth: 20,
      align: "right",
    });
    draw(normalizeMoneyCell(row.vatAmount), colX.vatAmount + ox, y, {
      fontSize: 8.5,
      maxWidth: 20,
      align: "right",
    });
    draw(normalizeMoneyCell(row.totalWithVat), colX.totalWithVat + ox, y, {
      fontSize: 8.5,
      maxWidth: 28,
      align: "right",
    });
  });

  draw(normalizeMoneyCell(data.total), 200 + ox, 286 + oy, {
    fontSize: 10,
    maxWidth: 28,
    align: "right",
    bold: true,
  });

  if (options?.openInNewTab) {
    pdf.output("dataurlnewwindow");
    return pdf;
  }

  pdf.save(options?.fileName ?? DEFAULT_FILE_NAME);
  return pdf;
}

function calculateVat(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return amount * 0.18;
}

function buildCrystalPdfData(
  input: PrintCrystalInstallmentInvoiceInput,
  orderCode: string,
  operationDate: string,
): CrystalPdfData {
  const vatEnabled = false;
  const resolveVat = (amount: number) => (vatEnabled ? calculateVat(amount) : 0);
  const lineRows: CrystalTableRow[] = input.items.map((item) => {
    const qty = Number(item.qty ?? 0);
    const price = Number(item.price ?? 0);
    const valueWithoutVat = qty * price;
    const vatAmount = resolveVat(valueWithoutVat);
    const totalWithVat = valueWithoutVat + vatAmount;
    return {
      itemName: item.productTitle ?? "პროდუქტი",
      unit: "ც",
      quantity: qty,
      price: formatMoneyWithGel(price),
      valueWithoutVat: formatMoneyWithGel(valueWithoutVat),
      vatAmount: formatMoneyWithGel(vatAmount),
      totalWithVat: formatMoneyWithGel(totalWithVat),
    };
  });

  if (input.shipping > 0) {
    lineRows.push({
      itemName: "მიწოდება",
      unit: "ც",
      quantity: 1,
      price: formatMoneyWithGel(input.shipping),
      valueWithoutVat: formatMoneyWithGel(input.shipping),
      vatAmount: formatMoneyWithGel(resolveVat(input.shipping)),
      totalWithVat: formatMoneyWithGel(input.shipping + resolveVat(input.shipping)),
    });
  }

  if (input.installmentCommission > 0) {
    lineRows.push({
      itemName: "განვადების საკომისიო",
      unit: "ც",
      quantity: 1,
      price: formatMoneyWithGel(input.installmentCommission),
      valueWithoutVat: formatMoneyWithGel(input.installmentCommission),
      vatAmount: formatMoneyWithGel(resolveVat(input.installmentCommission)),
      totalWithVat: formatMoneyWithGel(
        input.installmentCommission + resolveVat(input.installmentCommission),
      ),
    });
  }

  const buyerName = `${input.buyer.firstName} ${input.buyer.lastName}`.trim();
  const address = [input.buyer.address, input.buyer.city, input.buyer.state]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
  const buyerPhone = input.buyer.phone.trim();
  const buyerEmail = input.buyer.email.trim();

  return {
    sellerHeader: `პარტნიორი - ${IMALL_LEGAL_NAME}`,
    sellerSubHeader: `ს/კ ${IMALL_COMPANY_ID}`,
    invoiceType: "ინვოისი",
    invoiceNumber: orderCode,
    operationDate,
    sellerName: `${IMALL_BRAND_NAME} (${IMALL_LEGAL_NAME})`,
    buyerName: buyerName || undefined,
    address: address || undefined,
    sellerId: IMALL_COMPANY_ID,
    buyerId: undefined,
    buyerPhone: buyerPhone || undefined,
    buyerEmail: buyerEmail || undefined,
    transportInfo: IMALL_CONTACT_EMAIL,
    basis: 'სს "კრისტალი"',
    waybillNumber: undefined,
    waybillDate: undefined,
    rows: lineRows,
    total: formatMoneyWithGel(input.total),
  };
}

export async function printCrystalInstallmentInvoice(input: PrintCrystalInstallmentInvoiceInput) {
  if (typeof window === "undefined") return;

  const now = new Date();
  const formattedDay = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const sequence = String(now.getTime()).slice(-4);
  const orderCode = `CRY-${formattedDay}-${sequence}`;
  const operationDate = now.toLocaleDateString("ka-GE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const payload = buildCrystalPdfData(input, orderCode, operationDate);
  await generateCrystalTemplatePdf(payload, {
    fileName: `crystal-invoice-${orderCode}.pdf`,
    templateImageUrl: DEFAULT_TEMPLATE_IMAGE,
    openInNewTab: true,
  });
}
