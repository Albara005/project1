import type { ModuleKey } from "@/lib/rbac";

export type NavItem = {
  href: string;
  label: string;
  module: ModuleKey;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "الرئيسية",
    items: [{ href: "/dashboard", label: "لوحة التحكم", module: "dashboard" }],
  },
  {
    title: "المخزون والمشتريات",
    items: [
      { href: "/dashboard/products", label: "المنتجات", module: "inventory" },
      { href: "/dashboard/categories", label: "فئات المنتجات", module: "inventory" },
      { href: "/dashboard/warehouses", label: "المستودعات", module: "inventory" },
      { href: "/dashboard/stock", label: "أرصدة وحركات المخزون", module: "inventory" },
      { href: "/dashboard/suppliers", label: "الموردون", module: "purchasing" },
      { href: "/dashboard/purchase-orders", label: "أوامر الشراء", module: "purchasing" },
      { href: "/dashboard/returns?type=PURCHASE", label: "مرتجعات المشتريات", module: "purchasing" },
    ],
  },
  {
    title: "المبيعات والعملاء",
    items: [
      { href: "/dashboard/customers", label: "العملاء", module: "sales" },
      { href: "/dashboard/leads", label: "الفرص البيعية", module: "crm" },
      { href: "/dashboard/sales-orders", label: "أوامر البيع", module: "sales" },
      { href: "/dashboard/invoices", label: "الفواتير", module: "sales" },
      { href: "/dashboard/payments", label: "المدفوعات", module: "sales" },
      { href: "/dashboard/returns?type=SALES", label: "مرتجعات المبيعات", module: "sales" },
    ],
  },
  {
    title: "المحاسبة",
    items: [
      { href: "/dashboard/accounts", label: "دليل الحسابات", module: "accounting" },
      { href: "/dashboard/journal", label: "القيود المحاسبية", module: "accounting" },
      { href: "/dashboard/reports", label: "التقارير المالية", module: "accounting" },
      { href: "/dashboard/reports/cash-flow", label: "التدفقات النقدية", module: "accounting" },
      { href: "/dashboard/einvoicing", label: "الفوترة الإلكترونية", module: "accounting" },
    ],
  },
  {
    title: "الموارد البشرية",
    items: [
      { href: "/dashboard/employees", label: "الموظفون", module: "hr" },
      { href: "/dashboard/departments", label: "الأقسام", module: "hr" },
      { href: "/dashboard/leaves", label: "طلبات الإجازات", module: "hr" },
      { href: "/dashboard/payroll", label: "الرواتب", module: "hr" },
    ],
  },
  {
    title: "الإعدادات",
    items: [
      { href: "/dashboard/workflows", label: "سير العمل الديناميكي", module: "workflows" },
      { href: "/dashboard/branches", label: "الفروع", module: "settings" },
      { href: "/dashboard/currencies", label: "العملات وأسعار الصرف", module: "settings" },
      { href: "/dashboard/users", label: "المستخدمون", module: "settings" },
      { href: "/dashboard/settings", label: "إعدادات المنشأة", module: "settings" },
    ],
  },
];
