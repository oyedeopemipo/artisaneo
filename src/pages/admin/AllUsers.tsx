import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Loader as Loader2, ShieldBan, ShieldCheck } from "lucide-react";

type Profile = {
  id: string;
  display_name: string | null;
  city: string | null;
  bio: string | null;
  avatar_url: string | null;
  suspended: boolean;
  created_at: string;
};

type UserRole = {
  user_id: string;
  role: string;
};

type UserRow = Profile & { roles: string[] };

export const AllUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const profiles = (profilesRes.data as Profile[]) ?? [];
    const roles = (rolesRes.data as UserRole[]) ?? [];

    const roleMap = new Map<string, string[]>();
    for (const r of roles) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }

    const rows: UserRow[] = profiles.map((p) => ({
      ...p,
      roles: roleMap.get(p.id) ?? [],
    }));

    setUsers(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSuspend = async (userId: string, currentlySuspended: boolean) => {
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ suspended: !currentlySuspended, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;
      toast.success(currentlySuspended ? "Account reactivated" : "Account suspended");
      await load();
    } catch (err) {
      toast.error("Action failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && !u.roles.includes(roleFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = (u.display_name ?? "").toLowerCase();
      const city = (u.city ?? "").toLowerCase();
      if (!name.includes(q) && !city.includes(q) && !u.id.includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">All Users</h1>
      <p className="mt-1 text-muted-foreground">View and manage all buyers and sellers.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, city, or ID..."
            className="h-10 pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-10 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="buyer">Buyers</SelectItem>
            <SelectItem value="seller">Sellers</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "user" : "users"}
      </p>

      {loading ? (
        <div className="mt-8 flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No users found.</p>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.display_name || <span className="italic text-muted-foreground">No name</span>}
                  </TableCell>
                  <TableCell>{u.city || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <Badge variant="outline" className="text-xs">none</Badge>
                      ) : (
                        u.roles.map((r) => (
                          <Badge
                            key={r}
                            variant={r === "admin" ? "default" : r === "seller" ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {r}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.suspended ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-300 text-emerald-700">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={u.suspended ? "outline" : "destructive"}
                      size="sm"
                      onClick={() => toggleSuspend(u.id, u.suspended)}
                      disabled={actionLoading === u.id}
                    >
                      {actionLoading === u.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : u.suspended ? (
                        <>
                          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Reactivate
                        </>
                      ) : (
                        <>
                          <ShieldBan className="mr-1.5 h-3.5 w-3.5" /> Suspend
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
