---
title: "TryHackMe: SQL Injection"
date: 2025-11-05
category: "TryHackMe"
order: 1
tags: ["tryhackme", "sql-injection"]
layout: layouts/writeup.njk
permalink: /writeups/thm-sql-injection.html
---

## In-Band SQL Injection

Es la más fácil de detectar y explotar. In-band se refiere a que el mismo método de comunicación es usado tanto para explotar la vulnerabilidad como para recibir los resultados — por ejemplo, descubrir una inyección SQL en la página de un sitio web, y luego ser capaz de extraer información de la base de datos desde esa misma página.

## Error-Based SQL Injection

Es la que más sirve para obtener información fácilmente acerca de una estructura de base de datos, ya que los mensajes de error de la base de datos son impresos directamente en el navegador. Puede usarse para enumerar la base de datos.

## Union-Based SQL Injection

Es la más común para extraer grandes cantidades de información a través de una vulnerabilidad de inyección SQL.

---

## Práctica

En SQL, el apóstrofe se usa para delimitar strings (cadenas de texto). Cuando escribís una consulta normal, se ve así:

```sql
SELECT * FROM article WHERE id = '1'
```

Los apóstrofes indican dónde empieza y termina el valor `'1'`. Ahora imaginá que el código del sitio web construye esta consulta así:

```sql
SELECT * FROM article WHERE id = 'LO_QUE_TU_ESCRIBAS'
```

Si escribís simplemente `1`, funciona bien. Pero si escribís `1'`, la consulta queda así:

```sql
SELECT * FROM article WHERE id = '1''
```

Ahora hay **tres apóstrofes** — el primero abre el string, el segundo lo cierra, y el tercero queda suelto sin pareja. Esto causa un **error de sintaxis** en SQL, y ese error confirma que el sitio es vulnerable.
