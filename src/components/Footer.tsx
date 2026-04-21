import { Sparkles } from "lucide-react";

export const Footer = () => (
  <footer className="border-t border-border/60 bg-secondary/40">
    <div className="container flex flex-col items-center justify-between gap-4 py-8 md:flex-row">
      <div className="flex items-center gap-2 font-display text-lg font-semibold text-primary">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-gold text-accent-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        Artisaneo
      </div>
      <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Artisaneo. Crafted in the UK.</p>
    </div>
  </footer>
);
