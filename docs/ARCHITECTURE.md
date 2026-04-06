# Arquitectura recomendada (ligera)

## Capas
1. **Presentación** (`index.html`, `style.css`)
   - Estructura visual y estilos.
2. **Estado y UI** (`script.js`)
   - Navegación, sesión local, render y eventos.
3. **Datos/config** (`data.js`)
   - Idiomas, invitados, contenido demo y fecha del evento.

## Principios
- Usar IDs estables para negocio (`guestId`) y no nombres visibles.
- Mantener los textos por idioma fuera de HTML para escalar traducciones.
- Separar demo data de futura capa API para migrar sin reescribir UI.

## Próxima evolución
- Sustituir `data.js` por adaptadores de API (`services/`).
- Añadir validación de respuestas y fallback offline.
- Instrumentar errores de frontend para detectar fallos en tiempo real.
