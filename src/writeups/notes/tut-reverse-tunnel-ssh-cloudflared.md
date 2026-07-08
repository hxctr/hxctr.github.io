---
title: "Reverse Tunnel SSH via Cloudflared (sin VPN)"
category: "Tutoriales"
order: 30
tags: ["tutorial", "ssh", "cloudflared", "tunneling", "pentest-infra"]
layout: layouts/writeup.njk
permalink: /writeups/tut-reverse-tunnel-ssh-cloudflared.html
---

## ¿Qué es este método?

Un **Reverse Tunnel** permite acceso SSH a una máquina remota sin que tenga puertos entrantes abiertos. La máquina remota inicia una conexión saliente hacia Cloudflare, y el acceso se hace a través de esa conexión.

```
Tu PC (local) → Internet → Cloudflare → Kali (red interna)
```

El Kali sigue dentro de la red del cliente — solo cambia la forma de acceder a él.

## Verificaciones previas

**¿Tiene IP pública?**

```bash
curl -s ifconfig.me
```

**¿Está corriendo SSH?**

```bash
systemctl status ssh
ss -tlnp | grep 22
sudo systemctl start ssh   # si no está corriendo
```

**¿Hay salida HTTPS al exterior?** (el check más importante)

```bash
curl -s https://google.com -o /dev/null -w "%{http_code}"
```

Si devuelve `200` o `301` → cloudflared funcionará.

**¿TCP raw está bloqueado?**

```bash
nc -zv 8.8.8.8 443 2>&1
```

Si falla pero `curl` funciona → hay un proxy transparente. Cloudflared funciona igual porque usa HTTPS como transporte, no TCP raw.

## Setup completo

**Paso 1 — Descargar cloudflared en el Kali:**

```bash
curl -Lo cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared
```

**Paso 2 — Levantar el tunnel:**

```bash
./cloudflared tunnel --url tcp://localhost:22
```

Cloudflare entrega una URL temporal como `https://abc123xyz.trycloudflare.com`.

**Paso 3 — Instalar cloudflared en la máquina local (Windows):**

Descargar el `.exe` desde `cloudflared-windows-amd64.exe`, renombrarlo a `cloudflared.exe` y colocarlo en un directorio accesible.

**Paso 4 — Conectarse vía SSH:**

```bash
ssh -o ProxyCommand="cloudflared access tcp --hostname abc123xyz.trycloudflare.com" usuario@abc123xyz.trycloudflare.com
```

**Paso 5 — SOCKS5 proxy (opcional)**, para pivotear hacia la red interna del Kali:

```bash
ssh -o ProxyCommand="cloudflared access tcp --hostname abc123xyz.trycloudflare.com" usuario@abc123xyz.trycloudflare.com -D 9090
```

Configurar `localhost:9050` como SOCKS5 en la herramienta que corresponda.

## Hacerlo persistente (systemd)

```bash
sudo tee /etc/systemd/system/cloudflared-ssh.service > /dev/null <<EOF
[Unit]
Description=Cloudflare SSH Tunnel
After=network.target

[Service]
ExecStart=/home/ciberseg/cloudflared tunnel --url tcp://localhost:22
Restart=always
RestartSec=5
User=ciberseg

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable cloudflared-ssh
sudo systemctl start cloudflared-ssh
```

Ver la URL generada por el servicio:

```bash
sudo journalctl -u cloudflared-ssh | grep trycloudflare.com
```

> La URL cambia cada vez que el servicio reinicia. Para una URL fija se necesita cuenta en Cloudflare.

## Consideraciones de seguridad

- La URL es aleatoria y temporal — difícil de adivinar.
- SSH sigue requiriendo credenciales válidas.
- Cloudflare ve el tráfico (aunque SSH encripta el contenido).
- Para mayor seguridad, deshabilitar autenticación por password y usar solo keys:

```bash
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

## Contexto de uso

Útil cuando:

- El Kali está detrás de un PMP (ManageEngine Password Manager Pro) o similar.
- FortiClient no rutea la subred interna del Kali.
- El puerto 22 está bloqueado por firewall upstream.
- La interfaz web es lenta (RDP/VNC sobre proxy).
- Se quiere evitar el session recording del PMP.
