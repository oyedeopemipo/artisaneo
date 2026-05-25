import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, X, Eye, Search, Loader as Loader2 } from "lucide-react";

type Application = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  country: string;
  bio: string | null;
  shop_name: string;
  product_category: string;
  shop_description: string;
  sample_photo_url: string | null;
  payout_method: string;
  terms_agreed: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
};

export const SellerApplications = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const load = useCallback(async () => {
    let query = supabase.from("seller_applications").select("*").order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    setApplications((data as Application[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = async (id: string, status: "approved" | "rejected") => {
    setActionLoading(id);
    try {
      // Update application status
      const { error: appError } = await supabase
        .from("seller_applications")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (appError) throw appError;

      // If approved, create seller profile and add seller role
      if (status === "approved") {
        const app = applications.find((a) => a.id === id);
        if (app) {
          const { error: profileError } = await supabase.from("seller_profiles").insert({
            user_id: app.user_id,
            full_name: app.full_name,
            location: app.country,
            bio: app.bio,
            shop_name: app.shop_name,
            service_category: app.product_category,
            shop_description: app.shop_description,
            photo_url: app.sample_photo_url,
          });
          if (profileError) throw profileError;

          const { error: roleError } = await supabase.from("user_roles").insert({
            user_id: app.user_id,
            role: "seller",
          });
          if (roleError) throw roleError;
        }
      }

      toast.success(`Application ${status}`);
      await load();
    } catch (err) {
      toast.error("Action failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = applications.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.full_name.toLowerCase().includes(q) ||
      a.shop_name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Seller Applications</h1>
      <p className="mt-1 text-muted-foreground">Review and manage seller applications.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, shop, or email..."
            className="h-10 pl-10"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-10 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "application" : "applications"}
      </p>

      {loading ? (
        <div className="mt-8 flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No applications found.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {filtered.map((app) => (
            <Card key={app.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{app.shop_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{app.full_name} &middot; {app.email}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[app.status] ?? "outline"}>
                    {app.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div><span className="text-muted-foreground">Category:</span> {app.product_category}</div>
                  <div><span className="text-muted-foreground">Country:</span> {app.country}</div>
                  <div><span className="text-muted-foreground">Payout:</span> {app.payout_method}</div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <span className="text-muted-foreground">Description:</span>{" "}
                    {app.shop_description.length > 150
                      ? app.shop_description.slice(0, 150) + "..."
                      : app.shop_description}
                  </div>
                  <div className="text-muted-foreground">
                    Applied {new Date(app.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setSelectedApp(app)}>
                        <Eye className="mr-1.5 h-3.5 w-3.5" /> View details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{app.shop_name} — Full Details</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 text-sm">
                        <DetailRow label="Full name" value={app.full_name} />
                        <DetailRow label="Email" value={app.email} />
                        <DetailRow label="Country" value={app.country} />
                        <DetailRow label="Bio" value={app.bio} />
                        <DetailRow label="Shop name" value={app.shop_name} />
                        <DetailRow label="Category" value={app.product_category} />
                        <DetailRow label="Shop description" value={app.shop_description} />
                        <DetailRow label="Payout method" value={app.payout_method} />
                        <DetailRow label="Terms agreed" value={app.terms_agreed ? "Yes" : "No"} />
                        {app.sample_photo_url && (
                          <div>
                            <span className="text-muted-foreground">Sample photo:</span>
                            <img src={app.sample_photo_url} alt="Sample" className="mt-1 max-h-48 rounded-lg border" />
                          </div>
                        )}
                        <DetailRow
                          label="Applied"
                          value={new Date(app.created_at).toLocaleString("en-GB")}
                        />
                      </div>
                    </DialogContent>
                  </Dialog>

                  {app.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleAction(app.id, "approved")}
                        disabled={actionLoading === app.id}
                      >
                        {actionLoading === app.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleAction(app.id, "rejected")}
                        disabled={actionLoading === app.id}
                      >
                        {actionLoading === app.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div>
    <span className="text-muted-foreground">{label}:</span>{" "}
    {value || <span className="italic text-muted-foreground">Not provided</span>}
  </div>
);
