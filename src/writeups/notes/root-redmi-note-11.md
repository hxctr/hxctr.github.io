---
title: "Root en Redmi Note 11"
date: 2026-07-05
category: "Mobile Pentesting"
order: 1
tags: ["mobile-pentesting", "android", "root", "magisk"]
layout: layouts/writeup.njk
permalink: /writeups/root-redmi-note-11.html
---

## Dispositivo

<table>
<tr><td>Campo</td><td>Valor</td></tr>
<tr><td>Modelo</td><td>Redmi Note 11 NFC</td></tr>
<tr><td>Número de modelo</td><td>2201117TY</td></tr>
<tr><td>Codename</td><td>spesn</td></tr>
<tr><td>Chipset</td><td>Qualcomm Snapdragon 680</td></tr>
<tr><td>OS</td><td>HyperOS 1.0.11.0.TGKEUXM</td></tr>
<tr><td>Android</td><td>13</td></tr>
<tr><td>Región</td><td>EEA (Europa)</td></tr>
</table>

---

## Herramientas utilizadas

<table>
<tr><td>Herramienta</td><td>Versión</td><td>Link</td></tr>
<tr><td>Magisk</td><td>v30.7</td><td><a href="http://github.com/topjohnwu/Magisk/releases">github.com/topjohnwu/Magisk/releases</a></td></tr>
<tr><td>payload-dumper-go</td><td>v1.3.0</td><td><a href="http://github.com/ssut/payload-dumper-go/releases">github.com/ssut/payload-dumper-go/releases</a></td></tr>
<tr><td>platform-tools (ADB/Fastboot)</td><td>Latest</td><td><a href="http://developer.android.com/studio/releases/platform-tools">developer.android.com/studio/releases/platform-tools</a></td></tr>
<tr><td>MiUnlock</td><td>6.5.224.28</td><td><a href="http://miui.com/unlock/download">miui.com/unlock/download</a></td></tr>
<tr><td>Shamiko</td><td>Latest</td><td><a href="http://github.com/LSPosed/LSPosed.github.io/releases">github.com/LSPosed/LSPosed.github.io/releases</a></td></tr>
<tr><td>LSPosed</td><td>v1.9.2 (zygisk)</td><td><a href="http://github.com/LSPosed/LSPosed/releases">github.com/LSPosed/LSPosed/releases</a></td></tr>
<tr><td>PlayIntegrityFix (KOWX712)</td><td>Latest</td><td><a href="http://github.com/KOWX712/PlayIntegrityFix/releases">github.com/KOWX712/PlayIntegrityFix/releases</a></td></tr>
</table>

---

## PARTE 1 — Desbloqueo del Bootloader

### Requisitos previos

- Cuenta Xiaomi con más de 30 días de antigüedad
- País de la cuenta ≠ China ni India
- Find My Device activado en el teléfono
- SIM insertada (recomendado)
- HyperOS actualizado

### Verificar dispositivo Global

Ir a `mi.com/verify` y confirmar que el dispositivo es auténtico y Global.

### Activar opciones de desarrollador

```
Ajustes → Acerca del teléfono → Versión de MIUI/HyperOS → tap 7 veces
```

### Activar OEM Unlock y USB Debugging

```
Ajustes → Opciones de desarrollador → OEM Unlock → ON
Ajustes → Opciones de desarrollador → Depuración USB → ON
```

### Obtener autorización de Xiaomi (Script Python)

El desbloqueo requiere aprobación de los servidores de Xiaomi. Se usó un script automatizado que dispara la solicitud exactamente a medianoche Beijing (00:00 UTC+8 = 10:00 AM Guatemala).

**Archivos del script:**

- `GetTokens.py` — extrae cookies de Firefox y Chrome
- `NScript.py` — envía la solicitud de desbloqueo
- `token.txt` — tokens de sesión (generados automáticamente)
- `timeshift.txt` — offsets de tiempo calibrados para Guatemala (260ms latencia a servidores Xiaomi)

**Valores de timeshift.txt calibrados para Guatemala (latencia 260ms al servidor Xiaomi en Singapur):**

```
560
410
310
260
```

**Proceso:**

1. Correr `py GetTokens.py` antes de las 10:00 AM Guatemala
2. Iniciar sesión en Firefox cuando lo pida → OK
3. Iniciar sesión en Chrome cuando lo pida → OK
4. Se abren 4 ventanas de NScript.py automáticamente
5. A las 10:00 AM disparan las solicitudes
6. El script reintenta automáticamente cada día si no hay éxito
7. El script despierta 20 minutos antes (9:40 AM) para verificar cookies antes del disparo
8. Cuando hay éxito muestra: `¡¡¡ SOLICITUD APROBADA !!!`

**Verificación en el teléfono:**

```
Opciones de desarrollador → Mi Unlock Status → Link Account to Device
```

Si permite vincular → éxito. El proceso tomó 1 intento exitoso.

### Usar MiUnlock

**Driver incluido en MiUnlock:**

- Ejecutar `driver_install_64.exe` como administrador (Windows 64-bit)
- Esto resuelve el problema de "phone not detected"

**Poner teléfono en Fastboot:**

```
Opciones de desarrollador → Reboot to bootloader
```

O manualmente: Apagar → mantener Volumen Abajo + Power

**Conectar y desbloquear:**

1. Abrir `miflash_unlock.exe` como administrador
2. Conectar teléfono en Fastboot con cable USB
3. Iniciar sesión escaneando QR con el teléfono (sacar de Fastboot primero para poder usar el teléfono)
4. Volver a poner en Fastboot y conectar
5. Presionar **Unlock**

**Resultado esperado:**

```
Please unlock 71 hours later
```

El contador corre en servidores de Xiaomi — no necesitas dejar el PC encendido.

**Durante las 71 horas NO hacer:**

- Cerrar sesión de cuenta Xiaomi en el teléfono → resetea el contador
- Factory reset → resetea el contador
- Ir a Mi Unlock Status de nuevo
- Quitar el chip

**Después de las 71 horas:**

1. Poner teléfono en Fastboot
2. Conectar a PC
3. Abrir MiUnlock → Unlock
4. El teléfono hace **factory reset automático** — hacer backup antes

---

## PARTE 2 — Root con Magisk

### Verificar codename del dispositivo

```bash
adb shell getprop ro.product.device
# Output: spesn
```

### Verificar particiones disponibles

```bash
adb shell ls /dev/block/by-name/
```

**Resultado importante para spesn:**

- NO tiene `init_boot_a` ni `init_boot_b`
- Tiene `boot_a` y `boot_b`
- Por lo tanto Magisk parchea `boot` (no `init_boot`)

> ⚠️ El intento de extraer directamente con adb pull da Permission Denied sin root previo — es el problema del huevo y la gallina. La solución es descargar el firmware.

```bash
# ESTO NO FUNCIONA sin root previo:
adb pull /dev/block/by-name/boot_a boot_a.img
# Error: Permission denied
```

### Descargar firmware stock

- **Sitio:** `xiaomirom.com/en/download/redmi-note-11-nfc-spesn-stable-OS1.0.11.0.TGKEUXM/`
- **Tipo:** Recovery ROM (4.1 GB) — más pequeño que Fastboot ROM (6.2 GB), ambos funcionan
- **Archivo:** `miui_SPESNEEAGlobal_OS1.0.11.0.TGKEUXM_1337fb4a33_13.0.zip`
- **MD5:** `1337fb4a3397b7097287bc7aeb24b316`

El Recovery ROM contiene `boot.img` dentro de `payload.bin`.

### Extraer boot.img con payload-dumper-go

```bash
payload-dumper-go.exe -p boot -o output C:\Users\soporte\Downloads\miui_SPESNEEAGlobal_OS1.0.11.0.TGKEUXM_1337fb4a33_13.0\payload.bin
# Output: boot (101 MB) [====] 100%
```

El archivo queda en `output\boot.img`. El firmware no tiene `boot_a`/`boot_b` — el dumper los maneja automáticamente.

### Transferir boot.img al teléfono

```bash
adb push C:\Users\soporte\Downloads\payload-dumper-go_1.3.0_windows_amd64\output\boot.img /sdcard/Download/boot.img
# Output: 27.7 MB/s (100663296 bytes in 3.467s)
```

### Instalar Magisk APK y parchear boot.img

1. Descargar `Magisk-v30.7.apk` desde `github.com/topjohnwu/Magisk/releases` e instalar en el teléfono
2. Abrir app Magisk → sección Magisk → **Install**
3. Seleccionar **"Select and Patch a File"** — NO "Download Mode/Odin" (eso es solo Samsung)
4. Buscar `boot.img` en `/sdcard/Download/`
5. Presionar **Let's Go**
6. Output: `Output file is written to Download/magisk_patched-30700_xfmtW.img — All done`

### Verificar y transferir archivo parcheado

```bash
adb shell ls /sdcard/Download/
# Output:
# Magisk-v30.7.apk
# boot.img
# magisk_patched-30700_xfmtW.img

adb pull /sdcard/Download/magisk_patched-30700_xfmtW.img C:\Users\soporte\Downloads\platform-tools-latest-windows\platform-tools\
# Output: 31.3 MB/s (100663296 bytes in 3.068s)
```

### Flashear via Fastboot

```bash
# Poner en fastboot
adb reboot bootloader

# Flashear en slot activo (boot_b)
fastboot flash boot magisk_patched-30700_xfmtW.img
# Sending 'boot_b' (131072 KB)   OKAY [4.118s]
# Writing 'boot_b'               OKAY [0.564s]

# Flashear también en slot inactivo (boot_a)
fastboot flash boot_a magisk_patched-30700_xfmtW.img
# Sending 'boot_a' (131072 KB)   OKAY [4.099s]
# Writing 'boot_a'               OKAY [0.561s]

# Reiniciar
fastboot reboot
```

### Verificar root

- Abrir app Magisk → debe mostrar `Magisk: Installed v30.7`
- Tab de Superuser ahora accesible
- Root Checker confirma acceso root exitoso

---

## PARTE 3 — Configuración post-root

### Configuración en Magisk

```
Magisk → Settings → Zygisk → ON
Magisk → Settings → Systemless Hosts → tap para agregar módulo
Magisk → Settings → Configure DenyList → Enable DenyList → ON
```

Agregar apps de Google y cualquier app que detecte root al DenyList.

### Módulos instalados

**Shamiko** — bypass detección de root:

- `github.com/LSPosed/LSPosed.github.io/releases`
- Magisk → Modules → Install from storage → zip → reiniciar

**LSPosed v1.9.2** — framework de hooking:

- Descargar versión **zygisk** de `github.com/LSPosed/LSPosed/releases`
- Desarrollo pausado desde 2023 pero sigue funcionando con Magisk actual
- Magisk → Modules → Install from storage → zip → reiniciar

**PlayIntegrityFix (KOWX712)** — bypass Google Play Integrity:

- ⚠️ chiteroman/PlayIntegrityFix está DISCONTINUADO desde enero 2025
- Usar fork activo: `github.com/KOWX712/PlayIntegrityFix/releases`
- Magisk → Modules → Install from storage → zip → reiniciar

---

## Stack final instalado

<table>
<tr><td>Herramienta</td><td>Estado</td><td>Uso</td></tr>
<tr><td>Bootloader desbloqueado</td><td>✅</td><td>Base para todo</td></tr>
<tr><td>Magisk v30.7</td><td>✅</td><td>Root</td></tr>
<tr><td>Zygisk</td><td>✅</td><td>Framework de módulos</td></tr>
<tr><td>Systemless Hosts</td><td>✅</td><td>Modificar hosts sin tocar sistema</td></tr>
<tr><td>Shamiko</td><td>✅</td><td>Bypass detección de root</td></tr>
<tr><td>LSPosed v1.9.2</td><td>✅</td><td>Hooking a nivel de framework</td></tr>
<tr><td>PlayIntegrityFix (KOWX712)</td><td>✅</td><td>Bypass Google Play Integrity</td></tr>
<tr><td>DenyList configurado</td><td>✅</td><td>Ocultar root por app</td></tr>
<tr><td>Frida Server 17.15.3</td><td>✅</td><td>Ver write-up de Frida-server</td></tr>
</table>

---

## Notas importantes

### ADB no funciona en PowerShell

Usar siempre CMD como administrador con `cd /d ruta`. PowerShell puede dar errores inesperados con ADB.

### Drivers de Fastboot

Si fastboot no detecta el teléfono — instalar `driver_install_64.exe` incluido en la carpeta de MiUnlock.

### Recovery ROM vs Fastboot ROM

Ambos contienen `boot.img`. El Recovery ROM (4.1 GB) es suficiente y más pequeño que el Fastboot ROM (6.2 GB).

### Por qué no TWRP

TWRP no está bien mantenido para spesn con HyperOS. El método de patched boot.img es el recomendado oficialmente por Magisk con menor riesgo de brick.

### Detección de root — niveles y soluciones

<table>
<tr><td>Nivel</td><td>Descripción</td><td>Solución</td></tr>
<tr><td>Básico</td><td>Checks simples de binarios su</td><td>Shamiko + DenyList</td></tr>
<tr><td>Medio</td><td>Play Integrity / SafetyNet</td><td>PlayIntegrityFix</td></tr>
<tr><td>Avanzado</td><td>Promon, Arxan, DexGuard</td><td>Frida gadget, apktool, reFlutter</td></tr>
</table>

La detección de root bypasseable es una vulnerabilidad válida en un pentest — CWE-919, OWASP Mobile Top 10: M8.
