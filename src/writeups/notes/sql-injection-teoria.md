---
title: "SQL Injection"
date: 2025-11-02
category: "SQL Injection"
order: 1
tags: ["web-security-academy", "sql-injection", "theory"]
layout: layouts/writeup.njk
permalink: /writeups/sql-injection-teoria.html
---

## What is SQL injection?

Es una vulnerabilidad web que le permite a un atacante interferir con las consultas que una aplicación hace a la base de datos. Permite ver data que normalmente no es visible.

En algunas situaciones un atacante puede escalar un ataque de inyección SQL para comprometer el servidor o infraestructura del backend. También se pueden realizar ataques de denegación de servicio.

---

## What is the impact of SQL injection?

Puede resultar en acceso no autorizado a información tal como:

- Contraseñas.
- Tarjetas de crédito.
- Información personal.

---

## Detecting SQL injection vulnerabilities

Se puede hacer una inyección SQL manual, usando un conjunto de pruebas contra un input en la aplicación:

- Enviar el carácter `'` y ver errores o anomalías.
- Algunas sintaxis SQL que evalúan el valor base de un punto de entrada, y para un diferente valor, ver diferencias sistemáticas en la respuesta de la aplicación.
- Condiciones booleanas tales como `OR 1=1` y `OR 1=2`, y ver diferencias en las respuestas.
- Payloads diseñados para generar retrasos de tiempo cuando se ejecutan dentro de una consulta SQL, y ver diferencias en el tiempo que toma responder.
- OAST payloads diseñados para generar interacción fuera de banda de redes cuando se ejecuta una consulta SQL, y monitorear cualquier interacción resultante.

También se puede usar el Burp Scanner.

### SQL injection in different parts of the query

La mayoría de inyecciones SQL ocurren en la cláusula `WHERE` de una consulta `SELECT`. Pero pueden ocurrir en cualquier parte de una consulta SQL:

- En declaraciones `UPDATE`, dentro del valor updated o en la cláusula `WHERE`.
- En declaraciones `INSERT`, dentro del valor insertado.
- En declaraciones `SELECT`, dentro del nombre de tablas o columnas.
- En declaraciones `SELECT`, dentro de la cláusula `ORDER BY`.

---

## Examples of SQL injection

Hay distintos tipos de inyección SQL:

- **Retorno oculto de información**, donde se modifica una consulta SQL para retornar resultados adicionales.
- **Alterar la lógica de la aplicación**, donde se cambia una consulta para interferir en la lógica de la aplicación.
- **Ataques de UNION**, donde se retorna data de diferentes tablas de la base de datos.
- **Blind SQL injection**, donde el resultado de una consulta que controlás no es retornado en la respuesta de la aplicación.

### Retrieving hidden data

Imaginemos una app que despliega productos de distintas categorías. Cuando un usuario da click en la categoría **Gifts**, su navegador solicita:

```
https://insecure-website.com/products?category=Gifts
```

Esto hace que la aplicación haga una consulta SQL:

```sql
SELECT * FROM products WHERE category = 'Gifts' AND released = 1
```

Esta consulta le pide a la base de datos que retorne todos los detalles de la tabla `products` donde la categoría es `Gifts` y `released` es igual a `1` (asumiendo que hay productos no lanzados con `released = 0`).

Si la app no implementa ninguna defensa, un atacante puede construir:

```
https://insecure-website.com/products?category=Gifts'--
```

Lo cual resulta en:

```sql
SELECT * FROM products WHERE category = 'Gifts'--' AND released = 1
```

El `--` le indica que el resto de la consulta sea ignorada. Como resultado, la consulta ya no incluye el `AND released = 1`, y se muestran todo tipo de productos (lanzados y no lanzados).

Se puede usar un ataque similar para desplegar todos los productos de cualquier categoría, incluyendo categorías desconocidas:

```
https://insecure-website.com/products?category=Gifts'+OR+1=1--
```

```sql
SELECT * FROM products WHERE category = 'Gifts' OR 1=1--' AND released = 1
```

La consulta modificada retorna todos los ítems donde la categoría es `Gifts`, o `1=1`. Como `1=1` es siempre verdadero, la consulta retorna todos los ítems.

<table>
<tr><td>Fila con</td><td>category = 'Gifts'</td><td>1=1</td><td>¿Se muestra?</td></tr>
<tr><td>Gifts</td><td>Verdadero</td><td>Sí</td><td>Sí</td></tr>
<tr><td>Electronics</td><td>Falso</td><td>Sí</td><td>Sí</td></tr>
<tr><td>Ropa</td><td>Falso</td><td>Sí</td><td>Sí</td></tr>
</table>

### Subverting application logic

Imaginemos una app de login: se envía el usuario `wiener` y la contraseña `bluecheese`, y la aplicación revisa las credenciales con:

```sql
SELECT * FROM users WHERE username = 'wiener' AND password = 'bluecheese'
```

Si retorna la data del usuario, el login es exitoso. Un atacante se puede loguear con cualquier usuario sin necesidad de la contraseña, usando `--` para remover el check de la contraseña de la cláusula `WHERE`. Enviando el username `administrator'--` y una contraseña en blanco:

```sql
SELECT * FROM users WHERE username = 'administrator'--' AND password = ''
```

Esta consulta retorna el usuario cuyo `username` es `administrator` y loguea exitosamente al atacante como ese usuario.

### Retrieving data from other database tables

Se puede usar la palabra clave `UNION` para ejecutar una consulta `SELECT` adicional y anexar el resultado a la consulta original. Si la aplicación ejecuta:

```sql
SELECT name, description FROM products WHERE category = 'Gifts'
```

Un atacante podría enviar:

```sql
' UNION SELECT username, password FROM users--
```

Esto hace que la aplicación retorne todos los usernames y contraseñas junto con los nombres y descripción de los productos.

### Blind SQL injection vulnerabilities

Muchas instancias de inyección SQL son vulnerabilidades ciegas — la DB no retorna ninguna información o error. Técnicas para explotarlas:

- Cambiar la lógica de la app para generar una diferencia notable en la respuesta del servidor (inyectar una nueva condición booleana, o condicionalmente generar un error como dividir entre cero).
- Generar condicionalmente un time delay en el proceso de la query.
- Usar técnicas de OAST.

### Second-order SQL injection

**First-order SQL injection** ocurre cuando la aplicación procesa la entrada del usuario de una solicitud HTTP y la incorpora en una consulta SQL de forma insegura, inmediatamente.

**Second-order SQL injection** (también conocida como stored SQL injection) ocurre cuando la aplicación toma la entrada del usuario y la almacena para uso futuro (usualmente en una base de datos), sin que ocurra ninguna vulnerabilidad en ese punto. Luego, al manejar una petición HTTP diferente, la aplicación retorna la información almacenada y la incorpora en una consulta SQL de forma insegura.

Esto ocurre a menudo en situaciones donde los desarrolladores están atentos a inyecciones SQL, y manejan seguramente la ubicación inicial del input. Cuando la información es procesada después, se considera segura porque estaba previamente almacenada — pero en ese punto se maneja de forma insegura, porque el desarrollador asumió erróneamente que ya estaba sanitizada.

---

## Examining the database

Para explotar vulnerabilidades de SQL injection, es necesario encontrar información acerca de la base de datos: el tipo y versión, y las tablas y columnas que contiene.

### Querying the database type and version

<table>
<tr><td>Database type</td><td>Query</td></tr>
<tr><td>Microsoft, MySQL</td><td><code>SELECT @@version</code></td></tr>
<tr><td>Oracle</td><td><code>SELECT * FROM v$version</code></td></tr>
<tr><td>PostgreSQL</td><td><code>SELECT version()</code></td></tr>
</table>

También se puede saber qué tablas y columnas existen, para la mayoría de bases de datos con:

```sql
SELECT * FROM information_schema.tables
```

### SQL injection in different contexts

En los labs se suele usar una consulta string para inyectar el payload SQL, pero se puede realizar usando cualquier input manejable que sea procesado como consulta SQL — por ejemplo, sitios que toman entrada en JSON o XML.

Estos formatos pueden brindar formas de ofuscar ataques bloqueados por WAFs u otros mecanismos de defensa. Implementaciones débiles a menudo buscan keywords de SQL injection comunes dentro de la petición, así que se puede bypassear codificando o escapando caracteres en las palabras clave prohibidas. Por ejemplo, la siguiente inyección basada en XML usa secuencia de escape XML para codificar el carácter `s` en `SELECT`:

```xml
<stockCheck>
    <productId>123</productId>
    <storeId>999 &#x53;ELECT * FROM information_schema.tables</storeId>
</stockCheck>
```

Esto se decodifica del lado del servidor antes de pasar por el intérprete SQL.

---

## UNION attacks

Cuando la aplicación es vulnerable a SQL injection y los resultados de la consulta son retornados dentro de la respuesta, se puede usar la palabra clave `UNION` para retornar información desde otras tablas de la base de datos — un ataque de SQL injection UNION.

`UNION` permite ejecutar una o más consultas `SELECT` y añadir los resultados a la consulta original:

```sql
SELECT a, b FROM table1 UNION SELECT c, d FROM table2
```

- Las consultas individuales deben retornar el mismo número de columnas.
- Los tipos de dato en cada columna deben ser compatibles entre las consultas individuales.

### Determining the number of columns required

**Método 1 — `ORDER BY`:** inyectar una serie de cláusulas `ORDER BY` incrementando el índice de la columna hasta que ocurra un error:

```sql
' ORDER BY 1--
' ORDER BY 2--
' ORDER BY 3--
```

Cuando el índice excede el número de columnas actuales, la base de datos retorna un error como *"The ORDER BY position number 3 is out of range"*.

**Método 2 — `UNION SELECT` con NULLs:**

```sql
' UNION SELECT NULL--
' UNION SELECT NULL,NULL--
' UNION SELECT NULL,NULL,NULL--
```

Si el número de nulls no hace match con el número de columnas, la base de datos retorna un error como *"All queries combined using a UNION... must have an equal number of expressions"*. Se usa `NULL` porque los tipos de dato en cada columna deben ser compatibles entre la consulta original y la inyectada, y `NULL` es compatible con cualquier tipo.
