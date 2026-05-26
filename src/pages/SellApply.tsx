import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader as Loader2 } from "lucide-react";

const CATEGORIES = ["Jewelry", "Textiles", "Ceramics", "Art", "Woodwork", "Leather", "Other"];
const PAYOUT_METHODS = ["Bank Transfer", "PayPal", "Other"];

const step1Schema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
  country: z.string().trim().min(2, "Please enter a country").max(80),
  bio: z.string().trim().max(500, "Keep it under 500 characters").optional().or(z.literal("")),
});

const step2Schema = z.object({
  shop_name: z.string().trim().min(2, "Please enter a shop name").max(80),
  product_category: z.string().min(1, "Please choose a category"),
  shop_description: z
    .string()
    .trim()
    .min(20, "Tell us a little more (at least 20 characters)")
    .max(1000),
});

const step3Schema = z.object({
  payout_method: z.string().min(1, "Please choose a payout method"),
  terms_agreed: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the seller terms" }),
  }),
});

type FormState = {
  full_name: string;
  email: string;
  country: string;
  bio: string;
  shop_name: string;
  product_category: string;
  shop_description: string;
  sample_photo: File | null;
  payout_method: string;
  terms_agreed: boolean;
};

const initialForm: FormState = {
  full_name: "",
  email: "",
  country: "",
  bio: "",
  shop_name: "",
  product_category: "",
  shop_description: "",
  sample_photo: null,
  payout_method: "",
  terms_agreed: false,
};

const SellApply = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) {
        toast.info("Please sign in to apply as a seller");
        navigate("/auth?mode=signup&redirect=/sell/apply");
        return;
      }
      setUserId(u.id);
      setForm((f) => ({ ...f, email: f.email || u.email || "" }));
    });
  }, [navigate]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const { [key as string]: _, ...rest } = e;
      return rest;
    });
  };

  const validateStep = (): boolean => {
    let result;
    if (step === 1) result = step1Schema.safeParse(form);
    else if (step === 2) result = step2Schema.safeParse(form);
    else result = step3Schema.safeParse(form);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => {
        if (i.path[0]) fieldErrors[String(i.path[0])] = i.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleNext = () => {
    if (validateStep()) setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    if (!validateStep() || !userId) return;
    setSubmitting(true);
    try {
      let sample_photo_url: string | null = null;
      if (form.sample_photo) {
        const ext = form.sample_photo.name.split(".").pop() || "jpg";
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("seller-uploads")
          .upload(path, form.sample_photo, { upsert: false });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("seller-uploads").getPublicUrl(path);
        sample_photo_url = data.publicUrl;
      }

      // 1. Create the seller profile (status defaults to 'active')
      const { error: profileError } = await supabase.from("seller_profiles").insert({
        user_id: userId,
        full_name: form.full_name.trim(),
        location: form.country.trim(),
        bio: form.bio.trim() || null,
        shop_name: form.shop_name.trim(),
        service_category: form.product_category,
        shop_description: form.shop_description.trim(),
        photo_url: sample_photo_url,
      });
      if (profileError) throw profileError;

      // 2. Add seller role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: "seller",
      });
      if (roleError) throw roleError;

      // 3. Also keep the application record for admin visibility
      const { error: appError } = await supabase.from("seller_applications").insert({
        user_id: userId,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        country: form.country.trim(),
        bio: form.bio.trim() || null,
        shop_name: form.shop_name.trim(),
        product_category: form.product_category,
        shop_description: form.shop_description.trim(),
        sample_photo_url,
        payout_method: form.payout_method,
        terms_agreed: form.terms_agreed,
        status: "approved",
      });
      if (appError) throw appError;

      navigate(`/artisans/${userId}?live=1`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error("Could not submit application", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const progress = (step / 3) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="container max-w-2xl py-12 md:py-16">
        <div className="mb-8">
          <Link to="/become-a-seller" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to overview
          </Link>
          <h1 className="mt-4 font-display text-3xl font-semibold md:text-4xl">Become a Seller</h1>
          <p className="mt-2 text-muted-foreground">Step {step} of 3</p>
          <Progress value={progress} className="mt-3 h-2" />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft md:p-8">
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-display text-xl font-semibold">About you</h2>
              <Field label="Full name" error={errors.full_name} required>
                <Input
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  placeholder="Jane Doe"
                />
              </Field>
              <Field label="Email" error={errors.email} required>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="Country / location" error={errors.country} required>
                <Input
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                  placeholder="United Kingdom"
                />
              </Field>
              <Field label="Short bio" error={errors.bio} hint="Optional — tell us about yourself">
                <Textarea
                  value={form.bio}
                  onChange={(e) => update("bio", e.target.value)}
                  rows={3}
                  placeholder="A few words about your craft and experience"
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-display text-xl font-semibold">Your shop</h2>
              <Field label="Shop name" error={errors.shop_name} required>
                <Input
                  value={form.shop_name}
                  onChange={(e) => update("shop_name", e.target.value)}
                  placeholder="The Clay Studio"
                />
              </Field>
              <Field label="Product category" error={errors.product_category} required>
                <Select
                  value={form.product_category}
                  onValueChange={(v) => update("product_category", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="What do you sell?" error={errors.shop_description} required>
                <Textarea
                  value={form.shop_description}
                  onChange={(e) => update("shop_description", e.target.value)}
                  rows={4}
                  placeholder="Describe your products, materials and what makes them special"
                />
              </Field>
              <Field label="Sample photo" hint="Optional — upload a photo of your work">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => update("sample_photo", e.target.files?.[0] ?? null)}
                />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-display text-xl font-semibold">Payouts</h2>
              <Field label="Preferred payout method" error={errors.payout_method} required>
                <Select
                  value={form.payout_method}
                  onValueChange={(v) => update("payout_method", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a payout method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYOUT_METHODS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="space-y-2">
                <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4">
                  <Checkbox
                    id="terms"
                    checked={form.terms_agreed}
                    onCheckedChange={(v) => update("terms_agreed", Boolean(v))}
                  />
                  <Label htmlFor="terms" className="text-sm font-normal leading-relaxed">
                    I agree to the Artisaneo seller terms, including listing accuracy, fulfilment
                    standards, and applicable platform fees.
                  </Label>
                </div>
                {errors.terms_agreed && (
                  <p className="text-sm font-medium text-destructive">{errors.terms_agreed}</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1 || submitting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            {step < 3 ? (
              <Button onClick={handleNext}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button variant="hero" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
                  </>
                ) : (
                  "Submit application"
                )}
              </Button>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const Field = ({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium">
      {label} {required && <span className="text-destructive">*</span>}
    </Label>
    {children}
    {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    {error && <p className="text-sm font-medium text-destructive">{error}</p>}
  </div>
);

export default SellApply;
