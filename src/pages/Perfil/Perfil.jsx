import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  User,
  Mail,
  LogOut,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

import BottomNav from "../../components/BottomNav/BottomNav";

import "./Perfil.css";


function Perfil() {

  // Aquí guardaremos el usuario que inició sesión.
  const [usuario, setUsuario] = useState(null);

  const navigate = useNavigate();


  // --------------------------------------------------
  // OBTENER USUARIO
  // --------------------------------------------------

  useEffect(() => {

    async function cargarUsuario() {

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUsuario(user);
    }

    cargarUsuario();

  }, []);


  // --------------------------------------------------
  // CERRAR SESIÓN
  // --------------------------------------------------

  async function cerrarSesion() {

    await supabase.auth.signOut();

    navigate("/login");
  }


  return (

    <main className="perfil-page">

      <section className="perfil-content">

        <p className="perfil-small">
          Mi cuenta
        </p>

        <h1>
          Perfil
        </h1>


        {/* Avatar */}
        <div className="perfil-avatar">
          <User size={36} />
        </div>


        {/* Nombre */}
        <div className="perfil-info">

          <span>
            Nombre
          </span>

          <strong>
            {usuario?.user_metadata?.nombre || "Usuario"}
          </strong>

        </div>


        {/* Correo */}
        <div className="perfil-info">

          <span>
            <Mail size={16} />
            Correo electrónico
          </span>

          <strong>
            {usuario?.email || "Cargando..."}
          </strong>

        </div>


        {/* Cerrar sesión */}
        <button
          type="button"
          className="perfil-logout"
          onClick={cerrarSesion}
        >
          <LogOut size={19} />

          Cerrar sesión
        </button>

      </section>


      {/* Nuestro menú inferior */}
      <BottomNav />

    </main>

  );
}


export default Perfil;