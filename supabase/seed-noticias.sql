-- Opcional: tres artículos de arranque para que /noticias no se vea vacío antes de que GEMPRO
-- publique los suyos desde /panel/noticias. Ejecutar una sola vez, después de schema.sql.
insert into noticias (titulo, contenido, publicado) values
  (
    '¿Qué es el mantenimiento predictivo y por qué su planta lo necesita?',
    'Medir la condición de un equipo antes de que falle cambia el costo de una reparación: de una parada no planificada a una intervención programada. En GEMPRO usamos análisis de vibraciones, termografía, análisis de aceites y ultrasonido para saber exactamente cómo está cada máquina, sin necesidad de detenerla para revisarla. La diferencia no es solo económica: una parada programada se planifica con repuestos listos y personal disponible, mientras que una falla imprevista casi siempre cuesta más tiempo y más dinero.',
    true
  ),
  (
    'Cinco señales de que un eje está desalineado (y por qué vuelve a fallar)',
    'La vibración vuelve, el rodamiento se recalienta, el acople se desgasta antes de tiempo. Estas son señales típicas de una desalineación que nunca se corrigió de raíz. La causa casi siempre está en el montaje, no en la pieza que se cambió. Por eso, después de cualquier reparación que involucre desmontar un motor o una bomba, alineamos con láser de precisión — no basta con "a ojo" o con una regla.',
    true
  ),
  (
    'Cómo armar un plan de mantenimiento por criticidad, no por calendario',
    'No todos los equipos merecen la misma frecuencia de inspección. Un plan basado en RCM (Mantenimiento Centrado en Confiabilidad) prioriza según qué tan crítico es cada activo para la operación: un equipo que detiene toda la planta si falla necesita más atención que uno con respaldo inmediato. Esto evita dos errores comunes: revisar demasiado seguido equipos poco críticos, y descuidar los que de verdad importan.',
    true
  );
