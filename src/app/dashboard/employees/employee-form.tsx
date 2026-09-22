"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Label, Select } from "@/components/ui";
import { saveEmployee, type ActionState } from "./actions";
import { EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_VALUES } from "./labels";

export type DepartmentOption = { id: string; name: string };
export type PositionOption = { id: string; title: string; departmentId: string | null };

export type EmployeeFormValues = {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationalId: string;
  hireDate: string;
  terminationDate: string;
  departmentId: string;
  positionId: string;
  baseSalary: string;
  allowances: string;
  status: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "جاري الحفظ..." : label}
    </Button>
  );
}

export function EmployeeForm({
  departments,
  positions,
  employee,
}: {
  departments: DepartmentOption[];
  positions: PositionOption[];
  employee?: EmployeeFormValues;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveEmployee, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [departmentId, setDepartmentId] = useState(employee?.departmentId ?? "");

  const isEdit = Boolean(employee?.id);

  useEffect(() => {
    if (state.success && !isEdit) {
      formRef.current?.reset();
      setDepartmentId("");
    }
  }, [state, isEdit]);

  const visiblePositions = departmentId
    ? positions.filter(
        (position) => position.departmentId === departmentId || position.departmentId === null,
      )
    : positions;

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {employee?.id ? <input type="hidden" name="id" value={employee.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label htmlFor="employeeNo">الرقم الوظيفي</Label>
          <Input
            id="employeeNo"
            name="employeeNo"
            required
            defaultValue={employee?.employeeNo ?? ""}
            placeholder="EMP-004"
          />
        </div>
        <div>
          <Label htmlFor="firstName">الاسم الأول</Label>
          <Input id="firstName" name="firstName" required defaultValue={employee?.firstName ?? ""} />
        </div>
        <div>
          <Label htmlFor="lastName">اسم العائلة</Label>
          <Input id="lastName" name="lastName" required defaultValue={employee?.lastName ?? ""} />
        </div>
        <div>
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            defaultValue={employee?.email ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="phone">رقم الجوال</Label>
          <Input id="phone" name="phone" dir="ltr" defaultValue={employee?.phone ?? ""} />
        </div>
        <div>
          <Label htmlFor="nationalId">رقم الهوية</Label>
          <Input id="nationalId" name="nationalId" dir="ltr" defaultValue={employee?.nationalId ?? ""} />
        </div>
        <div>
          <Label htmlFor="departmentId">القسم</Label>
          <Select
            id="departmentId"
            name="departmentId"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          >
            <option value="">— بدون قسم —</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="positionId">المسمى الوظيفي</Label>
          <Select id="positionId" name="positionId" defaultValue={employee?.positionId ?? ""}>
            <option value="">— بدون مسمى —</option>
            {visiblePositions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.title}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="status">الحالة</Label>
          <Select id="status" name="status" defaultValue={employee?.status ?? "ACTIVE"}>
            {EMPLOYEE_STATUS_VALUES.map((status) => (
              <option key={status} value={status}>
                {EMPLOYEE_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="hireDate">تاريخ التعيين</Label>
          <Input
            id="hireDate"
            name="hireDate"
            type="date"
            required
            defaultValue={employee?.hireDate ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="terminationDate">تاريخ انتهاء الخدمة</Label>
          <Input
            id="terminationDate"
            name="terminationDate"
            type="date"
            defaultValue={employee?.terminationDate ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="baseSalary">الراتب الأساسي</Label>
          <Input
            id="baseSalary"
            name="baseSalary"
            type="number"
            step="0.01"
            min="0"
            defaultValue={employee?.baseSalary ?? "0"}
          />
        </div>
        <div>
          <Label htmlFor="allowances">البدلات</Label>
          <Input
            id="allowances"
            name="allowances"
            type="number"
            step="0.01"
            min="0"
            defaultValue={employee?.allowances ?? "0"}
          />
        </div>
      </div>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
      {state.success && state.message ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {state.message}
        </p>
      ) : null}

      <SubmitButton label={isEdit ? "حفظ التعديلات" : "إضافة الموظف"} />
    </form>
  );
}
