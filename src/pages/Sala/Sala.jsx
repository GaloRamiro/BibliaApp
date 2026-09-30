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
// ==================================================
// CONFIGURACIÓN DEL CONSENSO
// ==================================================

// Para esta primera prueba necesitamos
// 2 dispositivos diferentes.

const VOTOS_NECESARIOS = 2;

// Las detecciones deben ocurrir dentro
// de una ventana de 10 segundos.
//
// Damos este margen porque dos dispositivos
// pueden tardar tiempos diferentes en convertir
// la misma frase de voz en texto.
//
// Ejemplo:
// PC detecta Romanos 8:1-4
// 9 segundos después
// celular detecta Romanos 8:1-4
//
// Ambos todavía pueden participar
// en el mismo consenso.

const VENTANA_CONSENSO_MS = 10000;
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
  // Referencia que siempre mantiene la versión actual de la sala.
  // La usamos dentro del reconocimiento de voz para evitar
  // trabajar con una versión antigua del estado.
  const salaRef = useRef(null);
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
  //
  // {
  //   libro: "Juan",
  //   capitulo: 3,
  //   versiculo: 16,
  //   referencia: "Juan 3:16"
  // }

  const [versiculoDetectado, setVersiculoDetectado] = useState(null);

  // Texto real obtenido desde la API bíblica.

  const [textoVersiculo, setTextoVersiculo] = useState(null);

  // Todos los versículos detectados
  // durante la predicación.

  const [historialVersiculos, setHistorialVersiculos] = useState([]);

  // ==================================================
  // ESTADOS DEL CONSENSO
  // ==================================================

  // Aquí iremos guardando las detecciones
  // que lleguen desde todos los dispositivos
  // mediante Supabase Realtime.

  const [deteccionesRecientes, setDeteccionesRecientes] = useState([]);

  // Más adelante aquí guardaremos algo como:
  //
  // {
  //   referencia: "Salmos 23:1",
  //   votos: 2
  // }

  const [consenso, setConsenso] = useState(null);

  // ==================================================
  // REFERENCIA AL RECONOCIMIENTO DE VOZ
  // ==================================================
  const reconocimientoRef = useRef(null);
  // Cada referencia tendrá su propio temporizador.
  //
  // Ejemplo:
  //
  // Juan 3:16       → temporizador A
  // Romanos 8:1-4   → temporizador B
  // Filipenses 4:13 → temporizador C
  //
  // Así una referencia no cancela a las demás.

  const referenciasCandidatasRef = useRef(new Map());

  // Tiempo que una referencia debe permanecer
  // como candidata antes de aceptarla.

  const TIEMPO_ESTABILIZACION_MS = 700;
  // ==================================================
  // REFERENCIAS YA PROCESADAS
  // ==================================================
  //
  // SpeechRecognition puede devolver un fragmento que
  // contiene varias referencias bíblicas.
  //
  // Guardamos temporalmente cuáles ya enviamos para
  // evitar mandar dos veces la misma referencia dentro
  // del mismo fragmento.
  //

  const referenciasProcesadasRef = useRef(new Set());
  // ==================================================
  // IDENTIFICADOR DEL DISPOSITIVO
  // ==================================================
  //
  // Cada pestaña o dispositivo obtiene
  // un identificador diferente.
  //
  // Ese MISMO identificador se utilizará para:
  //
  // 1. Presence
  // 2. Guardar detecciones
  // 3. Calcular consenso
  //
  // useRef permite conservar el mismo ID
  // durante toda la vida de esta pantalla.
  // ==================================================

  const dispositivoIdRef = useRef(crypto.randomUUID());
  // ==================================================
  // ÚLTIMA CONFIRMACIÓN GUARDADA
  // ==================================================
  //
  // Evita que varios eventos Realtime provoquen
  // que este dispositivo intente guardar muchas veces
  // el mismo consenso seguido.

  const ultimaConfirmacionRef = useRef({
    referencia: null,
    tiempo: 0,
  });
  // ==================================================
  // CONSENSOS YA PROCESADOS
  // ==================================================
  //
  // Guardamos qué referencia ya alcanzó consenso
  // dentro de una determinada ventana de tiempo.
  //
  // Ejemplo:
  //
  // "Juan 3:16|123456"
  //
  // Esto evita intentar guardar varias veces
  // el mismo consenso cuando llegan nuevos eventos
  // de Realtime.
  //
  // Si Juan 3:16 aparece mucho tiempo después,
  // tendrá otra ventana y podrá confirmarse otra vez.
  // ==================================================

  const consensosProcesadosRef = useRef(new Set());
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
  // MANTENER SALAREF ACTUALIZADO
  // ==================================================

  useEffect(() => {
    salaRef.current = sala;
  }, [sala]);
  // ==================================================
  // REALTIME PRESENCE
  // ==================================================
  //
  // Presence nos permite saber cuántos
  // dispositivos están actualmente
  // conectados a esta sala.
  // ==================================================

  useEffect(() => {
    let activo = true;

    let canal = null;

    async function conectarRealtime() {
      // Obtenemos al usuario conectado.

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // React pudo desmontar este efecto
      // mientras esperábamos la respuesta.

      if (!activo || !user) {
        return;
      }

      // Utilizamos el identificador
      // permanente de esta pestaña.

      const dispositivoId = dispositivoIdRef.current;

      // Todos los dispositivos de la misma sala
      // utilizan el mismo canal.

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

      canal.on(
        "presence",
        {
          event: "sync",
        },
        () => {
          if (!activo || !canal) {
            return;
          }

          const estado = canal.presenceState();

          // Cada key representa
          // un dispositivo conectado.

          const cantidad = Object.keys(estado).length;

          setConectados(cantidad);
        },
      );

      if (!activo) {
        return;
      }

      // ==================================================
      // CONECTARNOS
      // ==================================================

      canal.subscribe(async (estado) => {
        if (estado !== "SUBSCRIBED") {
          return;
        }

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
      activo = false;

      if (canal) {
        supabase.removeChannel(canal);

        canal = null;
      }
    };
  }, [id]);

  // ==================================================
  // REALTIME - DETECCIONES DE LA SALA
  // ==================================================
  //
  // Este canal es diferente al de Presence.
  //
  // Presence:
  //
  // sala:ID
  //
  // Detecciones:
  //
  // detecciones:ID
  //
  // Cada vez que un dispositivo inserte
  // una nueva fila en la tabla detecciones,
  // Supabase nos avisará.
  // ==================================================

  useEffect(() => {
    let activo = true;

    const canalDetecciones = supabase
      .channel(`detecciones:${id}`)

      .on(
        "postgres_changes",
        {
          event: "INSERT",

          schema: "public",

          table: "detecciones",

          // Solo queremos detecciones
          // pertenecientes a ESTA sala.

          filter: `sala_id=eq.${id}`,
        },

        (payload) => {
          if (!activo) {
            return;
          }

          // payload.new contiene la nueva fila
          // insertada en Supabase.

          const nuevaDeteccion = payload.new;

          console.log("Detección recibida por Realtime:", nuevaDeteccion);

          // Guardamos temporalmente la detección
          // para después calcular el consenso.

          setDeteccionesRecientes((anteriores) => [
            ...anteriores,
            nuevaDeteccion,
          ]);
        },
      )

      .subscribe((estado) => {
        if (estado === "SUBSCRIBED") {
          console.log("Escuchando detecciones Realtime de la sala:", id);
        }
      });

    // ==================================================
    // LIMPIEZA DEL CANAL
    // ==================================================

    return () => {
      activo = false;

      supabase.removeChannel(canalDetecciones);
    };
  }, [id]);

  // ==================================================
  // CARGAR ÚLTIMO VERSÍCULO DETECTADO
  // ==================================================
  //
  // Cuando entramos nuevamente a la sala o hacemos F5,
  // buscamos la detección más reciente guardada
  // en Supabase.
  //
  // Esto NO significa que el versículo esté confirmado.
  // Solamente recuperamos la última referencia escuchada.
  // ==================================================

  useEffect(() => {
    let activo = true;

    async function cargarUltimoVersiculoDetectado() {
      const { data, error: errorDeteccion } = await supabase
        .from("detecciones")
        .select("*")
        .eq("sala_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activo) {
        return;
      }

      if (errorDeteccion) {
        console.error(
          "Error al cargar último versículo detectado:",
          errorDeteccion,
        );

        return;
      }

      // Si todavía no existen detecciones
      // en esta sala, no hacemos nada.
      if (!data) {
        console.log("La sala todavía no tiene versículos detectados.");

        return;
      }

      console.log("Último versículo detectado cargado:", data);

      const referenciaDetectada = {
        libro: data.libro,
        capitulo: data.capitulo,
        versiculo: data.versiculo,

        // Recuperamos también el final del rango.
        versiculoFin: data.versiculo_fin ?? null,

        referencia: data.referencia,
      };

      // Recuperamos la referencia en React.
      setVersiculoDetectado(referenciaDetectada);

      // Limpiamos cualquier texto anterior.
      setTextoVersiculo(null);

      // Recuperamos también el texto bíblico.
      const resultado = await buscarVersiculo(
        data.libro,
        data.capitulo,
        data.versiculo,
        data.versiculo_fin,
      );

      if (!activo) {
        return;
      }

      if (resultado) {
        setTextoVersiculo(resultado);
      }
    }

    cargarUltimoVersiculoDetectado();

    return () => {
      activo = false;
    };
  }, [id]);
  // ==================================================
  // CARGAR HISTORIAL GLOBAL DE LA SALA
  // ==================================================
  //
  // Cuando entramos o recargamos la sala,
  // recuperamos los versículos que ya fueron
  // confirmados anteriormente.
  //
  // Así el historial no depende del dispositivo.
  // ==================================================

  useEffect(() => {
    let activo = true;

    async function cargarHistorialGlobal() {
      const { data, error: errorHistorial } = await supabase
        .from("versiculos_confirmados")
        .select("*")
        .eq("sala_id", id)
        .order("created_at", { ascending: true });

      if (!activo) {
        return;
      }

      if (errorHistorial) {
        console.error("Error al cargar historial global:", errorHistorial);

        return;
      }

      console.log("Historial global cargado:", data);

      setHistorialVersiculos(data || []);
    }

    cargarHistorialGlobal();

    return () => {
      activo = false;
    };
  }, [id]);
  // ==================================================
  // CARGAR TRANSCRIPCIÓN GUARDADA
  // ==================================================
  //
  // Cuando entramos a la sala o hacemos F5,
  // recuperamos todos los fragmentos que ya
  // fueron guardados en Supabase.
  //
  // Los buscamos por sala_id porque toda la
  // transcripción pertenece al mismo culto.
  //
  // ==================================================

  useEffect(() => {
    let activo = true;

    async function cargarTranscripcion() {
      const { data, error: errorTranscripcion } = await supabase
        .from("transcripciones")
        .select("*")
        .eq("sala_id", id)
        .order("created_at", { ascending: true });

      // Si abandonamos la pantalla mientras
      // Supabase respondía, no hacemos nada.
      if (!activo) {
        return;
      }

      if (errorTranscripcion) {
        console.error("Error al cargar la transcripción:", errorTranscripcion);

        return;
      }

      console.log("Transcripción guardada cargada:", data);

      // Extraemos únicamente el texto de cada fila.
      //
      // Ejemplo:
      // [
      //   { texto: "Hoy hablaremos de la fe" },
      //   { texto: "Abramos nuestras Biblias" }
      // ]
      //
      // se convierte en:
      //
      // "Hoy hablaremos de la fe Abramos nuestras Biblias"

      const textoCompleto = (data || [])
        .map((fragmento) => fragmento.texto)
        .join(" ");

      setTranscripcion(textoCompleto);
    }

    cargarTranscripcion();

    return () => {
      activo = false;
    };
  }, [id]);
  // ==================================================
  // REALTIME - VERSÍCULOS CONFIRMADOS
  // ==================================================
  //
  // Este canal escucha la confirmación oficial
  // de la sala.
  //
  // Cuando cualquier dispositivo consiga consenso
  // y guarde el versículo en Supabase,
  // TODOS los dispositivos conectados a la sala
  // recibirán esta fila.
  // ==================================================

  useEffect(() => {
    let activo = true;

    const canalConfirmados = supabase
      .channel(`confirmados:${id}`)

      .on(
        "postgres_changes",
        {
          event: "INSERT",

          schema: "public",

          table: "versiculos_confirmados",

          // Solo escuchamos confirmaciones
          // pertenecientes a esta sala.
          filter: `sala_id=eq.${id}`,
        },

        (payload) => {
          if (!activo) {
            return;
          }

          // La fila que acaba de insertarse
          // en versiculos_confirmados.
          const confirmado = payload.new;

          console.log(
            "Versículo confirmado recibido por Realtime:",
            confirmado,
          );

          // ==================================================
          // ACTUALIZAR CONSENSO GLOBAL
          // ==================================================
          //
          // Ya no importa qué teléfono calculó
          // originalmente el consenso.
          //
          // Todos reciben la confirmación oficial.
          // ==================================================

          setConsenso({
            referencia: confirmado.referencia,

            libro: confirmado.libro,

            capitulo: confirmado.capitulo,

            versiculo: confirmado.versiculo,

            votos: confirmado.votos,

            confirmadoEn: confirmado.created_at,
          });
          // ==================================================
          // AGREGAR AL HISTORIAL GLOBAL
          // ==================================================
          //
          // Solo los versículos que ya fueron confirmados
          // por consenso entran al historial.
          //
          // Como la confirmación llega mediante Realtime,
          // todos los dispositivos reciben la misma fila.
          // ==================================================

          setHistorialVersiculos((historialAnterior) => {
            // Comprobamos el ID porque cada confirmación
            // oficial tiene un ID único en Supabase.

            const yaExiste = historialAnterior.some(
              (versiculo) => versiculo.id === confirmado.id,
            );

            if (yaExiste) {
              return historialAnterior;
            }

            return [...historialAnterior, confirmado];
          });
          // ==================================================
          // MOSTRAR EL VERSÍCULO CONFIRMADO EN TODOS
          // ==================================================
          //
          // El consenso ya es oficial.
          //
          // Por eso este versículo se convierte ahora
          // en el versículo visible para toda la sala.
          // ==================================================

          const referenciaConfirmada = {
            libro: confirmado.libro,

            capitulo: confirmado.capitulo,

            versiculo: confirmado.versiculo,

            versiculoFin: confirmado.versiculo_fin ?? null,

            referencia: confirmado.referencia,
          };

          // Mostramos la referencia confirmada
          // en este dispositivo.

          setVersiculoDetectado(referenciaConfirmada);

          // Limpiamos el texto anterior mientras
          // consultamos el nuevo versículo.

          setTextoVersiculo(null);

          // ==================================================
          // CONSULTAR TEXTO BÍBLICO
          // ==================================================
          //
          // Cada dispositivo consulta el texto
          // correspondiente al versículo confirmado.
          // ==================================================

          buscarVersiculo(
            confirmado.libro,
            confirmado.capitulo,
            confirmado.versiculo,
            confirmado.versiculo_fin,
          ).then((resultado) => {
            console.log("Texto del versículo confirmado:", resultado);

            if (resultado) {
              setTextoVersiculo(resultado);
            }
          });
        },
      )

      .subscribe((estado) => {
        if (estado === "SUBSCRIBED") {
          console.log("Escuchando versículos confirmados de la sala:", id);
        }
      });

    // ==================================================
    // LIMPIEZA
    // ==================================================

    return () => {
      activo = false;

      supabase.removeChannel(canalConfirmados);
    };
  }, [id]);
  // ==================================================
  // GUARDAR VERSÍCULO CONFIRMADO
  // ==================================================

  async function guardarVersiculoConfirmado(deteccion, votos) {
    try {
      const ahora = Date.now();

      const ultimaConfirmacion = ultimaConfirmacionRef.current;

      // ==================================================
      // EVITAR DUPLICADOS SEGUIDOS
      // ==================================================
      //
      // Si este mismo dispositivo ya confirmó
      // la misma referencia hace menos de 10 segundos,
      // no volvemos a insertarla.

      if (
        ultimaConfirmacion.referencia === deteccion.referencia &&
        ahora - ultimaConfirmacion.tiempo < 10000
      ) {
        console.log("Confirmación duplicada ignorada:", deteccion.referencia);

        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error("No existe un usuario autenticado.");

        return;
      }

      // ==================================================
      // CALCULAR VENTANA DE CONSENSO
      // ==================================================
      //
      // Agrupamos las confirmaciones en bloques de 5 segundos.
      //
      // Si PC y celular confirman el mismo versículo
      // dentro del mismo bloque, ambos generarán
      // exactamente el mismo número de ventana.
      //
      // PostgreSQL permitirá guardar solamente uno.
      // ==================================================

      const tiempoDeteccion = new Date(deteccion.created_at).getTime();

      const ventanaConsenso = Math.floor(tiempoDeteccion / VENTANA_CONSENSO_MS);

      // ==================================================
      // DATOS DEL VERSÍCULO CONFIRMADO
      // ==================================================

      const nuevoConfirmado = {
        sala_id: id,

        libro: deteccion.libro,

        capitulo: deteccion.capitulo,

        versiculo: deteccion.versiculo,

        // Conservamos también el final del rango.
        versiculo_fin: deteccion.versiculo_fin ?? null,

        referencia: deteccion.referencia,

        votos,

        confirmado_por: user.id,

        ventana_consenso: ventanaConsenso,
      };

      console.log("Guardando versículo confirmado:", nuevoConfirmado);

      const { data, error: errorConfirmacion } = await supabase
        .from("versiculos_confirmados")
        .insert(nuevoConfirmado)
        .select()
        .single();

      if (errorConfirmacion) {
        // ==================================================
        // CONFIRMACIÓN DUPLICADA
        // ==================================================
        //
        // PostgreSQL devuelve el código 23505 cuando
        // otro dispositivo ya guardó el mismo versículo
        // dentro de la misma ventana de consenso.
        //
        // Esto NO es un error real para nuestra aplicación.
        // Significa que otro dispositivo ganó la carrera.
        // ==================================================

        if (errorConfirmacion.code === "23505") {
          console.log(
            "El versículo ya fue confirmado por otro dispositivo:",
            deteccion.referencia,
          );

          return;
        }

        // Cualquier otro error sí debemos mostrarlo.

        console.error(
          "Error al guardar versículo confirmado:",
          errorConfirmacion,
        );

        return;
      }

      // Solo marcamos el bloqueo después
      // de que Supabase confirme el INSERT.

      ultimaConfirmacionRef.current = {
        referencia: deteccion.referencia,

        tiempo: ahora,
      };

      console.log("Versículo confirmado guardado:", data);
    } catch (errorGuardar) {
      console.error("Error inesperado guardando consenso:", errorGuardar);
    }
  }
  // ==================================================
  // MOTOR DE CONSENSO
  // ==================================================
  //
  // Cada vez que llega una nueva detección,
  // revisamos las detecciones recientes.
  //
  // Para confirmar un versículo necesitamos:
  //
  // 1. Misma referencia.
  // 2. Misma sala.
  // 3. Detectada recientemente.
  // 4. Dispositivos diferentes.
  // ==================================================

  useEffect(() => {
    // Si todavía no tenemos detecciones,
    // no hay nada que analizar.

    if (deteccionesRecientes.length === 0) {
      return;
    }

    // ==================================================
    // ANALIZAR TODAS LAS REFERENCIAS RECIENTES
    // ==================================================
    //
    // Antes analizábamos solamente la última detección.
    //
    // Ahora vamos a revisar todas las referencias que
    // existan en deteccionesRecientes.
    //
    // Ejemplo:
    //
    // Juan 3:16
    // Romanos 8:1-4
    // Filipenses 4:13
    //
    // Cada referencia tendrá su propio análisis
    // de consenso.
    // ==================================================

    // Creamos una lista solamente con las referencias.
    //
    // Ejemplo:
    //
    // [
    //   "Juan 3:16",
    //   "Romanos 8:1-4",
    //   "Juan 3:16"
    // ]

    const referencias = deteccionesRecientes.map(
      (deteccion) => deteccion.referencia,
    );

    // Set elimina referencias repetidas.
    //
    // El ejemplo anterior queda:
    //
    // [
    //   "Juan 3:16",
    //   "Romanos 8:1-4"
    // ]

    const referenciasUnicas = [...new Set(referencias)];

    // ==================================================
    // ANALIZAR CADA REFERENCIA
    // ==================================================

    referenciasUnicas.forEach((referencia) => {
      // Buscamos todas las detecciones
      // que pertenecen a esta referencia.

      const deteccionesReferencia = deteccionesRecientes.filter(
        (deteccion) => deteccion.referencia === referencia,
      );

      // Si por alguna razón no encontramos ninguna,
      // continuamos con la siguiente referencia.

      if (deteccionesReferencia.length === 0) {
        return;
      }

      // ==================================================
      // OBTENER LA DETECCIÓN MÁS RECIENTE
      // DE ESTA REFERENCIA
      // ==================================================

      const ultimaDeteccion =
        deteccionesReferencia[deteccionesReferencia.length - 1];

      const tiempoUltimaDeteccion = new Date(
        ultimaDeteccion.created_at,
      ).getTime();

      // ==================================================
      // BUSCAR DETECCIONES COMPATIBLES
      // ==================================================
      //
      // Una detección es compatible cuando:
      //
      // 1. Es de la misma referencia.
      // 2. Está dentro de nuestra ventana de 10 segundos.
      //
      // Así evitamos juntar detecciones demasiado alejadas.
      // ==================================================

      const deteccionesCompatibles = deteccionesReferencia.filter(
        (deteccion) => {
          const tiempoDeteccion = new Date(deteccion.created_at).getTime();

          const diferenciaTiempo = Math.abs(
            tiempoUltimaDeteccion - tiempoDeteccion,
          );

          return diferenciaTiempo <= VENTANA_CONSENSO_MS;
        },
      );

      // ==================================================
      // CONTAR DISPOSITIVOS DIFERENTES
      // ==================================================
      //
      // Un mismo dispositivo puede generar varias
      // detecciones, pero solamente cuenta como un voto.
      // ==================================================

      const dispositivosUnicos = new Set(
        deteccionesCompatibles.map((deteccion) => deteccion.dispositivo_id),
      );

      const cantidadVotos = dispositivosUnicos.size;

      console.log("Analizando consenso:", referencia, "Votos:", cantidadVotos);

      // ==================================================
      // ¿SE ALCANZÓ EL CONSENSO?
      // ==================================================

      if (cantidadVotos >= VOTOS_NECESARIOS) {
        // ==================================================
        // IDENTIFICAR ESTA OCURRENCIA DEL CONSENSO
        // ==================================================
        //
        // Usamos la referencia + la ventana de tiempo.
        //
        // Así podemos distinguir:
        //
        // Juan 3:16 ahora
        //
        // de:
        //
        // Juan 3:16 citado nuevamente mucho después.
        // ==================================================

        const ventanaConsenso = Math.floor(
          tiempoUltimaDeteccion / VENTANA_CONSENSO_MS,
        );

        const claveConsenso = `${ultimaDeteccion.referencia}|${ventanaConsenso}`;

        // Si este dispositivo ya procesó exactamente
        // este consenso, no intentamos guardarlo otra vez.

        if (consensosProcesadosRef.current.has(claveConsenso)) {
          console.log("Consenso ya procesado:", ultimaDeteccion.referencia);

          return;
        }

        // Lo marcamos antes del INSERT.
        //
        // Esto es importante porque pueden llegar varios
        // eventos Realtime casi al mismo tiempo.

        consensosProcesadosRef.current.add(claveConsenso);
        const nuevoConsenso = {
          referencia: ultimaDeteccion.referencia,

          libro: ultimaDeteccion.libro,

          capitulo: ultimaDeteccion.capitulo,

          versiculo: ultimaDeteccion.versiculo,

          versiculoFin: ultimaDeteccion.versiculo_fin ?? null,

          votos: cantidadVotos,

          confirmadoEn: new Date().toISOString(),
        };

        console.log("CONSENSO ALCANZADO:", nuevoConsenso);

        setConsenso(nuevoConsenso);

        // Guardamos la confirmación oficial
        // de esta referencia en Supabase.

        guardarVersiculoConfirmado(ultimaDeteccion, cantidadVotos);
      }
    });
  }, [deteccionesRecientes]);
  // ==================================================
  // GUARDAR DETECCIÓN EN SUPABASE
  // ==================================================
  //
  // Ejemplo recibido:
  //
  // {
  //   libro: "Salmos",
  //   capitulo: 23,
  //   versiculo: 1,
  //   referencia: "Salmos 23:1"
  // }
  //
  // Después guardamos:
  //
  // sala
  // dispositivo
  // usuario
  // libro
  // capítulo
  // versículo
  // referencia
  // ==================================================

  async function guardarDeteccion(referencia) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error(
          "No hay un usuario autenticado para guardar la detección.",
        );

        return;
      }

      const nuevaDeteccion = {
        sala_id: id,

        dispositivo_id: dispositivoIdRef.current,

        usuario_id: user.id,

        libro: referencia.libro,

        capitulo: referencia.capitulo,

        versiculo: referencia.versiculo,

        // Si es un rango:
        // Romanos 8:1-4
        // aquí guardaremos 4.
        //
        // Si es Juan 3:16,
        // guardaremos null.
        versiculo_fin: referencia.versiculoFin ?? null,

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
  // ESTABILIZAR REFERENCIA ANTES DE GUARDAR
  // ==================================================
  //
  // Esta función recibe una referencia detectada,
  // pero NO la guarda inmediatamente.
  //
  // Primero la dejamos como candidata durante
  // 700 milisegundos.
  //
  // Si durante ese tiempo aparece otra referencia,
  // cancelamos el temporizador anterior y comenzamos
  // nuevamente con la nueva candidata.
  //
  // Ejemplo:
  //
  // Juan 3:1
  //    ↓
  // Chrome corrige rápidamente
  //    ↓
  // Juan 3:16
  //
  // Solamente la última candidata estable
  // llegará a guardarDeteccion().
  // ==================================================

  function estabilizarReferencia(referencia) {
    const clave = referencia.referencia;

    console.log("Referencia candidata:", clave);

    // Buscamos si ESTA referencia ya estaba esperando.
    const temporizadorAnterior = referenciasCandidatasRef.current.get(clave);

    // Solamente cancelamos el temporizador de la MISMA referencia.
    // Las demás referencias continúan normalmente.
    if (temporizadorAnterior) {
      clearTimeout(temporizadorAnterior);
    }

    // Creamos un temporizador independiente
    // para esta referencia.
    const nuevoTemporizador = setTimeout(() => {
      console.log("Referencia estabilizada:", clave);

      // Después de 700 ms enviamos esta referencia
      // al sistema normal de detecciones.
      guardarDeteccion(referencia);

      // Ya fue procesada, así que la eliminamos del Map.
      referenciasCandidatasRef.current.delete(clave);
    }, TIEMPO_ESTABILIZACION_MS);

    // Guardamos el temporizador usando la referencia
    // como identificador.
    referenciasCandidatasRef.current.set(clave, nuevoTemporizador);
  }
  // ==================================================
  // GUARDAR FRAGMENTO DE TRANSCRIPCIÓN
  // ==================================================
  //
  // Cada vez que Chrome termina de reconocer
  // un fragmento de voz, lo guardamos en Supabase.
  //
  // Ejemplo:
  //
  // "Hoy vamos a hablar acerca de la fe."
  //
  // Cada fragmento queda relacionado con:
  // - la sala
  // - el dispositivo
  // - el usuario
  // ==================================================

  async function guardarTranscripcion(texto) {
    // Evitamos guardar textos vacíos.
    const textoLimpio = texto.trim();

    if (!textoLimpio) {
      return;
    }

    // Una sala finalizada ya no debe
    // recibir nuevas transcripciones.
    if (salaRef.current?.estado === "finalizada") {
      console.log("Transcripción ignorada porque el culto ha finalizado.");
      return;
    }

    try {
      // Obtenemos el usuario que está usando
      // actualmente este dispositivo.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error(
          "No hay un usuario autenticado para guardar la transcripción.",
        );

        return;
      }

      // --------------------------------------------------
      // COMPROBAR QUIÉN CREÓ LA SALA
      // --------------------------------------------------
      //
      // Todos los dispositivos pueden escuchar y detectar
      // versículos, pero solamente el creador de la sala
      // guardará la transcripción completa del culto.
      // --------------------------------------------------

      if (user.id !== salaRef.current?.creado_por) {
        console.log(
          "Este dispositivo participa en el consenso, pero no guarda la transcripción.",
        );

        return;
      }

      // --------------------------------------------------
      // GUARDAR TRANSCRIPCIÓN
      // --------------------------------------------------

      const nuevaTranscripcion = {
        sala_id: id,
        dispositivo_id: dispositivoIdRef.current,
        usuario_id: user.id,
        texto: textoLimpio,
      };

      const { data, error: errorTranscripcion } = await supabase
        .from("transcripciones")
        .insert(nuevaTranscripcion)
        .select()
        .single();

      if (errorTranscripcion) {
        console.error("Error al guardar la transcripción:", errorTranscripcion);

        return;
      }

      console.log("Fragmento de transcripción guardado:", data);
    } catch (errorGuardar) {
      console.error("Error inesperado guardando transcripción:", errorGuardar);
    }
  }
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

    // También recibiremos
    // texto temporal.

    reconocimiento.interimResults = true;

    // Español de Ecuador.

    reconocimiento.lang = "es-EC";

    // ==================================================
    // CUANDO CHROME RECONOCE VOZ
    // ==================================================

    reconocimiento.onresult = (event) => {
      let textoFinal = "";

      let textoTemporal = "";

      // Recorremos todos los resultados
      // entregados por Chrome.

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const texto = event.results[i][0].transcript;

        // Chrome considera este fragmento
        // como definitivo.

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
        // Agregamos el texto
        // a la transcripción.

        setTranscripcion((textoAnterior) => textoAnterior + textoFinal);
        // Guardamos también este fragmento
        // en Supabase.

        guardarTranscripcion(textoFinal);
        // Buscamos todas las referencias
        // bíblicas presentes en este fragmento.

        const referenciasEncontradas = detectarVersiculos(textoFinal);

        console.log("Referencias encontradas:", referenciasEncontradas);

        if (referenciasEncontradas.length > 0) {
          // ==================================================
          // PROCESAR TODAS LAS REFERENCIAS
          // ==================================================
          //
          // Antes solamente guardábamos la última referencia.
          //
          // Ejemplo:
          //
          // Juan 3:16
          // Romanos 8:1-4
          // Filipenses 4:13
          //
          // terminaba guardando solamente Filipenses 4:13.
          //
          // Ahora cada referencia encontrada genera su propia
          // detección y podrá participar en el consenso.
          // ==================================================

          const referenciasUnicas = referenciasEncontradas.filter(
            (referencia, index, arreglo) =>
              index ===
              arreglo.findIndex(
                (otraReferencia) =>
                  otraReferencia.referencia === referencia.referencia,
              ),
          );

          console.log(
            "Referencias únicas que serán procesadas:",
            referenciasUnicas,
          );

          // ==================================================
          // GUARDAR CADA DETECCIÓN
          // ==================================================

          referenciasUnicas.forEach((referencia) => {
            console.log("Procesando referencia:", referencia.referencia);
            // Ya no guardamos inmediatamente.
            // Primero dejamos que la referencia se estabilice.
            estabilizarReferencia(referencia);
          });

          // ==================================================
          // ÚLTIMA REFERENCIA
          // ==================================================
          //
          // Todas participan en el consenso, pero la tarjeta
          // "Último versículo detectado" debe mostrar solamente
          // la referencia más reciente.
          // ==================================================

          const ultimaReferencia =
            referenciasUnicas[referenciasUnicas.length - 1];

          console.log("Último versículo detectado:", ultimaReferencia);

          setVersiculoDetectado(ultimaReferencia);

          // Limpiamos el texto anterior mientras consultamos
          // el nuevo versículo.

          setTextoVersiculo(null);

          // ==================================================
          // CONSULTAR API BÍBLICA
          // ==================================================
          //
          // No necesitamos consultar aquí el texto de todas
          // las referencias.
          //
          // La tarjeta solamente muestra la última.
          // Las confirmadas llegarán después mediante Realtime.
          // ==================================================

          buscarVersiculo(
            ultimaReferencia.libro,
            ultimaReferencia.capitulo,
            ultimaReferencia.versiculo,
            ultimaReferencia.versiculoFin,
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

    // Guardamos el reconocedor
    // para usarlo desde el botón.

    reconocimientoRef.current = reconocimiento;

    // Al abandonar la pantalla
    // detenemos el micrófono.

    return () => {
      reconocimiento.stop();
    };
  }, []);

  // ==================================================
  // INICIAR / DETENER ESCUCHA
  // ==================================================
  // ==================================================
  // INICIAR / DETENER ESCUCHA
  // ==================================================

  function cambiarEscucha() {
    const reconocimiento = reconocimientoRef.current;

    if (!reconocimiento) {
      return;
    }

    // ==================================================
    // BLOQUEAR MICRÓFONO SI EL CULTO FINALIZÓ
    // ==================================================
    //
    // Una sala finalizada ya no debe generar
    // nuevas transcripciones ni detecciones.
    // ==================================================

    if (sala?.estado === "finalizada") {
      console.log(
        "No se puede iniciar el micrófono porque el culto ha finalizado.",
      );

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
  // FINALIZAR CULTO
  // ==================================================
  //
  // Cuando el administrador termina el culto:
  //
  // 1. Cambiamos el estado de la sala a "finalizada".
  // 2. Guardamos la fecha y hora de finalización.
  // 3. Actualizamos el estado local de React.
  //
  // NO borramos la sala porque después necesitaremos
  // su historial, versículos y enseñanza.
  // ==================================================

  async function finalizarCulto() {
    // Evitamos finalizar nuevamente
    // una sala que ya terminó.

    if (sala?.estado === "finalizada") {
      return;
    }

    // Pedimos confirmación para evitar
    // terminar el culto por accidente.

    const confirmar = window.confirm(
      "¿Estás seguro de que deseas finalizar este culto?",
    );

    if (!confirmar) {
      return;
    }

    try {
      const fechaFin = new Date().toISOString();

      const { data, error: errorFinalizar } = await supabase
        .from("salas")
        .update({
          estado: "finalizada",
          fecha_fin: fechaFin,
        })
        .eq("id", id)
        .select()
        .single();

      if (errorFinalizar) {
        console.error("Error al finalizar el culto:", errorFinalizar);
        return;
      }

      console.log("Culto finalizado correctamente:", data);

      // Actualizamos la sala en React.
      // Así la pantalla cambia inmediatamente
      // sin necesidad de hacer F5.
      // ==================================================
      // DETENER MICRÓFONO AL FINALIZAR EL CULTO
      // ==================================================
      //
      // Si el dispositivo estaba escuchando cuando
      // finalizamos el culto, detenemos el reconocimiento
      // inmediatamente.
      // ==================================================

      if (reconocimientoRef.current && escuchando) {
        reconocimientoRef.current.stop();

        setEscuchando(false);
      }
      setSala(data);
    } catch (errorFinalizar) {
      console.error("Error inesperado al finalizar el culto:", errorFinalizar);
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
    FINALIZAR CULTO
    ============================================== */}

        {sala.estado === "activa" && (
          <button
            type="button"
            className="sala-finish-button"
            onClick={finalizarCulto}
          >
            Finalizar culto
          </button>
        )}

        {sala.estado === "finalizada" && (
          <div className="sala-finished-message">Este culto ha finalizado.</div>
        )}
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
            disabled={sala?.estado === "finalizada"}
          >
            {escuchando ? <MicOff size={19} /> : <Mic size={19} />}

            {sala?.estado === "finalizada"
              ? "Culto finalizado"
              : escuchando
                ? "Detener escucha"
                : "Iniciar escucha"}
          </button>

          {errorMicrofono && (
            <p className="sala-microphone-error">{errorMicrofono}</p>
          )}
        </div>
        {/* ==============================================
    CONSENSO
    ============================================== */}

        {consenso && (
          <div className="sala-info-card">
            <div className="sala-info-icon">
              <Users size={22} />
            </div>

            <div>
              <span>Versículo confirmado</span>

              <strong>{consenso.referencia}</strong>

              <small>{consenso.votos} dispositivos coincidieron</small>
            </div>
          </div>
        )}
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
