import { Product, Invoice } from "./types";

// Helper to generate a sequential barcode
export function generateBarcode(products?: Product[]): string {
  if (!products || products.length === 0) {
    return "1";
  }
  const numericCodes = products
    .map(p => {
      // Clean up any non-numeric characters if present
      const clean = p.barcode.replace(/\D/g, "");
      return parseInt(clean, 10);
    })
    .filter(b => !isNaN(b));
  const max = numericCodes.length > 0 ? Math.max(...numericCodes) : 0;
  return (max + 1).toString();
}

// Preset modern images for luxury decor
export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod-1",
    name: "لوحة زيتية تجريدية - ألوان الغسق",
    price: 3200,
    basePrice: 3200,
    barcode: "1",
    stock: 12,
    minStockAlert: 3,
    image: "https://images.unsplash.com/photo-1549887534-1541e9326642?w=400&auto=format&fit=crop&q=60",
    category: "براويز",
  },
  {
    id: "prod-2",
    name: "فازة سيراميك يدوية الصنع أسود ملكي",
    price: 850,
    basePrice: 850,
    barcode: "2",
    stock: 25,
    minStockAlert: 5,
    image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=400&auto=format&fit=crop&q=60",
    category: "ڤازات",
  },
  {
    id: "prod-3",
    name: "أباجورة مكتب نحاسية بتصميم كلاسيكي",
    price: 1850,
    basePrice: 1850,
    barcode: "3",
    stock: 7,
    minStockAlert: 2,
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&auto=format&fit=crop&q=60",
    category: "انتيكات",
  },
  {
    id: "prod-4",
    name: "ساعة حائط كلاسيكية خشب القيقب",
    price: 2100,
    basePrice: 2100,
    barcode: "4",
    stock: 2, // Low stock on purpose to trigger alerts!
    minStockAlert: 4,
    image: "https://images.unsplash.com/photo-1563861826100-9cb868fdcd1d?w=400&auto=format&fit=crop&q=60",
    category: "ساعات",
  },
  {
    id: "prod-5",
    name: "شمعة معطرة بنكهة العود والمسك الملكي",
    price: 450,
    basePrice: 450,
    barcode: "5",
    stock: 40,
    minStockAlert: 10,
    image: "https://images.unsplash.com/photo-1603006905003-be475563bc59?w=400&auto=format&fit=crop&q=60",
    category: "شمعدان",
  },
  {
    id: "prod-6",
    name: "تمثال منحوت من الرخام الأبيض الفاخر",
    price: 4800,
    basePrice: 4800,
    barcode: "6",
    stock: 5,
    minStockAlert: 2,
    image: "https://images.unsplash.com/photo-1605722243979-fe0be8158232?w=400&auto=format&fit=crop&q=60",
    category: "مجسمات",
  },
];

// Seed some highly realistic past invoices to make stats look pristine out of the box
export function getInitialInvoices(products: Product[]): Invoice[] {
  const now = new Date();
  
  // Formatters with clear Arabic names for days/months
  const arabicDayFormatter = new Intl.DateTimeFormat("ar-EG", { weekday: "long" });
  const arabicDateFormatter = new Intl.DateTimeFormat("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  
  const getFormattedDateStr = (date: Date) => {
    return `${arabicDayFormatter.format(date)}، ${arabicDateFormatter.format(date)}`;
  };
  
  const getFormattedTimeStr = (date: Date) => {
    return date.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  // 1. Invoice from today
  const today1 = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
  const p1 = products[0] || INITIAL_PRODUCTS[0];
  const p2 = products[1] || INITIAL_PRODUCTS[1];
  
  const invToday1: Invoice = {
    id: "inv-1",
    invoiceNumber: "ANTO-0001",
    timestamp: today1.getTime(),
    formattedDate: getFormattedDateStr(today1),
    formattedTime: getFormattedTimeStr(today1),
    items: [
      { productId: p1.id, name: p1.name, price: p1.price, quantity: 1 },
      { productId: p2.id, name: p2.name, price: p2.price, quantity: 2 },
    ],
    total: p1.price * 1 + p2.price * 2,
  };

  // 2. Another invoice from today
  const today2 = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4 hours ago
  const p5 = products[4] || INITIAL_PRODUCTS[4];
  
  const invToday2: Invoice = {
    id: "inv-2",
    invoiceNumber: "ANTO-0002",
    timestamp: today2.getTime(),
    formattedDate: getFormattedDateStr(today2),
    formattedTime: getFormattedTimeStr(today2),
    items: [
      { productId: p5.id, name: p5.name, price: p5.price, quantity: 3 },
    ],
    total: p5.price * 3,
  };

  // 3. Invoice from 3 days ago (this month)
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const p3 = products[2] || INITIAL_PRODUCTS[2];
  
  const invPast1: Invoice = {
    id: "inv-3",
    invoiceNumber: "ANTO-0003",
    timestamp: threeDaysAgo.getTime(),
    formattedDate: getFormattedDateStr(threeDaysAgo),
    formattedTime: getFormattedTimeStr(threeDaysAgo),
    items: [
      { productId: p3.id, name: p3.name, price: p3.price, quantity: 1 },
      { productId: p2.id, name: p2.name, price: p2.price, quantity: 1 },
    ],
    total: p3.price * 1 + p2.price * 1,
  };

  // 4. Invoice from 10 days ago (this month)
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  
  const invPast2: Invoice = {
    id: "inv-4",
    invoiceNumber: "ANTO-0004",
    timestamp: tenDaysAgo.getTime(),
    formattedDate: getFormattedDateStr(tenDaysAgo),
    formattedTime: getFormattedTimeStr(tenDaysAgo),
    items: [
      { productId: p1.id, name: p1.name, price: p1.price, quantity: 2 },
    ],
    total: p1.price * 2,
  };

  return [invToday1, invToday2, invPast1, invPast2];
}
