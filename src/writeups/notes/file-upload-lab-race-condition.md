---
title: "Lab: Web shell upload via race condition"
date: 2026-06-07
category: "File Upload"
order: 9
tags: ["web-security-academy", "file-upload", "lab", "rce", "race-condition"]
layout: layouts/writeup.njk
permalink: /writeups/file-upload-lab-race-condition.html
---

## Descripción

El servidor valida correctamente los archivos subidos y los rechaza si no son imágenes. Sin embargo, existe una **race condition** en el flujo de procesamiento: hay una ventana de tiempo muy pequeña entre que el archivo se sube al servidor y cuando la validación lo elimina. Si durante ese instante se hace una petición GET al archivo, el código PHP se ejecuta antes de ser borrado.

---

## Reconocimiento

- El endpoint `/my-account/avatar` acepta uploads multipart.
- Responde **403 Forbidden** ante cualquier archivo `.php` directo.
- El servidor es Apache/2.4.41 (Ubuntu).
- Los archivos subidos van a `/files/avatars/`.

---

## Intentos fallidos

### Intento 1 — Subir BasicWebShell.php directamente

```
filename="BasicWebShell.php" | Content-Type: application/octet-stream
→ HTTP 403: "Sorry, only JPG & PNG files are allowed"
```

**Lo que el desarrollador hizo bien:** valida la extensión del archivo y rechaza `.php` con 403.

### Intento 2 — Subir polyglot.php (PNG + payload PHP)

```
filename="polyglot.php" | magic bytes PNG al inicio
→ HTTP 403: "Sorry, only JPG & PNG files are allowed"
```

**Lo que el desarrollador hizo bien:** la validación no solo mira el Content-Type o los magic bytes — también valida la extensión. Un polyglot no sirve aquí porque el 403 bloquea antes de que el archivo llegue a ejecutarse.

> La diferencia con el lab anterior: allí el servidor aceptaba el archivo y luego intentaba validar el contenido. Acá el servidor valida **primero** la extensión y rechaza antes de guardar. La vulnerabilidad no está en la validación del tipo de archivo, sino en la **ventana de tiempo** entre guardado y validación.

---

## Bypass exitoso — Race condition con Turbo Intruder

Turbo Intruder es una extensión de Burp Suite que permite enviar múltiples requests en paralelo con sincronización precisa de timing. Se accede desde: click derecho sobre la request → **Extensions → Turbo Intruder → Send to Turbo Intruder**.

El script configurado para la race condition:

```python
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=10,
                           requestsPerConnection=100,
                           pipeline=False)

    # Request 1: el upload del web shell
    engine.queue(target.req, gate='race1')

    # Requests 2-50: GET al archivo mientras se está subiendo
    for i in range(50):
        engine.queue('''GET /files/avatars/BasicWebShell.php HTTP/1.1
Host: 0a3d002e03ce700b8096b78d00e900c0.web-security-academy.net
Cookie: session=...

''', gate='race1')

    # Abre la compuerta — todas las requests salen al mismo tiempo
    engine.openGate('race1')

def handleResponse(req, interesting):
    table.add(req)
```

**¿Qué hace `gate='race1'`?** Retiene todas las requests hasta que se llama `openGate('race1')`. En ese momento, el POST del upload y los 50 GET salen simultáneamente. Alguno de esos GET llegará exactamente en la ventana de tiempo donde el archivo existe en disco antes de ser validado y eliminado.

> **¿Por qué no sirve Repeater manual?** Abrir dos pestañas de Repeater y enviar manualmente es imposible — el servidor valida y elimina el archivo en milisegundos. Turbo Intruder sincroniza las requests a nivel de paquete TCP para que lleguen al servidor en el mismo instante.

**Error encontrado al configurar Turbo Intruder:**

Al lanzar el ataque con `concurrentConnections=10` y 51 requests gateadas, Turbo Intruder arrojó:

> *"You have queued more gated requests than concurrentConnections, so your attack will deadlock. Consider increasing concurrentConnections"*

Solución: aumentar `concurrentConnections` a 51 o más — debe ser igual o mayor al número total de requests gateadas.

**Resultado observado:**

- El POST devuelve **500 Internal Server Error** (antes era 403 inmediato) — esto confirma que el archivo sí llega a ser procesado brevemente antes de ser rechazado. La race condition es real.
- Los GET devuelven **404** — la ventana de tiempo no fue ganada en los intentos realizados.
- El ataque es probabilístico: hay que repetirlo múltiples veces hasta que algún GET llegue exactamente en la ventana donde el archivo existe en disco.

---

## Por qué funciona (concepto)

El flujo interno del servidor es:

1. Recibe el archivo → **lo guarda temporalmente en disco**.
2. Valida la extensión → falla.
3. **Elimina el archivo**.
4. Devuelve 403/500.

La ventana entre los pasos 1 y 3 es de milisegundos. Si durante ese instante llega un GET a `/files/avatars/BasicWebShell.php`, Apache sirve el archivo y PHP lo ejecuta antes de que sea eliminado.

---

## Error del desarrollador

Procesar el archivo (guardarlo en disco) **antes** de validarlo. El orden correcto sería validar primero y solo guardar si pasa la validación.

```python
# ❌ Orden vulnerable
def upload(file):
    save_to_disk(file)        # 1. Guarda primero
    if not is_valid(file):    # 2. Valida después
        delete_from_disk(file)  # 3. Elimina si falla ← ventana de race condition
        return 403

# ✅ Orden correcto
def upload(file):
    if not is_valid(file):    # 1. Valida primero
        return 403
    save_to_disk(file)        # 2. Solo guarda si es válido
```

---

## Mitigación

- Validar **antes** de guardar en disco.
- Guardar archivos subidos en un directorio temporal fuera del webroot — nunca directamente en una ruta accesible públicamente.
- Renombrar el archivo con UUID al guardarlo definitivamente.
- Configurar el servidor para no ejecutar scripts en el directorio de uploads.

---

## Impacto

RCE durante la ventana de race condition. Aunque la ventana es breve, un atacante con automatización puede ganarla de forma confiable. El impacto es el mismo que cualquier RCE: lectura de archivos, ejecución de comandos, reverse shell.

---

## Cómo identificarlo en blackbox

1. Subir `.php` directamente → observar respuesta (403, 500, 200).
2. Si el servidor devuelve 500 en vez de 403 inmediato → sospechar que el archivo se guarda brevemente antes de ser rechazado.
3. Configurar Turbo Intruder con gate para enviar POST + múltiples GET simultáneamente.
4. Repetir hasta ganar la carrera y obtener un 200 en algún GET.

---

## Preguntas frecuentes

**¿Por qué el POST devuelve 500 en vez de 403?** Cuando Turbo Intruder envía la request con `pipeline=False` y múltiples conexiones simultáneas, el comportamiento del servidor cambia ligeramente. El 500 indica que el servidor llegó a procesar el archivo internamente antes de rechazarlo — lo que confirma que existe la ventana de tiempo.

**¿Cuántas veces hay que intentarlo?** Depende del servidor. En labs de PortSwigger suele tomar entre 5 y 20 intentos. En aplicaciones reales con servidores más lentos, la ventana es mayor y es más fácil de ganar.

**¿Existía alguna forma de hacer esto antes de Turbo Intruder?** Sí — con `curl` en paralelo desde bash usando `&` para lanzar múltiples procesos simultáneos, o con Python usando `threading`. Turbo Intruder añade precisión con el **single-packet attack**, que mete múltiples requests en un solo paquete TCP para que lleguen al servidor en el mismo instante exacto.
