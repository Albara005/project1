import {
  Prisma,
  Role,
  WorkflowEntityType,
  WorkflowInstanceStatus,
} from "@/generated/prisma";
import { prisma } from "@/lib/db";

/**
 * محرك سير العمل الديناميكي.
 *
 * بدلاً من تثبيت الحالات والانتقالات في الكود، تُعرّف في قاعدة البيانات
 * (WorkflowDefinition/State/Transition) ويمكن للمستخدم تعديلها من الواجهة.
 * كل مستند (أمر شراء، أمر بيع، طلب إجازة...) يرتبط بـ WorkflowInstance واحدة
 * تتتبع حالته الحالية وسجل انتقالاته.
 */

export type AvailableTransition = {
  id: string;
  label: string;
  toStateKey: string;
  toStateLabel: string;
  requiresNote: boolean;
};

export type WorkflowSnapshot = {
  instanceId: string;
  definitionName: string;
  currentStateKey: string;
  currentStateLabel: string;
  currentStateColor: string;
  status: WorkflowInstanceStatus;
  isFinal: boolean;
  availableTransitions: AvailableTransition[];
};

type TxClient = Prisma.TransactionClient | typeof prisma;

/** يبدأ سير عمل لمستند جديد اعتماداً على التعريف النشط لنوع المستند. */
export async function startWorkflow(
  entityType: WorkflowEntityType,
  entityId: string,
  options: { amount?: number; actorId?: string; client?: TxClient } = {},
): Promise<string | null> {
  const db = options.client ?? prisma;

  const definition = await db.workflowDefinition.findFirst({
    where: { entityType, isActive: true },
    include: { states: { orderBy: { sortOrder: "asc" } } },
  });

  if (!definition) return null;

  const initialState =
    definition.states.find((state) => state.isInitial) ?? definition.states[0];
  if (!initialState) return null;

  const existing = await db.workflowInstance.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
  });
  if (existing) return existing.id;

  const instance = await db.workflowInstance.create({
    data: {
      definitionId: definition.id,
      entityType,
      entityId,
      currentStateId: initialState.id,
      amount: options.amount != null ? new Prisma.Decimal(options.amount) : null,
      history: {
        create: {
          toStateKey: initialState.key,
          note: "بدء سير العمل",
          actorId: options.actorId ?? null,
        },
      },
    },
  });

  return instance.id;
}

/** يعيد الحالة الحالية والانتقالات المتاحة لمستند بحسب دور المستخدم وقيمة المستند. */
export async function getWorkflowSnapshot(
  entityType: WorkflowEntityType,
  entityId: string,
  role: Role,
): Promise<WorkflowSnapshot | null> {
  const instance = await prisma.workflowInstance.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
    include: {
      definition: true,
      currentState: true,
    },
  });

  if (!instance) return null;

  const transitions = await prisma.workflowTransition.findMany({
    where: { fromStateId: instance.currentStateId },
    include: { toState: true },
    orderBy: { sortOrder: "asc" },
  });

  const amount = instance.amount ? Number(instance.amount) : 0;

  const availableTransitions = transitions
    .filter((transition) => isTransitionAllowed(transition, role, amount))
    .map((transition) => ({
      id: transition.id,
      label: transition.label,
      toStateKey: transition.toState.key,
      toStateLabel: transition.toState.label,
      requiresNote: transition.requiresNote,
    }));

  return {
    instanceId: instance.id,
    definitionName: instance.definition.name,
    currentStateKey: instance.currentState.key,
    currentStateLabel: instance.currentState.label,
    currentStateColor: instance.currentState.color,
    status: instance.status,
    isFinal: instance.currentState.isFinal,
    availableTransitions:
      instance.status === WorkflowInstanceStatus.ACTIVE ? availableTransitions : [],
  };
}

function isTransitionAllowed(
  transition: {
    allowedRoles: Role[];
    minAmount: Prisma.Decimal | null;
    maxAmount: Prisma.Decimal | null;
  },
  role: Role,
  amount: number,
): boolean {
  if (role !== Role.ADMIN && transition.allowedRoles.length > 0) {
    if (!transition.allowedRoles.includes(role)) return false;
  }
  if (transition.minAmount && amount < Number(transition.minAmount)) return false;
  // الحد الأعلى يُطبَّق على الجميع بمن فيهم المدير، وإلا ظهر للمدير زران
  // متطابقان لنفس الانتقال عند تجاوز الحد.
  if (transition.maxAmount && amount > Number(transition.maxAmount)) return false;
  return true;
}

export class WorkflowError extends Error {}

/**
 * ينفّذ انتقالاً على مستند. يتحقق من الصلاحية والشروط، ويحدّث الحالة،
 * ويسجل العملية في السجل. يعيد مفتاح الحالة الجديدة ليقرر المستدعي
 * ما الأثر الذي يطبّقه على المستند نفسه (مثل خصم المخزون).
 */
export async function applyTransition(params: {
  entityType: WorkflowEntityType;
  entityId: string;
  transitionId: string;
  role: Role;
  actorId?: string;
  note?: string;
  client?: TxClient;
}): Promise<{ fromStateKey: string; toStateKey: string; isFinal: boolean }> {
  const db = params.client ?? prisma;

  const instance = await db.workflowInstance.findUnique({
    where: {
      entityType_entityId: { entityType: params.entityType, entityId: params.entityId },
    },
    include: { currentState: true },
  });

  if (!instance) throw new WorkflowError("لا يوجد سير عمل مرتبط بهذا المستند");
  if (instance.status !== WorkflowInstanceStatus.ACTIVE) {
    throw new WorkflowError("سير العمل لهذا المستند غير نشط");
  }

  const transition = await db.workflowTransition.findUnique({
    where: { id: params.transitionId },
    include: { toState: true },
  });

  if (!transition) throw new WorkflowError("الانتقال غير موجود");
  if (transition.fromStateId !== instance.currentStateId) {
    throw new WorkflowError("هذا الانتقال غير متاح من الحالة الحالية");
  }

  const amount = instance.amount ? Number(instance.amount) : 0;
  if (!isTransitionAllowed(transition, params.role, amount)) {
    throw new WorkflowError("لا تملك صلاحية تنفيذ هذا الانتقال");
  }
  if (transition.requiresNote && !params.note?.trim()) {
    throw new WorkflowError("هذا الإجراء يتطلب إدخال ملاحظة");
  }

  await db.workflowInstance.update({
    where: { id: instance.id },
    data: {
      currentStateId: transition.toStateId,
      status: transition.toState.isFinal
        ? WorkflowInstanceStatus.COMPLETED
        : WorkflowInstanceStatus.ACTIVE,
      history: {
        create: {
          transitionId: transition.id,
          fromStateKey: instance.currentState.key,
          toStateKey: transition.toState.key,
          note: params.note?.trim() || null,
          actorId: params.actorId ?? null,
        },
      },
    },
  });

  return {
    fromStateKey: instance.currentState.key,
    toStateKey: transition.toState.key,
    isFinal: transition.toState.isFinal,
  };
}

/** يحدّث قيمة المستند المرتبطة بسير العمل (تؤثر على شروط minAmount). */
export async function syncWorkflowAmount(
  entityType: WorkflowEntityType,
  entityId: string,
  amount: number,
  client: TxClient = prisma,
) {
  await client.workflowInstance.updateMany({
    where: { entityType, entityId },
    data: { amount: new Prisma.Decimal(amount) },
  });
}

export async function getWorkflowHistory(
  entityType: WorkflowEntityType,
  entityId: string,
) {
  const instance = await prisma.workflowInstance.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
    include: {
      history: {
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true } } },
      },
    },
  });

  return instance?.history ?? [];
}

export { ENTITY_TYPE_LABELS } from "@/lib/labels";

export const STATE_COLORS: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  green: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};
