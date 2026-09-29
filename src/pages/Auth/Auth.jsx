// useState nos permite guardar información que cambia.
import { useState } from "react";

// useNavigate nos permitirá enviar al usuario al Home
// cuando inicie sesión correctamente.
import { useNavigate } from "react-router-dom";

// Iconos.
import {
  BookOpen,
  Mail,
  LockKeyhole,
  User,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";

// Nuestra conexión con Supabase.
import { supabase } from "../../lib/supabase";

// Estilos.
import "./Auth.css";

function Auth() {
  const navigate = useNavigate();

  // --------------------------------------------------
  // MODO DE LA PANTALLA
  // --------------------------------------------------

  // false = Login
  // true  = Registro
  const [registro, setRegistro] = useState(false);

  // --------------------------------------------------
  // DATOS DEL FORMULARIO
  // --------------------------------------------------

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");

  // Mostrar u ocultar contraseña.
  const [mostrarPassword, setMostrarPassword] = useState(false);

  // Mensajes para el usuario.
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  // Nos permite saber si Supabase está trabajando.
  const [cargando, setCargando] = useState(false);

  // --------------------------------------------------
  // CAMBIAR ENTRE LOGIN Y REGISTRO
  // --------------------------------------------------

  function cambiarModo() {
    setRegistro(!registro);

    // Limpiamos mensajes anteriores.
    setMensaje("");
    setError("");

    // Limpiamos las contraseñas.
    setPassword("");
    setConfirmarPassword("");
  }

  // --------------------------------------------------
  // INICIAR SESIÓN
  // --------------------------------------------------

  async function iniciarSesion(event) {
    // Evita que el formulario recargue la página.
    event.preventDefault();

    setError("");
    setMensaje("");
    setCargando(true);

    // Enviamos email y contraseña a Supabase.
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    // Si Supabase devuelve un error.
    if (loginError) {
      setError("No pudimos iniciar sesión. Revisa tu correo y contraseña.");

      setCargando(false);

      return;
    }

    // Login correcto.
    setCargando(false);

    // Enviamos al usuario al Home.
    navigate("/");
  }

  // --------------------------------------------------
  // REGISTRAR USUARIO
  // --------------------------------------------------

  async function registrarUsuario(event) {
    event.preventDefault();

    setError("");
    setMensaje("");

    // Comprobamos que las contraseñas sean iguales.
    if (password !== confirmarPassword) {
      setError("Las contraseñas no coinciden.");

      return;
    }

    // Evitamos contraseñas demasiado cortas.
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");

      return;
    }

    setCargando(true);

    // Creamos el usuario en Supabase Authentication.
    const { error: registroError } = await supabase.auth.signUp({
      email: email,

      password: password,

      options: {
        // Guardamos también el nombre como metadata.
        data: {
          nombre: nombre,
        },
      },
    });

    // Si ocurre algún problema.
    if (registroError) {
      setError(registroError.message);

      setCargando(false);

      return;
    }

    // Registro correcto.
    setMensaje("Cuenta creada correctamente. Ya puedes iniciar sesión.");

    setCargando(false);

    // Volvemos al formulario de Login.
    setRegistro(false);

    setPassword("");
    setConfirmarPassword("");
  }

  return (
    <main className="auth-page">
      {/* Contenedor principal */}
      <section
        className={
          registro ? "auth-container register-active" : "auth-container"
        }
      >
        {/* ==========================================
            FORMULARIO
            ========================================== */}

        <div className="auth-form-area">
          <div className="auth-form-wrapper">
            {/* Logo */}
            <div className="auth-brand">
              <div className="auth-logo">
                <BookOpen size={25} />
              </div>

              <span>Versículo en Vivo</span>
            </div>

            {/* Título que cambia */}
            <div className="auth-heading">
              <p>
                {registro ? "Comienza tu experiencia" : "Bienvenido nuevamente"}
              </p>

              <h1>{registro ? "Crear cuenta" : "Iniciar sesión"}</h1>
            </div>

            {/* ======================================
                LOGIN
                ====================================== */}

            {!registro && (
              <form className="auth-form" onSubmit={iniciarSesion}>
                {/* Correo */}
                <div className="auth-field">
                  <label htmlFor="login-email">Correo electrónico</label>

                  <div className="auth-input">
                    <Mail size={19} />

                    <input
                      id="login-email"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Contraseña */}
                <div className="auth-field">
                  <label htmlFor="login-password">Contraseña</label>

                  <div className="auth-input">
                    <LockKeyhole size={19} />

                    <input
                      id="login-password"
                      type={mostrarPassword ? "text" : "password"}
                      placeholder="Tu contraseña"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />

                    <button
                      type="button"
                      className="password-button"
                      onClick={() => setMostrarPassword(!mostrarPassword)}
                      aria-label="Mostrar contraseña"
                    >
                      {mostrarPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Mensajes */}
                {error && <p className="auth-error">{error}</p>}

                {mensaje && <p className="auth-success">{mensaje}</p>}

                {/* Botón Login */}
                <button
                  type="submit"
                  className="auth-submit"
                  disabled={cargando}
                >
                  {cargando ? "Ingresando..." : "Iniciar sesión"}

                  {!cargando && <ArrowRight size={18} />}
                </button>
              </form>
            )}

            {/* ======================================
                REGISTRO
                ====================================== */}

            {registro && (
              <form className="auth-form" onSubmit={registrarUsuario}>
                {/* Nombre */}
                <div className="auth-field">
                  <label htmlFor="register-name">Nombre</label>

                  <div className="auth-input">
                    <User size={19} />

                    <input
                      id="register-name"
                      type="text"
                      placeholder="Tu nombre"
                      value={nombre}
                      onChange={(event) => setNombre(event.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Correo */}
                <div className="auth-field">
                  <label htmlFor="register-email">Correo electrónico</label>

                  <div className="auth-input">
                    <Mail size={19} />

                    <input
                      id="register-email"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Contraseña */}
                <div className="auth-field">
                  <label htmlFor="register-password">Contraseña</label>

                  <div className="auth-input">
                    <LockKeyhole size={19} />

                    <input
                      id="register-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Confirmar contraseña */}
                <div className="auth-field">
                  <label htmlFor="confirm-password">Confirmar contraseña</label>

                  <div className="auth-input">
                    <LockKeyhole size={19} />

                    <input
                      id="confirm-password"
                      type="password"
                      placeholder="Repite tu contraseña"
                      value={confirmarPassword}
                      onChange={(event) =>
                        setConfirmarPassword(event.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                {error && <p className="auth-error">{error}</p>}

                <button
                  type="submit"
                  className="auth-submit"
                  disabled={cargando}
                >
                  {cargando ? "Creando cuenta..." : "Crear cuenta"}

                  {!cargando && <ArrowRight size={18} />}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ==========================================
            PANEL AZUL ANIMADO
            ========================================== */}

        <div className="auth-panel">
          <div className="auth-panel-content">
            <BookOpen size={42} />

            <h2>{registro ? "¿Ya eres parte?" : "La Palabra contigo"}</h2>

            <p>
              {registro
                ? "Inicia sesión y continúa viviendo la Palabra en tiempo real."
                : "Crea tu cuenta y participa en una experiencia bíblica conectada."}
            </p>

            <button
              type="button"
              className="auth-change-button"
              onClick={cambiarModo}
            >
              {registro ? "Iniciar sesión" : "Crear una cuenta"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Auth;
