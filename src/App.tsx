import { AlertTriangleIcon, FileQuestionIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Link, Route, Routes } from 'react-router';
import { useStore } from 'zustand';

import { Layout } from '@/app/Layout';
import { ServicesContext, type AppServices } from '@/app/services';
import { EmptyState, Spinner } from '@/components/States';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { DebriefPage } from '@/features/debrief/DebriefPage';
import { ProblemRoute } from '@/features/problem/ProblemPage';
import { ProblemListPage } from '@/features/problems/ProblemListPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ProblemListPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/problems/:problemId" element={<ProblemRoute />} />
      <Route path="/problems/:problemId/debrief" element={<DebriefPage />} />
      <Route
        path="*"
        element={
          <EmptyState
            icon={FileQuestionIcon}
            title="Page not found"
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/">Back to problems</Link>
              </Button>
            }
          />
        }
      />
    </Routes>
  );
}

/** Root component. The router is provided by the caller (BrowserRouter in the app, MemoryRouter in tests). */
export function App({ services }: { services: AppServices }) {
  const status = useStore(services.store, (s) => s.status);
  const error = useStore(services.store, (s) => s.error);
  const theme = useStore(services.store, (s) => s.settings.theme);

  useEffect(() => {
    void services.store.getState().init();
    void services.runner.warmUp();
  }, [services]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return (
    <ServicesContext.Provider value={services}>
      <TooltipProvider delayDuration={300}>
        {status === 'loading' ? (
          <div className="flex h-full items-center justify-center">
            <Spinner label="Loading your library…" />
          </div>
        ) : status === 'error' ? (
          <EmptyState
            icon={AlertTriangleIcon}
            title="Elite Code couldn't open its local database"
            action={
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Reload
              </Button>
            }
          >
            {error}. IndexedDB may be disabled, for example in a private window.
          </EmptyState>
        ) : (
          <Layout>
            <AppRoutes />
          </Layout>
        )}
        <Toaster theme={theme} />
      </TooltipProvider>
    </ServicesContext.Provider>
  );
}
