---
title: "TryHackMe: Pickle Rick"
category: "TryHackMe"
order: 27
tags: ["tryhackme", "command-injection", "nikto", "web-shell", "unsolved"]
layout: layouts/writeup.njk
permalink: /writeups/thm-pickle-rick.html
---

> Nota: mis notas de esta sala se cortan justo después de encontrar el segundo y tercer "ingrediente" (las flags temáticas de la room) navegando el sistema de archivos a través de la consola web — no quedó registrado el paso final de captura de cada ingrediente ni la lectura textual de su contenido, solo capturas de pantalla. Lo dejo tal cual, ya que el proceso de reconocimiento y explotación documentado es igualmente instructivo.

## Reconocimiento

```bash
nmap -p- -Pn -vv -T4 -A 10.10.25.163
...
PORT      STATE    SERVICE VERSION
22/tcp    open     ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.11
80/tcp    open     http    Apache httpd 2.4.41 (Ubuntu)
```

El sitio web (`Rick is sup4r cool`) revela un nombre de usuario en el código fuente.

## Enumeración de directorios

```bash
dirb http://10.10.25.163 /usr/share/wordlists/dirb/common.txt
...
==> DIRECTORY: http://10.10.25.163/assets/
+ http://10.10.25.163/index.html
+ http://10.10.25.163/robots.txt
+ http://10.10.25.163/server-status
```

`/assets/` es un directorio listable con imágenes. `robots.txt` contiene lo que parece ser una contraseña.

## Descubrimiento de login con Nikto

```bash
nikto -h 10.10.25.163
...
+ /login.php: Admin login page/section found.
```

Con el usuario del código fuente y la contraseña del `robots.txt` se accede a `/login.php`.

## Consola de comandos simulada

Tras el login aparece un input que simula una terminal. El comando `cat` está deshabilitado, pero `less` funciona como alternativa para leer archivos — permitiendo listar el primer ingrediente.

Navegando por directorios accesibles (sin `cd ..` funcional, solo listando con `ls`) se llega al home de Rick, donde hay un archivo con el segundo ingrediente (leído también con `less`). El acceso `sudo` sin restricciones permite además listar el directorio `/root`, donde está el archivo con el ingrediente final.

## Lecciones aprendidas

- Cuando comandos básicos como `cat` están bloqueados en una "consola" web restringida, alternativas como `less`, `more`, `head`, `tac` o `sed` suelen seguir funcionando — es la primera cosa a probar ante un filtro de comandos.
- `robots.txt` y el código fuente HTML siguen siendo dos de las fuentes más rentables de credenciales filtradas accidentalmente en aplicaciones CTF (y, con más frecuencia de la esperada, en aplicaciones reales mal configuradas).
- Nikto es efectivo para descubrir rutas de administración (`/login.php`) que no aparecen en wordlists genéricas de `dirb`/`gobuster`.
