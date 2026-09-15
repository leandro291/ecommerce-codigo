"use client";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { Fragment, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AuditLogsFilters } from "@/modules/audit/components/audit-logs-filters";
import { useAuditLogs } from "@/modules/audit/hooks/use-audit-logs";
import {
  actionLabel,
  describeChange,
  entityLabel,
  SEVERITY,
} from "@/modules/audit/lib/audit-labels";
import type {
  AuditLogFilters,
  AuditLogRow,
} from "@/modules/audit/types/audit-log";

const COLUMN_COUNT = 5;

// Ya está en la frase de `describeChange` con el nombre del puesto: repetirlo
// acá mostraría el slug crudo.
const HIDDEN_METADATA_KEYS = new Set(["roleSlug"]);

function formatValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function ExpandedRow({ row }: { row: AuditLogRow }) {
  const entries = Object.entries(row.metadata ?? {}).filter(
    ([key]) => !HIDDEN_METADATA_KEYS.has(key),
  );

  return (
    <TableRow>
      <TableCell colSpan={COLUMN_COUNT} className="whitespace-normal bg-muted/30">
        <div className="flex flex-col gap-2 px-2 py-1">
          <p className="text-sm">{describeChange(row)}</p>

          <dl className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-[auto_1fr]">
            {row.entityId ? (
              <>
                <dt>Identificador</dt>
                <dd className="font-mono">{row.entityId}</dd>
              </>
            ) : null}

            {entries.map(([key, value]) => (
              <div key={key} className="contents">
                <dt>{key}</dt>
                <dd className="font-mono">{formatValue(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function AuditLogsTable() {
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAuditLogs(filters);

  const rows = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <AuditLogsFilters value={filters} onChange={setFilters} />

      {isError ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 p-6">
          <p className="text-sm text-destructive">
            No se pudo cargar la bitácora: {error.message}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Fecha</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isPending ? (
                  Array.from({ length: 8 }, (_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={COLUMN_COUNT}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={COLUMN_COUNT}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No hay eventos que coincidan.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const isExpanded = expandedId === row.id;
                    const severity = SEVERITY[row.severity];

                    return (
                      <Fragment key={row.id}>
                        <TableRow>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-expanded={isExpanded}
                              aria-label={
                                isExpanded ? "Ocultar detalle" : "Ver detalle"
                              }
                              onClick={() =>
                                setExpandedId(isExpanded ? null : row.id)
                              }
                            >
                              {isExpanded ? (
                                <ChevronDownIcon />
                              ) : (
                                <ChevronRightIcon />
                              )}
                            </Button>
                          </TableCell>

                          {/* Llega como string por JSON: se envuelve antes de formatear. */}
                          <TableCell>
                            {new Date(row.createdAt).toLocaleString("es-PE")}
                          </TableCell>

                          <TableCell>
                            {row.actor ? (
                              row.actor.email
                            ) : (
                              <span className="text-muted-foreground">
                                Sistema
                              </span>
                            )}
                          </TableCell>

                          <TableCell>
                            <span className="flex items-center gap-2">
                              {actionLabel(row.action)}
                              <Badge variant={severity.variant}>
                                {severity.label}
                              </Badge>
                            </span>
                          </TableCell>

                          <TableCell>{entityLabel(row.entityType)}</TableCell>
                        </TableRow>

                        {isExpanded ? <ExpandedRow row={row} /> : null}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {hasNextPage ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                disabled={isFetchingNextPage}
                onClick={() => fetchNextPage()}
              >
                {isFetchingNextPage ? "Cargando…" : "Cargar más"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
