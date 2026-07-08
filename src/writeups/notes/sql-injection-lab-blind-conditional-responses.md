---
title: "Lab: Blind SQL injection with conditional responses"
date: 2026-01-14
category: "SQL Injection"
order: 12
tags: ["web-security-academy", "sql-injection", "lab", "blind"]
layout: layouts/writeup.njk
permalink: /writeups/sql-injection-lab-blind-conditional-responses.html
---

This lab contains a blind SQL injection vulnerability. The application uses a tracking cookie for analytics, and performs a SQL query containing the value of the submitted cookie.

The results of the SQL query are not returned, and no error messages are displayed. But the application includes a `Welcome back` message in the page if the query returns any rows.

The database contains a different table called `users`, with columns called `username` and `password`. You need to exploit the blind SQL injection vulnerability to find out the password of the `administrator` user.

To solve the lab, log in as the `administrator` user.

---

## Paso 1 — Confirmar si el parámetro es vulnerable a blind SQLi

```sql
SELECT tracking-id FROM tracking-table WHERE trackingId = 'hotFzRxfi7Ibsv8blQioEFyYblGwGhjq'
-- Si el tracking-id existe → la consulta retorna filas → "Welcome back"
-- Si el tracking-id NO existe → la consulta no retorna nada → sin "Welcome back"
```

Confirmando con condiciones booleanas inyectadas en la cookie:

```sql
SELECT tracking-id FROM tracking-table WHERE trackingId = 'uTEZlPEjHDjOUwBg' and 1=1--'
-- True → Welcome back

SELECT tracking-id FROM tracking-table WHERE trackingId = 'uTEZlPEjHDjOUwBg' and 1=0--'
-- False → sin Welcome back
```

Esta diferencia de comportamiento (aparece/no aparece "Welcome back") es la señal binaria que se usa para blind SQL injection — sin necesidad de ver el contenido de la consulta ni un error.

## Paso 2 — Confirmar que existe una tabla de usuarios

```sql
SELECT tracking-id FROM tracking-table WHERE trackingId = 'uTEZlPEjHDjOUwBg' and 1=1--'
```

> Nota: esta entrada del Notion original quedó incompleta en este punto — no incluye los payloads siguientes para extraer carácter por carácter el password del usuario `administrator` (típicamente con `SUBSTRING()` combinado con condiciones booleanas, iterando sobre cada posición del string). Queda pendiente completar los pasos restantes del lab.
