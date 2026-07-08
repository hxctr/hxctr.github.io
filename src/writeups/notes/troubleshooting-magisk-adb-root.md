---
title: "Troubleshooting: Magisk ADB Root Access"
date: 2026-07-05
category: "Mobile Pentesting"
order: 3
tags: ["mobile-pentesting", "android", "magisk", "troubleshooting"]
layout: layouts/writeup.njk
permalink: /writeups/troubleshooting-magisk-adb-root.html
---

## Problema

Al intentar iniciar `frida-server` desde Kali via ADB, el comando `adb shell su -c "..."` retornaba **Permission denied** sin mostrar ningún diálogo de autorización en el teléfono.

```bash
adb shell su -c "/data/local/tmp/frida-server &"
# Output: Permission denied
```

El teléfono solo mostraba una nubecita (toast) que decía **"shell was denied superuser rights"** sin botones de Allow/Deny.

---

## Diagnóstico

### Verificaciones realizadas

```bash
# Confirmar que SELinux estaba en Enforcing
adb shell getenforce
# Output: Enforcing

# Confirmar que su no funcionaba ni interactivamente
adb shell su -c "id"
# Output: Permission denied

# Confirmar que adb root no es opción en builds de producción
adb root
# Output: adbd cannot run as root in production builds

# Confirmar permisos del binario (estaban correctos)
adb shell ls -la /data/local/tmp/frida-server
# Output: -rwxr-xr-x 1 shell shell 53489240
```

### Causa raíz

Magisk tenía una regla de **deny** guardada en su base de datos (`/data/adb/magisk.db`) para el usuario `shell` (ADB). Esta regla se creó cuando el prompt de autorización expiró sin ser aceptado en un intento anterior. Con la regla guardada, Magisk auto-denegaba sin mostrar ningún diálogo.

### Intentos fallidos previos

- Verificar **Root Access** en Magisk Settings → ya estaba en "ADB and Apps"
- Habilitar **"Open new windows while running in the background"** en permisos de Magisk en HyperOS → no resolvió
- Buscar entrada de shell en el tab Superuser de Magisk → no aparecía nada
- `adb root` → no funciona en production builds
- Dejar el teléfono desbloqueado y Magisk en primer plano → mismo resultado

---

## Solución

### Paso 1 — Instalar Termux

Descargar desde **F-Droid** (no Play Store — la versión de Play Store está desactualizada).

> El de Play Store tiene problemas conocidos con paquetes y permisos. Usar siempre la versión de F-Droid.

### Paso 2 — Obtener root en Termux

Abrir Termux y escribir:

```bash
su
```

Magisk mostró el diálogo con botones **Allow/Deny** correctamente para Termux (apps tienen diferente flujo que ADB shell). Se aceptó.

### Paso 3 — Eliminar la base de datos de Magisk

```bash
rm /data/adb/magisk.db
```

Esto resetea **todos** los permisos de superusuario guardados — reglas de allow y deny. No afecta la instalación de Magisk ni los módulos.

### Paso 4 — Reiniciar el teléfono

```bash
reboot
```

### Paso 5 — Aceptar el nuevo prompt de ADB

Después del reinicio, desde Kali:

```bash
adb shell su -c "id"
```

Esta vez Magisk mostró el diálogo correctamente. Se aceptó y el comando retornó:

```
uid=0(root) gid=0(root)...
```

---

## Resultado

```bash
adb shell su -c "/data/local/tmp/frida-server &"
frida-ps -U
# Output: lista completa de procesos del teléfono ✓
```

frida-server 17.15.3 corriendo correctamente con root via ADB.

---

## Notas

<table>
<tr><td>Síntoma</td><td>Causa</td></tr>
<tr><td>Toast sin botones "shell was denied"</td><td>Regla deny guardada en magisk.db</td></tr>
<tr><td>No aparece en tab Superuser</td><td>Bug conocido en Magisk — las denegaciones no siempre se muestran</td></tr>
<tr><td>Termux sí muestra el diálogo</td><td>Apps y ADB shell tienen flujos distintos en Magisk</td></tr>
</table>

### Referencia

- XDA Thread: Magisk Manager was denied Superuser rights
- Fix confirmado por usuario CTH-EVO: eliminar `/data/adb/magisk.db` desde terminal con root
