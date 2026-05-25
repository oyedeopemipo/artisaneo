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
import BookingConfirmation from "./pages/BookingConfirmation.tsx";
import BookingCancelled from "./pages/BookingCancelled.tsx";
import BuyerDashboard from "./pages/BuyerDashboard.tsx";
import SellerDashboard from "./pages/SellerDashboard.tsx";
import Messages from "./pages/Messages.tsx";
import NotFound from "./pages/NotFound.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { AdminLayout } from "./components/AdminLayout";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { SellerApplications } from "./pages/admin/SellerApplications";
import { AllUsers } from "./pages/admin/AllUsers";
import { BookingsOverview } from "./pages/admin/BookingsOverview";
import { Reports } from "./pages/admin/Reports";

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
          <Route path="/booking/confirmation" element={<BookingConfirmation />} />
          <Route path="/booking/cancelled" element={<BookingCancelled />} />
          <Route path="/dashboard/buyer" element={<ProtectedRoute><BuyerDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/seller" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="applications" element={<SellerApplications />} />
            <Route path="users" element={<AllUsers />} />
            <Route path="bookings" element={<BookingsOverview />} />
            <Route path="reports" element={<Reports />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
