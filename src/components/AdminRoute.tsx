import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader as Loader2 } from "lucide-react";

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [status, setStatus] = useState<"loading" | "admin" | "unauthorized" | "guest">("loading");

  useEffect(() => {
    const check = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setStatus("guest");
        return;
      }

      const userId = sessionData.session.user.id;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      setStatus(data ? "admin" : "unauthorized");
    };

    void check();
  }, []);

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (status === "guest") {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?redirect=${redirect}`} replace />;
  }

  if (status === "unauthorized") {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <p className="text-lg font-semibold">Access denied</p>
          <p className="text-sm">You do not have admin privileges.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
