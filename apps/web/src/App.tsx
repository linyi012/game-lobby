import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { GameLobbyPage } from './pages/GameLobbyPage';
import { RoomPage } from './pages/RoomPage';
import { WordPackManagePage } from './games/draw-guess/WordPackManagePage';
import { PairPackManagePage } from './games/undercover/PairPackManagePage';
import { Layout } from './components/Layout';

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
        <Route path="games/:gameType/word-packs" element={<WordPackManagePage />} />
        <Route path="games/undercover/word-pairs" element={<PairPackManagePage />} />
        <Route path="games/:gameType" element={<GameLobbyPage />} />
        <Route path="games/:gameType/room/:roomId" element={<RoomPage />} />
      </Route>
    </Routes>
  );
}
