import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { SessionProvider } from "./components/SessionProvider"; // Updated import path
import { ThemeProvider } from "next-themes";
import React, { useEffect } from "react";
import MainLayout from "./components/MainLayout";
import SettingsPage from "./pages/SettingsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SchedulerPage from "./pages/SchedulerPage";
import DocumentationPage from "./pages/DocumentationPage";
import EnvironmentProvider from "./components/EnvironmentProvider";
import EnergyRegenInitializer from "./components/EnergyRegenInitializer";
import ModelPage from "./pages/ModelPage";
import SimplifiedSchedulePage from "./pages/SimplifiedSchedulePage";
import WellnessPage from "./pages/WellnessPage";
import AetherSinkPage from "./pages/AetherSinkPage";
import RecapPage from "./pages/RecapPage"; // NEW IMPORT
import { useSession } from "./hooks/use-session";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user } = useSession();
  
  // Log to track if AppContent remounts unnecessarily
  useEffect(() => {
    console.log("[AppContent] Mounted/Re-rendered. User ID:", user?.id);
  });

  return (
    <MainLayout key={user?.id || 'guest'}>
      <Routes>
        <Route path="/" element={<Navigate to="/scheduler" replace />} />
        
        {/* Secondary Pages */}
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/wellness" element={<WellnessPage />} />
        <Route path="/documentation" element={<DocumentationPage />} />
        <Route path="/model" element={<ModelPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/simplified-schedule" element={<SimplifiedSchedulePage />} />
        
        {/* SCHEDULER CORE VIEWS */}
        <Route path="/scheduler" element={<SchedulerPage view="schedule" />} />
        <Route path="/sink" element={<AetherSinkPage />} />
        <Route path="/recap" element={<RecapPage />} /> {/* NEW: Add RecapPage route */}
        
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MainLayout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider delayDuration={200}>
        <React.Fragment>
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <EnvironmentProvider>
              <SessionProvider>
                <EnergyRegenInitializer />
                <AppContent />
              </SessionProvider>
            </EnvironmentProvider>
          </BrowserRouter>
        </React.Fragment>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;