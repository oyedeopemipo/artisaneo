import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Users,
  FileText,
  CalendarDays,
  Flag,
  LayoutDashboard,
} from "lucide-react";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/applications", label: "Applications", icon: FileText },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/admin/reports", label: "Reports", icon: Flag },
];

export const AdminLayout = () => {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="border-b border-border px-6 py-5">
            <h2 className="font-display text-lg font-semibold">Admin Panel</h2>
            <p className="text-xs text-muted-foreground">Artisaneo</p>
          </div>
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card md:hidden">
        <nav className="flex items-center justify-around py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground",
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
