---
title: "Instalar APKs via ADB"
date: 2026-07-05
category: "Mobile Pentesting"
order: 6
tags: ["mobile-pentesting", "android", "adb"]
layout: layouts/writeup.njk
permalink: /writeups/instalar-apks-via-adb.html
---

> Cómo instalar apps en Android desde Kali via ADB, incluyendo APKs simples y apps divididas en múltiples archivos (split APKs / XAPK).

---

## Tipos de instalación

### APK simple

Una sola app en un archivo `.apk`:

```bash
adb install <app.apk>
```

### Split APK (XAPK)

Algunas apps vienen divididas en múltiples archivos:

- `app.apk` — el APK principal
- `config.arm64_v8a.apk` — binarios para la arquitectura del dispositivo
- `config.xxxhdpi.apk` — recursos gráficos para la densidad de pantalla

```bash
adb install-multiple <app.apk> <config.arquitectura.apk> <config.densidad.apk>
```

Ejemplo real con Firefox:

```bash
adb install-multiple org.mozilla.firefox.apk config.arm64_v8a.apk config.xxxhdpi.apk
```

> Si intentas instalar solo el APK principal de un split APK obtendrás: `INSTALL_FAILED_MISSING_SPLIT`

---

## Cómo extraer un XAPK

Un XAPK es un ZIP renombrado. Para extraerlo:

```bash
# Renombrar a .zip
mv app.xapk app.zip

# Extraer
unzip app.zip

# Dentro encontrarás los archivos .apk
ls *.apk
```

---

## Error: INSTALL_FAILED_USER_RESTRICTED en HyperOS

HyperOS bloquea la instalación via ADB por defecto. Para habilitarlo:

1. **Settings → Additional Settings → Developer Options → Install via USB** — activar
2. HyperOS verifica cuenta Mi y SIM al activarlo — asegurarse de estar logueado en cuenta Xiaomi y tener SIM insertada
3. Si sigue fallando, conectarse a **datos móviles** (no WiFi) al correr el comando — HyperOS consulta servidores de Xiaomi para verificar el permiso

---

## Flags útiles

```bash
# Reinstalar app que ya está instalada (sin borrar datos)
adb install -r <app.apk>

# Instalar en almacenamiento externo
adb install -s <app.apk>

# Permitir downgrade de versión
adb install -d <app.apk>

# Instalar sin verificación
adb install --no-streaming <app.apk>
```
