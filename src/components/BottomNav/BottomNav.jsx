// NavLink permite navegar entre páginas
// sin recargar completamente la aplicación.
import { NavLink } from "react-router-dom";


// Iconos.
import {
  House,
  BookOpen,
  CirclePlus,
  Bookmark,
  User,
} from "lucide-react";


import "./BottomNav.css";


function BottomNav() {
  return (
    <nav className="bottom-nav">

      {/* INICIO */}
      <NavLink
        to="/"
        className={({ isActive }) =>
          isActive ? "nav-item active" : "nav-item"
        }
      >
        <House size={21} />
        <span>Inicio</span>
      </NavLink>


      {/* BIBLIA */}
      <NavLink
        to="/biblia"
        className={({ isActive }) =>
          isActive ? "nav-item active" : "nav-item"
        }
      >
        <BookOpen size={21} />
        <span>Biblia</span>
      </NavLink>


      {/* SALA */}
      <NavLink
        to="/sala"
        className="nav-create"
        aria-label="Sala"
      >
        <CirclePlus size={27} />
      </NavLink>


      {/* GUARDADOS */}
      <NavLink
        to="/guardados"
        className={({ isActive }) =>
          isActive ? "nav-item active" : "nav-item"
        }
      >
        <Bookmark size={21} />
        <span>Guardados</span>
      </NavLink>


      {/* PERFIL */}
      <NavLink
        to="/perfil"
        className={({ isActive }) =>
          isActive ? "nav-item active" : "nav-item"
        }
      >
        <User size={21} />
        <span>Perfil</span>
      </NavLink>

    </nav>
  );
}

export default BottomNav;