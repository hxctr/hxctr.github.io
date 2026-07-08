---
title: "WiFi Pineapple Mark VII"
category: "Tutoriales"
order: 33
tags: ["tutorial", "wifi-pineapple", "wireless", "airodump-ng", "recon"]
layout: layouts/writeup.njk
permalink: /writeups/tut-wifi-pineapple-mark-vii.html
---

## Inicializar la Pineapple

1. Conectar por USB-C la piña al computador.
2. Se genera una red wifi que normalmente tendría que ser tipo `Pineapple_XXXX` — en caso contrario, verificar qué red nueva aparece luego de conectar la piña.
3. Conectar el computador a esa red wifi mientras se mantiene conexión a una red normal.
4. Dirigirse a `http://172.16.42.1:1471` (siempre esta dirección y puerto).

## Conexión por SSH

```bash
# Siempre será esta IP
ssh root@172.16.42.1
```

## Dashboard en un vistazo

- **Dashboard:** vista general.
- **Campaigns:** gestión de campañas.
- **PineAP Suite:** la parte principal de la piña — gestiona el rogue access point.

## Recon Scan (GUI)

Se presiona el botón "Recon", luego "Start", y tras el tiempo configurado se muestran las redes del entorno.

## Recon Scan (Consola)

```bash
airodump-ng <NombreAdaptadorDeRed>
```

**¿Qué adaptador elegir?**

```bash
iwconfig
```

Buscar la interfaz que esté en `Mode:Monitor` (ej. `wlan1`, `wlan1mon`). Si el adaptador no está en modo monitor:

```bash
ifconfig <NombreAdaptadorDeRed> down
iwconfig <NombreAdaptadorDeRed> mode monitor
ifconfig <NombreAdaptadorDeRed> up
```

Ejemplo de salida de `airodump-ng wlan1` listando redes cercanas con su BSSID, canal, cifrado y ESSID.

## Check de clientes conectados a una red

```bash
airodump-ng --channel <número de canal> --bssid <MAC objetivo> <NombreAdaptadorRed>
```

Ejemplo con la red objetivo "RedDePrueba": primero se identifica su canal y BSSID con un recon general, luego se apunta el escaneo específicamente a ese canal/BSSID para ver qué estaciones (clientes) están asociadas.

## Deauthentication Attacks

Necesario para capturar el handshake de una red: como es poco probable que un usuario se conecte justo durante la evaluación, se deautentica a los usuarios conectados para forzar una reconexión (y así capturar el handshake). También se usa para forzar a los clientes a conectarse a un Evil Twin.

## Actualizar firmware

1. Conectar la piñita por USB-C.
2. Ir a `http://172.16.42.1:1471`.
3. Ingresar con las credenciales por defecto (`root:root`).
4. En la sección de networking, escanear redes y configurar la conexión a internet de la piña.
5. En la tab "General", buscar actualizaciones e instalar si hay una versión nueva disponible.

## Resetear de fábrica

Mantener presionado el botón de reset por 3 segundos — el LED cambiará a rojo estático confirmando el reset.
