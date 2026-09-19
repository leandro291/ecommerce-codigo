import { MetricsView } from "@/modules/dashboard/components/metrics-view";

export const metadata = {
  title: "Dashboard | Administración",
};

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          KPIs de ventas y gráficos del período elegido.
        </p>
      </div>

      <MetricsView />
    </div>
  );
}
