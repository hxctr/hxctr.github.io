---
title: "Lab: Information disclosure in error messages"
date: 2026-06-18
category: "Information Disclosure"
order: 2
tags: ["web-security-academy", "information-disclosure", "lab"]
layout: layouts/writeup.njk
permalink: /writeups/information-disclosure-lab-error-messages.html
---

## Descripción

Lab de PortSwigger donde una página de producto (`/product?productId=X`) es vulnerable a **information disclosure a través de mensajes de error verbosos**. El objetivo es provocar un error en el servidor que revele información técnica sobre el stack tecnológico — específicamente, la versión exacta del framework que utiliza el backend — y enviarla como solución del lab.

---

## Reconocimiento

Solicitud normal a un producto existente:

```
GET /product?productId=1 HTTP/2
```

Respuesta: `200 OK`, contenido normal del producto. Sin nada interesante.

---

## Intentos fallidos

### Intento 1: ID de producto inexistente

```
GET /product?productId=150 HTTP/2
```

Respuesta:

```
HTTP/2 404 Not Found
Content-Type: application/json; charset=utf-8
Content-Length: 11

"Not Found"
```

**¿Por qué no funcionó?** Porque `150` sigue siendo un input **válido en cuanto a tipo de dato** (un número entero). La aplicación maneja correctamente este caso: simplemente no encuentra el producto y devuelve un 404 genérico en JSON, sin información adicional.

---

## Bypass exitoso

### Enviar un tipo de dato inesperado en el parámetro

```
GET /product?productId=testing HTTP/2
```

Respuesta:

```
HTTP/2 500 Internal Server Error
Content-Length: 1689

Internal Server Error: java.lang.NumberFormatException: For input string: "testing"
	at java.base/java.lang.NumberFormatException.forInputString(NumberFormatException.java:67)
	at java.base/java.lang.Integer.parseInt(Integer.java:661)
	at java.base/java.lang.Integer.parseInt(Integer.java:777)
	at lab.a.mm.v.o.h(Unknown Source)
	...
Apache Struts 2 2.3.31
```

**Solución enviada:** `Apache Struts 2 2.3.31`

---

## Por qué funcionó

El parámetro `productId` esperaba un valor numérico (un `int`). Al enviar el string `"testing"`, el backend intentó convertirlo a entero usando `Integer.parseInt()`, lo cual lanzó una excepción **`NumberFormatException`** no controlada.

Como la aplicación no capturó esta excepción, el servidor devolvió el **stack trace completo** en la respuesta HTTP con código `500`. Esta respuesta verbosa reveló:

- **Lenguaje y plataforma:** Java (`java.base`, `java.lang.Integer`).
- **Tipo de dato esperado:** entero (confirmado por la excepción específica `NumberFormatException`).
- **Framework y versión exacta:** `Apache Struts 2 2.3.31`, visible al final del stack trace.

Esta versión de Struts corresponde a una rama vulnerable a CVEs conocidos de ejecución remota de código (el mismo framework involucrado en el incidente de Equifax 2017). Con esa información, un atacante real podría buscar exploits públicos documentados para esa versión específica y escalar el ataque a RCE.

---

## Error del desarrollador

El desarrollador no implementó manejo de excepciones (`try/catch`) alrededor de la conversión del parámetro `productId` a entero. Esto permitió que un error no controlado se propagara hasta el cliente con todo el detalle interno de la aplicación.

### A nivel de código, ¿qué pasó exactamente?

```java
String productId = request.getParameter("productId");
int id = Integer.parseInt(productId); // <-- aquí explota
Product product = productRepository.findById(id);
```

`Integer.parseInt()` solo sabe hacer dos cosas: devolver un `int` válido, o lanzar `NumberFormatException` si el string no es numérico. El desarrollador asumió que `productId` siempre llegaría como un número (confiando en que el frontend lo validaría), y nunca contempló el caso en que un atacante interactúa directamente con el endpoint sin pasar por el frontend. Como no hay un `try/catch` alrededor de esa línea, la excepción sube sin control hasta el framework (Struts), que construye una página de error que incluye el stack trace completo — incluyendo, al final, la versión del propio framework.

En resumen, dos fallos combinados:

1. **Falta de validación de input:** nunca se verificó que `productId` fuera numérico antes de intentar convertirlo.
2. **Falta de manejo de excepciones:** ni siquiera como red de seguridad se capturó el error para evitar que los detalles internos llegaran al cliente.

### ¿Cómo se remedia?

**1. Validar el input antes de usarlo:**

```java
String productId = request.getParameter("productId");
if (!productId.matches("\\d+")) {
    return genericErrorResponse("Invalid product ID");
}
int id = Integer.parseInt(productId);
```

**2. Envolver la conversión en try/catch como segunda capa de defensa:**

```java
try {
    int id = Integer.parseInt(productId);
    Product product = productRepository.findById(id);
} catch (NumberFormatException e) {
    log.warn("Invalid productId received: {}", productId); // log interno, detallado
    return genericErrorResponse("Invalid product ID");        // respuesta genérica al cliente
}
```

**3. Configurar el framework para no mostrar páginas de error de desarrollo en producción.** En Struts específicamente, esto significa deshabilitar `struts.devMode` (debe estar en `false` en producción), y configurar manejo de excepciones global (`<global-exception-mappings>`) que redirija cualquier excepción no controlada a una página de error genérica.

La idea clave: el detalle técnico completo (stack trace, tipo de excepción, nombres de clases) debe ir únicamente al log interno del servidor, nunca al cliente. El cliente solo debe ver un mensaje genérico y, opcionalmente, un código de referencia para que soporte pueda buscar el error real en los logs.

---

## Mitigación

- Implementar manejo de excepciones explícito alrededor de cualquier conversión de tipos derivada de input del usuario (`try/catch`).
- Nunca exponer stack traces, mensajes de excepción nativos, o detalles de implementación en respuestas HTTP de producción.
- Usar mensajes de error genéricos y consistentes para el usuario final, registrando el detalle completo únicamente en logs internos del servidor.
- Configurar el entorno de producción para deshabilitar el modo debug/desarrollo del framework.
- Mantener los frameworks actualizados — más allá del information disclosure, esta versión específica de Struts es vulnerable a RCE conocido.

---

## Impacto

Aunque el lab en sí solo pide identificar la versión del framework, el impacto real de este hallazgo es alto: revelar `Apache Struts 2 2.3.31` le da a un atacante la pieza exacta que necesita para buscar un exploit público documentado (CVEs de deserialización/OGNL injection en Struts 2) y potencialmente lograr **ejecución remota de comandos** en el servidor. Es un claro ejemplo de cómo information disclosure de bajo impacto aparente puede convertirse en la llave para un ataque de alta severidad.

---

## Cómo identificarlo en blackbox

Desde una perspectiva de caja negra, el comportamiento observable fue:

- Input válido (`productId=1`, `productId=150`) → respuestas controladas (200 o 404 JSON limpio).
- Input de tipo incorrecto (`productId=testing`) → error 500 con stack trace completo.

Esta diferencia de comportamiento ante distintos tipos de input es la señal clave a buscar durante fuzzing: cualquier parámetro numérico merece ser probado con strings, valores negativos, decimales, arrays, etc., para ver si el manejo de excepciones está bien implementado.
