import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,      // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (err) => {
        console.error('[mutation error]', err);
      },
    },
  },
});
