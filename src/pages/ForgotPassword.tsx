import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

const emailSchema = z.string().trim().email("Enter a valid email").max(255);

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const parsed = emailSchema.parse(email);
      const { error } = await supabase.auth.resetPasswordForEmail(parsed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Check your inbox for the reset link.");
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
              <h1 className="font-display text-2xl font-semibold">Reset your password</h1>
              <p className="text-sm text-muted-foreground">We'll email you a secure link</p>
            </div>
          </div>

          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If an account exists for <span className="font-medium text-foreground">{email}</span>, a reset link is on its way.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required maxLength={255} />
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send reset link"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link to="/auth" className="hover:underline">← Back to sign in</Link>
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
