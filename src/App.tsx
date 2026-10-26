import { useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/AuthScreen';
import { AppLayout } from '@/components/AppLayout';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/Logo';

function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center gap-4">
        <Logo size={40} />
        <div className="flex items-center gap-2 text-sub text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading BLOOP...
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <AppLayout />;
}

export default App;
