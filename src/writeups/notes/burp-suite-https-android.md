---
title: "Burp Suite — Interceptar tráfico HTTPS en Android"
date: 2026-07-05
category: "Mobile Pentesting"
order: 5
tags: ["mobile-pentesting", "android", "burp-suite", "magisk"]
layout: layouts/writeup.njk
permalink: /writeups/burp-suite-https-android.html
---

> Setup completo para interceptar tráfico HTTPS de apps Android con Burp Suite Pro, certificado instalado como sistema via módulo de Magisk.

---

## Requisitos

- Burp Suite Pro corriendo en Windows
- Kali Linux con ADB conectado al teléfono
- Teléfono rooteado con Magisk
- Teléfono y Windows en la misma red WiFi

---

## Paso 1 — Configurar Burp para escuchar en todas las interfaces

En Burp Suite:

**Proxy → Proxy settings → Proxy listeners → Edit**

Cambiar **Bind to address** de `Loopback only` a `All interfaces`

> Guardar el proyecto de Burp con esta configuración para no tener que repetirlo.

---

## Paso 2 — Obtener la IP de Windows

En CMD de Windows:

```shell
ipconfig
```

Buscar la IP del adaptador WiFi. Ejemplo: `192.168.1.66`

---

## Paso 3 — Configurar proxy en el teléfono

**WiFi → Mantener presionada la red → Modificar red**

- Proxy: **Manual**
- Hostname: `192.168.1.66` (IP de Windows)
- Puerto: `8080`
- Guardar

> Esto hay que actualizarlo si la IP de Windows cambia (DHCP). Para evitarlo, asignar IP fija a Windows en el router.

---

## Paso 4 — Descargar el certificado de Burp desde Kali

```bash
curl -x 192.168.1.66:8080 http://burpsuite/cert -o cacert.der
```

> No usar el Certificate Installer del teléfono — instala como certificado de usuario, que Android 7+ no confía para apps.

---

## Paso 5 — Convertir el certificado y obtener el hash

```bash
openssl x509 -inform DER -in cacert.der -out burp.pem
HASH=$(openssl x509 -inform PEM -subject_hash_old -in burp.pem | head -1)
echo $HASH
# Output ejemplo: 9a5ba575
```

Renombrar con el formato que Android requiere:

```bash
cp burp.pem $HASH.0
```

---

## Paso 6 — Subir el certificado al teléfono

```bash
adb push $HASH.0 /data/local/tmp/
```

---

## Paso 7 — Instalar como módulo de Magisk

No se puede modificar `/system` directamente porque dm-verity lo protege en Android moderno. Se usa un módulo de Magisk que inyecta el certificado de forma systemless.

```bash
# Crear estructura del módulo
adb shell su -c "mkdir -p /data/adb/modules/burp_cert/system/etc/security/cacerts"

# Copiar el certificado
adb shell su -c "cp /data/local/tmp/$HASH.0 /data/adb/modules/burp_cert/system/etc/security/cacerts/"
adb shell su -c "chmod 644 /data/adb/modules/burp_cert/system/etc/security/cacerts/$HASH.0"

# Crear module.prop
adb shell su -c "printf 'id=burp_cert\nname=Burp Certificate\nversion=v1\nversionCode=1\nauthor=pentest\ndescription=Burp Suite CA as system certificate' > /data/local/tmp/module.prop"
adb shell su -c "mv /data/local/tmp/module.prop /data/adb/modules/burp_cert/module.prop"
```

### ¿Por qué un módulo de Magisk y no directo?

- Android 10+ protege `/system` con dm-verity — no se puede remount como rw
- El módulo crea un overlay systemless que Magisk inyecta en el boot
- No modifica la partición del sistema real

---

## Paso 8 — Reiniciar el teléfono

```bash
adb reboot
```

---

## Paso 9 — Verificar

En el teléfono:

**Ajustes → Seguridad → Credenciales de confianza → Sistema**

Buscar **PortSwigger** — debe aparecer en la lista.

En Magisk → Modules debe aparecer **Burp Certificate** habilitado.

---

## Verificación final

Desde el navegador del teléfono entrar a `https://example.com`. El tráfico debe aparecer en **Burp → Proxy → HTTP history**.

```
GET / HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0 (Linux; Android...)
...
```

---

## Notas importantes

<table>
<tr><td>Situación</td><td>¿Hay que repetir el proceso?</td></tr>
<tr><td>Nueva sesión de Burp</td><td>No</td></tr>
<tr><td>Nuevo proyecto de Burp</td><td>No</td></tr>
<tr><td>IP de Windows cambió</td><td>Solo actualizar proxy en el teléfono (Paso 3)</td></tr>
<tr><td>Se regenera el cert de Burp</td><td>Sí, repetir desde Paso 4</td></tr>
<tr><td>Flash de nueva ROM</td><td>Sí, repetir todo</td></tr>
</table>

---

## Limitaciones

- **Navegador y apps normales** — funciona directo
- **Apps con certificate pinning** — requiere Frida u Objection para bypassear
- **Apps bancarias/alta seguridad** — protecciones adicionales (root detection, Frida detection)
