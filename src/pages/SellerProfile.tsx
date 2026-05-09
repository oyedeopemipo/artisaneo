import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Globe, MapPin, Megaphone, Sparkles, Store, CreditCard, CheckCircle2, Loader2 } from "lucide-react";

const profileSchema = z.object({
  display_name: z.string().trim().min(2, "Display name must be at least 2 characters").max(100, "Display name must be 100 characters or fewer"),
  city: z.string().trim().min(2, "City is required").max(100, "City must be 100 characters or fewer"),
  bio: z.string().trim().min(30, "Business description must be at least 30 characters").max(600, "Business description must be 600 characters or fewer"),
  avatar_url: z.union([z.literal(""), z.string().trim().url("Enter a valid image URL")]),
});

type ProfileForm = z.infer<typeof profileSchema>;

const emptyForm: ProfileForm = {
  display_name: "",
  city: "",
  bio: "",
  avatar_url: "",
};

const SellerProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [stripeStatus, setStripeStatus] = useState<{ has_account: boolean; complete: boolean }>({ has_account: false, complete: false });
  const [stripeLoading, setStripeLoading] = useState(false);

  const loadStripeStatus = async (uid: string) => {
    const { data } = await supabase
      .from("seller_profiles")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("user_id", uid)
      .maybeSingle();
    setStripeStatus({
      has_account: !!data?.stripe_account_id,
      complete: !!data?.stripe_onboarding_complete,
    });
  };

  const handleConnectStripe = async () => {
    setStripeLoading(true);
    const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", { body: {} });
    setStripeLoading(false);
    if (error || !data?.url) {
      toast.error((data as { error?: string } | null)?.error || error?.message || "Could not start onboarding");
      return;
    }
    window.location.href = data.url as string;
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        navigate("/auth?redirect=/seller/profile");
        return;
      }

      const [{ data: profile }, { data: role }] = await Promise.all([
        supabase.from("profiles").select("display_name, city, bio, avatar_url").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "seller").maybeSingle(),
      ]);

      if (!active) return;

      setUserId(user.id);
      setIsSeller(Boolean(role));
      setForm({
        display_name: profile?.display_name ?? user.user_metadata?.display_name ?? "",
        city: profile?.city ?? "",
        bio: profile?.bio ?? "",
        avatar_url: profile?.avatar_url ?? "",
      });
      await loadStripeStatus(user.id);
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [navigate]);

  const initials = useMemo(() => {
    const label = form.display_name.trim() || "A";
    return label.slice(0, 1).toUpperCase();
  }, [form.display_name]);

  const updateField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!userId) {
      navigate("/auth?redirect=/seller/profile");
      return;
    }

    if (!isSeller) {
      toast.error("Only seller accounts can create an advertising profile.");
      return;
    }

    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please review your profile details.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      display_name: parsed.data.display_name,
      city: parsed.data.city,
      bio: parsed.data.bio,
      avatar_url: parsed.data.avatar_url || null,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Seller profile updated.");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="container flex-1 py-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <Skeleton className="h-[540px] rounded-2xl" />
            <Skeleton className="h-[540px] rounded-2xl" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isSeller) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="container flex-1 py-16">
          <section className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 shadow-card-soft md:p-10">
            <Badge variant="secondary" className="mb-4">Advertising profile</Badge>
            <h1 className="font-display text-3xl font-semibold">Switch to a seller account to advertise</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              This page is reserved for artisans who want a public-facing profile for promoting their services.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="hero" asChild>
                <Link to="/auth?mode=signup">Create seller account</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/browse">Browse marketplace</Link>
              </Button>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <section className="border-b border-border bg-gradient-soft">
          <div className="container py-10">
            <Badge variant="secondary" className="mb-4">Seller tools</Badge>
            <h1 className="font-display text-4xl font-semibold md:text-5xl">Create your advertising profile</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Shape how buyers see your business with a polished identity, local trust signals, and a concise service pitch.
            </p>
          </div>
        </section>

        <section className="container py-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-card-soft md:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="display_name">Business or seller name</Label>
                  <Input
                    id="display_name"
                    value={form.display_name}
                    onChange={(event) => updateField("display_name", event.target.value)}
                    placeholder="Oak & Clay Studio"
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(event) => updateField("city", event.target.value)}
                      placeholder="Bristol"
                      className="pl-10"
                      maxLength={100}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avatar_url">Profile image URL</Label>
                  <div className="relative">
                    <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="avatar_url"
                      type="url"
                      value={form.avatar_url}
                      onChange={(event) => updateField("avatar_url", event.target.value)}
                      placeholder="https://..."
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Advertising description</Label>
                <Textarea
                  id="bio"
                  value={form.bio}
                  onChange={(event) => updateField("bio", event.target.value)}
                  placeholder="Describe your craft, style, ideal projects, and what buyers can expect when booking you."
                  maxLength={600}
                  className="min-h-[180px]"
                />
                <p className="text-sm text-muted-foreground">{form.bio.length}/600 characters</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" variant="hero" size="lg" disabled={saving}>
                  {saving ? "Saving profile..." : "Save advertising profile"}
                </Button>
                <Button type="button" variant="outline" size="lg" asChild>
                  <Link to="/browse">View marketplace</Link>
                </Button>
              </div>
            </form>

            <aside className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft">
                <div className="flex items-start gap-4">
                  <Avatar className="h-20 w-20 border border-border">
                    <AvatarImage src={form.avatar_url || undefined} alt={form.display_name || "Seller avatar"} />
                    <AvatarFallback className="bg-secondary font-display text-2xl text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2">
                      <Badge>Seller</Badge>
                      <Badge variant="outline">Advertising ready</Badge>
                    </div>
                    <h2 className="mt-3 font-display text-2xl font-semibold">{form.display_name || "Your business name"}</h2>
                    <p className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" /> {form.city || "Your city"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-xl border border-border bg-secondary/40 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium"><Megaphone className="h-4 w-4 text-primary" /> Marketplace impression</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {form.bio || "Your description will appear here once you add a clear introduction for buyers."}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    {[
                      { icon: Store, title: "Stronger trust", text: "A complete profile helps buyers feel confident before messaging." },
                      { icon: Sparkles, title: "Better conversion", text: "A focused description makes your services easier to book." },
                    ].map((item) => (
                      <div key={item.title} className="rounded-xl border border-border p-4">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <item.icon className="h-4 w-4 text-primary" /> {item.title}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default SellerProfile;