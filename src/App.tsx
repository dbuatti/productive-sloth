import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from './hooks/use-session';
import IndexPage from './pages/Index';
import LoginPage from './pages/Login';
import SchedulerPage from './pages/SchedulerPage';
import { Toaster } from 'react-hot-toast';
import { TooltipProvider } from './components/ui/tooltip';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { EnvironmentProvider } from './hooks/use-environment-context';

const queryClient = new QueryClient();

const App = () => {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <EnvironmentProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              {user ? (
                <>
                  <Route path="/" element={<IndexPage />} />
                  <Route path="/schedule" element={<SchedulerPage view="schedule" />} />
                  <Route path="/sink" element={<SchedulerPage view="sink" />} />
                  <Route path="*" element={<Navigate to="/schedule" replace />} />
                </>
              ) : (
                <Route path="*" element={<Navigate to="/login" replace />} />
              )}
            </Routes>
          </Router>
          <Toaster />
        </EnvironmentProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;