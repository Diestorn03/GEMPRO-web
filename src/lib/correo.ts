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
 *
 * Por qué tarda unos segundos: Vercel no deja "responder ya y seguir enviando detrás" en este
 * tipo de función (comprobado en el propio adaptador instalado: @astrojs/vercel deja
 * `waitUntil` sin implementar fuera de Edge, y nodemailer no puede correr en Edge porque
 * necesita el módulo `net` de Node para hablar SMTP). El apretón de manos con Gmail (conectar,
 * TLS, autenticar, enviar) toma en sí mismo 1-3 segundos reales; eso no se puede evitar sin
 * cambiar de arquitectura (una cola: guardar y responder al instante, un cron aparte manda el
 * correo después — viable cuando el proyecto esté en Vercel Pro, que permite crons cada minuto
 * en vez de uno solo al día).
 */
import nodemailer from 'nodemailer';

export interface Consulta {
  nombre: string;
  empresa: string;
  correo: string;
  telefono: string;
  mensaje: string;
}

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function html(c: Consulta): string {
  const nombre = escapar(c.nombre);
  const primerNombre = escapar(c.nombre.trim().split(/\s+/)[0] || c.nombre);
  const empresa = escapar(c.empresa);
  const correo = escapar(c.correo);
  const telefono = escapar(c.telefono);
  const mensaje = escapar(c.mensaje).replace(/\n/g, '<br>');
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nueva consulta</title></head>
<body style="margin:0;padding:0;background-color:#eef1f4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f4;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background-color:#061426;padding:28px 32px;text-align:center;">
          <img src="https://gempro-web.vercel.app/logo-correo.png" width="180" alt="GEMPRO" style="display:block;margin:0 auto;border:0;max-width:180px;height:auto;">
        </td></tr>
        <tr><td style="height:4px;background-color:#3ddc84;line-height:4px;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 32px 4px 32px;">
          <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#28af60;font-weight:bold;">Nueva consulta desde el sitio web</p>
          <h1 style="margin:0 0 24px 0;font-size:22px;line-height:1.3;color:#061426;">${nombre}${empresa ? ` <span style="color:#8fa3bd;font-weight:normal;">· ${empresa}</span>` : ''}</h1>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #eef1f4;width:100px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#8fa3bd;vertical-align:top;">Correo</td>
              <td style="padding:10px 0;border-bottom:1px solid #eef1f4;font-size:14px;color:#061426;"><a href="mailto:${correo}" style="color:#28af60;text-decoration:none;">${correo}</a></td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #eef1f4;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#8fa3bd;vertical-align:top;">Teléfono</td>
              <td style="padding:10px 0;border-bottom:1px solid #eef1f4;font-size:14px;color:#061426;">${telefono || '<span style="color:#8fa3bd;">(no indicado)</span>'}</td>
            </tr>
          </table>
          <p style="margin:0 0 8px 0;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#8fa3bd;">Equipo y síntoma</p>
          <p style="margin:0 0 28px 0;padding:16px;background-color:#f4f6f8;border-left:3px solid #3ddc84;border-radius:4px;font-size:15px;line-height:1.6;color:#061426;">${mensaje}</p>
          <a href="mailto:${correo}" style="display:inline-block;background-color:#28af60;color:#ffffff;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:.5px;text-transform:uppercase;padding:14px 26px;border-radius:5px;">Responder a ${primerNombre}</a>
        </td></tr>
        <tr><td style="padding:20px 32px 28px 32px;">
          <p style="margin:0;font-size:12px;color:#8fa3bd;">Aviso automático del formulario de contacto de gempro.com.ve. Guardado también en el panel de GEMPRO.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
      html: html(c),
    });
  } catch (e) {
    console.error('[correo] no se pudo enviar el aviso de la consulta', e);
  }
}
