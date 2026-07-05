import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 0,
			gcTime: 5 * 60 * 1000,
			refetchOnMount: true,
			refetchOnWindowFocus: true,
			retry: 1,
		},
	},
});