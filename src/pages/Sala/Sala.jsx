import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
  Radio,
  Copy,
  Users,
  Mic,
  MicOff,
  BookOpen,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import { buscarVersiculo } from "../../services/bibliaService";
import { detectarVersiculos } from "../../utils/detectarVersiculo";

import "./Sala.css";

function Sala() {
  // ==================================================
  // DATOS DE LA RUTA
  // ==================================================

  const { id } = useParams();

  const navigate = useNavigate();

  // ==================================================
  // ESTADOS GENERALES
  // ==================================================

  const [sala, setSala] = useState(null);

  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState("");

  const [conectados, setConectados] = useState(0);

  // ==================================================
  // ESTADOS DEL MICRÓFONO
  // ==================================================

  const [escuchando, setEscuchando] = useState(false);

  const [transcripcion, setTranscripcion] = useState("");

  const [errorMicrofono, setErrorMicrofono] = useState("");

  // ==================================================
  // ESTADOS DE LOS VERSÍCULOS
  // ==================================================

  // Última referencia detectada.
  //
  // Ejemplo:
  // {
  //   libro: "Juan",
  //   capitulo: 3,
  //   versiculo: 16,
  //   referencia: "Juan 3:16"
  // }

  const [versiculoDetectado, setVersiculoDetectado] = useState(null);

  // Texto real obtenido desde la API.

  const [textoVersiculo, setTextoVersiculo] = useState(null);

  // Todos los versículos detectados
  // durante la predicación.

  const [historialVersiculos, setHistorialVersiculos] = useState([]);

  // ==================================================
  // REFERENCIA AL RECONOCIMIENTO DE VOZ
  // ==================================================

  const reconocimientoRef = useRef(null);
  // ==================================================
  // IDENTIFICADOR DEL DISPOSITIVO
  // ==================================================
  //
  // Cada pestaña/dispositivo que entra a la sala
  // tendrá su propio identificador.
  //
  // Lo guardamos en useRef porque queremos que
  // permanezca igual mientras esta pantalla exista.
  //
  // Lo utilizaremos para:
  //
  // 1. Presence
  // 2. Guardar detecciones
  // 3. Calcular consenso

  const dispositivoIdRef = useRef(crypto.randomUUID());
  // ==================================================
  // CARGAR SALA DESDE SUPABASE
  // ==================================================

  useEffect(() => {
    async function cargarSala() {
      setCargando(true);

      setError("");

      const { data, error: supabaseError } = await supabase
        .from("salas")
        .select("*")
        .eq("id", id)
        .single();

      if (supabaseError) {
        console.error("Error al cargar la sala:", supabaseError);

        setError("No se pudo encontrar la sala.");

        setCargando(false);

        return;
      }

      setSala(data);

      setCargando(false);
    }

    cargarSala();
  }, [id]);

  // ==================================================
  // REALTIME PRESENCE
  // ==================================================

  // ==================================================
  // REALTIME PRESENCE
  // ==================================================

  useEffect(() => {
    // Nos permite saber si esta ejecución del efecto
    // todavía sigue activa.
    //
    // Esto es importante porque React en desarrollo
    // puede montar y desmontar un efecto rápidamente.
    let activo = true;

    // Aquí guardaremos el canal creado
    // para poder eliminarlo al salir de la sala.
    let canal = null;

    async function conectarRealtime() {
      // Primero obtenemos al usuario conectado.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Mientras esperábamos a Supabase,
      // React pudo haber desmontado este efecto.
      //
      // Si ocurrió eso, NO continuamos.
      if (!activo || !user) {
        return;
      }

      // Utilizamos el identificador que pertenece
      // a este dispositivo/pestaña.

      const dispositivoId = dispositivoIdRef.current;

      // Todos los dispositivos de esta sala utilizan
      // EL MISMO nombre de canal.
      //
      // Ejemplo:
      //
      // sala:abc123
      //
      // Esto permite que todos puedan verse entre sí.
      canal = supabase.channel(`sala:${id}`, {
        config: {
          presence: {
            key: dispositivoId,
          },
        },
      });

      // ==================================================
      // PRESENCE SYNC
      // ==================================================
      //
      // IMPORTANTE:
      //
      // Registramos .on() ANTES de subscribe().
      //
      // Cada vez que entra o sale un dispositivo,
      // Supabase sincroniza el estado.
      // ==================================================

      canal.on(
        "presence",
        {
          event: "sync",
        },
        () => {
          // Si este efecto ya murió,
          // no actualizamos React.
          if (!activo || !canal) {
            return;
          }

          const estado = canal.presenceState();

          // Cada key representa un dispositivo conectado.
          const cantidad = Object.keys(estado).length;

          setConectados(cantidad);
        },
      );

      // Antes de suscribirnos volvemos a comprobar
      // que esta ejecución todavía siga activa.
      if (!activo) {
        return;
      }

      // ==================================================
      // CONECTARNOS
      // ==================================================

      canal.subscribe(async (estado) => {
        // Solo hacemos track cuando Supabase
        // confirma que ya estamos conectados.
        if (estado !== "SUBSCRIBED") {
          return;
        }

        // Puede ocurrir que el efecto haya sido
        // desmontado justo mientras conectábamos.
        if (!activo || !canal) {
          return;
        }

        try {
          await canal.track({
            dispositivo_id: dispositivoId,

            usuario_id: user.id,

            conectado_en: new Date().toISOString(),
          });
        } catch (errorPresence) {
          // No mostramos errores si pertenecen
          // a una ejecución vieja del efecto.
          if (activo) {
            console.error("Error al registrar Presence:", errorPresence);
          }
        }
      });
    }

    conectarRealtime();

    // ==================================================
    // LIMPIEZA
    // ==================================================

    return () => {
      // Primero marcamos esta ejecución como terminada.
      //
      // De esta manera cualquier operación async
      // que todavía esté esperando sabe que debe parar.
      activo = false;

      // Después eliminamos únicamente el canal
      // creado por esta ejecución.
      if (canal) {
        supabase.removeChannel(canal);

        canal = null;
      }
    };
  }, [id]);

  // ==================================================
  // RECONOCIMIENTO DE VOZ
  // ==================================================

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    // Revisamos si el navegador
    // soporta reconocimiento de voz.

    if (!SpeechRecognition) {
      setErrorMicrofono("Este navegador no soporta reconocimiento de voz.");

      return;
    }

    // Creamos el reconocedor.

    const reconocimiento = new SpeechRecognition();

    // Queremos que siga escuchando.

    reconocimiento.continuous = true;

    // También recibiremos texto temporal.

    reconocimiento.interimResults = true;

    // Español de Ecuador.

    reconocimiento.lang = "es-EC";

    // ==================================================
    // CUANDO CHROME RECONOCE VOZ
    // ==================================================

    reconocimiento.onresult = (event) => {
      let textoFinal = "";

      let textoTemporal = "";

      // Recorremos los resultados
      // entregados por el navegador.

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const texto = event.results[i][0].transcript;

        // Si Chrome ya considera
        // terminado este fragmento.

        if (event.results[i].isFinal) {
          textoFinal += texto + " ";
        } else {
          textoTemporal += texto;
        }
      }

      // ==================================================
      // TEXTO FINAL
      // ==================================================

      if (textoFinal) {
        // Agregamos el texto a la transcripción.

        setTranscripcion((textoAnterior) => textoAnterior + textoFinal);

        // Buscamos todas las referencias
        // existentes dentro del fragmento.

        const referenciasEncontradas = detectarVersiculos(textoFinal);

        console.log("Referencias encontradas:", referenciasEncontradas);

        // Si encontramos referencias...

        if (referenciasEncontradas.length > 0) {
          // ==================================================
          // GUARDAR TODAS EN EL HISTORIAL
          // ==================================================

          setHistorialVersiculos((historialAnterior) => {
            const nuevoHistorial = [...historialAnterior];

            referenciasEncontradas.forEach((referencia) => {
              // Revisamos la última guardada.

              const ultimoGuardado = nuevoHistorial[nuevoHistorial.length - 1];

              // Evitamos duplicados consecutivos.

              if (ultimoGuardado?.referencia === referencia.referencia) {
                return;
              }

              // Guardamos la referencia.

              nuevoHistorial.push({
                ...referencia,

                detectadoEn: new Date().toISOString(),
              });
            });

            return nuevoHistorial;
          });

          // ==================================================
          // OBTENER LA ÚLTIMA REFERENCIA
          // ==================================================

          const ultimaReferencia =
            referenciasEncontradas[referenciasEncontradas.length - 1];

          console.log("Último versículo detectado:", ultimaReferencia);
          // Guardamos lo que este dispositivo detectó
          // para posteriormente compararlo con los demás.

          guardarDeteccion(ultimaReferencia);
          // Mostramos inmediatamente
          // la referencia.

          setVersiculoDetectado(ultimaReferencia);

          // Limpiamos el texto anterior
          // mientras esperamos la API.

          setTextoVersiculo(null);

          // ==================================================
          // CONSULTAR API BÍBLICA
          // ==================================================

          buscarVersiculo(
            ultimaReferencia.libro,

            ultimaReferencia.capitulo,

            ultimaReferencia.versiculo,
          ).then((resultado) => {
            console.log("Texto bíblico recibido:", resultado);

            if (resultado) {
              setTextoVersiculo(resultado);
            }
          });
        }
      }

      // ==================================================
      // TEXTO TEMPORAL
      // ==================================================

      if (textoTemporal) {
        console.log("Escuchando:", textoTemporal);
      }
    };

    // ==================================================
    // ERRORES DEL MICRÓFONO
    // ==================================================

    reconocimiento.onerror = (event) => {
      console.error("Error de reconocimiento:", event.error);

      if (event.error === "not-allowed") {
        setErrorMicrofono("Debes permitir el acceso al micrófono.");
      } else if (event.error === "no-speech") {
        setErrorMicrofono("No se detectó voz. Intenta hablar nuevamente.");
      } else {
        setErrorMicrofono("Ocurrió un problema con el reconocimiento de voz.");
      }
    };

    // Cuando termina la escucha.

    reconocimiento.onend = () => {
      setEscuchando(false);
    };

    // Guardamos el objeto para poder
    // utilizarlo desde el botón.

    reconocimientoRef.current = reconocimiento;

    // Cuando abandonamos la pantalla,
    // detenemos el micrófono.

    return () => {
      reconocimiento.stop();
    };
  }, []);
  // ==================================================
  // GUARDAR DETECCIÓN EN SUPABASE
  // ==================================================
  //
  // Esta función recibe una referencia detectada.
  //
  // Ejemplo:
  //
  // {
  //   libro: "Salmos",
  //   capitulo: 23,
  //   versiculo: 1,
  //   referencia: "Salmos 23:1"
  // }
  //
  // Después guarda quién la detectó,
  // en qué sala y desde qué dispositivo.
  // ==================================================

  async function guardarDeteccion(referencia) {
    try {
      // Obtenemos al usuario que tiene
      // la sesión iniciada.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error(
          "No hay un usuario autenticado para guardar la detección.",
        );

        return;
      }

      // Construimos exactamente la información
      // que necesita nuestra tabla detecciones.

      const nuevaDeteccion = {
        sala_id: id,

        dispositivo_id: dispositivoIdRef.current,

        usuario_id: user.id,

        libro: referencia.libro,

        capitulo: referencia.capitulo,

        versiculo: referencia.versiculo,

        referencia: referencia.referencia,
      };

      console.log("Guardando detección en Supabase:", nuevaDeteccion);

      const { data, error: errorDeteccion } = await supabase
        .from("detecciones")
        .insert(nuevaDeteccion)
        .select()
        .single();

      if (errorDeteccion) {
        console.error("Error al guardar detección:", errorDeteccion);

        return;
      }

      console.log("Detección guardada correctamente:", data);
    } catch (errorGuardar) {
      console.error("Error inesperado al guardar detección:", errorGuardar);
    }
  }
  // ==================================================
  // INICIAR / DETENER ESCUCHA
  // ==================================================

  function cambiarEscucha() {
    const reconocimiento = reconocimientoRef.current;

    if (!reconocimiento) {
      return;
    }

    setErrorMicrofono("");

    // Si está escuchando,
    // lo detenemos.

    if (escuchando) {
      reconocimiento.stop();

      setEscuchando(false);

      return;
    }

    // Si está detenido,
    // comenzamos.

    try {
      reconocimiento.start();

      setEscuchando(true);
    } catch (errorReconocimiento) {
      console.error("No se pudo iniciar el micrófono:", errorReconocimiento);
    }
  }

  // ==================================================
  // COPIAR CÓDIGO
  // ==================================================

  async function copiarCodigo() {
    if (!sala?.codigo) {
      return;
    }

    await navigator.clipboard.writeText(sala.codigo);
  }

  // ==================================================
  // CARGANDO
  // ==================================================

  if (cargando) {
    return (
      <main className="sala-page">
        <div className="sala-loading">Cargando sala...</div>
      </main>
    );
  }

  // ==================================================
  // ERROR
  // ==================================================

  if (error) {
    return (
      <main className="sala-page">
        <div className="sala-error-page">
          <h2>Sala no encontrada</h2>

          <p>{error}</p>

          <button type="button" onClick={() => navigate("/")}>
            Volver al inicio
          </button>
        </div>
      </main>
    );
  }

  // ==================================================
  // PANTALLA PRINCIPAL
  // ==================================================

  return (
    <main className="sala-page">
      {/* ==============================================
          ENCABEZADO
          ============================================== */}

      <header className="sala-header">
        <button
          type="button"
          className="sala-back"
          onClick={() => navigate("/")}
          aria-label="Volver"
        >
          <ArrowLeft size={21} />
        </button>

        <div className="sala-header-title">
          <Radio size={18} />

          <span>Sala en vivo</span>
        </div>
      </header>

      <section className="sala-content">
        {/* ==============================================
            ESTADO DE LA SALA
            ============================================== */}

        <div className="sala-status">
          <span className="sala-status-dot"></span>

          {sala.estado}
        </div>

        <h1>{sala.nombre}</h1>

        <p className="sala-description">
          Comparte el código para que otras personas puedan unirse a esta sala.
        </p>

        {/* ==============================================
            CÓDIGO DE LA SALA
            ============================================== */}

        <div className="sala-code-card">
          <div>
            <span>Código de la sala</span>

            <strong>{sala.codigo}</strong>
          </div>

          <button
            type="button"
            onClick={copiarCodigo}
            aria-label="Copiar código"
          >
            <Copy size={20} />
          </button>
        </div>

        {/* ==============================================
            DISPOSITIVOS CONECTADOS
            ============================================== */}

        <div className="sala-info-card">
          <div className="sala-info-icon">
            <Users size={22} />
          </div>

          <div>
            <span>Dispositivos conectados</span>

            <strong>{conectados}</strong>
          </div>
        </div>

        {/* ==============================================
            MICRÓFONO
            ============================================== */}

        <div className="sala-listening-card">
          <div
            className={
              escuchando
                ? "sala-listening-icon escuchando"
                : "sala-listening-icon"
            }
          >
            {/* Ondas */}

            {escuchando && (
              <>
                <span className="mic-wave mic-wave-1"></span>

                <span className="mic-wave mic-wave-2"></span>

                <span className="mic-wave mic-wave-3"></span>
              </>
            )}

            {escuchando ? <Mic size={27} /> : <MicOff size={27} />}
          </div>

          <h2>
            {escuchando ? "Escuchando predicación" : "Esperando el culto"}
          </h2>

          <p>
            {escuchando
              ? "Habla normalmente. Estamos convirtiendo la voz en texto."
              : "Cuando estés listo podremos comenzar a escuchar la predicación."}
          </p>

          <button
            type="button"
            className={
              escuchando ? "sala-start-button escuchando" : "sala-start-button"
            }
            onClick={cambiarEscucha}
          >
            {escuchando ? <MicOff size={19} /> : <Mic size={19} />}

            {escuchando ? "Detener escucha" : "Iniciar escucha"}
          </button>

          {errorMicrofono && (
            <p className="sala-microphone-error">{errorMicrofono}</p>
          )}
        </div>

        {/* ==============================================
            TRANSCRIPCIÓN
            ============================================== */}

        <div className="sala-transcription-section">
          <div className="sala-section-title">
            <Radio size={19} />

            <h3>Transcripción en vivo</h3>
          </div>

          <div className="sala-transcription-card">
            {transcripcion ? (
              <p>{transcripcion}</p>
            ) : (
              <p className="sala-transcription-empty">
                La predicación aparecerá aquí mientras hablamos.
              </p>
            )}
          </div>
        </div>

        {/* ==============================================
            ÚLTIMO VERSÍCULO
            ============================================== */}

        <div className="sala-verse-section">
          <div className="sala-section-title">
            <BookOpen size={19} />

            <h3>Último versículo detectado</h3>
          </div>

          {versiculoDetectado ? (
            <div className="sala-detected-verse">
              <div className="sala-detected-icon">
                <BookOpen size={23} />
              </div>

              <div className="sala-detected-content">
                <span>Referencia detectada</span>

                <strong>{versiculoDetectado.referencia}</strong>

                {textoVersiculo && (
                  <>
                    <p className="sala-verse-text">{textoVersiculo.texto}</p>

                    <small className="sala-verse-version">
                      {textoVersiculo.version}
                    </small>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="sala-empty-verse">
              <BookOpen size={25} />

              <p>Todavía no se ha detectado ningún versículo.</p>
            </div>
          )}
        </div>

        {/* ==============================================
            HISTORIAL DE VERSÍCULOS
            ============================================== */}

        <div className="sala-history-section">
          <div className="sala-section-title">
            <BookOpen size={19} />

            <h3>Versículos del culto</h3>
          </div>

          {historialVersiculos.length > 0 ? (
            <div className="sala-history-list">
              {historialVersiculos.map((versiculo, index) => (
                <div
                  className="sala-history-item"
                  key={`${versiculo.referencia}-${index}`}
                >
                  <div className="sala-history-number">{index + 1}</div>

                  <div className="sala-history-info">
                    <strong>{versiculo.referencia}</strong>

                    <span>Detectado durante la predicación</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="sala-history-empty">
              <BookOpen size={23} />

              <p>Los versículos detectados aparecerán aquí.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default Sala;
