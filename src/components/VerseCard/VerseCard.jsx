// Importamos iconos de Lucide.
import { BookOpen, Radio, ChevronRight } from "lucide-react";

// Importamos los estilos de este componente.
import "./VerseCard.css";

// VerseCard recibe información desde otro componente.
//
// referencia → ejemplo: "Juan 3:16"
// texto      → contenido del versículo
function VerseCard({ referencia, texto }) {
  return (
    <article className="verse-card">
      {/* Parte superior de la tarjeta */}
      <div className="verse-card-header">
        <div className="verse-icon">
          <BookOpen size={22} />
        </div>

        {/* Indica que estamos recibiendo información en vivo */}
        <div className="verse-live">
          <Radio size={14} />
          <span>EN VIVO</span>
        </div>
      </div>

      {/* Referencia bíblica recibida desde Home */}
      <h2 className="verse-reference">{referencia}</h2>

      {/* Texto recibido desde Home */}
      <p className="verse-text">{texto}</p>

      {/* Más adelante abrirá el capítulo completo */}
      <button type="button" className="verse-link">
        Ver capítulo
        <ChevronRight size={17} />
      </button>
    </article>
  );
}

export default VerseCard;
