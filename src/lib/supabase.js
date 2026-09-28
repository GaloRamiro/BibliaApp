// Importamos la herramienta que permite conectarnos con Supabase.
import { createClient } from "@supabase/supabase-js";

// Leemos las variables del archivo .env.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Creamos la conexión con nuestro proyecto de Supabase.
export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);