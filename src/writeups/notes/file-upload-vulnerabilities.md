---
title: "File upload vulnerabilities"
date: 2026-06-06
category: "File Upload"
order: 2
tags: ["web-security-academy", "file-upload", "theory"]
layout: layouts/writeup.njk
permalink: /writeups/file-upload-vulnerabilities.html
---

## What are file upload vulnerabilities?

Es cuando un servidor le permite a los usuarios subir archivos a su sistema de archivos sin validar suficientemente cosas como su nombre, tipo, contenido o tamaño. Fallar en reforzar restricciones apropiadas podría significar que la función de subir una imagen básica pueda ser usada para subir archivos arbitrarios potencialmente peligrosos. Esto podría incluir scripts server-side que habiliten ejecución de código remoto.

En algunos casos, la acción de subir el archivo por sí sola es suficiente para causar daño. Otros ataques podrían involucrar un seguimiento con una petición HTTP hacia el archivo, usualmente desencadenando su ejecución por el servidor.

---

## What is the impact of file upload vulnerabilities?

El impacto generalmente depende de dos factores clave:

- Qué parte del archivo el sitio web no valida adecuadamente (tamaño, tipo, contenido, etc.)
- Qué restricciones son impuestas en el archivo una vez que este es subido satisfactoriamente.

En el peor escenario, el tipo de archivo no es validado correctamente, y la configuración del servidor permite que ciertos tipos de archivos, tales como `.php` o `.jsp`, sean ejecutados como código. En este caso, un atacante podría potencialmente subir un archivo de código del lado del servidor que funcione como una web shell, permitiéndole control total del servidor.

---

## How do web servers handle requests for static files?

Es importante saber cómo los servidores manejan las peticiones para archivos estáticos.

Históricamente, los sitios consistían casi enteramente de archivos estáticos que se servían a los usuarios cuando eran solicitados. Como resultado, la ruta de cada petición podía mapearse 1:1 con la jerarquía de directorios y archivos en el sistema de archivos del servidor. Hoy en día, los sitios web son cada vez más dinámicos y la ruta de una petición a menudo no tiene relación directa con el sistema de archivos. No obstante, los servidores web siguen sirviendo peticiones por algunos archivos estáticos, incluyendo stylesheets, imágenes, etc.

El proceso para manejar archivos estáticos sigue siendo el mismo. En algún punto, el servidor parsea la ruta en la petición para identificar la extensión del archivo. Luego usa esto para determinar el tipo de archivo solicitado, usualmente comparándolo con una lista preconfigurada que mapea extensiones a MIME types. Lo que pasa después depende del tipo de archivo y la configuración del servidor:

- Si el tipo de archivo no es ejecutable (una imagen, un HTML estático), el servidor solo envía el contenido del archivo al cliente en una respuesta HTTP.
- Si el tipo de archivo es ejecutable (un archivo PHP) y el servidor está configurado para ejecutar archivos de este tipo, asignará variables basadas en los encabezados y parámetros de la petición HTTP y correrá el script. El output resultante se envía al cliente en la respuesta.
- Si el tipo de archivo es ejecutable, pero el servidor **no** está configurado para ejecutar archivos de ese tipo, generalmente responderá con un error. Sin embargo, en algunos casos, el contenido del archivo podría servirse al cliente como texto plano — esta mala configuración puede ser explotada ocasionalmente para filtrar código fuente y otra información sensible.

> **Tip:** el header de respuesta `Content-Type` puede dar pistas sobre qué tipo de archivo el servidor piensa que está sirviendo. Si este encabezado no ha sido explícitamente configurado por el código de la aplicación, normalmente contendrá el resultado del mapping MIME por tipo de archivo.

---

## Exploiting unrestricted file uploads to deploy a web shell

> **Web Shell:** una web shell es un script malicioso que le permite a un atacante ejecutar comandos arbitrarios en un servidor web remoto simplemente al enviar peticiones HTTP al endpoint correcto.

Si se logra subir exitosamente una web shell, se tiene control total del servidor. Esto significa que se pueden leer y escribir archivos arbitrarios, exfiltrar data sensible, e incluso usar el servidor para pivotear ataques contra infraestructura interna u otros servidores fuera de la red. Por ejemplo, la siguiente línea PHP podría usarse para leer archivos arbitrarios del sistema de archivos:

```php
<?php echo file_get_contents('/path/to/target/file'); ?>
```

Una vez subido, enviar la petición por este archivo malicioso retornará el contenido del archivo objetivo en la respuesta.
