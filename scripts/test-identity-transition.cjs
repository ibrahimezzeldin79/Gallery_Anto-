const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  initDatabase,
  productsApi,
  invoicesApi,
  employeesApi,
  categoriesApi,
  closedDaysApi,
  expensesApi,
  backupsApi
} = require("../electron/database.cjs");
const { LanTransport } = require("../electron/realtime/lanTransport.cjs");

const FUTURE_IDENTITY = {
  appId: "com.galleryanto.pos",
  productName: "Gallery ANTO POS"
};

function assertFile(filePath, message) {
  assert.ok(fs.existsSync(filePath), `${message}: ${filePath}`);
}

function createFixtureData(root) {
  initDatabase(root);

  productsApi.create({
    id: "test-product-1",
    name: "Transition Test Product",
    price: 125,
    basePrice: 90,
    barcode: "TRANSITION-001",
    stock: 10,
    minStockAlert: 2,
    category: "Test Category",
    image: "images/transition-test.png",
    createdAt: Date.now()
  });
  employeesApi.create("Transition Test Employee");
  categoriesApi.create("Test Category");
  invoicesApi.createTransaction({
    id: "test-invoice-1",
    invoiceNumber: "ANTO-9001",
    timestamp: Date.now(),
    formattedDate: "2026-09-18",
    formattedTime: "12:00",
    total: 250,
    subtotal: 250,
    discount: 0,
    paymentMethod: "Cash",
    sellerName: "Transition Test Employee",
    items: [
      {
        productId: "test-product-1",
        name: "Transition Test Product",
        price: 125,
        quantity: 2,
        basePrice: 90
      }
    ]
  });
  expensesApi.create({
    id: "test-expense-1",
    title: "Transition Test Expense",
    amount: 25,
    timestamp: Date.now(),
    formattedDate: "2026-09-18",
    formattedTime: "12:05",
    notes: "Isolated test data",
    sellerName: "Transition Test Employee"
  });
  closedDaysApi.create({
    id: "test-closed-day-1",
    timestamp: Date.now(),
    formattedDate: "2026-09-18",
    formattedTime: "12:10",
    totalSales: 250,
    totalExpenses: 25,
    netSales: 225,
    invoiceCount: 1,
    invoiceIds: ["test-invoice-1"]
  });

  const imagesDir = path.join(root, "data", "images");
  fs.writeFileSync(path.join(imagesDir, "transition-test.png"), crypto.randomBytes(32));

  const backupResult = backupsApi.createBackup();
  assert.strictEqual(backupResult.success, true, "Fixture backup creation failed");
}

function createFixtureInChild(root) {
  const result = childProcess.spawnSync(process.execPath, [__filename, "create-fixture", root], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`Fixture creation failed:\n${result.stdout}\n${result.stderr}`);
  }
}

async function runLanTest(root) {
  const host = new LanTransport({
    deviceIdProvider: () => "transition-host",
    dataDirectory: path.join(root, "lan-host"),
    allowMutations: false
  });
  const client = new LanTransport({
    deviceIdProvider: () => "transition-client",
    dataDirectory: path.join(root, "lan-client"),
    allowMutations: false
  });

  assert.strictEqual(host.allowMutations, false, "LAN host mutations must remain disabled");
  assert.strictEqual(client.allowMutations, false, "LAN client mutations must remain disabled");

  await host.startHost({ host: "127.0.0.1", port: 0 });
  const pairing = host.createPairingCode();
  const hostPort = host.getStatus().connectionInfo.port;
  await client.connect({ host: "127.0.0.1", port: hostPort, pairingCode: pairing.code });
  const acknowledgement = await client.sendTestMessage({ source: "identity-transition-test" });
  const received = host.getLastTestMessage();

  assert.strictEqual(acknowledgement.status, "received", "LAN test acknowledgement was not received");
  assert.strictEqual(received.payload.testOnly, true, "LAN test message was not test-only");
  assert.strictEqual(host.confirmTestMessage(received.testId), true, "LAN test message was not confirmed");

  await client.disconnect();
  await host.stopHost();
}

async function runTest() {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gallery-anto-identity-transition-"));
  const fixtureRoot = path.join(testRoot, "fixture-source");
  const legacyRoot = path.join(testRoot, "react-example");
  const unintendedRoot = path.join(testRoot, "GalleryANTOData");
  const unintendedProductRoot = path.join(testRoot, "Gallery ANTO POS");

  createFixtureInChild(fixtureRoot);
  fs.cpSync(fixtureRoot, legacyRoot, { recursive: true });

  const databasePath = path.join(legacyRoot, "data", "gallery_anto.sqlite");
  const imagePath = path.join(legacyRoot, "data", "images", "transition-test.png");
  assertFile(databasePath, "Copied test database is missing");
  assertFile(imagePath, "Copied test image is missing");

  initDatabase(legacyRoot);

  const products = productsApi.getAll();
  const invoices = invoicesApi.getAll();
  const employees = employeesApi.getAll();
  const categories = categoriesApi.getAll();
  const expenses = expensesApi.getAll();
  const closedDays = closedDaysApi.getAll();
  const backups = backupsApi.listBackups();

  assert.strictEqual(FUTURE_IDENTITY.appId, "com.galleryanto.pos");
  assert.strictEqual(FUTURE_IDENTITY.productName, "Gallery ANTO POS");
  assert.strictEqual(products.some((item) => item.id === "test-product-1"), true, "Existing product was not readable");
  assert.strictEqual(invoices.some((item) => item.id === "test-invoice-1"), true, "Existing invoice was not readable");
  assert.strictEqual(employees.some((item) => item.name === "Transition Test Employee"), true, "Existing employee was not readable");
  assert.strictEqual(categories.includes("Test Category"), true, "Existing category was not readable");
  assert.strictEqual(expenses.some((item) => item.id === "test-expense-1"), true, "Existing expense was not readable");
  assert.strictEqual(closedDays.some((item) => item.id === "test-closed-day-1"), true, "Existing closed day was not readable");
  assert.ok(backups.length > 0, "Existing backup was not readable");
  assertFile(imagePath, "Existing image was not readable after reopen");
  assert.strictEqual(fs.existsSync(unintendedRoot), false, "An unintended GalleryANTOData root was created");
  assert.strictEqual(fs.existsSync(unintendedProductRoot), false, "An unintended product-name root was created");

  await runLanTest(testRoot);

  console.log("IDENTITY_TRANSITION_TEST: PASS");
  console.log(`TEST_DATA_ROOT: ${testRoot}`);
  console.log(`LEGACY_DATA_ROOT_USED: ${legacyRoot}`);
  console.log(`DATABASE_USED: ${databasePath}`);
  console.log(`APP_ID_TESTED: ${FUTURE_IDENTITY.appId}`);
  console.log(`PRODUCT_NAME_TESTED: ${FUTURE_IDENTITY.productName}`);
  console.log("CUSTOMER_DATA_TOUCHED: false");
  console.log("PRODUCTION_INSTALLATION_TOUCHED: false");
  console.log("ELECTRON_UPDATER_CONFIGURED: false");
}

if (process.argv[2] === "create-fixture") {
  createFixtureData(process.argv[3]);
} else {
  runTest().catch((error) => {
    console.error("IDENTITY_TRANSITION_TEST: FAIL");
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
