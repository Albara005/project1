/**
 * تهيئة بيئة التطوير المحلية بأمر واحد:
 * ينشئ .env بمفتاح عشوائي، ينتظر قاعدة البيانات، يطبّق الهجرات، ثم يعبّئ
 * بيانات تجريبية. آمن للتكرار: تشغيله مرة أخرى لا يفسد شيئاً.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

const color = (code, text) => `\u001b[${code}m${text}\u001b[0m`;
const step = (text) => console.log(color(36, `\n▸ ${text}`));
const ok = (text) => console.log(color(32, `  ✓ ${text}`));
const fail = (text) => console.error(color(31, `  ✗ ${text}`));

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`فشل الأمر: ${command} ${args.join(" ")}`);
  }
}

// 1) ملف البيئة
step("التحقق من ملف البيئة (.env)");
if (!existsSync(envPath)) {
  if (!existsSync(examplePath)) {
    fail(".env.example غير موجود — تأكد أنك داخل مجلد المشروع.");
    process.exit(1);
  }
  writeFileSync(envPath, readFileSync(examplePath, "utf8"));
  ok("أُنشئ .env من .env.example");
} else {
  ok(".env موجود");
}

// المفتاح الافتراضي في المثال نصّ عربي توضيحي، فنستبدله بمفتاح حقيقي.
let envText = readFileSync(envPath, "utf8");
const secretLine = /^AUTH_SECRET=.*$/m;
const currentSecret = envText.match(/^AUTH_SECRET="?([^"\n]*)"?$/m)?.[1] ?? "";
if (currentSecret.length < 32 || /[؀-ۿ]/.test(currentSecret)) {
  const secret = randomBytes(32).toString("base64");
  envText = secretLine.test(envText)
    ? envText.replace(secretLine, `AUTH_SECRET="${secret}"`)
    : `${envText.trimEnd()}\nAUTH_SECRET="${secret}"\n`;
  writeFileSync(envPath, envText);
  ok("وُلّد AUTH_SECRET عشوائي");
} else {
  ok("AUTH_SECRET معرّف مسبقاً");
}

// 2) انتظار قاعدة البيانات
const { default: dotenv } = await import("dotenv");
dotenv.config({ path: envPath, override: true });
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  fail("DATABASE_URL غير معرّف في .env");
  process.exit(1);
}

step("انتظار قاعدة البيانات");
const { Client } = await import("pg");
const deadline = Date.now() + 60_000;
let connected = false;
let lastError;
while (Date.now() < deadline) {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.end();
    connected = true;
    break;
  } catch (error) {
    lastError = error;
    await client.end().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
if (!connected) {
  fail(`تعذّر الاتصال خلال 60 ثانية: ${lastError?.message ?? "سبب غير معروف"}`);
  console.error(
    color(33, "\n  شغّل قاعدة البيانات أولاً:  docker compose up -d\n" +
      "  أو عدّل DATABASE_URL في .env ليشير لقاعدة PostgreSQL لديك."),
  );
  process.exit(1);
}
ok("قاعدة البيانات جاهزة");

// 3) الجداول والبيانات
step("تطبيق الهجرات");
run("npx", ["prisma", "migrate", "deploy"]);

step("توليد عميل Prisma");
run("npx", ["prisma", "generate"]);

step("تعبئة البيانات التجريبية");
run("npx", ["prisma", "db", "seed"]);

console.log(color(32, "\n✓ اكتملت التهيئة."));
console.log("\n  شغّل الآن:  " + color(36, "npm run dev"));
console.log("  ثم افتح:    " + color(36, "http://localhost:3000"));
console.log("\n  الدخول:  admin@erp.local  /  Admin@123\n");
