"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUDIT_ACTION_LABELS,
  ENTITY_LABELS,
  SEVERITY,
} from "@/modules/audit/lib/audit-labels";
import type {
  AuditLogFilters,
  AuditSeverity,
} from "@/modules/audit/types/audit-log";
import { useUsers } from "@/modules/users/hooks/use-users";

// `<Select>` no admite un item con valor vacío: "todos" viaja como centinela y
// se traduce a `undefined` antes de salir hacia arriba.
const ALL = "all";

// Las acciones posibles nacen en el código, no en los datos (decisión 2): salen
// del mismo mapa de etiquetas que usa la tabla, sin endpoint de facets.
const ACTIONS = Object.entries(AUDIT_ACTION_LABELS);
const ENTITIES = Object.entries(ENTITY_LABELS);

// El Select puede emitir `null` al deseleccionar: se normaliza junto con el
// centinela para que el filtro salga como "sin filtro".
function clean(next: string | null): string | undefined {
  return !next || next === ALL ? undefined : next;
}

type AuditLogsFiltersProps = {
  value: AuditLogFilters;
  onChange: (filters: AuditLogFilters) => void;
};

export function AuditLogsFilters({ value, onChange }: AuditLogsFiltersProps) {
  // Los 3 puestos con `audit_logs.read` tienen también `users.read`: la lista de
  // actores sale del endpoint que ya existe.
  const { data: users } = useUsers();
  const hasFilters = Object.values(value).some(Boolean);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="audit-action">Acción</Label>
        <Select
          value={value.action ?? ALL}
          onValueChange={(next) =>
            onChange({ ...value, action: clean(next) })
          }
        >
          <SelectTrigger id="audit-action" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {ACTIONS.map(([action, label]) => (
              <SelectItem key={action} value={action}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="audit-entity">Entidad</Label>
        <Select
          value={value.entityType ?? ALL}
          onValueChange={(next) =>
            onChange({ ...value, entityType: clean(next) })
          }
        >
          <SelectTrigger id="audit-entity" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {ENTITIES.map(([entity, label]) => (
              <SelectItem key={entity} value={entity}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="audit-severity">Severidad</Label>
        <Select
          value={value.severity ?? ALL}
          onValueChange={(next) =>
            onChange({
              ...value,
              // Los items del Select son exactamente las claves de SEVERITY.
              severity: clean(next) as AuditSeverity | undefined,
            })
          }
        >
          <SelectTrigger id="audit-severity" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {Object.entries(SEVERITY).map(([severity, { label }]) => (
              <SelectItem key={severity} value={severity}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="audit-actor">Actor</Label>
        <Select
          value={value.actorId ?? ALL}
          onValueChange={(next) =>
            onChange({ ...value, actorId: clean(next) })
          }
        >
          <SelectTrigger id="audit-actor" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="system">Sistema</SelectItem>
            {users?.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="audit-from">Desde</Label>
        <Input
          id="audit-from"
          type="date"
          className="w-40"
          value={value.from ?? ""}
          onChange={(event) =>
            onChange({ ...value, from: event.target.value || undefined })
          }
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="audit-to">Hasta</Label>
        <Input
          id="audit-to"
          type="date"
          className="w-40"
          value={value.to ?? ""}
          onChange={(event) =>
            onChange({ ...value, to: event.target.value || undefined })
          }
        />
      </div>

      <Button
        variant="outline"
        disabled={!hasFilters}
        onClick={() => onChange({})}
      >
        Limpiar
      </Button>
    </div>
  );
}
