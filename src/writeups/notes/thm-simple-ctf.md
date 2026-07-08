---
title: "TryHackMe: Simple CTF"
date: 2025-01-27
category: "TryHackMe"
order: 9
tags: ["tryhackme", "cms-made-simple", "sqli", "unsolved"]
layout: layouts/writeup.njk
permalink: /writeups/thm-simple-ctf.html
---

> Nota: el exploit de este room quedó pendiente por un problema de dependencias de Python (`termcolor`) que no se logró resolver a tiempo. Dejo el reconocimiento y el CVE identificado tal cual.

## Reconocimiento

```bash
sudo nmap -Pn -n -v -p- --min-parallelism 64 --min-rate 20000 --min-hostgroup 64 --randomize-hosts -sS -sV 10.10.79.3
...
PORT     STATE SERVICE VERSION
21/tcp   open  ftp     vsftpd 3.0.3
80/tcp   open  http    Apache httpd 2.4.18 ((Ubuntu))
2222/tcp open  ssh     OpenSSH 7.2p2 Ubuntu 4ubuntu2.8 (Ubuntu Linux; protocol 2.0)
```

**¿Cuántos servicios corren bajo el puerto 1000?** → 2 (FTP y HTTP). **¿Qué corre en el puerto más alto?** → SSH (2222).

### FTP anónimo

```bash
ftp 10.10.79.3
Name: anonymous
230 Login successful.
ftp> cd pub
ftp> get ForMitch.txt
```

El archivo `ForMitch.txt` sugiere un ataque de diccionario contra el usuario `mitch`, probablemente por SSH.

### Intento de fuerza bruta (sin éxito)

```bash
hydra -l mitch -P /usr/share/wordlists/rockyou.txt 10.10.79.3 ssh
[ERROR] could not connect to ssh://10.10.79.3:22 - Timeout connecting to 10.10.79.3

hydra -l mitch -P /usr/share/wordlists/rockyou.txt 10.10.79.3 ftp
0 valid password found
```

El SSH real está en el puerto 2222, no en el 22 por defecto — hay que ajustar el puerto en Hydra. FTP anónimo no reveló contraseña válida por fuerza bruta.

### Enumeración web

```bash
gobuster dir -u http://10.10.79.3 -w /usr/share/wordlists/dirb/common.txt
...
/simple               (Status: 301) [--> http://10.10.79.3/simple/]
```

`/simple` resultó ser un CMS — **CMS Made Simple**. La versión expuesta en el sitio, buscada en Google, apunta directamente a:

**CVE:** `CVE-2019-9053`
**Tipo de vulnerabilidad:** SQL Injection (blind, con capacidad de crackear el hash de contraseña extraído)

## Estado del exploit

El exploit público requiere ejecutarse así:

```bash
python script.py -u http://10.10.68.237/simple --crack -w /usr/share/wordlists/rockyou.txt
```

Se probó con distintas versiones de Python (2, 3, 2.7) sin éxito — el script depende de la librería `termcolor`, que no se logró instalar correctamente en el entorno usado. Portar el script a Python 3 hubiera sido la solución, pero no hubo tiempo para hacerlo en esa sesión. Queda pendiente completar la explotación.
