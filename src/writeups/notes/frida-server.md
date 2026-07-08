---
title: "Frida-server"
date: 2026-07-05
category: "Mobile Pentesting"
order: 2
tags: ["mobile-pentesting", "android", "frida"]
layout: layouts/writeup.njk
permalink: /writeups/frida-server.html
---

## ¿Qué es Frida?

Herramienta principal para análisis dinámico en pentesting móvil. Permite hookear funciones de una app en runtime — interceptar llamadas, modificar parámetros, bypassear certificate pinning y detección de root.

---

## Permanencia del setup

<table>
<tr><td>Acción</td><td>Frecuencia</td></tr>
<tr><td><code>adb push frida-server</code></td><td>Solo una vez</td></tr>
<tr><td><code>adb shell chmod 755 ...</code></td><td>Solo una vez</td></tr>
<tr><td><code>adb shell su -c ".../frida-server &amp;"</code></td><td>Cada sesión de trabajo</td></tr>
</table>

El binario persiste entre reinicios. El proceso no.

---

## Verificar arquitectura del dispositivo

Antes de descargar hay que saber la arquitectura para descargar el binario correcto.

```bash
adb shell getprop ro.product.cpu.abi
# Output: arm64-v8a → descargar android-arm64
```

<table>
<tr><td>Output ABI</td><td>Archivo a descargar</td></tr>
<tr><td>arm64-v8a</td><td>frida-server-*-android-arm64.xz</td></tr>
<tr><td>armeabi-v7a</td><td>frida-server-*-android-arm.xz</td></tr>
<tr><td>x86_64</td><td>frida-server-*-android-x86_64.xz</td></tr>
</table>

---

## Descargar frida-server

- Sitio: `github.com/frida/frida/releases`
- Archivo: `frida-server-17.15.3-android-arm64.xz`
- Descomprimir con WinRAR/7-Zip → renombrar a `frida-server`

---

## Subir al teléfono (solo una vez)

```bash
adb push "C:/Users/soporte/Downloads/frida-server-17.15.3-android-arm64/frida-server" "/data/local/tmp/"
# Output: 44.7 MB/s (53489240 bytes in 1.141s)
```

### ¿Por qué /data/local/tmp/?

1. adb push puede escribir ahí sin root previo
2. Permite ejecutar binarios — sdcard no permite esto
3. Convención estándar — Objection y documentación oficial asumen esta ruta
4. El archivo persiste entre reinicios aunque sea una ruta temporal

---

## Dar permisos de ejecución (solo una vez)

```bash
adb shell chmod 755 "/data/local/tmp/frida-server"
```

### ¿Por qué 755 y no +x?

- `chmod +x` — agrega ejecución a todos los usuarios
- `chmod 755` — rwxr-xr-x — propietario puede leer/escribir/ejecutar, otros solo leer/ejecutar
- Ambos funcionan, pero `755` limita que otros procesos modifiquen el binario

---

## Flujo de trabajo por sesión

```bash
# 1. Iniciar frida-server
# No devuelve output — el & lo pone en background, es normal
adb shell su -c "/data/local/tmp/frida-server &"

# 2. Verificar desde PC
# -U = USB, se conecta al frida-server del teléfono via ADB
# Debe mostrar lista de procesos del teléfono
frida-ps -U

# 3. Trabajar
frida -U -n com.app.target
# o
objection -g com.app.target explore

# 4. Al terminar (opcional)
adb shell su -c "pkill frida-server"
```

---

## Cómo funciona la comunicación PC ↔ Teléfono

```
Tu PC (frida-ps -U / objection)
    ↓ via USB / ADB
Teléfono (frida-server corriendo con root)
    ↓
Lista procesos / hookea funciones
    ↑
Devuelve resultado a la PC
```

Sin `frida-server` en el teléfono → frida-ps no puede conectar.
Sin `frida-tools` en la PC → no puedes enviar comandos.

---

## Instalar frida-tools en Kali Linux

### Instalación

```bash
pip install --break-system-packages frida==17.15.3 frida-tools
# Instala globalmente: frida-17.15.3 y frida-tools-14.10.4
# No requiere venv — funciona en cualquier terminal
```

> **Nota de versiones**: frida-tools usa un esquema de versión distinto al de frida.
> frida 17.x → frida-tools 14.x (son compatibles aunque los números no coincidan)

```bash
frida --version
# Output: 17.15.3 ✓
```

### Verificar cliente y servidor coinciden

```bash
# En Kali
frida --version

# En el teléfono (frida-server debe ser la misma versión)
adb shell ls /data/local/tmp/frida-server
# Nombre del binario incluye la versión: frida-server-17.15.3-android-arm64
```

El cliente (frida-tools en Kali) y el servidor (frida-server en el teléfono) **deben ser exactamente la misma versión** para evitar errores de protocolo.
