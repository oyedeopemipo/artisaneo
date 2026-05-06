import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Browse from "./pages/Browse.tsx";
import ServiceDetail from "./pages/ServiceDetail.tsx";
import Auth from "./pages/Auth.tsx";
import SellerProfile from "./pages/SellerProfile.tsx";
import PublicSellerProfile from "./pages/PublicSellerProfile.tsx";
import BecomeASeller from "./pages/BecomeASeller.tsx";
import SellApply from "./pages/SellApply.tsx";
import SellSuccess from "./pages/SellSuccess.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import NotFound from "./pages/NotFound.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/service/:id" element={<ServiceDetail />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/seller/profile" element={<ProtectedRoute><SellerProfile /></ProtectedRoute>} />
          <Route path="/seller/:id" element={<PublicSellerProfile />} />
          <Route path="/become-a-seller" element={<BecomeASeller />} />
          <Route path="/sell" element={<BecomeASeller />} />
          <Route path="/sell/apply" element={<ProtectedRoute><SellApply /></ProtectedRoute>} />
          <Route path="/sell/success" element={<ProtectedRoute><SellSuccess /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
