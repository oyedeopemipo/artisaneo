import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, Upload } from "lucide-react";

const CATEGORIES = ["Hair", "Makeup", "Photography", "Catering", "Music", "Other"] as const;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const step1Schema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  location: z.string().trim().min(2, "Location is required").max(100),
  bio: z.string().trim().max(600, "Bio must be 600 characters or fewer").optional().or(z.literal("")),
  photo_url: z.string().trim().url().optional().or(z.literal("")),
});
const step2Schema = z.object({
  shop_name: z.string().trim().min(2, "Shop name is required").max(100),
  service_category: z.enum(CATEGORIES, { required_error: "Choose a category" }),
  shop_description: z.string().trim().min(20, "Describe your shop in at least 20 characters").max(1000),
});
const step3Schema = z.object({
  availability_days: z.array(z.string()).min(1, "Pick at least one day"),
  availability_start: z.string().min(1, "Start time required"),
  availability_end: z.string().min(1, "End time required"),
}).refine((v) => v.availability_end > v.availability_start, {
  message: "End time must be after start time",
  path: ["availability_end"],
});

type FormState = {
  full_name: string;
  location: string;
  bio: string;
  photo_url: string;
  shop_name: string;
  service_category: typeof CATEGORIES[number] | "";
  shop_description: string;
  availability_days: string[];
  availability_start: string;
  availability_end: string;
};

const initial: FormState = {
  full_name: "",
  location: "",
  bio: "",
  photo_url: "",
  shop_name: "",
  service_category: "",
  shop_description: "",
  availability_days: [],
  availability_start: "09:00",
  availability_end: "17:00",
};

const STEPS = ["Personal", "Shop", "Availability", "Review"] as const;

const BecomeASeller = () => {
  const navigate = useNavigate();
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthLoading(false);
      if (!session) navigate("/auth?redirect=/become-a-seller", { replace: true });
    });
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      setAuthLoading(false);
      if (!uid) navigate("/auth?redirect=/become-a-seller", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const toggleDay = (day: string) => {
    setForm((p) => ({
      ...p,
      availability_days: p.availability_days.includes(day)
        ? p.availability_days.filter((d) => d !== day)
        : [...p.availability_days, day],
    }));
  };

  const handlePhotoUpload = async (file: File) => {
    if (!userId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("seller-profile-photos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("seller-profile-photos").getPublicUrl(path);
      update("photo_url", data.publicUrl);
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const validateStep = (s: number): boolean => {
    try {
      if (s === 0) step1Schema.parse({ full_name: form.full_name, location: form.location, bio: form.bio, photo_url: form.photo_url });
      else if (s === 1) step2Schema.parse({ shop_name: form.shop_name, service_category: form.service_category, shop_description: form.shop_description });
      else if (s === 2) step3Schema.parse({ availability_days: form.availability_days, availability_start: form.availability_start, availability_end: form.availability_end });
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.errors[0].message);
      return false;
    }
  };

  const next = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    if (!userId) return;
    if (!validateStep(0) || !validateStep(1) || !validateStep(2)) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("seller_profiles").upsert({
        user_id: userId,
        full_name: form.full_name,
        location: form.location,
        bio: form.bio || null,
        photo_url: form.photo_url || null,
        shop_name: form.shop_name,
        service_category: form.service_category as string,
        shop_description: form.shop_description,
        availability_days: form.availability_days,
        availability_start: form.availability_start,
        availability_end: form.availability_end,
      }, { onConflict: "user_id" });
      if (error) throw error;

      // Ensure user has the seller role
      await supabase.from("user_roles").insert({ user_id: userId, role: "seller" }).then(() => null, () => null);

      setDone(true);
      setTimeout(() => navigate("/seller/profile"), 1800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setSubmitting(false);
    }
  };

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-soft">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-soft">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-elegant">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-gradient-gold text-accent-foreground shadow-gold">
              <Check className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl font-semibold">You're all set!</h1>
            <p className="mt-2 text-sm text-muted-foreground">Taking you to your seller dashboard…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-soft">
      <Navbar />
      <main className="flex-1">
        <div className="container max-w-2xl py-10">
          <div className="mb-8">
            <p className="text-sm font-medium text-primary">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
            <h1 className="mt-1 font-display text-3xl font-semibold">Become a seller on Artisaneo</h1>
            <Progress value={progress} className="mt-4" />
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              {STEPS.map((s, i) => (
                <span key={s} className={i <= step ? "font-medium text-foreground" : ""}>{s}</span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant md:p-8">
            {step === 0 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input id="full_name" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="City, Country" maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Short bio (optional)</Label>
                  <Textarea id="bio" value={form.bio} onChange={(e) => update("bio", e.target.value)} rows={4} maxLength={600} placeholder="Tell buyers a little about you…" />
                </div>
                <div className="space-y-2">
                  <Label>Profile photo</Label>
                  <div className="flex items-center gap-4">
                    {form.photo_url ? (
                      <img src={form.photo_url} alt="Profile preview" className="h-16 w-16 rounded-full object-cover" />
                    ) : (
                      <div className="grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground">
                        <Upload className="h-5 w-5" />
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                      />
                      <span className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
                        {uploading ? "Uploading…" : form.photo_url ? "Change photo" : "Upload photo"}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="shop_name">Shop name</Label>
                  <Input id="shop_name" value={form.shop_name} onChange={(e) => update("shop_name", e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>Service category</Label>
                  <Select value={form.service_category || undefined} onValueChange={(v) => update("service_category", v as FormState["service_category"])}>
                    <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shop_description">Shop description</Label>
                  <Textarea id="shop_description" value={form.shop_description} onChange={(e) => update("shop_description", e.target.value)} rows={5} maxLength={1000} placeholder="What do you offer? What makes your shop special?" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Available days</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {DAYS.map((d) => {
                      const checked = form.availability_days.includes(d);
                      return (
                        <label key={d} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${checked ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"}`}>
                          <Checkbox checked={checked} onCheckedChange={() => toggleDay(d)} />
                          <span>{d.slice(0, 3)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start">Start time</Label>
                    <Input id="start" type="time" value={form.availability_start} onChange={(e) => update("availability_start", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end">End time</Label>
                    <Input id="end" type="time" value={form.availability_end} onChange={(e) => update("availability_end", e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 text-sm">
                <ReviewRow label="Name" value={form.full_name} />
                <ReviewRow label="Location" value={form.location} />
                {form.bio && <ReviewRow label="Bio" value={form.bio} />}
                <ReviewRow label="Shop" value={form.shop_name} />
                <ReviewRow label="Category" value={form.service_category} />
                <ReviewRow label="Description" value={form.shop_description} />
                <ReviewRow label="Available days" value={form.availability_days.join(", ") || "—"} />
                <ReviewRow label="Hours" value={`${form.availability_start} – ${form.availability_end}`} />
              </div>
            )}

            <div className="mt-8 flex items-center justify-between">
              <Button variant="ghost" onClick={back} disabled={step === 0 || submitting}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button variant="hero" onClick={next}>
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="hero" onClick={submit} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit application"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const ReviewRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1 border-b border-border/60 pb-3 sm:flex-row sm:items-start sm:justify-between">
    <span className="font-medium text-muted-foreground">{label}</span>
    <span className="sm:max-w-[60%] sm:text-right">{value}</span>
  </div>
);

export default BecomeASeller;
