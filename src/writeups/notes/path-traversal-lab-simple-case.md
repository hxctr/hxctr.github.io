---
title: "Lab: File path traversal, simple case"
date: 2026-05-15
category: "Path Traversal"
order: 2
tags: ["web-security-academy", "path-traversal", "lab"]
layout: layouts/writeup.njk
permalink: /writeups/path-traversal-lab-simple-case.html
---

## Descripción de la vulnerabilidad

Path Traversal (también llamado Directory Traversal) es una vulnerabilidad que permite a un atacante leer archivos fuera del directorio base que la aplicación tiene permitido usar.

Ocurre cuando la app toma input del usuario para construir una ruta de archivo, pero **no valida ni normaliza esa ruta** antes de usarla.

---

## Reconocimiento

Al explorar la aplicación (una tienda e-commerce de práctica), se inspeccionaron los recursos de la página desde las herramientas del desarrollador. Se identificó que las imágenes de los productos se cargaban mediante una petición como esta:

```
GET /image?filename=24.jpg
```

El parámetro `filename` recibe directamente el nombre del archivo a servir. Esto es una señal inmediata de posible Path Traversal, porque sugiere que la app está leyendo un archivo del disco usando ese valor.

---

## ¿Por qué no todas las rutas son vulnerables?

En el HTML de la misma página se pueden ver dos tipos de imágenes:

```html
<!-- Vulnerable — parámetro controlable -->
<img src="/image?filename=31.jpg">

<!-- NO vulnerable — ruta fija -->
<img src="/resources/images/rating2.png">
```

La diferencia es que `/resources/images/rating2.png` no tiene ningún `?param=valor`. El servidor tiene esa ruta quemada en su código y siempre sirve ese archivo exacto, sin consultar nada que venga del request. No hay nada que puedas modificar desde afuera.

En cambio `/image?filename=31.jpg` le pasa el control al usuario a través del parámetro `filename`. El servidor toma ese valor y lo usa para construir la ruta en disco — ahí es donde entra el Path Traversal.

**Regla simple:** si no hay un parámetro que vos controlés, no hay superficie de ataque para Path Traversal.

---

## Pruebas realizadas

Se interceptó el tráfico con **Burp Suite** y se modificó el parámetro `filename` para intentar salir del directorio base.

### Intento 1 — URL encoding

```
filename=..%2F..%2F..%2Fetc%2Fpasswd%2500.jpg
```

**Resultado:** `No such file`

El servidor decodificó `%2F` (que equivale a `/`) pero igualmente no encontró el archivo. El `%00` es un **null byte** — un truco antiguo para terminar la cadena de texto y que el `.jpg` sea ignorado, pero servidores modernos lo filtran.

### Intento 2 — Null byte sin encoding

```
filename=../../../etc/passwd%00.jpg
```

**Resultado:** `No such file`. Mismo problema — el servidor detectó o ignoró el null byte.

### Intento 3 — Payload limpio ✅

```
filename=../../../etc/passwd
```

**Resultado:** la imagen no se renderizó, pero el servidor devolvió **contenido real**.

> El "no such file" de los primeros intentos ya era una pista de vulnerabilidad — significa que el payload llegó al sistema de archivos. Una app bien protegida hubiera retornado un error genérico antes de tocar el disco.

---

## Explotación exitosa

En la vista **Pretty / Raw** de Burp Suite se pudo leer el contenido del archivo `/etc/passwd` del servidor:

```
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
...
peter:x:12001:12001::/home/peter:/bin/bash
carlos:x:12002:12002::/home/carlos:/bin/bash
user:x:12000:12000::/home/user:/bin/bash
```

La respuesta HTTP tenía `Content-Type: image/jpeg`, lo que explica por qué en **Render** no se veía nada — el browser intentaba interpretar texto como imagen y fallaba.

---

## ¿Cómo hacerlo sin Burp Suite?

Burp no es necesario. El ataque funciona igual, solo necesitás otra forma de leer la respuesta raw.

**Opción 1 — Directamente en el navegador**

```
https://sitio.com/image?filename=../../../etc/passwd
```

El problema es que el servidor responde con `Content-Type: image/jpeg`, entonces el navegador intenta renderizarlo como imagen y muestra el ícono de imagen rota. El contenido llegó, pero el navegador lo ocultó.

**Opción 2 — curl desde terminal**

```bash
curl "https://sitio.com/image?filename=../../../etc/passwd"
```

En este lab no se necesitan headers adicionales porque el endpoint es público. En apps reales con sesión activa, hay que pasar la cookie:

```bash
curl "https://sitio.com/image?filename=../../../etc/passwd" \
  -H "Cookie: session=tu_token_aqui"
```

Sin la cookie, el servidor redirige al login o devuelve 401 antes de procesar el filename.

<table>
<tr><td>Método</td><td>¿Funciona?</td><td>Nota</td></tr>
<tr><td>Navegador directo</td><td>Parcial</td><td>El ataque funciona pero el browser no muestra el contenido texto</td></tr>
<tr><td>curl sin headers</td><td>En endpoints públicos</td><td>Muestra la respuesta raw en terminal</td></tr>
<tr><td>curl con Cookie</td><td>En endpoints con sesión</td><td>Necesario cuando hay autenticación</td></tr>
<tr><td>Burp Suite</td><td>Sí</td><td>El más cómodo — vista Raw/Pretty/Render y fácil de modificar requests</td></tr>
</table>

---

## ¿Por qué funcionó `../../../etc/passwd`?

Los `..` le indican al sistema operativo "sube un nivel en el árbol de directorios". Si la app sirve imágenes desde `/var/www/images/`, la secuencia se resuelve así:

```
/var/www/images   ← directorio base
/var/www          ← primer ../
/var              ← segundo ../
/                 ← tercer ../ (raíz del sistema)
/etc/passwd       ← archivo de destino
```

La app **no normalizó la ruta antes de usarla**, así que el sistema operativo resolvió los `..` y terminó leyendo un archivo completamente diferente al esperado.

---

## ¿Por qué fallaron los otros payloads?

<table>
<tr><td>Payload</td><td>Razón del fallo</td></tr>
<tr><td><code>..%2F..%2F..%2Fetc%2Fpasswd</code></td><td>El servidor decodificó <code>%2F</code> → <code>/</code> pero también aplicó algún filtro adicional</td></tr>
<tr><td><code>../../../etc/passwd%00.jpg</code></td><td>El null byte <code>%00</code> es un truco para truncar strings en C, pero servidores modernos (Python, Java, Node) lo ignoran o filtran</td></tr>
<tr><td><code>..%2F</code> (variante encoded)</td><td>Algunos servidores bloquean específicamente <code>%2F</code> como intento de traversal</td></tr>
</table>

---

## ¿Es un bug de Linux?

No. Linux hace exactamente lo que debe: `..` siempre ha significado "directorio padre" en cualquier sistema Unix. El bug está en la **aplicación**, que debió resolver la ruta con una función como `realpath()` o `Path.resolve()` y luego verificar que el resultado siga dentro del directorio permitido.

---

## ¿Cómo se previene?

1. Resolver la ruta completa primero (`realpath()` en C/PHP, `os.path.realpath()` en Python).
2. Verificar que la ruta resuelta **empiece con** el directorio base permitido.
3. Solo entonces abrir el archivo.

```python
# Ejemplo correcto en Python
import os

BASE = "/var/www/images"
user_input = "../../../etc/passwd"

full_path = os.path.realpath(os.path.join(BASE, user_input))

if not full_path.startswith(BASE):
    raise Exception("Acceso denegado")  # ← corta aquí, nunca llega al disco
```

---

## ¿Qué otras vulnerabilidades se podrían probar en un blackbox?

Encontrar Path Traversal no significa que sean las únicas vulns de la app. En un pentest blackbox el objetivo es probar **toda la superficie disponible**, priorizando según qué hace lógicamente cada parámetro.

### Parámetros identificados en esta app

```
/image?filename=24.jpg       ← interactúa con el sistema de archivos
/product?productId=1         ← interactúa con una base de datos
```

### `productId=1` — Buen punto de entrada para SQL Injection

Casi con certeza genera una consulta a la DB internamente:

```sql
SELECT * FROM products WHERE id = 1
```

Payloads a probar:

```
/product?productId=1'
/product?productId=1 OR 1=1--
/product?productId=1 AND SLEEP(5)--
```

### `filename=24.jpg` — Mal punto de entrada para SQL Injection

Claramente interactúa con el sistema de archivos, no con una DB:

```python
open("/var/www/images/" + filename)
```

No hay query SQL ahí. Probar SQLi en ese parámetro es técnicamente válido en blackbox, pero de baja prioridad. **Sin embargo**, `filename` sí es buen punto de entrada para Path Traversal (ya confirmado), LFI si el servidor ejecuta el archivo, y XSS si el nombre del archivo se refleja en alguna respuesta HTML.

### Regla general en blackbox

<table>
<tr><td>Tipo de parámetro</td><td>Huele a...</td><td>Vulns a priorizar</td></tr>
<tr><td><code>filename=</code>, <code>file=</code>, <code>path=</code></td><td>Filesystem</td><td>Path Traversal, LFI</td></tr>
<tr><td><code>id=</code>, <code>productId=</code>, <code>userId=</code></td><td>Base de datos</td><td>SQL Injection</td></tr>
<tr><td><code>search=</code>, <code>q=</code>, <code>name=</code></td><td>Reflejo en HTML</td><td>XSS, SQLi</td></tr>
<tr><td><code>redirect=</code>, <code>url=</code>, <code>next=</code></td><td>Redirección</td><td>Open Redirect, SSRF</td></tr>
<tr><td><code>page=</code>, <code>template=</code></td><td>Inclusión de archivos</td><td>LFI, Path Traversal</td></tr>
</table>

---

## Lecciones aprendidas

- Un parámetro que recibe nombres de archivos es siempre sospechoso de Path Traversal.
- Las rutas hardcodeadas en el HTML sin parámetros no son superficie de ataque.
- El "no such file" es una pista de vulnerabilidad — significa que el payload llegó al sistema de archivos.
- Los encodings como `%2F` o el null byte `%00` son variantes del mismo ataque para evadir filtros superficiales.
- Cuando la respuesta dice "la imagen no puede mostrarse" pero el servidor devuelve contenido, **la vuln funcionó** — el browser simplemente no sabe renderizar texto como imagen.
- En Burp, la vista **Raw** o **Pretty** muestra el contenido real; **Render** lo interpreta como el browser lo haría.
- Burp facilita el proceso, pero curl es suficiente para leer la respuesta raw sin él.
- El SO no es el problema — la validación insuficiente en la app es el problema.

---

## Referencia

Lab oficial: [PortSwigger — File path traversal, simple case](https://portswigger.net/web-security/file-path-traversal/lab-simple)

**Estado:** Solved
