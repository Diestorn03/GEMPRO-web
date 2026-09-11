/**
 * Aviso por correo cuando llega una consulta nueva por el formulario de contacto: hoy el mensaje
 * solo queda guardado en la tabla `mensajes` de Supabase, sin ninguna pantalla en el panel para
 * verlo — sin este correo, GEMPRO no se entera de una consulta nueva salvo que entre a mirar la
 * base de datos directamente.
 *
 * Envía por SMTP con una cuenta de Gmail dedicada (gratis, sin Google Workspace): GMAIL_USER +
 * GMAIL_APP_PASSWORD (contraseña de aplicación, no la contraseña normal de la cuenta — se genera
 * en myaccount.google.com/apppasswords, requiere verificación en dos pasos activada).
 *
 * Ambas variables son opcionales a propósito: si todavía no están configuradas, la consulta se
 * sigue guardando igual en Supabase (eso nunca depende del correo) y solo se registra un aviso
 * en los logs del servidor, para no bloquear el formulario mientras se termina de configurar.
 */
import nodemailer from 'nodemailer';

export interface Consulta {
  nombre: string;
  empresa: string;
  correo: string;
  telefono: string;
  mensaje: string;
}

export async function avisarConsultaPorCorreo(destino: string, c: Consulta): Promise<void> {
  const usuario = process.env.GMAIL_USER;
  const clave = process.env.GMAIL_APP_PASSWORD;
  if (!usuario || !clave) {
    console.warn('[correo] GMAIL_USER/GMAIL_APP_PASSWORD no están configuradas: no se envió el aviso de la consulta de', c.correo);
    return;
  }
  const texto = [
    `Nombre: ${c.nombre}`,
    `Empresa: ${c.empresa || '(no indicada)'}`,
    `Correo: ${c.correo}`,
    `Teléfono: ${c.telefono || '(no indicado)'}`,
    '',
    'Equipo y síntoma:',
    c.mensaje,
  ].join('\n');
  try {
    const transportador = nodemailer.createTransport({ service: 'gmail', auth: { user: usuario, pass: clave } });
    await transportador.sendMail({
      from: `GEMPRO · Sitio web <${usuario}>`,
      to: destino,
      replyTo: c.correo,
      subject: `Nueva consulta de ${c.nombre}${c.empresa ? ' · ' + c.empresa : ''}`,
      text: texto,
    });
  } catch (e) {
    console.error('[correo] no se pudo enviar el aviso de la consulta', e);
  }
}
