import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { SessionProvider } from "./components/SessionProvider";
import { ThemeProvider } from "next-themes";
import React from "react";
import MainLayout from "./components/MainLayout";
import TasksPage from "./pages/TasksPage";
import AchievementsPage from "./pages/AchievementsPage";
import SettingsPage from "./pages/SettingsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SchedulerPage from "./pages/SchedulerPage";
import DocumentationPage from "./pages/DocumentationPage";
import EnvironmentProvider from "./components/EnvironmentProvider";
import EnergyRegenInitializer from "./components/EnergyRegenInitializer";

const queryClient = new QueryClient();

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
                <MainLayout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/scheduler" replace />} />
                    <Route path="/tasks" element={<TasksPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/achievements" element={<AchievementsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    
                    {/* NEW SCHEDULER ROUTES */}
                    <Route path="/scheduler" element={<SchedulerPage view="schedule" />} />
                    <Route path="/sink" element={<SchedulerPage view="sink" />} />
                    <Route path="/recap" element={<SchedulerPage view="recap" />} />
                    
                    <Route path="/documentation" element={<DocumentationPage />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </MainLayout>
              </SessionProvider>
            </EnvironmentProvider>
          </BrowserRouter>
        </React.Fragment>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;