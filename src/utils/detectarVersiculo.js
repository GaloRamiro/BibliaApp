// ==================================================
// DETECTOR DE REFERENCIAS BÍBLICAS
// ==================================================
//
// Este archivo recibe un texto reconocido por voz
// e intenta encontrar una referencia bíblica.
//
// Ejemplo:
//
// "vamos a leer Juan capítulo tres versículo dieciséis"
//
// Resultado:
//
// {
//   libro: "Juan",
//   capitulo: 3,
//   versiculo: 16,
//   referencia: "Juan 3:16"
// }

// --------------------------------------------------
// NÚMEROS ESCRITOS CON PALABRAS
// --------------------------------------------------
//
// SpeechRecognition normalmente puede devolver:
//
// "Juan capítulo tres versículo dieciséis"
//
// Por eso necesitamos convertir:
//
// tres      -> 3
// dieciséis -> 16
//

const numeros = {
  uno: 1,
  un: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
};

// --------------------------------------------------
// LIBROS BÍBLICOS
// --------------------------------------------------
//
// Por ahora agregamos los nombres que necesitamos
// reconocer. Después ampliaremos variantes como:
//
// "primera de corintios"
// "1 corintios"
// "primero de corintios"
//

const libros = [
  "genesis",
  "exodo",
  "levitico",
  "numeros",
  "deuteronomio",
  "josue",
  "jueces",
  "rut",
  "esdras",
  "nehemias",
  "ester",
  "job",
  "salmos",
  "proverbios",
  "eclesiastes",
  "cantares",
  "isaias",
  "jeremias",
  "lamentaciones",
  "ezequiel",
  "daniel",
  "oseas",
  "joel",
  "amos",
  "abdias",
  "jonas",
  "miqueas",
  "nahum",
  "habacuc",
  "sofonias",
  "hageo",
  "zacarias",
  "malaquias",

  "mateo",
  "marcos",
  "lucas",
  "juan",
  "hechos",
  "romanos",
  "galatas",
  "efesios",
  "filipenses",
  "colosenses",
  "filemon",
  "hebreos",
  "santiago",
  "judas",
  "apocalipsis",
];

// --------------------------------------------------
// QUITAR TILDES
// --------------------------------------------------
//
// "capítulo" -> "capitulo"
// "dieciséis" -> "dieciseis"
// "Génesis" -> "genesis"
//

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;!?¿¡]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// --------------------------------------------------
// CONVERTIR UNA PALABRA EN NÚMERO
// --------------------------------------------------

function obtenerNumero(valor) {
  // Si SpeechRecognition ya escribió:
  //
  // "Juan capítulo 3 versículo 16"
  //
  // simplemente convertimos "3" y "16".
  if (/^\d+$/.test(valor)) {
    return Number(valor);
  }

  // Si escribió:
  //
  // "tres"
  //
  // buscamos el número en nuestro objeto.
  if (numeros[valor] !== undefined) {
    return numeros[valor];
  }

  return null;
}

// --------------------------------------------------
// BUSCAR LIBRO
// --------------------------------------------------

function buscarLibro(palabras) {
  for (let i = 0; i < palabras.length; i++) {
    const palabra = palabras[i];

    if (libros.includes(palabra)) {
      return {
        libro: palabra,
        posicion: i,
      };
    }
  }

  return null;
}

// --------------------------------------------------
// PONER BONITO EL NOMBRE DEL LIBRO
// --------------------------------------------------
//
// "juan" -> "Juan"
// "romanos" -> "Romanos"
//

function formatearLibro(libro) {
  return libro.charAt(0).toUpperCase() + libro.slice(1);
}

// ==================================================
// FUNCIÓN PRINCIPAL
// ==================================================

export function detectarVersiculo(texto) {
  // Si no recibimos texto, no hacemos nada.
  if (!texto) {
    return null;
  }

  // Normalizamos el texto.
  const textoNormalizado = normalizarTexto(texto);

  // Lo separamos palabra por palabra.
  const palabras = textoNormalizado.split(" ");

  // Buscamos un libro bíblico.
  const libroEncontrado = buscarLibro(palabras);

  // Si no encontramos ningún libro,
  // no existe una referencia detectable.
  if (!libroEncontrado) {
    return null;
  }

  const { libro, posicion } = libroEncontrado;

  // ------------------------------------------------
  // BUSCAR "CAPÍTULO"
  // ------------------------------------------------

  let capitulo = null;

  let versiculo = null;

  for (let i = posicion + 1; i < palabras.length; i++) {
    // Encontramos la palabra "capitulo".
    if (palabras[i] === "capitulo" && palabras[i + 1]) {
      capitulo = obtenerNumero(palabras[i + 1]);
    }

    // Encontramos "versiculo".
    if (palabras[i] === "versiculo" && palabras[i + 1]) {
      versiculo = obtenerNumero(palabras[i + 1]);
    }
  }

  // ------------------------------------------------
  // REFERENCIA CORTA
  // ------------------------------------------------
  //
  // También queremos reconocer:
  //
  // "Juan 3 16"
  //
  // porque algunos navegadores pueden transformar
  // la voz directamente en números.
  //

  if (capitulo === null || versiculo === null) {
    const despuesDelLibro = palabras.slice(posicion + 1);

    const numerosEncontrados = despuesDelLibro
      .map(obtenerNumero)
      .filter((numero) => numero !== null);

    if (numerosEncontrados.length >= 2) {
      if (capitulo === null) {
        capitulo = numerosEncontrados[0];
      }

      if (versiculo === null) {
        versiculo = numerosEncontrados[1];
      }
    }
  }

  // Necesitamos libro + capítulo + versículo.
  if (capitulo === null || versiculo === null) {
    return null;
  }

  const nombreLibro = formatearLibro(libro);

  // ------------------------------------------------
  // RESULTADO
  // ------------------------------------------------

  return {
    libro: nombreLibro,

    capitulo,

    versiculo,

    referencia: `${nombreLibro} ${capitulo}:${versiculo}`,
  };
}
