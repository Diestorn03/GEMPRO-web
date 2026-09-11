// Logo para el correo de aviso de consultas (src/lib/correo.ts): los clientes de correo
// necesitan una URL pública y estable, no la que genera astro:assets con hash (cambia en cada
// build). Se guarda en public/, liviano (los clientes de correo cargan la imagen cada vez que
// se abre el mensaje). Correr de nuevo solo si cambia el logo maestro.
import sharp from 'sharp';

await sharp('src/assets/logos/logo-gempro-blanco.png')
  .resize({ width: 440 })
  .png({ quality: 90, compressionLevel: 9 })
  .toFile('public/logo-correo.png');

console.log('public/logo-correo.png generado.');
