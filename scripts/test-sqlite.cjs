const path = require("path");
const fs = require("fs");
const os = require("os");
const {
  initDatabase,
  getNextInvoiceNumber,
  productsApi,
  invoicesApi,
  deletedInvoicesApi,
  employeesApi,
  categoriesApi,
  closedDaysApi,
  expensesApi,
  archivedSalesApi,
  settingsApi,
  backupsApi,
  runMigrationIfNeeded
} = require("../electron/database.cjs");

async function runTests() {
  console.log("=================================================");
  console.log("   GALLERY ANTO - SQLITE PERSISTENCE TEST SUITE  ");
  console.log("=================================================\n");

  const testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "anto-sqlite-test-"));
  console.log(`[1/8] Initializing test SQLite database in: ${testTempDir}`);
  initDatabase(testTempDir);
  console.log("✅ Database initialized with WAL mode & foreign keys.\n");

  // TEST 1: Products CRUD
  console.log("[2/8] Testing Products CRUD...");
  const p1 = productsApi.create({
    id: "prod-101",
    name: "فازة كريستال بوهيمي",
    price: 450,
    basePrice: 300,
    barcode: "62210001",
    stock: 25,
    minStockAlert: 5,
    category: "ڤازات",
    createdAt: Date.now()
  });
  console.log("  -> Inserted product:", p1.name, "(Stock:", p1.stock, ")");

  const p2 = productsApi.create({
    id: "prod-102",
    name: "ساعة حائط كلاسيك خشب",
    price: 850,
    basePrice: 600,
    barcode: "62210002",
    stock: 10,
    minStockAlert: 2,
    category: "ساعات",
    createdAt: Date.now()
  });
  console.log("  -> Inserted product:", p2.name, "(Stock:", p2.stock, ")");

  productsApi.update({
    id: "prod-101",
    name: "فازة كريستال بوهيمي مطلية ذهب",
    price: 500,
    basePrice: 320,
    barcode: "62210001",
    stock: 30,
    minStockAlert: 5,
    category: "ڤازات"
  });
  const updatedP1 = productsApi.getById("prod-101");
  if (updatedP1.price !== 500 || updatedP1.stock !== 30) {
    throw new Error("❌ Product update failed!");
  }
  console.log("✅ Product CRUD test passed successfully.\n");

  // TEST 2: Sequence and Invoice Generation
  console.log("[3/8] Testing Invoice Sequence & Atomic Checkout Transaction...");
  const seq1 = getNextInvoiceNumber();
  const seq2 = getNextInvoiceNumber();
  console.log(`  -> Generated Sequences: ${seq1}, ${seq2}`);
  if (seq1 !== "ANTO-0001" || seq2 !== "ANTO-0002") {
    throw new Error(`❌ Sequence generation mismatch: ${seq1}, ${seq2}`);
  }

  const invoiceData = {
    id: "inv-test-1",
    invoiceNumber: "ANTO-0003",
    timestamp: Date.now(),
    formattedDate: "2026-08-14",
    formattedTime: "10:30 ص",
    total: 1000,
    subtotal: 1000,
    discount: 0,
    paymentMethod: "كاش",
    sellerName: "عمرو",
    items: [
      { productId: "prod-101", name: "فازة كريستال بوهيمي مطلية ذهب", price: 500, quantity: 2, basePrice: 320 }
    ]
  };

  const initialStock = productsApi.getById("prod-101").stock; // 30
  const createdInv = invoicesApi.createTransaction(invoiceData);
  const afterCheckoutStock = productsApi.getById("prod-101").stock; // should be 28

  console.log(`  -> Stock before: ${initialStock}, after checkout: ${afterCheckoutStock}`);
  if (afterCheckoutStock !== 28) {
    throw new Error(`❌ Stock was not deducted properly! Expected 28, got ${afterCheckoutStock}`);
  }
  if (!createdInv || createdInv.items.length !== 1) {
    throw new Error("❌ Invoice creation transaction failed!");
  }
  console.log("✅ Atomic Checkout Transaction passed.\n");

  // TEST 3: Insufficient Stock Rollback Test
  console.log("[4/8] Testing Transaction Rollback on Insufficient Stock...");
  try {
    invoicesApi.createTransaction({
      id: "inv-fail",
      invoiceNumber: "ANTO-0004",
      timestamp: Date.now(),
      formattedDate: "2026-08-14",
      formattedTime: "10:35 ص",
      total: 50000,
      paymentMethod: "كاش",
      items: [
        { productId: "prod-101", name: "فازة كريستال بوهيمي", price: 500, quantity: 9999 }
      ]
    });
    throw new Error("❌ Transaction should have failed due to insufficient stock!");
  } catch (err) {
    console.log("  -> Caught expected error:", err.message);
    const unchangedStock = productsApi.getById("prod-101").stock;
    if (unchangedStock !== 28) {
      throw new Error("❌ Stock was altered despite transaction error!");
    }
    console.log("✅ Rollback verified: Stock remained exactly at 28.\n");
  }

  // TEST 4: Invoice Deletion & Stock Restoration
  console.log("[5/8] Testing Invoice Deletion Transaction & Stock Restoration...");
  invoicesApi.deleteTransaction("inv-test-1");
  const restoredStock = productsApi.getById("prod-101").stock;
  console.log(`  -> Stock after invoice cancellation: ${restoredStock}`);
  if (restoredStock !== 30) {
    throw new Error(`❌ Stock was not restored on invoice deletion! Expected 30, got ${restoredStock}`);
  }

  const deletedInvs = deletedInvoicesApi.getAll();
  console.log(`  -> Archived deleted invoices count: ${deletedInvs.length}`);
  if (deletedInvs.length !== 1 || deletedInvs[0].id !== "inv-test-1") {
    throw new Error("❌ Deleted invoice was not properly archived in deleted_invoices table!");
  }
  console.log("✅ Invoice Deletion & Stock Restoration passed.\n");

  // TEST 5: Closed Shift & Expenses
  console.log("[6/8] Testing Expenses & Shift Settlement...");
  const exp1 = expensesApi.create({
    id: "exp-1",
    title: "شحن بضائع",
    amount: 150,
    timestamp: Date.now(),
    formattedDate: "2026-08-14",
    formattedTime: "11:00 ص",
    notes: "فاتورة شحن الصعيد",
    sellerName: "عمرو"
  });

  const invShift = invoicesApi.createTransaction({
    id: "inv-shift-1",
    invoiceNumber: "ANTO-0005",
    timestamp: Date.now(),
    formattedDate: "2026-08-14",
    formattedTime: "11:30 ص",
    total: 850,
    subtotal: 850,
    discount: 0,
    paymentMethod: "كاش",
    sellerName: "عمرو",
    items: [
      { productId: "prod-102", name: "ساعة حائط كلاسيك خشب", price: 850, quantity: 1, basePrice: 600 }
    ]
  });

  const closedDayRes = closedDaysApi.create({
    id: "day-close-1",
    timestamp: Date.now(),
    formattedDate: "الجمعة 14 أغسطس 2026",
    formattedTime: "11:45 ص",
    totalSales: 850,
    totalExpenses: 150,
    netSales: 700,
    invoiceCount: 1,
    invoiceIds: ["inv-shift-1"]
  });

  const allClosed = closedDaysApi.getAll();
  console.log(`  -> Shift closed with Net Sales: ${allClosed[0].netSales} EGP`);
  if (allClosed.length !== 1 || allClosed[0].netSales !== 700) {
    throw new Error("❌ Shift settlement failed!");
  }
  console.log("✅ Expenses and Shift settlement passed.\n");

  // TEST 6: Backup & Restore Engine
  console.log("[7/8] Testing SQLite Backup & Restore Engine...");
  const backupRes = backupsApi.createBackup();
  if (!backupRes.success) {
    throw new Error(`❌ Backup creation failed: ${backupRes.error}`);
  }
  console.log(`  -> Backup created: ${backupRes.filename}`);
  const backupsList = backupsApi.listBackups();
  if (backupsList.length === 0) {
    throw new Error("❌ Backups list is empty!");
  }

  // Add dummy product then restore
  productsApi.create({ id: "prod-temp", name: "منتج مؤقت للحذف", price: 10, stock: 1 });
  const restoreRes = backupsApi.restoreBackup(backupRes.filename);
  if (!restoreRes.success) {
    throw new Error(`❌ Backup restore failed: ${restoreRes.error}`);
  }
  const checkRestored = productsApi.getById("prod-temp");
  if (checkRestored !== null) {
    throw new Error("❌ Database state was not restored cleanly!");
  }
  console.log("✅ Backup & Restore verified successfully.\n");

  // TEST 7: Stress Testing (1,000 Products + 5,000 Invoices)
  console.log("[8/8] Performing Performance & Volume Stress Test...");
  console.log("  -> Generating 1,000 products...");
  const startProdTime = Date.now();
  for (let i = 1; i <= 1000; i++) {
    productsApi.create({
      id: `stress-prod-${i}`,
      name: `صنف تحفة رقم ${i}`,
      price: 100 + (i % 50) * 10,
      basePrice: 80,
      barcode: `STR-${String(i).padStart(6, "0")}`,
      stock: 500,
      minStockAlert: 10,
      category: i % 2 === 0 ? "انتيكات" : "ڤازات"
    });
  }
  console.log(`  -> 1,000 Products inserted in ${(Date.now() - startProdTime)}ms.`);

  console.log("  -> Generating 2,000 atomic invoices with stock deduction...");
  const startInvTime = Date.now();
  for (let i = 1; i <= 2000; i++) {
    const targetProdId = `stress-prod-${(i % 1000) + 1}`;
    invoicesApi.createTransaction({
      id: `stress-inv-${i}`,
      invoiceNumber: `ANTO-${String(10000 + i)}`,
      timestamp: Date.now() - (2000 - i) * 60000,
      formattedDate: "2026-08-14",
      formattedTime: "12:00 م",
      total: 200,
      subtotal: 200,
      discount: 0,
      paymentMethod: i % 3 === 0 ? "فيزا" : "كاش",
      sellerName: i % 2 === 0 ? "بيشوي" : "أنطو",
      items: [
        { productId: targetProdId, name: `صنف تحفة رقم ${(i % 1000) + 1}`, price: 200, quantity: 1, basePrice: 150 }
      ]
    });
  }
  console.log(`  -> 2,000 Invoices created atomically in ${(Date.now() - startInvTime)}ms.`);

  const queryStart = Date.now();
  const searchResults = invoicesApi.getAll({ search: "بيشوي", page: 1, limit: 50 });
  console.log(`  -> Query + Search across 2,000 invoices completed in ${(Date.now() - queryStart)}ms. Returned ${searchResults.length} records.`);

  console.log("\n=================================================");
  console.log("🎉 ALL SQLITE PERSISTENCE & STRESS TESTS PASSED! ");
  console.log("=================================================\n");
}

runTests().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
