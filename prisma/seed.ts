import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AccountType,
  CashFlowCategory,
  PrismaClient,
  Role,
  WorkflowEntityType,
} from "../src/generated/prisma";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // التعبئة تعمل على قاعدة فارغة فقط. بعد أول نشر تصبح البيانات بيانات المستخدم،
  // وإعادة التعبئة كانت ستعيد كتابة كلمات المرور وتُرجع العيّنات التي حذفها.
  const existing = await prisma.organization.count();
  if (existing > 0 && !process.env.FORCE_SEED) {
    console.log("⏭️  قاعدة البيانات مُعبّأة مسبقاً — تم التخطي.");
    return;
  }

  console.log("🌱 بدء تعبئة البيانات التجريبية...");

  const organization = await prisma.organization.upsert({
    where: { id: "org_default" },
    update: {},
    create: {
      id: "org_default",
      name: "شركة النموذج التجارية",
      legalName: "شركة النموذج التجارية المحدودة",
      taxNumber: "300000000000003",
      currency: "SAR",
      email: "info@example.com",
      phone: "+966500000000",
      address: "الرياض، المملكة العربية السعودية",
    },
  });

  // ---- المستخدمون ----
  const users: Array<{ name: string; email: string; role: Role }> = [
    { name: "مدير النظام", email: "admin@erp.local", role: Role.ADMIN },
    { name: "سعيد المحاسب", email: "accountant@erp.local", role: Role.ACCOUNTANT },
    { name: "نورة المبيعات", email: "sales@erp.local", role: Role.SALES },
    { name: "خالد المشتريات", email: "purchasing@erp.local", role: Role.PURCHASING },
    { name: "منى المستودع", email: "inventory@erp.local", role: Role.INVENTORY },
    { name: "هدى الموارد البشرية", email: "hr@erp.local", role: Role.HR },
  ];

  // كلمة المرور تُؤخذ من البيئة عند النشر، ويبقى الافتراضي للتطوير المحلي فقط.
  const seedPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123";
  const passwordHash = await bcrypt.hash(seedPassword, 10);
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { role: user.role, name: user.name },
      create: { ...user, passwordHash, organizationId: organization.id },
    });
  }

  // ---- العملات وأسعار الصرف ----
  const currencies = [
    { code: "SAR", name: "ريال سعودي", symbol: "ر.س", isBase: true },
    { code: "USD", name: "دولار أمريكي", symbol: "$", isBase: false },
    { code: "EUR", name: "يورو", symbol: "€", isBase: false },
    { code: "AED", name: "درهم إماراتي", symbol: "د.إ", isBase: false },
  ];
  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: { name: currency.name, symbol: currency.symbol, isBase: currency.isBase },
      create: currency,
    });
  }

  // أسعار صرف افتتاحية مقابل الريال (كم ريالاً تساوي وحدة واحدة من العملة)
  const openingRates: Record<string, number> = { USD: 3.75, EUR: 4.05, AED: 1.021 };
  const rateDate = new Date(Date.UTC(new Date().getFullYear(), 0, 1));
  for (const [code, rate] of Object.entries(openingRates)) {
    const currency = await prisma.currency.findUniqueOrThrow({ where: { code } });
    await prisma.exchangeRate.upsert({
      where: { currencyId_validFrom: { currencyId: currency.id, validFrom: rateDate } },
      update: { rate },
      create: { currencyId: currency.id, rate, validFrom: rateDate },
    });
  }

  // ---- الفروع ----
  const branches = [
    { code: "BR-RUH", name: "الفرع الرئيسي - الرياض", address: "الرياض - طريق الملك فهد" },
    { code: "BR-JED", name: "فرع جدة", address: "جدة - شارع التحلية" },
  ];
  for (const branch of branches) {
    await prisma.branch.upsert({
      where: { code: branch.code },
      update: {},
      create: branch,
    });
  }

  const mainBranch = await prisma.branch.findUniqueOrThrow({ where: { code: "BR-RUH" } });
  const jeddahBranch = await prisma.branch.findUniqueOrThrow({ where: { code: "BR-JED" } });

  // ربط المستخدمين بالفرع الرئيسي افتراضياً
  await prisma.user.updateMany({
    where: { branchId: null },
    data: { branchId: mainBranch.id },
  });

  // ---- دليل الحسابات ----
  // الحسابات الرئيسية أولاً، ثم الفرعية التي تشير إليها عبر parentCode
  const accounts: Array<{
    code: string;
    name: string;
    type: AccountType;
    parentCode?: string;
    cashFlowCategory?: CashFlowCategory;
  }> = [
    { code: "1000", name: "الأصول", type: AccountType.ASSET },
    { code: "1100", name: "النقدية وما في حكمها", type: AccountType.ASSET, parentCode: "1000", cashFlowCategory: CashFlowCategory.CASH },
    { code: "1200", name: "الذمم المدينة (العملاء)", type: AccountType.ASSET, parentCode: "1000", cashFlowCategory: CashFlowCategory.OPERATING },
    { code: "1300", name: "المخزون", type: AccountType.ASSET, parentCode: "1000", cashFlowCategory: CashFlowCategory.OPERATING },
    { code: "1400", name: "الأصول الثابتة", type: AccountType.ASSET, parentCode: "1000", cashFlowCategory: CashFlowCategory.INVESTING },
    { code: "2000", name: "الخصوم", type: AccountType.LIABILITY },
    { code: "2100", name: "الذمم الدائنة (الموردون)", type: AccountType.LIABILITY, parentCode: "2000", cashFlowCategory: CashFlowCategory.OPERATING },
    { code: "2200", name: "ضريبة القيمة المضافة المستحقة", type: AccountType.LIABILITY, parentCode: "2000", cashFlowCategory: CashFlowCategory.OPERATING },
    { code: "2300", name: "قروض طويلة الأجل", type: AccountType.LIABILITY, parentCode: "2000", cashFlowCategory: CashFlowCategory.FINANCING },
    { code: "3000", name: "حقوق الملكية", type: AccountType.EQUITY },
    { code: "3100", name: "رأس المال", type: AccountType.EQUITY, parentCode: "3000", cashFlowCategory: CashFlowCategory.FINANCING },
    { code: "4000", name: "الإيرادات", type: AccountType.REVENUE },
    { code: "4100", name: "إيرادات المبيعات", type: AccountType.REVENUE, parentCode: "4000", cashFlowCategory: CashFlowCategory.OPERATING },
    { code: "4200", name: "أرباح فروقات العملة", type: AccountType.REVENUE, parentCode: "4000", cashFlowCategory: CashFlowCategory.OPERATING },
    { code: "5000", name: "المصروفات", type: AccountType.EXPENSE },
    { code: "5100", name: "تكلفة البضاعة المباعة", type: AccountType.EXPENSE, parentCode: "5000", cashFlowCategory: CashFlowCategory.OPERATING },
    { code: "5200", name: "الرواتب والأجور", type: AccountType.EXPENSE, parentCode: "5000", cashFlowCategory: CashFlowCategory.OPERATING },
    { code: "5300", name: "مصروفات عمومية وإدارية", type: AccountType.EXPENSE, parentCode: "5000", cashFlowCategory: CashFlowCategory.OPERATING },
    { code: "5400", name: "خسائر فروقات العملة", type: AccountType.EXPENSE, parentCode: "5000", cashFlowCategory: CashFlowCategory.OPERATING },
  ];

  for (const { parentCode, ...account } of accounts) {
    const parent = parentCode
      ? await prisma.chartOfAccount.findUnique({ where: { code: parentCode } })
      : null;

    await prisma.chartOfAccount.upsert({
      where: { code: account.code },
      update: {
        name: account.name,
        type: account.type,
        parentId: parent?.id ?? null,
        cashFlowCategory: account.cashFlowCategory ?? null,
      },
      create: { ...account, parentId: parent?.id ?? null },
    });
  }

  // ---- المخزون ----
  const categories = [
    { name: "أجهزة إلكترونية", description: "حواسيب وملحقاتها" },
    { name: "أثاث مكتبي", description: "كراسي وطاولات" },
    { name: "قرطاسية", description: "مستلزمات مكتبية" },
  ];
  for (const category of categories) {
    await prisma.productCategory.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }

  const electronics = await prisma.productCategory.findUniqueOrThrow({
    where: { name: "أجهزة إلكترونية" },
  });
  const furniture = await prisma.productCategory.findUniqueOrThrow({
    where: { name: "أثاث مكتبي" },
  });
  const stationery = await prisma.productCategory.findUniqueOrThrow({
    where: { name: "قرطاسية" },
  });

  const products = [
    { sku: "LAP-001", name: "حاسوب محمول 14 بوصة", costPrice: 2800, salePrice: 3600, reorderLevel: 5, categoryId: electronics.id },
    { sku: "MON-002", name: "شاشة 27 بوصة", costPrice: 900, salePrice: 1300, reorderLevel: 8, categoryId: electronics.id },
    { sku: "KEY-003", name: "لوحة مفاتيح لاسلكية", costPrice: 120, salePrice: 210, reorderLevel: 15, categoryId: electronics.id },
    { sku: "CHR-004", name: "كرسي مكتبي مريح", costPrice: 550, salePrice: 850, reorderLevel: 6, categoryId: furniture.id },
    { sku: "DSK-005", name: "مكتب خشبي 160 سم", costPrice: 780, salePrice: 1200, reorderLevel: 4, categoryId: furniture.id },
    { sku: "PEN-006", name: "علبة أقلام جافة (50)", costPrice: 25, salePrice: 45, reorderLevel: 30, categoryId: stationery.id },
    { sku: "PAP-007", name: "ورق تصوير A4 (رزمة)", costPrice: 14, salePrice: 25, reorderLevel: 50, categoryId: stationery.id },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }

  const warehouses = [
    { code: "WH-MAIN", name: "المستودع الرئيسي", location: "الرياض - الصناعية", branchId: mainBranch.id },
    { code: "WH-JED", name: "مستودع جدة", location: "جدة - حي الخمرة", branchId: jeddahBranch.id },
  ];
  for (const warehouse of warehouses) {
    await prisma.warehouse.upsert({
      where: { code: warehouse.code },
      update: { branchId: warehouse.branchId },
      create: warehouse,
    });
  }

  const mainWarehouse = await prisma.warehouse.findUniqueOrThrow({
    where: { code: "WH-MAIN" },
  });

  // أرصدة افتتاحية
  const allProducts = await prisma.product.findMany();
  const openingQuantities: Record<string, number> = {
    "LAP-001": 12,
    "MON-002": 20,
    "KEY-003": 40,
    "CHR-004": 3,
    "DSK-005": 9,
    "PEN-006": 120,
    "PAP-007": 35,
  };

  for (const product of allProducts) {
    const quantity = openingQuantities[product.sku] ?? 0;
    await prisma.stockItem.upsert({
      where: {
        productId_warehouseId: {
          productId: product.id,
          warehouseId: mainWarehouse.id,
        },
      },
      update: {},
      create: {
        productId: product.id,
        warehouseId: mainWarehouse.id,
        quantity,
      },
    });
  }

  // ---- الموردون والعملاء ----
  const suppliers = [
    { code: "SUP-001", name: "مؤسسة التقنية الحديثة", contactName: "فهد العتيبي", phone: "+966511111111", email: "sales@tech.example" },
    { code: "SUP-002", name: "شركة الأثاث الراقي", contactName: "ريم القحطاني", phone: "+966522222222", email: "info@furniture.example" },
  ];
  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: { code: supplier.code },
      update: {},
      create: supplier,
    });
  }

  const customers = [
    { code: "CUS-001", name: "شركة الأفق للاستشارات", contactName: "عبدالله الشمري", phone: "+966533333333", email: "purchase@ufuq.example", creditLimit: 50000 },
    { code: "CUS-002", name: "مؤسسة البناء المتقدم", contactName: "سارة الدوسري", phone: "+966544444444", email: "accounts@bina.example", creditLimit: 30000 },
    { code: "CUS-003", name: "مركز التدريب الاحترافي", contactName: "ماجد الزهراني", phone: "+966555555555", email: "admin@training.example", creditLimit: 20000 },
  ];
  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { code: customer.code },
      update: {},
      create: customer,
    });
  }

  // ---- الموارد البشرية ----
  const departments = [
    { code: "DEP-FIN", name: "المالية" },
    { code: "DEP-SAL", name: "المبيعات" },
    { code: "DEP-OPS", name: "العمليات" },
  ];
  for (const department of departments) {
    await prisma.department.upsert({
      where: { code: department.code },
      update: {},
      create: department,
    });
  }

  const finance = await prisma.department.findUniqueOrThrow({ where: { code: "DEP-FIN" } });
  const salesDept = await prisma.department.findUniqueOrThrow({ where: { code: "DEP-SAL" } });

  const positions = [
    { title: "محاسب", departmentId: finance.id },
    { title: "مندوب مبيعات", departmentId: salesDept.id },
  ];
  for (const position of positions) {
    await prisma.position.upsert({
      where: { title_departmentId: { title: position.title, departmentId: position.departmentId } },
      update: {},
      create: position,
    });
  }

  const accountantPosition = await prisma.position.findFirstOrThrow({
    where: { title: "محاسب" },
  });
  const salesPosition = await prisma.position.findFirstOrThrow({
    where: { title: "مندوب مبيعات" },
  });

  const employees = [
    { employeeNo: "EMP-001", firstName: "سعيد", lastName: "الحربي", email: "saeed@erp.local", baseSalary: 9000, allowances: 1500, departmentId: finance.id, positionId: accountantPosition.id },
    { employeeNo: "EMP-002", firstName: "نورة", lastName: "المطيري", email: "noura@erp.local", baseSalary: 8000, allowances: 1200, departmentId: salesDept.id, positionId: salesPosition.id },
    { employeeNo: "EMP-003", firstName: "طارق", lastName: "السبيعي", email: "tarek@erp.local", baseSalary: 7000, allowances: 1000, departmentId: salesDept.id, positionId: salesPosition.id },
  ];
  for (const employee of employees) {
    await prisma.employee.upsert({
      where: { employeeNo: employee.employeeNo },
      update: { branchId: mainBranch.id },
      create: { ...employee, branchId: mainBranch.id },
    });
  }

  // ---- تعريفات سير العمل الديناميكي ----
  await seedWorkflow({
    name: "اعتماد أوامر الشراء",
    entityType: WorkflowEntityType.PURCHASE_ORDER,
    description: "مسودة ← بانتظار الاعتماد ← معتمد ← مستلم",
    states: [
      { key: "DRAFT", label: "مسودة", color: "gray", isInitial: true },
      { key: "PENDING_APPROVAL", label: "بانتظار الاعتماد", color: "amber" },
      { key: "APPROVED", label: "معتمد", color: "blue" },
      { key: "RECEIVED", label: "مستلم", color: "green", isFinal: true },
      { key: "CANCELLED", label: "ملغي", color: "red", isFinal: true },
    ],
    transitions: [
      { from: "DRAFT", to: "PENDING_APPROVAL", label: "إرسال للاعتماد", roles: [Role.PURCHASING] },
      { from: "PENDING_APPROVAL", to: "APPROVED", label: "اعتماد", roles: [Role.ADMIN, Role.ACCOUNTANT] },
      { from: "PENDING_APPROVAL", to: "DRAFT", label: "إعادة كمسودة", roles: [Role.ADMIN, Role.ACCOUNTANT], requiresNote: true },
      { from: "APPROVED", to: "RECEIVED", label: "استلام البضاعة", roles: [Role.PURCHASING, Role.INVENTORY] },
      { from: "DRAFT", to: "CANCELLED", label: "إلغاء", roles: [Role.PURCHASING], requiresNote: true },
      { from: "PENDING_APPROVAL", to: "CANCELLED", label: "رفض وإلغاء", roles: [Role.ADMIN, Role.ACCOUNTANT], requiresNote: true },
    ],
  });

  await seedWorkflow({
    name: "اعتماد أوامر البيع",
    entityType: WorkflowEntityType.SALES_ORDER,
    description: "مسودة ← بانتظار الاعتماد ← مؤكد ← مُفوتر",
    states: [
      { key: "DRAFT", label: "مسودة", color: "gray", isInitial: true },
      { key: "PENDING_APPROVAL", label: "بانتظار الاعتماد", color: "amber" },
      { key: "CONFIRMED", label: "مؤكد", color: "blue" },
      { key: "INVOICED", label: "مُفوتر", color: "green", isFinal: true },
      { key: "CANCELLED", label: "ملغي", color: "red", isFinal: true },
    ],
    transitions: [
      { from: "DRAFT", to: "PENDING_APPROVAL", label: "إرسال للاعتماد", roles: [Role.SALES] },
      // الطلبات حتى 20,000 يؤكدها مندوب المبيعات، وما فوقها للمدير وحده
      { from: "PENDING_APPROVAL", to: "CONFIRMED", label: "تأكيد الطلب", roles: [Role.SALES], maxAmount: 20000 },
      { from: "PENDING_APPROVAL", to: "CONFIRMED", label: "تأكيد طلب كبير (مدير)", roles: [Role.ADMIN], minAmount: 20000 },
      { from: "PENDING_APPROVAL", to: "DRAFT", label: "إرجاع للمسودة", roles: [Role.ADMIN, Role.SALES], requiresNote: true },
      { from: "CONFIRMED", to: "INVOICED", label: "إصدار فاتورة", roles: [Role.SALES, Role.ACCOUNTANT] },
      { from: "DRAFT", to: "CANCELLED", label: "إلغاء", roles: [Role.SALES], requiresNote: true },
      { from: "PENDING_APPROVAL", to: "CANCELLED", label: "رفض", roles: [Role.ADMIN], requiresNote: true },
    ],
  });

  await seedWorkflow({
    name: "اعتماد طلبات الإجازة",
    entityType: WorkflowEntityType.LEAVE_REQUEST,
    description: "معلّق ← موافقة/رفض",
    states: [
      { key: "PENDING", label: "معلّق", color: "amber", isInitial: true },
      { key: "APPROVED", label: "موافق عليه", color: "green", isFinal: true },
      { key: "REJECTED", label: "مرفوض", color: "red", isFinal: true },
      { key: "CANCELLED", label: "ملغي", color: "gray", isFinal: true },
    ],
    transitions: [
      { from: "PENDING", to: "APPROVED", label: "موافقة", roles: [Role.HR, Role.ADMIN] },
      { from: "PENDING", to: "REJECTED", label: "رفض", roles: [Role.HR, Role.ADMIN], requiresNote: true },
      { from: "PENDING", to: "CANCELLED", label: "إلغاء الطلب", roles: [Role.EMPLOYEE, Role.HR] },
    ],
  });

  // ---- قيود تجريبية تُظهر قائمة التدفقات النقدية بأنشطتها الثلاثة ----
  // تُنشأ مرة واحدة فقط على دفاتر خالية حتى لا تتكرر مع كل تعبئة.
  if ((await prisma.journalEntry.count()) === 0) {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@erp.local" },
    });
    const entryDate = new Date(Date.UTC(new Date().getFullYear(), 2, 1));

    const demoEntries: Array<{
      description: string;
      lines: Array<{ code: string; debit?: number; credit?: number }>;
    }> = [
      { description: "رأس مال نقدي", lines: [{ code: "1100", debit: 200000 }, { code: "3100", credit: 200000 }] },
      { description: "قرض بنكي طويل الأجل", lines: [{ code: "1100", debit: 50000 }, { code: "2300", credit: 50000 }] },
      { description: "شراء أصل ثابت نقداً", lines: [{ code: "1400", debit: 80000 }, { code: "1100", credit: 80000 }] },
      { description: "مبيعات آجلة", lines: [{ code: "1200", debit: 57500 }, { code: "4100", credit: 50000 }, { code: "2200", credit: 7500 }] },
      { description: "تحصيل من عملاء", lines: [{ code: "1100", debit: 40000 }, { code: "1200", credit: 40000 }] },
      { description: "شراء مخزون آجل", lines: [{ code: "1300", debit: 30000 }, { code: "2100", credit: 30000 }] },
      { description: "سداد موردين", lines: [{ code: "2100", debit: 18000 }, { code: "1100", credit: 18000 }] },
      { description: "رواتب نقداً", lines: [{ code: "5200", debit: 22000 }, { code: "1100", credit: 22000 }] },
      { description: "مصروفات إدارية نقداً", lines: [{ code: "5300", debit: 6000 }, { code: "1100", credit: 6000 }] },
      { description: "سداد قسط قرض", lines: [{ code: "2300", debit: 10000 }, { code: "1100", credit: 10000 }] },
    ];

    const accountByCode = new Map(
      (await prisma.chartOfAccount.findMany({ select: { id: true, code: true } })).map(
        (account) => [account.code, account.id],
      ),
    );

    for (const [index, entry] of demoEntries.entries()) {
      await prisma.journalEntry.create({
        data: {
          number: `JV-${entryDate.getFullYear()}-${String(index + 1).padStart(4, "0")}`,
          description: entry.description,
          entryDate,
          status: "POSTED",
          sourceType: "MANUAL",
          createdById: admin.id,
          branchId: mainBranch.id,
          lines: {
            create: entry.lines.map((line) => ({
              accountId: accountByCode.get(line.code)!,
              debit: line.debit ?? 0,
              credit: line.credit ?? 0,
            })),
          },
        },
      });
    }
  }

  console.log("✅ اكتملت تعبئة البيانات التجريبية");
  console.log(
    `   بيانات الدخول: admin@erp.local / ${
      process.env.SEED_ADMIN_PASSWORD ? "(كلمة المرور من SEED_ADMIN_PASSWORD)" : seedPassword
    }`,
  );
}

type SeedState = {
  key: string;
  label: string;
  color: string;
  isInitial?: boolean;
  isFinal?: boolean;
};

type SeedTransition = {
  from: string;
  to: string;
  label: string;
  roles: Role[];
  minAmount?: number;
  maxAmount?: number;
  requiresNote?: boolean;
};

async function seedWorkflow(input: {
  name: string;
  description: string;
  entityType: WorkflowEntityType;
  states: SeedState[];
  transitions: SeedTransition[];
}) {
  const existing = await prisma.workflowDefinition.findUnique({
    where: { entityType_name: { entityType: input.entityType, name: input.name } },
  });
  if (existing) return;

  const definition = await prisma.workflowDefinition.create({
    data: {
      name: input.name,
      description: input.description,
      entityType: input.entityType,
      states: {
        create: input.states.map((state, index) => ({
          key: state.key,
          label: state.label,
          color: state.color,
          isInitial: state.isInitial ?? false,
          isFinal: state.isFinal ?? false,
          sortOrder: index,
        })),
      },
    },
    include: { states: true },
  });

  const stateByKey = new Map(definition.states.map((state) => [state.key, state.id]));

  for (const [index, transition] of input.transitions.entries()) {
    const fromStateId = stateByKey.get(transition.from);
    const toStateId = stateByKey.get(transition.to);
    if (!fromStateId || !toStateId) continue;

    await prisma.workflowTransition.create({
      data: {
        definitionId: definition.id,
        fromStateId,
        toStateId,
        label: transition.label,
        allowedRoles: transition.roles,
        minAmount: transition.minAmount ?? null,
        maxAmount: transition.maxAmount ?? null,
        requiresNote: transition.requiresNote ?? false,
        sortOrder: index,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error("❌ فشلت التعبئة:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
