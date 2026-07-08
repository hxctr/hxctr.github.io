---
title: "TryHackMe: Ra"
category: "TryHackMe"
order: 16
tags: ["tryhackme", "active-directory", "smb", "password-reset"]
layout: layouts/writeup.njk
permalink: /writeups/thm-ra.html
---

## Reconocimiento

```bash
sudo nmap -Pn -n -v -p- --min-parallelism 64 --min-rate 20000 --min-hostgroup 64 --randomize-hosts -sS -sV 10.10.46.27
...
PORT      STATE SERVICE             VERSION
53/tcp    open  domain              Simple DNS Plus
80/tcp    open  http                Microsoft IIS httpd 10.0
88/tcp    open  kerberos-sec        Microsoft Windows Kerberos
135/tcp   open  msrpc               Microsoft Windows RPC
139/tcp   open  netbios-ssn         Microsoft Windows netbios-ssn
389/tcp   open  ldap                Microsoft Windows Active Directory LDAP (Domain: windcorp.thm0.)
443/tcp   open  ssl/http            Microsoft HTTPAPI httpd 2.0
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http          Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ldapssl?
3268/tcp  open  ldap                Microsoft Windows Active Directory LDAP
3269/tcp  open  globalcatLDAPssl?
3389/tcp  open  ms-wbt-server       Microsoft Terminal Services
5222/tcp  open  jabber              Ignite Realtime Openfire Jabber server 3.10.0 or later
5985/tcp  open  http                Microsoft HTTPAPI httpd 2.0
9389/tcp  open  mc-nmf              .NET Message Framing
```

Máquina de Active Directory (dominio `windcorp.thm0.`) con Kerberos, LDAP, SMB, RDP, WinRM (5985) y un servidor Jabber/Openfire abierto.

## Enumeración del sitio web

Revisando el código fuente del sitio se encuentra una lista de correos de empleados, útil para ataques de fuerza bruta o para intentar un reseteo de contraseña:

```
sorganicfish718@fire.windcorp.thm">Antonietta Vidal</a></li>
sorganicwolf509@fire.windcorp.thm">Britney Palmer</a></li>
tinywolf424@fire.windcorp.thm">Brittany Cruz</a></li>
angrybird253@fire.windcorp.thm">Carla Meyer</a></li>
buse@fire.windcorp.thm">Buse Candan</a></li>
...
```

Hay un botón de "reset" que no carga a simple vista, pero revisando el código fuente aparece el dominio real. Agregándolo al archivo `/etc/hosts`, el botón carga correctamente.

En el código fuente también aparecen carpetas que sirven para enumerar directorios con `dirbuster` o `gobuster`.

Usando los datos encontrados (nombres/correos), se logra resetear la contraseña de un usuario:

**Contraseña reseteada a: `ChangeMe#1234`**

Con esas credenciales, ingresando al dominio se llega a una instancia de **Windows Admin Center**.

## Validación de credenciales y SMB

Con `smbmap` se valida el usuario/contraseña obtenidos y se enumeran los recursos compartidos:

```bash
smbmap -u 'lilyle' -p 'ChangeMe#1234' -H windcorp.thm -r

Disk        Permissions  Comment
----        -----------  -------
ADMIN$      NO ACCESS    Remote Admin
C$          NO ACCESS    Default share
IPC$        READ ONLY    Remote IPC
NETLOGON    READ ONLY    Logon server share
Shared      READ ONLY
  Flag 1.txt
  spark_2_8_3.deb / .dmg / .exe / .tar.gz
SYSVOL      READ ONLY    Logon server share
Users       READ ONLY
```

El share `Shared` es legible y contiene la primera flag, además de instaladores de **Spark** en una versión específica (candidata a tener vulnerabilidades conocidas).

## Lectura de la flag

```bash
smbclient //windcorp.thm/Shared -U 'lilyle'
smb: \> get "Flag 1.txt"
smb: \> exit

cat Flag\ 1.txt
THM{466d52dc75a277d6c3f6c6fcbc716d6b62420f48}
```

## Lecciones aprendidas

- Información aparentemente inofensiva (listas de correos en el código fuente) puede habilitar un flujo completo de reseteo de contraseña si el mecanismo de "forgot password" no está bien protegido.
- Revisar siempre el código fuente HTML/JS de un sitio antes de descartar una función como "rota" — a veces solo falta una entrada en `/etc/hosts`.
- Los shares SMB con acceso de solo lectura pueden filtrar credenciales, flags o software desactualizado (versión de Spark) que abre otro vector de ataque.
