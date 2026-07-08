---
title: "Lab: Web shell upload via obfuscated file extension"
date: 2026-06-07
category: "File Upload"
order: 7
tags: ["web-security-academy", "file-upload", "lab", "rce", "null-byte"]
layout: layouts/writeup.njk
permalink: /writeups/file-upload-lab-obfuscated-extension.html
---

## Descripción de la vulnerabilidad

Este lab tiene una **whitelist de extensiones** — solo acepta `.jpg` y `.png`. La whitelist es más segura que una blacklist en principio, pero si la validación no sanitiza correctamente el filename, es posible ofuscar la extensión real con un **null byte** (`%00`) para que el validador vea `.jpg` mientras el sistema operativo guarda el archivo como `.php`.

---

## Reconocimiento

Intento con `BasicWebShell.php` directo:

```
HTTP/2 403 Forbidden
Sorry, only JPG & PNG files are allowed
```

Whitelist confirmada. Extensiones alternativas como `.php7` también dieron 403 — la whitelist bloquea todo lo que no sea `.jpg` o `.png` explícitamente.

---

## Intentos fallidos

### Intento 1 — `.jpg` con contenido PHP

```
filename="BasicWebShell.jpg" / Content-Type: image/jpeg
```

**Resultado:** 200 OK pero PHP no se ejecutó. Apache sirve `.jpg` como imagen sin importar el contenido. La extensión define el handler de Apache, no el contenido del archivo.

**Lo que el desarrollador hizo bien:** implementó una whitelist que solo acepta extensiones seguras.

```python
EXTENSIONES_PERMITIDAS = ['.jpg', '.jpeg', '.png', '.gif']
extension = os.path.splitext(filename)[1].lower()
if extension not in EXTENSIONES_PERMITIDAS:
    return error("Solo se permiten imágenes")
```

> El mensaje "only JPG & PNG allowed" puede llevar a pensar que la solución es subir una imagen con el payload PHP adentro. Pero Apache decide cómo manejar un archivo por su **extensión**, no por su contenido. Subir `.htaccess` tampoco hubiera funcionado aquí — la whitelist lo hubiera bloqueado porque no es `.jpg` ni `.png`, a diferencia del lab anterior donde la blacklist no lo incluía.

### Intento 2 — Doble extensión `.php.jpg`

```
filename="BasicWebShell.php.jpg"
```

**Resultado:** 200 OK pero texto plano al acceder. Apache toma la **última extensión** para decidir el handler — `.jpg` → imagen, no PHP.

```python
# Extrae solo la última extensión — correcto
extension = os.path.splitext(filename)[1].lower()
# "BasicWebShell.php.jpg" → extension = ".jpg" → acepta
```

Este intento revela que tanto el validador como Apache leen la última extensión. Hay una asimetría: `.jpg` al final → validador acepta pero Apache no ejecuta PHP; `.php` al final → Apache ejecutaría pero validador bloquea. Se necesita engañar a ambos simultáneamente con un solo filename.

### Intento 3 — Doble extensión `.jpg.php`

```
filename="BasicWebShell.jpg.php"
```

**Resultado:** 403 — la whitelist también lee la última extensión y bloqueó `.php`.

### Intento 4 — Triple extensión `.php.jpg.php`

```
filename="BasicWebShell.php.jpg.php"
```

**Resultado:** 403 — la whitelist sigue viendo `.php` al final sin importar cuántas extensiones haya antes.

```python
extension = os.path.splitext("BasicWebShell.php.jpg.php")[1].lower()
# → ".php" → bloquea correctamente
```

### Intento 5 — URL encoding del punto (`%2E`)

```
filename="BasicWebShell.jpg%2Ephp"
```

**Resultado:** 403 — el servidor decodificó `%2E` a `.` antes de validar y vio `.php`.

```python
from urllib.parse import unquote
filename = unquote(filename)  # "BasicWebShell.jpg%2Ephp" → "BasicWebShell.jpg.php"
extension = os.path.splitext(filename)[1].lower()
# → ".php" → bloquea
```

> Que el servidor decodificara `%2E` correctamente es una buena señal — indica conciencia de los encodings. Esto hace más llamativo que no haya aplicado la misma sanitización al null byte `%00`.

---

## Bypass exitoso — Null byte

### Paso 1 — Subir el web shell

```
filename="BasicWebShell.php%00.jpg"
```

**Resultado:** 200 OK

```
The file avatars/BasicWebShell.php has been uploaded.
```

El null byte funcionó en dos niveles: **el validador** leyó el string y vio `.jpg` al final → aceptó. **El sistema operativo** truncó en `%00` al construir la ruta → guardó como `BasicWebShell.php`.

En el código fuente el avatar mostraba:

```html
<img src="/files/avatars/BasicWebShell.php%00.jpg">
```

> Al acceder con `BasicWebShell.php%00.jpg` el servidor devuelve 404 porque ese nombre no existe en disco — el sufijo `%00.jpg` nunca se guardó. Hay que acceder directamente a `BasicWebShell.php`.

### Paso 2 — Ejecutar el web shell

```
GET /files/avatars/BasicWebShell.php HTTP/1.1
```

**Resultado:** PHP ejecutado, flag devuelta en el response.

> No hay forma de hacer esto sin Burp — el browser nunca enviaría un `%00` en un filename al subir un archivo. La manipulación del multipart requiere un proxy que permita editar el request raw.

---

## Por qué funcionó

El null byte (`%00`) es el terminador de string en C. Los sistemas operativos construyen rutas con funciones C, entonces `BasicWebShell.php%00.jpg` se guarda como `BasicWebShell.php` — el OS para de leer en `%00`. El validador, en lenguaje de alto nivel, no trunca en null byte y vio `.jpg` al final.

> **Analogía:** el null byte es similar al `--` en SQL injection en el sentido de que ambos truncan lo que viene después. La diferencia es que `--` opera a nivel de sintaxis del lenguaje SQL, mientras que `%00` opera a nivel de memoria del sistema operativo.

---

## Tabla completa de técnicas de ofuscación de extensión

<table>
<tr><td>Técnica</td><td>Ejemplo</td><td>Resultado</td><td>Por qué</td></tr>
<tr><td>Extensión directa</td><td><code>exploit.php</code></td><td>Falla</td><td>Whitelist bloquea <code>.php</code></td></tr>
<tr><td>Extensión alternativa</td><td><code>exploit.php7</code></td><td>Falla</td><td>Whitelist solo acepta <code>.jpg</code>/<code>.png</code></td></tr>
<tr><td><code>.jpg</code> puro con PHP</td><td><code>exploit.jpg</code></td><td>Falla</td><td>Apache no ejecuta <code>.jpg</code> como PHP</td></tr>
<tr><td>Doble extensión <code>.php.jpg</code></td><td><code>exploit.php.jpg</code></td><td>Falla</td><td>Apache toma última extensión <code>.jpg</code></td></tr>
<tr><td>Doble extensión <code>.jpg.php</code></td><td><code>exploit.jpg.php</code></td><td>Falla</td><td>Whitelist ve <code>.php</code> al final</td></tr>
<tr><td>Triple extensión</td><td><code>exploit.php.jpg.php</code></td><td>Falla</td><td>Whitelist sigue viendo <code>.php</code> al final</td></tr>
<tr><td>URL encoding del punto</td><td><code>exploit%2Ephp</code></td><td>Falla</td><td>Servidor decodifica antes de validar</td></tr>
<tr><td>Null byte</td><td><code>exploit.php%00.jpg</code></td><td>Funciona</td><td>OS trunca en <code>%00</code>, validador ve <code>.jpg</code></td></tr>
<tr><td>Case sensitivity</td><td><code>exploit.pHp</code></td><td>No probado</td><td>Funciona si la validación es case-sensitive</td></tr>
<tr><td>Trailing dot</td><td><code>exploit.php.</code></td><td>No probado</td><td>Algunos sistemas eliminan el punto final al guardar</td></tr>
<tr><td>Unicode multibyte</td><td><code>exploit.pHp</code> con bytes especiales</td><td>No probado</td><td>Depende del encoding del servidor</td></tr>
<tr><td>Extensión anidada</td><td><code>exploit.p.phphp</code></td><td>No probado</td><td>Funciona contra filtros que hacen strip de extensiones en lugar de validar la extensión final</td></tr>
</table>

---

## Cómo identificarlo en blackbox

1. `.php` → 403 con "only JPG & PNG" → whitelist.
2. `.php7` → 403 → whitelist estricta, extensiones alternativas no funcionan.
3. `.php.jpg` → 200 pero no ejecuta → Apache toma última extensión.
4. `.jpg.php` → 403 → validador también lee última extensión.
5. Conclusión: buscar discrepancia entre validador y OS → probar null byte.
6. `exploit.php%00.jpg` → si acepta y respuesta dice que guardó `.php` → null byte funcionó.

---

## Error del desarrollador

```python
# Vulnerable
filename = request.form['filename']   # "exploit.php%00.jpg"
extension = filename.split('.')[-1]   # ve "jpg" — acepta
save_file(filename)                   # OS guarda "exploit.php"

# Seguro
filename = filename.replace('\x00', '')          # eliminar null bytes primero
extension = os.path.splitext(filename)[1].lower()
if extension not in ['.jpg', '.png']:
    return error("Solo JPG y PNG")
safe_name = str(uuid.uuid4()) + extension        # renombrar siempre
```

---

## Mitigación

- **Eliminar null bytes** y caracteres especiales del filename antes de cualquier validación.
- **Validar después de sanitizar** — decodificar URL encoding, eliminar null bytes, normalizar primero.
- **Nunca usar el filename del cliente** para construir rutas — generar el nombre en el servidor.
- Combinar whitelist con sanitización completa del input.

---

## Impacto

RCE completo. La whitelist era más sólida que la blacklist del lab anterior, pero la falta de sanitización del null byte creó una discrepancia explotable entre lo que vio el validador y lo que guardó el sistema operativo.
