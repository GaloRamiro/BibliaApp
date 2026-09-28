import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import Header from "../Header/Header";
import BottomNav from "../BottomNav/BottomNav";

import "./AppLayout.css";

function AppLayout() {

  // Estado que guarda el tema actual.
  const [tema, setTema] = useState("light");


  // Esta función cambia entre claro y oscuro.
  function cambiarTema() {
    if (tema === "light") {
      setTema("dark");
    } else {
      setTema("light");
    }
  }


  // Cada vez que cambia "tema", ejecutamos este código.
  useEffect(() => {

    // Colocamos:
    // <html data-theme="light">
    // o
    // <html data-theme="dark">
    document.documentElement.setAttribute(
      "data-theme",
      tema
    );

  }, [tema]);


  return (
    <div className="app-layout">

      {/* Header recibe el estado y la función */}
      <Header
        tema={tema}
        cambiarTema={cambiarTema}
      />

      {/* Aquí aparece la página actual */}
      <div className="page-content">
        <Outlet />
      </div>

      {/* Navegación inferior */}
      <BottomNav />

    </div>
  );
}

export default AppLayout;