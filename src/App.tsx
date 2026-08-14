import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from './router';
import { ThemeLoader } from './components/common/ThemeLoader';
import { CartProvider } from './features/cart/CartContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeLoader />
      <CartProvider>
        <AppRouter />
      </CartProvider>
    </QueryClientProvider>
  );
}

export default App;