import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './i18n';
import './index.css';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { ThemeProvider } from './theme/ThemeContext';
import { ConfirmProvider } from './components/ConfirmProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Keep on-screen data live: refetch when returning to the tab or remounting a page,
      // and treat data as stale quickly so navigation re-fetches.
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 5_000,
    },
  },
  // Any successful write (create/update/status-change/assign/…) refreshes all active
  // queries, so the change shows everywhere without a manual page refresh.
  mutationCache: new MutationCache({
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  }),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
