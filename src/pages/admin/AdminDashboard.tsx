import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, CalendarDays, Flag } from "lucide-react";
import { Link } from "react-router-dom";

export const AdminDashboard = () => {
  const [stats, setStats] = useState({
    pendingApplications: 0,
    totalUsers: 0,
    activeBookings: 0,
    openReports: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [apps, users, bookings, reports] = await Promise.all([
        supabase.from("seller_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      setStats({
        pendingApplications: apps.count ?? 0,
        totalUsers: users.count ?? 0,
        activeBookings: bookings.count ?? 0,
        openReports: reports.count ?? 0,
      });
      setLoading(false);
    };
    void load();
  }, []);

  const cards = [
    {
      label: "Pending Applications",
      value: stats.pendingApplications,
      icon: FileText,
      to: "/admin/applications",
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      to: "/admin/users",
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Active Bookings",
      value: stats.activeBookings,
      icon: CalendarDays,
      to: "/admin/bookings",
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Open Reports",
      value: stats.openReports,
      icon: Flag,
      to: "/admin/reports",
      color: "text-red-600 bg-red-50",
    },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Admin Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Overview of the Artisaneo platform.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.to} to={c.to}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <div className={`rounded-lg p-2 ${c.color}`}>
                  <c.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                ) : (
                  <p className="text-3xl font-bold">{c.value}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};
