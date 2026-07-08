---
title: "Objection"
date: 2026-07-05
category: "Mobile Pentesting"
order: 7
tags: ["mobile-pentesting", "android", "frida", "objection"]
layout: layouts/writeup.njk
permalink: /writeups/objection.html
---

## ¿Qué es Objection?

Objection es una herramienta de **runtime mobile exploration** construida sobre Frida. Automatiza las técnicas más comunes de pentesting móvil sin tener que escribir scripts de Frida manualmente.

En pocas palabras: si Frida es el motor, Objection es el volante.

---

## ¿Para qué sirve?

<table>
<tr><td>Función</td><td>Qué hace</td></tr>
<tr><td>Certificate Pinning Bypass</td><td>Desactiva validaciones SSL/TLS en runtime para que el tráfico pase por Burp</td></tr>
<tr><td>Root Detection Bypass</td><td>Engaña a la app para que crea que el dispositivo no está rooteado</td></tr>
<tr><td>Explorar la app en vivo</td><td>Ver activities, fragments, clases cargadas, shared preferences, archivos</td></tr>
<tr><td>Dump de memoria</td><td>Extraer datos de la app mientras corre</td></tr>
<tr><td>Hook de funciones</td><td>Interceptar llamadas a métodos específicos y ver/modificar parámetros</td></tr>
</table>

---

## Diferencia entre Frida y Objection

<table>
<tr><td></td><td>Frida</td><td>Objection</td></tr>
<tr><td>Tipo</td><td>Framework de instrumentación</td><td>Herramienta de pentesting sobre Frida</td></tr>
<tr><td>Uso</td><td>Escribir scripts JS manualmente</td><td>Comandos predefinidos en inglés</td></tr>
<tr><td>Curva de aprendizaje</td><td>Alta — requiere saber JavaScript y la API de Frida</td><td>Baja — comandos listos para usar</td></tr>
<tr><td>Flexibilidad</td><td>Total — puedes hacer cualquier cosa</td><td>Limitada a lo que Objection tiene implementado</td></tr>
<tr><td>Requiere frida-server</td><td>Sí</td><td>Sí (usa Frida internamente)</td></tr>
</table>

> **Regla práctica**: empieza con Objection. Si no funciona o necesitas más control, pasa a escribir un script Frida personalizado.

---

## Instalación

### Prerequisito: frida-tools ya instalado

```bash
frida --version
# Debe mostrar: 17.15.3
```

### Instalar Objection

```bash
pip install --break-system-packages objection
```

### Verificar instalación

```bash
objection --version
# Output esperado: objection: 1.x.x
```

> **Nota**: Objection se instala en `~/.local/bin/objection`. Si el comando no se encuentra, agrega `~/.local/bin` a tu `$PATH` o ejecuta como `python3 -m objection`.

---

## Uso básico

### Prerequisito: frida-server corriendo en el teléfono

```bash
# Iniciar frida-server primero
adb shell su -c "/data/local/tmp/frida-server &"

# Verificar que conecta
frida-ps -U
```

### Conectarse a una app

```bash
# -g = gadget/app target (nombre del paquete Android)
objection -g com.spotify.music explore
```

### Comandos dentro de Objection

```bash
# Bypassear certificate pinning
android sslpinning disable

# Bypassear root detection
android root disable

# Ver activities de la app
android hooking list activities

# Ver todas las clases cargadas
android hooking list classes

# Hookear un método específico y ver sus argumentos y return value
android hooking watch class_method com.example.Class.method --dump-args --dump-return

# Ver directorios y archivos de la app
env
```

---

## Flujo completo para interceptar tráfico con Burp

```bash
# 1. En Kali — iniciar frida-server en el teléfono
adb shell su -c "/data/local/tmp/frida-server &"

# 2. En Kali — conectar Objection a la app objetivo
objection -g com.spotify.music explore

# 3. Dentro de Objection — deshabilitar SSL pinning
android sslpinning disable

# 4. En el teléfono — verificar que el proxy está configurado
# WiFi → Modificar red → Proxy Manual → IP de Windows : 8080

# 5. En Burp Suite — verificar que llegan requests
# Proxy → HTTP History
```

---

## ¿Por qué funciona el bypass?

Cuando una app tiene **certificate pinning**, valida que el certificado que recibe del servidor sea exactamente el que tiene hardcodeado. Si llega el certificado de Burp, lo rechaza y corta la conexión.

`android sslpinning disable` hookea las funciones de validación SSL en **runtime** y las reemplaza para que siempre devuelvan `true` — acepta cualquier certificado sin validar.

### Implementaciones que bypasea automáticamente

- `TrustManager` personalizado — el más común en apps Android
- `OkHttp CertificatePinner` — librería HTTP muy usada
- `SSLContext` / `HttpsURLConnection` — API nativa de Android
- `Conscrypt` — motor SSL de Android
- `TrustKit` — librería de pinning de terceros

---

## Troubleshooting común

<table>
<tr><td>Error</td><td>Causa</td><td>Solución</td></tr>
<tr><td><code>Failed to attach: unable to find process</code></td><td>La app no está corriendo o el package name es incorrecto</td><td>Abre la app manualmente primero. Verifica con <code>frida-ps -Ua</code></td></tr>
<tr><td>frida-server no responde</td><td>El proceso murió (pasa al reiniciar el teléfono)</td><td>Reiniciar: <code>adb shell su -c "/data/local/tmp/frida-server &amp;"</code></td></tr>
<tr><td><code>sslpinning disable</code> no funciona</td><td>La app usa pinning avanzado (custom nativo, Frida detection, o proxy detection)</td><td>Necesitas un script Frida personalizado o análisis estático con jadx</td></tr>
<tr><td><code>objection: command not found</code></td><td>No está en el PATH</td><td>Usar <code>python3 -m objection</code> o agregar <code>~/.local/bin</code> al PATH</td></tr>
</table>

---

## Apps: funciona vs no funciona

<table>
<tr><td>App</td><td>¿Funciona?</td><td>Notas</td></tr>
<tr><td>Spotify</td><td>✅ Sí</td><td>Pinning básico con TrustManager — Objection lo bypasea directo</td></tr>
<tr><td>Netflix</td><td>❌ No directo</td><td>Múltiples capas: pinning nativo, Frida detection, proxy detection</td></tr>
<tr><td>Apps bancarias</td><td>⚠️ Depende</td><td>Algunas usan TrustKit o Conscrypt — requiere script personalizado</td></tr>
<tr><td>Apps sin pinning</td><td>✅ Solo cert de sistema</td><td>No necesitas Objection, el certificado Burp de sistema es suficiente</td></tr>
</table>
