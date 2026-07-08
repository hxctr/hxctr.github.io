---
title: "FreshTomato + IPVanish WireGuard — Configuración"
category: "Tutoriales"
order: 32
tags: ["tutorial", "vpn", "wireguard", "freshtomato", "networking"]
layout: layouts/writeup.njk
permalink: /writeups/tut-freshtomato-ipvanish-wireguard.html
---

## Contexto

Configuración de IPVanish usando WireGuard en un router Netgear R6300v2 con firmware FreshTomato.

## Prerequisitos

- Router Netgear R6300v2 con FreshTomato AIO instalado.
- Cuenta de IPVanish activa.
- Acceso al panel de FreshTomato en `http://192.168.2.1`.

## Paso 1 — Generar configuración WireGuard en IPVanish

1. Ir a `my.ipvanish.com`.
2. Ir a la sección **WireGuard**.
3. Seleccionar el servidor deseado.
4. Click en **Generate**.
5. Descargar el archivo `.conf` generado.

## Paso 2 — Configurar WireGuard en FreshTomato

1. Acceder al panel: `http://192.168.2.1`.
2. Ir a **VPN → WireGuard → wg0 → Config**.
3. Cambiar **Type of VPN** a `External - VPN Provider`.
4. Asegurarse que **Redirect Internet traffic** esté en `All`.
5. En **Import Config from File** → seleccionar el archivo `.conf`.
6. Click en **Import**.

## Paso 3 — Configurar manualmente (si el import no pobla los peers)

Abrir el archivo `.conf` y extraer los valores:

```
[Interface]
PrivateKey = <llave privada>
Address = <IP asignada>/32
DNS = 198.18.0.1, 198.18.0.2

[Peer]
PublicKey = <llave pública del servidor>
AllowedIPs = 0.0.0.0/0
Endpoint = <IP del servidor>:51820
```

**En la pestaña Config:**

| Campo | Valor |
|---|---|
| Enable on Start | ✓ |
| Type of VPN | External - VPN Provider |
| Redirect Internet traffic | All |
| Private Key | (del archivo .conf) |
| VPN Interface IP | (Address del archivo .conf) |
| DNS Servers (out) | 198.18.0.1, 198.18.0.2 |

**En la pestaña Peers:**

| Campo | Valor |
|---|---|
| Endpoint | IP:51820 (del archivo .conf) |
| Public Key | PublicKey del Peer |
| Allowed IPs | 0.0.0.0/0 |
| Keepalive | 25 |

Click **Add to Peers** → **Save**.

## Paso 4 — Activar la VPN

1. Click en **Save**.
2. Click en **Start Now**.
3. El status debe cambiar a **Up**.

## Paso 5 — Verificar

Desde cualquier dispositivo conectado al WiFi del router, ir a `https://whatismyipaddress.com` — debe mostrar la ubicación del servidor VPN en lugar de la IP real.

## Notas

- Algunos servidores IPVanish tienen la IP marcada como VPN en servicios de streaming; si un sitio bloquea el acceso, cambiar de servidor y repetir el proceso.
- Las credenciales de usuario/contraseña no son necesarias con WireGuard — la autenticación es por llaves criptográficas incluidas en el archivo `.conf`.
- El archivo `.conf` generado en IPVanish es único por sesión y está vinculado a la cuenta.
