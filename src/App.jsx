import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import AppLayout from "./components/Layout/AppLayout";

import Home from "./pages/Home/Home";
import Biblia from "./pages/Biblia/Biblia";
import Sala from "./pages/Sala/Sala";
import Guardados from "./pages/Guardados/Guardados";
import Perfil from "./pages/Perfil/Perfil";

function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* Layout principal */}
        <Route element={<AppLayout />}>

          {/* / */}
          <Route
            index
            element={<Home />}
          />

          {/* /biblia */}
          <Route
            path="biblia"
            element={<Biblia />}
          />

          {/* /sala */}
          <Route
            path="sala"
            element={<Sala />}
          />

          {/* /guardados */}
          <Route
            path="guardados"
            element={<Guardados />}
          />

          {/* /perfil */}
          <Route
            path="perfil"
            element={<Perfil />}
          />

        </Route>

      </Routes>

    </BrowserRouter>
  );
}

export default App;