import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { SessionProvider } from "./components/SessionProvider";
import { ThemeProvider } from "next-themes";
import React from "react";
import MainLayout from "./components/MainLayout"; // Import MainLayout
import Dashboard from "./pages/Dashboard"; // Pre-emptively import Dashboard
import TasksPage from "./pages/TasksPage"; // Pre-emptively import TasksPage
import AchievementsPage from "./pages/AchievementsPage"; // Pre-emptively import AchievementsPage
import SettingsPage from "./pages/SettingsPage"; // Import SettingsPage

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider delayDuration={200}>
        <React.Fragment>
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <SessionProvider>
              <MainLayout> {/* Wrap routes with MainLayout */}
                <Routes>
                  <Route path="/" element={<Dashboard />} /> {/* Changed default to Dashboard */}
                  <Route path="/tasks" element={<TasksPage />} /> {/* New route for tasks */}
                  <Route path="/achievements" element={<AchievementsPage />} /> {/* New route for achievements */}
                  <Route path="/settings" element={<SettingsPage />} /> {/* New route for settings */}
                  <Route path="/login" element={<Login />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </MainLayout>
            </SessionProvider>
          </BrowserRouter>
        </React.Fragment>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;