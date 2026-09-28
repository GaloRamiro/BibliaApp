import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home/Home";
import Auth from "./pages/Auth/Auth";
import Perfil from "./pages/Perfil/Perfil";
import CrearSala from "./pages/CrearSala/CrearSala";
import Sala from "./pages/Sala/Sala";
import UnirseSala from "./pages/UnirseSala/UnirseSala";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login y registro */}
        <Route path="/login" element={<Auth />} />

        {/* Home */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        {/* Crear una nueva sala */}
        <Route
          path="/crear-sala"
          element={
            <ProtectedRoute>
              <CrearSala />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sala/:id"
          element={
            <ProtectedRoute>
              <Sala />
            </ProtectedRoute>
          }
        />
        {/* Unirse a una sala */}
        <Route
          path="/unirse-sala"
          element={
            <ProtectedRoute>
              <UnirseSala />
            </ProtectedRoute>
          }
        />
        {/* Perfil */}
        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <Perfil />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
