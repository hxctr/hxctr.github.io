---
title: "Conexión a Burp Suite vía SOCKS proxy sobre SSH"
category: "Tutoriales"
order: 35
tags: ["tutorial", "burp-suite", "ssh", "socks-proxy", "pivoting"]
layout: layouts/writeup.njk
permalink: /writeups/tut-burpsuite-ssh-socks-proxy.html
---

## Objetivo

Enrutar el tráfico de Burp Suite (y del navegador) a través de un túnel SSH SOCKS hacia una máquina Kali remota, para interceptar tráfico que solo es accesible desde esa red.

## Paso 1 — Levantar el túnel SOCKS

```bash
ssh kali@10.10.10.126 -D 9090
```

La flag `-D 9090` abre un proxy SOCKS dinámico en el puerto local `9090`, enrutando todo el tráfico que se le envíe a través de la conexión SSH hacia la red donde está el Kali remoto.

## Paso 2 — Configurar Burp Suite

En la configuración de proxy de Burp Suite (upstream proxy / SOCKS), apuntar a `localhost:9090` como proxy SOCKS.

## Paso 3 — Configurar el navegador (Firefox)

En la configuración de red de Firefox, seleccionar proxy SOCKS manual apuntando también a `localhost:9090`, para que el tráfico del navegador pase por Burp Suite y luego por el túnel SSH hacia la red objetivo.

## Resultado

Con esta cadena (`Navegador → Burp Suite → túnel SOCKS SSH → red remota`), es posible interceptar y modificar tráfico HTTP/HTTPS dirigido a hosts que solo son alcanzables desde la máquina Kali remota, sin necesidad de instalar Burp Suite directamente en ella.
