import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, Loader as Loader2, Eye, CircleCheck as CheckCircle2, Circle as XCircle } from "lucide-react";

type Report = {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  booking_id: string | null;
  reason: string;
  description: string;
  status: string;
  admin_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileMap = Record<string, { display_name: string | null }>;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "destructive",
  under_review: "outline",
  resolved: "default",
  dismissed: "secondary",
};

const REASON_LABELS: Record<string, string> = {
  inappropriate: "Inappropriate content",
  no_show: "No-show",
  payment_issue: "Payment issue",
  harassment: "Harassment",
  other: "Other",
};

export const Reports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [profileMap, setProfileMap] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Report | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    setReports((data as Report[]) ?? []);

    const ids = new Set<string>();
    for (const r of data ?? []) {
      ids.add(r.reporter_id);
      if (r.reported_user_id) ids.add(r.reported_user_id);
    }
    if (ids.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", Array.from(ids));
      const map: ProfileMap = {};
      for (const p of profiles ?? []) {
        map[p.id] = { display_name: p.display_name };
      }
      setProfileMap(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleResolve = async (reportId: string, newStatus: "resolved" | "dismissed") => {
    setActionLoading(reportId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const adminId = sessionData.session?.user.id;

      const { error } = await supabase
        .from("reports")
        .update({
          status: newStatus,
          admin_notes: adminNotes || null,
          resolved_by: adminId ?? null,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reportId);
      if (error) throw error;

      toast.success(`Report ${newStatus}`);
      setReviewing(null);
      setAdminNotes("");
      await load();
    } catch (err) {
      toast.error("Action failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setActionLoading(null);
    }
  };

  const openReview = (report: Report) => {
    setReviewing(report);
    setAdminNotes(report.admin_notes ?? "");
  };

  const filtered = reports.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const reporter = (profileMap[r.reporter_id]?.display_name ?? "").toLowerCase();
      const reported = r.reported_user_id
        ? (profileMap[r.reported_user_id]?.display_name ?? "").toLowerCase()
        : "";
      const desc = r.description.toLowerCase();
      if (!reporter.includes(q) && !reported.includes(q) && !desc.includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Reports</h1>
      <p className="mt-1 text-muted-foreground">Review user-submitted reports and take action.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reporter, reported user, or description..."
            className="h-10 pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="under_review">Under review</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "report" : "reports"}
      </p>

      {loading ? (
        <div className="mt-8 flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No reports found.</p>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reporter</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Filed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {profileMap[r.reporter_id]?.display_name || r.reporter_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    {r.reported_user_id
                      ? profileMap[r.reported_user_id]?.display_name || r.reported_user_id.slice(0, 8)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {REASON_LABELS[r.reason] ?? r.reason}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {r.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>
                      {r.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => openReview(r)}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> Review
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Review Report</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <div>
                              <span className="text-muted-foreground">Reporter:</span>{" "}
                              {profileMap[r.reporter_id]?.display_name || r.reporter_id.slice(0, 8)}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Reported user:</span>{" "}
                              {r.reported_user_id
                                ? profileMap[r.reported_user_id]?.display_name || r.reported_user_id.slice(0, 8)
                                : "—"}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Reason:</span>{" "}
                              {REASON_LABELS[r.reason] ?? r.reason}
                            </div>
                            {r.booking_id && (
                              <div>
                                <span className="text-muted-foreground">Booking:</span>{" "}
                                <span className="font-mono text-xs">{r.booking_id.slice(0, 8)}</span>
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Description:</span>
                            <p className="mt-1 rounded-lg border p-3 text-sm">{r.description}</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Admin notes</Label>
                            <Textarea
                              value={adminNotes}
                              onChange={(e) => setAdminNotes(e.target.value)}
                              placeholder="Add notes about your decision..."
                              rows={3}
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-2">
                            <Button
                              onClick={() => handleResolve(r.id, "resolved")}
                              disabled={actionLoading === r.id}
                            >
                              {actionLoading === r.id ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Resolve
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleResolve(r.id, "dismissed")}
                              disabled={actionLoading === r.id}
                            >
                              <XCircle className="mr-1.5 h-3.5 w-3.5" />
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
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
