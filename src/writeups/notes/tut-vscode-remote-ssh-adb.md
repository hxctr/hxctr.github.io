---
title: "VS Code Remote-SSH + ADB sobre red (Kali ↔ NOX en otra PC)"
category: "Tutoriales"
order: 31
tags: ["tutorial", "vscode", "adb", "android", "troubleshooting", "mobile-pentesting"]
layout: layouts/writeup.njk
permalink: /writeups/tut-vscode-remote-ssh-adb.html
---

## Contexto

Setup: Kali Linux en una PC, NOX (emulador Android) en otra PC, ambas en la misma red local (`192.168.1.0/24`). Objetivo: usar VS Code con la extensión Remote-SSH para editar/analizar archivos directamente en Kali (APKs decompilados con apktool, manifest, smali, etc.), y usar `adb` desde Kali para atacar el emulador NOX que corre en la otra PC.

## Problema 1 — VS Code Server no instalaba (`No space left on device`)

Al conectar por Remote-SSH, la descarga del VS Code Server se cortaba siempre en el mismo punto (~20%, ~36MB de 182MB) y el editor entraba en loop pidiendo de nuevo plataforma + contraseña.

**Diagnóstico** (`Remote-SSH: Show Log`):

```
Error installing server: failed to download file: No space left on device (os error 28)
```

**Causa:** la partición raíz de Kali se quedó sin espacio en disco.

**Solución:**

```bash
df -h                                       # confirmar espacio real disponible
sudo apt clean
sudo apt autoremove
du -sh /home/kali/* | sort -rh | head -10   # ubicar qué ocupaba espacio
rm -rf ~/.vscode-server                     # limpiar instalación a medias
```

Después de liberar espacio, la conexión de Remote-SSH completó la descarga sin problema.

## Problema 2 — `adb` desde Kali no encontraba el emulador NOX

`adb devices` en Kali no mostraba nada por default — a diferencia de Windows (misma PC que NOX), donde `adb devices` sí detectaba el emulador en `127.0.0.1:62001` automáticamente.

**Por qué:** `adb` no escanea la red buscando emuladores solo; hay que decirle explícitamente la IP y puerto con `adb connect`.

```bash
adb connect 192.168.1.66:62001   # IP de la PC con NOX + puerto ADB de NOX
adb devices
```

Esto tampoco conectó al principio — se quedaba colgado sin dar ni error ni éxito.

## Problema 3 — Conexión colgada sin respuesta

**Verificación paso a paso:**

1. `ping 192.168.1.66` desde Kali → 100% packet loss. **No es concluyente**: Windows bloquea ICMP por firewall por default, independientemente de que otras conexiones funcionen.
2. `nc -vzn 192.168.1.66 62001` desde Kali → se quedaba colgado sin respuesta (ni "succeeded" ni "connection refused"). Un colgado silencioso así es la firma típica de un firewall descartando el paquete (drop) en vez de rechazarlo activamente.

**Primer intento de solución** — abrir el puerto en el Firewall de Windows (CMD como administrador en la PC de NOX):

```shell
netsh advfirewall firewall add rule name="ADB NOX" dir=in action=allow protocol=TCP localport=62001
```

Esto no resolvió el problema — `nc` seguía colgado igual.

## Causa raíz real: NOX solo escuchaba en localhost

```shell
netstat -an | findstr 62001
```

```
TCP    127.0.0.1:62001        0.0.0.0:0              LISTENING
```

NOX solo exponía el puerto ADB en `127.0.0.1`, nunca en `0.0.0.0` (todas las interfaces). Por diseño, NOX asume que `adb` se va a usar desde la misma PC — no expone el puerto a la red por default. Por eso ningún ajuste de firewall iba a solucionar nada: el puerto nunca estuvo expuesto hacia afuera.

## Solución final — port proxy con `netsh`

En la PC de NOX, CMD como administrador:

```shell
netsh interface portproxy add v4tov4 listenport=62001 listenaddress=0.0.0.0 connectport=62001 connectaddress=127.0.0.1
```

Esto redirige todo lo que llegue al puerto 62001 desde cualquier IP de la red hacia `127.0.0.1:62001`, donde NOX sí escucha.

**Verificar que el proxy quedó activo:**

```shell
netsh interface portproxy show v4tov4
```

```
Listen on ipv4:             Connect to ipv4:
Address         Port        Address         Port
--------------- ----------  --------------- ----------
0.0.0.0         62001       127.0.0.1       62001
```

**Confirmación desde Kali:**

```bash
nc -vzn 192.168.1.66 62001
# (UNKNOWN) [192.168.1.66] 62001 (?) open

adb connect 192.168.1.66:62001
# connected to 192.168.1.66:62001

adb devices
# 192.168.1.66:62001    device
```

Con el dispositivo ya visible desde Kali, se pudo lanzar el Intent de prueba contra la Activity exportada de InsecureBankv2:

```bash
adb shell am start -n com.android.insecurebankv2/.DoTransfer
```

## Para deshacer el port proxy

```shell
netsh interface portproxy delete v4tov4 listenport=62001 listenaddress=0.0.0.0
netsh advfirewall firewall delete rule name="ADB NOX"
```

## Resumen del diagnóstico

1. ~~Firewall de Windows bloqueando el puerto~~ → se abrió la regla, no resolvió nada.
2. ~~Problema de red general~~ → descartado con `ip a`, ambas PCs en la misma subred `/24`.
3. ~~Ping como test de conectividad~~ → descartado, Windows bloquea ICMP por default sin relación al resto.
4. **Causa real:** NOX solo escuchaba en `127.0.0.1`, nunca expuso el puerto a `0.0.0.0` → resuelto con `netsh interface portproxy`.
