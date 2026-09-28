// useEffect ejecuta código cuando carga el componente.
// useState guarda información que puede cambiar.
import { useEffect, useState } from "react";

// Navigate nos permite redirigir a otra ruta.
import { Navigate } from "react-router-dom";

// Conexión con Supabase.
import { supabase } from "../../lib/supabase";

function ProtectedRoute({ children }) {
  // Aquí guardaremos la sesión del usuario.
  const [sesion, setSesion] = useState(null);

  // Mientras preguntamos a Supabase, estará cargando.
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Preguntamos a Supabase:
    // "¿Hay alguien que haya iniciado sesión?"
    async function comprobarSesion() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSesion(session);

      setCargando(false);
    }

    comprobarSesion();

    // También escuchamos si el usuario inicia
    // o cierra sesión.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSesion(session);

      setCargando(false);
    });

    // Dejamos de escuchar cuando el componente desaparece.
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Todavía estamos preguntando a Supabase.
  if (cargando) {
    return <div className="route-loading">Cargando...</div>;
  }

  // No existe sesión.
  // Lo mandamos al Login.
  if (!sesion) {
    return <Navigate to="/login" replace />;
  }

  // Existe sesión.
  // Permitimos mostrar la página.
  return children;
}

export default ProtectedRoute;
