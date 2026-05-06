import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);
const nameSchema = z.string().trim().min(1, "Name is required").max(100);

const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"buyer" | "seller" | "both">("buyer");

  const redirectTo = params.get("redirect") || "/browse";

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate(redirectTo, { replace: true });
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate(redirectTo, { replace: true }); });
    return () => sub.subscription.unsubscribe();
  }, [navigate, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsedName = nameSchema.parse(name);
        const parsedEmail = emailSchema.parse(email);
        const parsedPwd = passwordSchema.parse(password);

        const { data, error } = await supabase.auth.signUp({
          email: parsedEmail,
          password: parsedPwd,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: parsedName },
          },
        });
        if (error) throw error;

        // Insert role(s)
        if (data.user) {
          const roles: ("buyer" | "seller")[] = role === "both" ? ["buyer", "seller"] : [role];
          await supabase.from("user_roles").insert(roles.map((r) => ({ user_id: data.user!.id, role: r })));
        }
        toast.success("Welcome to Artisaneo!");
      } else {
        const parsedEmail = emailSchema.parse(email);
        const { error } = await supabase.auth.signInWithPassword({ email: parsedEmail, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.errors[0].message : err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-soft">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-gold text-accent-foreground shadow-gold">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
              <p className="text-sm text-muted-foreground">{mode === "signup" ? "Join Artisaneo in seconds" : "Sign in to continue"}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required maxLength={100} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : ""} required />
            </div>
            {mode === "signup" && (
              <div className="space-y-2">
                <Label>I want to</Label>
                <RadioGroup value={role} onValueChange={(v) => setRole(v as typeof role)} className="grid grid-cols-3 gap-2">
                  {[
                    { v: "buyer", l: "Book" },
                    { v: "seller", l: "Sell" },
                    { v: "both", l: "Both" },
                  ].map((opt) => (
                    <Label
                      key={opt.v}
                      htmlFor={`role-${opt.v}`}
                      className={`flex cursor-pointer items-center justify-center rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${
                        role === opt.v ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-secondary"
                      }`}
                    >
                      <RadioGroupItem id={`role-${opt.v}`} value={opt.v} className="sr-only" />
                      {opt.l}
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            )}

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account? " : "New to Artisaneo? "}
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="font-medium text-primary hover:underline"
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">← Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Auth;
