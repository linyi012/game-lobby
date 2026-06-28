import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { GameLobbyPage } from './pages/GameLobbyPage';
import { RoomPage } from './pages/RoomPage';
import { Layout } from './components/Layout';

const WordPackManagePage = lazy(() =>
  import('./games/draw-guess/WordPackManagePage').then((m) => ({ default: m.WordPackManagePage })),
);
const PairPackManagePage = lazy(() =>
  import('./games/undercover/PairPackManagePage').then((m) => ({ default: m.PairPackManagePage })),
);
const ScriptListPage = lazy(() =>
  import('./games/script-murder/ScriptListPage').then((m) => ({ default: m.ScriptListPage })),
);
const ScriptEditorPage = lazy(() =>
  import('./games/script-murder/ScriptEditorPage').then((m) => ({ default: m.ScriptEditorPage })),
);

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="word-packs" element={<Navigate to="/games/draw_guess/word-packs" replace />} />
        <Route path="games/:gameType/word-packs" element={<Suspense fallback={<p style={{ color: 'var(--text-muted)' }}>加载中…</p>}><WordPackManagePage /></Suspense>} />
        <Route path="games/undercover/word-pairs" element={<Suspense fallback={<p style={{ color: 'var(--text-muted)' }}>加载中…</p>}><PairPackManagePage /></Suspense>} />
        <Route path="games/script_murder/scripts" element={<Suspense fallback={<p style={{ color: 'var(--text-muted)' }}>加载中…</p>}><ScriptListPage /></Suspense>} />
        <Route path="games/script_murder/scripts/:id/edit" element={<Suspense fallback={<p style={{ color: 'var(--text-muted)' }}>加载中…</p>}><ScriptEditorPage /></Suspense>} />
        <Route path="games/:gameType" element={<GameLobbyPage />} />
        <Route path="games/:gameType/room/:roomId" element={<RoomPage />} />
      </Route>
    </Routes>
  );
}
