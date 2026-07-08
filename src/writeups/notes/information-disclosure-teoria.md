---
title: "Information Disclosure"
date: 2026-06-18
category: "Information Disclosure"
order: 1
tags: ["web-security-academy", "information-disclosure", "theory"]
layout: layouts/writeup.njk
permalink: /writeups/information-disclosure-teoria.html
---

> Fuente: [PortSwigger Web Security Academy](https://portswigger.net/web-security/information-disclosure)

## ¿Qué es Information Disclosure?

**Information disclosure**, también conocido como **information leakage** (filtración de información), ocurre cuando un sitio web revela involuntariamente información sensible a sus usuarios. Dependiendo del contexto, los sitios web pueden filtrar todo tipo de información a un potencial atacante, incluyendo:

- Datos de otros usuarios, como nombres de usuario o información financiera.
- Datos comerciales o empresariales sensibles.
- Detalles técnicos sobre el sitio web y su infraestructura.

Los peligros de filtrar datos sensibles de usuarios o empresas son bastante obvios, pero revelar información técnica puede ser igual de grave. Aunque parte de esta información puede tener un uso limitado, puede convertirse en el punto de partida para exponer una superficie de ataque adicional que contenga otras vulnerabilidades. El conocimiento que se obtiene puede incluso proporcionar la pieza que faltaba del puzzle al intentar construir ataques complejos de alta severidad.

En ocasiones, información sensible puede ser filtrada descuidadamente a usuarios que simplemente navegan el sitio de manera normal. Sin embargo, más comúnmente, un atacante necesita provocar la divulgación de información interactuando con el sitio web de formas inesperadas o maliciosas, y luego estudiar cuidadosamente las respuestas del sitio para identificar comportamientos interesantes.

---

## Ejemplos de Information Disclosure

- Revelar nombres de directorios ocultos, su estructura y contenido a través de un archivo `robots.txt` o un listado de directorios (directory listing).
- Proporcionar acceso a archivos de código fuente a través de backups temporales.
- Mencionar explícitamente nombres de tablas o columnas de bases de datos en mensajes de error.
- Exponer innecesariamente información altamente sensible, como datos de tarjetas de crédito.
- Incrustar en el código fuente (hard-coding) claves de API, direcciones IP, credenciales de bases de datos, etc.
- Insinuar la existencia o ausencia de recursos, nombres de usuario, etc., a través de diferencias sutiles en el comportamiento de la aplicación.

---

## ¿Cómo surgen las vulnerabilidades de Information Disclosure?

- **Fallo al eliminar contenido interno del contenido público.** Por ejemplo, los comentarios de desarrolladores en el markup a veces son visibles para los usuarios en el entorno de producción.
- **Configuración insegura del sitio web y tecnologías relacionadas.** Por ejemplo, no deshabilitar las funciones de depuración y diagnóstico puede proporcionar a los atacantes herramientas útiles para obtener información sensible. Las configuraciones por defecto también pueden dejar sitios web vulnerables, mostrando mensajes de error excesivamente verbosos.
- **Diseño y comportamiento defectuoso de la aplicación.** Por ejemplo, si un sitio web devuelve respuestas distintas cuando ocurren diferentes estados de error, esto también puede permitir a los atacantes enumerar datos sensibles, como credenciales de usuario válidas.

---

## Impacto de las vulnerabilidades de Information Disclosure

Las vulnerabilidades de information disclosure pueden tener un impacto directo e indirecto dependiendo del propósito del sitio web y, por tanto, de la información que un atacante pueda obtener. En algunos casos, el simple hecho de revelar información sensible puede tener un alto impacto; por ejemplo, una tienda online que filtra los datos de tarjetas de crédito de sus clientes tendrá consecuencias graves.

Por otro lado, filtrar información técnica —como la estructura de directorios o qué frameworks de terceros se utilizan— puede tener poco o ningún impacto directo. Sin embargo, en las manos equivocadas, esto podría ser la información clave necesaria para construir cualquier número de otros exploits.

### Cómo evaluar la severidad

Aunque el impacto final puede ser muy grave, solo en circunstancias específicas la information disclosure es un problema de alta severidad por sí sola. Durante las pruebas, la divulgación de información técnica en particular solo es de interés si se puede demostrar cómo un atacante podría hacer algo dañino con ella.

Por ejemplo, saber que un sitio web usa una versión particular de un framework tiene un uso limitado si esa versión está completamente parcheada. Sin embargo, esta información se vuelve significativa cuando el sitio web usa una versión antigua que contiene una vulnerabilidad conocida — en ese caso, realizar un ataque devastador podría ser tan simple como aplicar un exploit documentado públicamente.

El enfoque principal debe estar en el impacto y la explotabilidad de la información filtrada, no solo en la presencia de information disclosure como problema aislado. La excepción obvia es cuando la información filtrada es tan sensible que justifica atención por sí misma.

---

## Cómo probar vulnerabilidades de Information Disclosure

En términos generales, es importante no desarrollar "visión de túnel" durante las pruebas — evitar enfocarse demasiado en una vulnerabilidad particular. Los datos sensibles pueden filtrarse en todo tipo de lugares. Una habilidad clave es reconocer información interesante en cualquier momento y lugar en que aparezca.

### Fuzzing

Si se identifican parámetros interesantes, se puede intentar enviar tipos de datos inesperados y strings de fuzz especialmente diseñados para ver qué efecto producen. Aunque las respuestas a veces revelan información interesante explícitamente, también pueden indicar el comportamiento de la aplicación de forma más sutil — por ejemplo, una ligera diferencia en el tiempo de procesamiento. Incluso si el contenido de un mensaje de error no revela nada, a veces el hecho de que se produjo un caso de error en lugar de otro es información útil en sí misma.

Se puede automatizar gran parte de este proceso con herramientas como **Burp Intruder**:

- Agregar posiciones de payload a parámetros y usar wordlists preconstruidas de fuzz strings.
- Identificar fácilmente diferencias en las respuestas comparando códigos de estado HTTP, tiempos de respuesta, longitudes, etc.
- Usar reglas de grep matching para identificar rápidamente ocurrencias de palabras clave como `error`, `invalid`, `SELECT`, `SQL`, etc.
- Aplicar reglas de grep extraction para extraer y comparar el contenido de elementos interesantes dentro de las respuestas.

También se puede usar la extensión **Logger++** del BApp Store para registrar requests y responses de todas las herramientas de Burp con filtros avanzados.

### Using Burp Scanner

Los usuarios de Burp Suite Professional tienen el beneficio de **Burp Scanner**, que marca automáticamente muchas vulnerabilidades de information disclosure — claves privadas, direcciones de correo, números de tarjetas de crédito, archivos de backup, directory listings, etc.

### Using Burp's Engagement Tools

Se accede desde el menú contextual: clic derecho en cualquier mensaje HTTP → "Engagement tools".

- **Search:** busca cualquier expresión dentro del ítem seleccionado, con opciones de regex o búsqueda negativa.
- **Find comments:** extrae rápidamente cualquier comentario de desarrollador encontrado.
- **Discover content:** identifica contenido y funcionalidad adicionales que no están vinculados desde el contenido visible del sitio.

### Engineering Informative Responses

Los mensajes de error verbosos a veces revelan información interesante durante el flujo normal de pruebas. Estudiando cómo cambian los mensajes de error según el input, se puede ir más lejos — manipular el sitio web para extraer datos arbitrarios a través de un mensaje de error. Un ejemplo común es hacer que la lógica de la aplicación intente una acción inválida sobre un ítem de datos específico.

---

## Fuentes comunes de Information Disclosure

### Files for Web Crawlers

Muchos sitios web proporcionan archivos en `/robots.txt` y `/sitemap.xml` para ayudar a los crawlers a navegar el sitio. Entre otras cosas, estos archivos suelen listar directorios específicos que los crawlers deben omitir, por ejemplo porque pueden contener información sensible. Como estos archivos no suelen estar vinculados desde dentro del sitio, vale la pena intentar navegar manualmente a `/robots.txt` o `/sitemap.xml`.

### Directory Listings

Los servidores web pueden configurarse para listar automáticamente el contenido de directorios que no tienen una página de índice. Esto puede ayudar a un atacante a identificar rápidamente los recursos en una ruta determinada. Los directory listings en sí mismos no son necesariamente una vulnerabilidad de seguridad, pero si el sitio web también falla en implementar controles de acceso adecuados, filtrar la existencia y ubicación de recursos sensibles de esta manera es claramente un problema.

### Developer Comments

Durante el desarrollo, a veces se añaden comentarios HTML inline al markup. Estos comentarios suelen eliminarse antes de que los cambios se desplieguen a producción, pero a veces se olvidan o se dejan deliberadamente. Aunque no son visibles en la página renderizada, se puede acceder a ellos fácilmente usando Burp o las herramientas de desarrollo del navegador.

### Error Messages

Una de las causas más comunes de information disclosure son los mensajes de error verbosos. El contenido de los mensajes de error puede revelar información sobre qué input o tipo de dato se espera de un parámetro determinado, y también puede nombrar explícitamente un template engine, tipo de base de datos o servidor que usa el sitio, junto con su número de versión — información útil para buscar exploits documentados para esa versión.

### Debugging Data

Muchos sitios web generan mensajes de error y logs personalizados con gran cantidad de información sobre el comportamiento de la aplicación. Los mensajes de debug pueden contener información vital para desarrollar un ataque, incluyendo valores de variables de sesión, nombres de host y credenciales de componentes backend, nombres de archivos y directorios en el servidor, y claves usadas para cifrar datos transmitidos vía el cliente.

### User Account Pages

La página de perfil o cuenta de un usuario suele contener información sensible como email o clave de API. Algunos sitios web contienen fallos de lógica que potencialmente permiten a un atacante aprovechar estas páginas para ver los datos de otros usuarios — por ejemplo, un sitio que determina qué página cargar basándose en un parámetro `user` (`GET /user/personal-info?user=carlos`) donde la lógica para obtener y renderizar un dato individual no verifica que el parámetro coincida con el usuario autenticado. Este tipo de vulnerabilidades se relacionan con **access control** e **IDOR** (Insecure Direct Object References).

### Source Code Disclosure via Backup Files

Obtener acceso al código fuente facilita enormemente que un atacante entienda el comportamiento de la aplicación. Los datos sensibles a veces incluso están hard-coded dentro del código fuente. Los editores de texto suelen generar archivos de backup temporales (con `~` al final o una extensión distinta) mientras el archivo original está siendo editado — solicitar un archivo de código usando esa extensión de backup puede a veces permitir leer el contenido en lugar de que se ejecute.

### Information Disclosure due to Insecure Configuration

Los sitios web a veces son vulnerables como resultado de una configuración incorrecta, especialmente por el uso de tecnologías de terceros mal entendidas, u opciones de debugging olvidadas en producción. Por ejemplo, el método HTTP `TRACE` está diseñado para diagnóstico — si está habilitado, el servidor hace eco de la solicitud exacta recibida, lo que ocasionalmente filtra headers internos de autenticación añadidos por reverse proxies.

### Version Control History

Prácticamente todos los sitios web se desarrollan usando algún sistema de control de versiones como **Git**, que por defecto almacena sus datos en una carpeta `.git`. Ocasionalmente los sitios exponen este directorio en producción, accesible navegando a `/.git`. Descargar el directorio completo y abrirlo con Git local da acceso al historial de commits, permitiendo leer fragmentos de código y encontrar datos sensibles hard-coded en líneas modificadas.

---

## Cómo prevenir vulnerabilidades de Information Disclosure

- Asegurarse de que todos los involucrados en producir el sitio web sean plenamente conscientes de qué información se considera sensible.
- Auditar cualquier código para detectar posibles information disclosures como parte de los procesos de QA o build — por ejemplo, automatizar la eliminación de comentarios de desarrolladores.
- Usar mensajes de error genéricos tanto como sea posible.
- Verificar que cualquier función o característica de depuración y diagnóstico esté deshabilitada en producción.
- Entender completamente los ajustes de configuración y las implicaciones de seguridad de cualquier tecnología de terceros implementada.
