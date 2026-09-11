/**
 * Todo el contenido del sitio en un solo lugar.
 * Los datos entre [CORCHETES] no se pudieron verificar y debe confirmarlos GEMPRO.
 */

/**
 * Antepone la base del sitio a una ruta absoluta ("/servicios" -> "/gempro-web/servicios").
 * En el dominio propio (base "/") no cambia nada; en un sitio de proyecto de GitHub Pages
 * (base "/gempro-web/") hace que los enlaces entre páginas sigan funcionando.
 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL; // p. ej. "/" o "/gempro-web/"
  return (base.endsWith('/') ? base.slice(0, -1) : base) + path;
}

/**
 * Origen público real del despliegue actual: el dominio de producción de Vercel (el propio
 * dominio de GEMPRO una vez asignado ahí, sin tocar código) en vez del origin de la petición.
 * Así el QR "permanente" no queda apuntando a una URL de vista previa que Vercel puede borrar.
 */
export function origenPublico(origenPeticion: string): string {
  // globalThis.process, no process: este módulo también exporta un `process` propio (los pasos
  // de la sección "Nuestro proceso") que taparía el global de Node en todo el archivo.
  const produccion = globalThis.process?.env.VERCEL_PROJECT_PRODUCTION_URL;
  return produccion ? `https://${produccion}` : origenPeticion;
}

export const site = {
  name: 'GEMPRO',
  legalName: 'GEMPRO S.A.',
  expanded: 'Grupo Empresarial de Mantenimiento Proactivo',
  tagline: 'Medir es nuestra ciencia',
  description:
    'Ingeniería de mantenimiento predictivo en Maracaibo: análisis de vibraciones, termografía, alineación láser y balanceo dinámico para plantas que no pueden parar.',
  url: 'https://gempro.com.ve',
  whatsapp: '584146355951',
  whatsappDisplay: '+58 414-635 5951',
  phone: '+58 414-6355951',
  email: 'keith.quilarquez@gempro.com.ve',
  address: 'Urb. Urdaneta, Av. principal con calle 9, Edif. GEMPRO PB No. 105-A, Maracaibo, Edo. Zulia, Venezuela',
  addressShort: 'Urb. Urdaneta, Av. principal con calle 9, Edif. GEMPRO, Maracaibo',
  rif: '[J-XXXXXXXX-X]',
  social: {
    facebook: 'https://www.facebook.com/Gempro.Company/',
    instagram: 'https://www.instagram.com/gempro.company/',
  },
};

export const nav = [
  { label: 'Servicios', href: withBase('/servicios') },
  { label: 'Nosotros', href: withBase('/nosotros') },
  { label: 'Productos', href: withBase('/productos') },
  { label: 'Noticias', href: withBase('/noticias') },
];

export const hero = {
  eyebrow: 'Monitoreo de condición · Maracaibo',
  lines: ['Escuchamos', 'lo que sus', 'máquinas callan.'],
  text: 'Vibraciones, termografía, alineación láser y balanceo. Diagnóstico en sitio para plantas que no pueden parar.',
  primary: { label: 'Solicitar diagnóstico', href: '#contacto' },
  secondary: { label: 'Ver cómo trabajamos', href: '#proceso' },
  hud: {
    title: 'Lectura de ruta',
    demo: 'DEMO · datos ilustrativos',
    asset: 'BOMBA P-201 · MOTOR 150 HP',
    value: 4.6,
    unit: 'mm/s RMS',
    freq: '29,7 Hz',
    temp: '68 °C',
    alert: 'Desbalance detectado · programar corrección',
  },
};

export const sectors = [
  'Petróleo', 'Petroquímica', 'Cemento', 'Alimentos y bebidas', 'Generación eléctrica',
  'Minería', 'Plásticos', 'Vidrio', 'Automotriz', 'Naval', 'Azúcar',
];

export const services = [
  {
    id: 'predictivo', code: '01', label: 'Predictivo', title: 'Medir la condición',
    text: 'Vibraciones, termografía, aceites, ultrasonido y espesores. Tendencia y diagnóstico por equipo, no solo datos.',
    href: withBase('/servicios#predictivo'),
  },
  {
    id: 'proactivo', code: '02', label: 'Proactivo', title: 'Eliminar la causa',
    text: 'Alineación láser, balanceo y análisis de causa raíz.',
    href: withBase('/servicios#proactivo'),
  },
  {
    id: 'preventivo', code: '03', label: 'Preventivo', title: 'Planificar la parada',
    text: 'Planes RCM, inspecciones y lubricación de precisión.',
    href: withBase('/servicios#preventivo'),
  },
  {
    id: 'correctivo', code: '04', label: 'Correctivo', title: 'Reparar en sitio',
    text: 'Balanceo en taller, mecanizado, rebabitado, metalizado.',
    href: withBase('/servicios#correctivo'),
  },
];

export const process = [
  { n: '01', title: 'Medir', text: 'Ruta de medición en planta con analizadores, cámaras térmicas y ultrasonido.' },
  { n: '02', title: 'Diagnosticar', text: 'Espectros, tendencias y causa probable. Prioridad por criticidad del activo.' },
  { n: '03', title: 'Corregir', text: 'Alineación, balanceo, mecanizado o reparación, en sitio o en taller.' },
  { n: '04', title: 'Verificar', text: 'Nueva medición e informe con antes y después. Sin informe no hay cierre.' },
];

export const stats = [
  { value: 60, prefix: '+', label: 'años de experiencia acumulada del equipo técnico' },
  { value: 4, label: 'países: Venezuela, Argentina, Perú y Panamá' },
  { value: 11, label: 'sectores industriales atendidos' },
  { raw: '24/7', label: 'respuesta a emergencias en planta' },
];

export const equipment = [
  { id: 'vibracion', tag: 'Vibración', title: 'Analizadores FFT', text: 'Portátiles y en línea, con software de diagnóstico.' },
  { id: 'termografia', tag: 'Termografía', title: 'Cámaras HIKMICRO', text: 'Imagen radiométrica de alta resolución.' },
  { id: 'laser', tag: 'Alineación', title: 'Sistemas Easy-Laser', text: 'Ejes, poleas y geometría de bancadas.' },
  { id: 'ultrasonido', tag: 'Ultrasonido', title: 'Detectores acústicos', text: 'Fugas, rodamientos y trampas de vapor.' },
];

export const brands = [
  { id: 'easylaser', name: 'Easy-Laser' },
  { id: 'semapi', name: 'SEMAPI' },
  { id: 'hikmicro', name: 'HIKMICRO' },
  { id: 'jpbalancer', name: 'JP Balancer' },
];

export const training = {
  title: 'Formamos a los analistas de su planta.',
  text: 'Cursos cortos bajo normas ISO y ASNT con prácticas sobre equipos reales. En Maracaibo o en sus instalaciones.',
  courses: [
    { code: 'VIB-I', name: 'Análisis de vibraciones · Nivel I', date: '[FECHA]' },
    { code: 'TER-I', name: 'Termografía infrarroja · Nivel I', date: '[FECHA]' },
    { code: 'TRI', name: 'Tribología y análisis de aceites', date: '[FECHA]' },
    { code: 'ALB', name: 'Alineación y balanceo de precisión', date: '[FECHA]' },
  ],
};

export const presence = [
  { country: 'Venezuela', city: 'Maracaibo', phone: '+58 414-635 5951', tel: '+584146355951', address: 'Urb. Urdaneta, Av. principal con calle 9, Edif. GEMPRO PB No. 105-A, Maracaibo, Edo. Zulia', email: 'keith.quilarquez@gempro.com.ve' },
  { country: 'Argentina', city: 'Buenos Aires', phone: '+54 911 2539-8609', tel: '+5491125398609', address: 'Calle Julián Álvarez 2335, apto 6F, CABA', email: 'gempro.ar@gmail.com' },
  { country: 'Perú', city: 'Lima', phone: '+51 916 710 376', tel: '+51916710376', address: 'Calle Padre Urraca 140, San Miguel, Lima', email: 'gemproperu@gmail.com' },
  { country: 'Panamá', city: 'Costa del Este', phone: '+507 621-33648', tel: '+50762133648', address: 'Parque Industrial Costa del Este, Calle 3era, Edif. Istorage Piso M-01', email: 'info@gempropanama.com' },
];

/** Página /nosotros */
export const nosotros = {
  eyebrow: 'Quiénes somos',
  title: ['Ingenieros que miden', 'antes de intervenir.'],
  intro:
    'GEMPRO nace para que la decisión de parar una máquina —o dejarla seguir— se tome con datos, no con intuición. Un equipo técnico con más de 60 años de experiencia acumulada, trabajando hoy en Venezuela, Argentina, Perú y Panamá.',
  valores: [
    { title: 'Medir primero', text: 'Ninguna recomendación sale sin una medición que la respalde. Vibración, temperatura, alineación: números, no corazonadas.' },
    { title: 'La causa, no el síntoma', text: 'Una falla que vuelve no se resuelve cambiando la pieza otra vez. Se busca por qué volvió a fallar.' },
    { title: 'El informe es el entregable', text: 'Cada intervención cierra con un informe técnico verificable: antes, después y recomendación. Sin informe no hay cierre.' },
    { title: 'Presencia regional', text: 'Cuatro países, un mismo estándar de medición y el mismo equipo técnico detrás.' },
  ],
};

/** Página /productos: equipos que GEMPRO usa y representa, con más detalle que el resumen de inicio. */
export const productos = [
  {
    id: 'vibracion', marca: 'Analizadores FFT', tag: 'Vibración',
    text: 'Analizadores portátiles y sistemas de monitoreo en línea, con software de diagnóstico para espectro, fase, órbitas y cascada espectral.',
  },
  {
    id: 'termografia', marca: 'HIKMICRO', tag: 'Termografía',
    text: 'Cámaras termográficas de imagen radiométrica de alta resolución, para tableros eléctricos, motores, hornos y aislamiento.',
  },
  {
    id: 'laser', marca: 'Easy-Laser', tag: 'Alineación',
    text: 'Sistemas de alineación láser de precisión para ejes, poleas y geometría de bancadas — el mismo estándar en los cuatro países donde operamos.',
  },
  {
    id: 'balanceo', marca: 'JP Balancer', tag: 'Balanceo',
    text: 'Equipos de balanceo dinámico en sitio y en taller, para rotores, impulsores y ventiladores.',
  },
  {
    id: 'ultrasonido', marca: 'Detectores acústicos', tag: 'Ultrasonido',
    text: 'Detección de fugas de aire y gases, evaluación de rodamientos y verificación de trampas de vapor.',
  },
];

// Las noticias ya no viven aquí: son un CMS en Supabase (tabla `noticias`), editable desde
// /panel/noticias. Los tres artículos originales quedan en supabase/seed-noticias.sql como
// contenido inicial opcional.

export const contact = {
  title: ['Cuéntenos qué máquina', 'le quita el sueño.'],
  text: 'Un ingeniero responde con una propuesta de medición. Su consulta queda registrada; si prefiere, escríbanos por WhatsApp.',
  placeholder: 'Equipo y síntoma. Ej.: motor de 150 HP con vibración alta desde el cambio de rodamientos.',
};

/** Página /servicios: detalle rescatado del sitio de 2017 */
export const serviceDetail = [
  {
    id: 'predictivo', label: 'Predictivo', color: 'neon',
    title: 'Medir la condición antes de que falle',
    text: 'Rutas de medición periódicas o monitoreo en línea. Entregamos tendencia, diagnóstico y recomendación por equipo, no solo datos.',
    items: [
      ['Medición y análisis de vibraciones', 'Espectro, fase, órbitas, cascada espectral, dominio del tiempo'],
      ['Termografía infrarroja', 'Tableros eléctricos, motores, hornos, aislamiento'],
      ['Análisis de aceites lubricantes', 'Contaminación, desgaste, viscosidad, vida útil'],
      ['Medición de espesores por ultrasonido', 'Tuberías, tanques y recipientes con acceso a un solo lado'],
      ['Flujo magnético', 'Defectos en motores y generadores'],
      ['Monitoreo de condición en línea', 'Sensores permanentes en equipos críticos'],
    ],
  },
  {
    id: 'proactivo', label: 'Proactivo', color: 'neon',
    title: 'Eliminar la causa, no el síntoma',
    text: 'Cuando la misma falla vuelve, el problema está en el montaje, la lubricación o el diseño. Lo corregimos de raíz.',
    items: [
      ['Alineación de precisión', 'Ejes, poleas y bancadas con sistema láser'],
      ['Balanceo de precisión', 'En sitio, uno y dos planos'],
      ['Geometría de ingeniería', 'Planitud, rectitud y paralelismo con láser'],
      ['Análisis de causa raíz', 'RCA y FMEA sobre fallas repetitivas'],
      ['Tribología de precisión', 'Selección y control del lubricante'],
    ],
  },
  {
    id: 'preventivo', label: 'Preventivo', color: 'neon',
    title: 'Planificar la parada con datos',
    text: 'Planes de mantenimiento por tiempo y uso, implantados en el software de gestión que la planta ya usa o en uno que instalamos.',
    items: [
      ['Planes basados en RCM', 'Criticidad, frecuencias y tareas por equipo'],
      ['Software de gestión de mantenimiento', 'Órdenes de trabajo, repuestos, reportes'],
      ['Inspecciones programadas', 'Rutas y listas de verificación'],
      ['Lubricación de precisión', 'Cantidad, frecuencia y producto correctos'],
    ],
  },
  {
    id: 'correctivo', label: 'Correctivo', color: 'neon',
    title: 'Reparar en sitio o en nuestro taller',
    text: 'Taller de balanceo y mecanizado en Maracaibo y cuadrillas para intervención en planta. Emergencias 24/7.',
    items: [
      ['Balanceo dinámico en taller', 'Rotores, impulsores, ventiladores'],
      ['Mecanizado en sitio', 'Bancadas, bridas y partes sin desmontar'],
      ['Nivelación de bases y alineación de bancadas', 'Placas base y fundaciones de equipos rotativos'],
      ['Rebabitado de cojinetes', 'Metal babbitt en cojinetes de deslizamiento'],
      ['Metalizado de rotores', 'Recuperación de ejes y asientos'],
      ['Costura de metales en frío y corrección de fugas', 'Carcasas y bloques fisurados'],
    ],
  },
];
