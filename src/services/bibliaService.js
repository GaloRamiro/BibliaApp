// ======================================================
// SERVICIO DE BIBLIA
// ======================================================
//
// Recibe:
// buscarVersiculo("Juan", 3, 16)
//
// Consulta la API y devuelve:
// {
//   referencia: "Juan 3:16",
//   texto: "...",
//   version: "rvr1909"
// }
//
// ======================================================

// URL principal de la API
const API_URL = "https://api.midvash.com/v1";

// Versión que utilizaremos por ahora
const VERSION_BIBLIA = "rvr1909";

export async function buscarVersiculo(libro, capitulo, versiculo) {
  try {
    // Convertimos el libro a minúsculas.
    // Ejemplo:
    // "Juan" -> "juan"
    const libroApi = libro.toLowerCase().replace(/\s+/g, "-");

    // Construimos la dirección de la API.
    //
    // Ejemplo:
    // https://api.midvash.com/v1/rvr1909/juan/3/16

    const url = `${API_URL}/${VERSION_BIBLIA}/${libroApi}/${capitulo}/${versiculo}`;

    console.log("Consultando API:");
    console.log(url);

    // Hacemos la petición.
    const respuesta = await fetch(url);

    // Si la API responde con error,
    // detenemos la función.
    if (!respuesta.ok) {
      throw new Error(`Error al buscar el versículo: ${respuesta.status}`);
    }

    // Convertimos la respuesta a JavaScript.
    const resultado = await respuesta.json();

    console.log("Respuesta de la API:");
    console.log(resultado);

    // Midvash devuelve:
    //
    // {
    //   data: {
    //     version: "...",
    //     book: "...",
    //     chapter: 3,
    //     verse: 16,
    //     text: "..."
    //   },
    //   meta: {...}
    // }

    const datos = resultado.data;

    // Dejamos una respuesta sencilla para React.
    return {
      referencia: `${libro} ${capitulo}:${versiculo}`,

      texto: datos.text,

      version: datos.version,
    };
  } catch (error) {
    console.error("Error en buscarVersiculo:", error);

    return null;
  }
}
