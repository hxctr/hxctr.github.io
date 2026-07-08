---
title: "Teoria path traversal"
date: 2026-05-18
category: "Path Traversal"
order: 1
tags: ["web-security-academy", "path-traversal", "theory"]
layout: layouts/writeup.njk
permalink: /writeups/path-traversal-teoria.html
---

## What is path traversal?

También conocido como directory traversal. Esta vulnerabilidad le permite a un atacante leer archivos arbitrarios en el servidor que está corriendo la aplicación. Esto podría incluir:

- Código de aplicación e información.
- Credenciales de sistemas backend.
- Archivos sensibles del sistema operativo.

En algunos casos el atacante podría ser capaz de escribir archivos arbitrarios en el servidor, permitiéndole modificar información de la aplicación o su comportamiento, y últimamente tomar control total del servidor.

---

## Reading arbitrary files via path traversal

Imaginá una app de compras que despliega imágenes de artículos para la venta:

```html
<img src="/loadImage?filename=218.png">
```

El endpoint `loadImage` toma un parámetro `filename` y retorna el contenido del archivo específico. Los archivos de imágenes son almacenados en disco en `/var/www/images/`. Para retornar una imagen, la aplicación le añade el filename solicitado a su directorio base y usa una API del sistema de archivos para leer el contenido. En otras palabras, la aplicación lee desde:

```
/var/www/images/218.png
```

Esta aplicación no implementa defensas contra ataques de path traversal. Como resultado, un atacante puede solicitar la siguiente URL para retornar el archivo `/etc/passwd` del sistema de archivos del servidor:

```
https://insecure-website.com/loadImage?filename=../../../etc/passwd
```

Esto causa que la aplicación lea desde:

```
/var/www/images/../../../etc/passwd
```

La secuencia `../` es válida dentro de una ruta de archivo, y significa subir un nivel en la estructura del directorio. Las tres secuencias consecutivas `../` sacan de `/var/www/images/` hasta la raíz del sistema de archivos, y así el archivo leído termina siendo `/etc/passwd`.

En sistemas basados en Unix, este es un archivo estándar que contiene detalles de los usuarios registrados en el servidor, pero un atacante podría retornar otros archivos arbitrarios usando la misma técnica.

En Windows, tanto `../` como `..\` son secuencias válidas de directory traversal:

```
https://insecure-website.com/loadImage?filename=..\..\..\windows\win.ini
```

---

## Common obstacles to exploiting path traversal vulnerabilities

Muchas aplicaciones que ponen entradas de usuario en rutas de archivos implementan defensas contra ataques de path traversal. Estas a menudo pueden ser bypaseadas:

- Usar una **ruta absoluta** desde la raíz del sistema de archivos, como `filename=/etc/passwd`, para referenciar directamente un archivo sin usar secuencias de traversal.
- Usar **secuencias transversales anidadas**, como `....//` o `....\/`. Estas se convierten en simples secuencias de recorrido cuando se elimina la secuencia interna (si el filtro no es recursivo).
- En rutas URL o en el parámetro `filename` de una petición `multipart/form-data`, los servidores web podrían eliminar secuencias de directory traversal antes de pasar el input a la aplicación. A veces se puede bypassear esta sanitización con **URL encoding**, o incluso **double URL encoding**: `../` se convierte en `%2e%2e%2f` y `%252e%252e%252f` respectivamente. Encodings no estándar como `..%c0%af` o `..%ef%bc%8f` también podrían funcionar.
- Si la app requiere que el filename comience con el directorio base esperado (ej. `/var/www/images`), se puede incluir ese prefijo seguido de una secuencia transversal: `filename=/var/www/images/../../../etc/passwd`.
- Si la app requiere que el filename termine con una extensión esperada (ej. `.png`), se puede usar un **null byte** para terminar la ruta antes de la extensión: `filename=../../../etc/passwd%00.png`.

---

## Siguientes pasos en un engagement real

Encontrar Path Traversal es solo el punto de partida. En un pentest real el objetivo es **escalar el impacto** usando los archivos que se pueden leer.

### 1. Mapear el sistema

```
/etc/os-release        ← distro y versión del SO
/proc/version           ← versión del kernel
/etc/hostname            ← nombre del host
/proc/self/environ       ← variables de entorno del proceso (puede contener credenciales)
```

### 2. Buscar credenciales

```
/etc/shadow                  ← hashes de contraseñas (requiere root para leerlo)
/home/usuario/.ssh/id_rsa    ← llave privada SSH del usuario
/home/usuario/.bash_history  ← comandos ejecutados anteriormente
```

Con una llave privada SSH se obtiene acceso directo al servidor por otra vía.

### 3. Leer configuración de la app

```
/var/www/html/config.php    ← credenciales de base de datos
/app/.env                    ← API keys, secrets
/etc/nginx/nginx.conf         ← configuración del servidor web
```

Las credenciales de DB abren acceso a todos los datos de usuarios de la aplicación.

### 4. Encadenar con otras vulnerabilidades

Path Traversal raramente es el fin, generalmente es el inicio de algo mayor:

<table>
<tr><td>Lo que lees</td><td>A dónde escala</td></tr>
<tr><td>Credenciales de DB</td><td>Acceso a datos sensibles de usuarios</td></tr>
<tr><td>Llave SSH privada</td><td>Shell en el servidor (acceso total)</td></tr>
<tr><td>API keys / secrets</td><td>Movimiento lateral a otros servicios</td></tr>
<tr><td>Logs del servidor</td><td>Posible escalada a RCE vía LFI</td></tr>
</table>

---

## ¿Se puede llegar a una shell reversa?

Directamente desde Path Traversal **no**, porque Path Traversal solo permite **leer** archivos, no escribir ni ejecutar nada.

Pero se puede llegar de forma **indirecta** si la vulnerabilidad es LFI (Local File Inclusion), que ocurre cuando el servidor **ejecuta** el archivo en lugar de solo servirlo.

### LFI to RCE — Log Poisoning

Si el servidor tiene LFI, se puede envenenar un log del servidor:

```
/var/log/apache2/access.log
/var/log/nginx/access.log
```

El log registra el User-Agent de cada request. Si se manda un request con:

```
User-Agent: <?php system($_GET['cmd']); ?>
```

Ese código queda escrito en el log. Luego, al incluir el log vía LFI, el servidor lo ejecuta — y desde ahí se lanza la reverse shell.

<table>
<tr><td>Tipo</td><td>¿Qué hace?</td><td>¿RCE posible?</td></tr>
<tr><td>Path Traversal puro</td><td>Solo sirve el archivo como datos</td><td>No directamente</td></tr>
<tr><td>LFI</td><td>Ejecuta el archivo incluido</td><td>Sí, vía log poisoning u otros métodos</td></tr>
</table>

En los labs de PortSwigger el endpoint sirve el archivo como imagen (Path Traversal puro), no lo ejecuta — por eso no hay camino directo a RCE desde esa vuln sola.

---

## ¿Necesito URL encoding o agregar extensión en engagements reales?

Depende del contexto. En un blackbox real hay que probar variantes porque no sabés qué filtros tiene la app.

### ¿Cuándo agregar extensión (.jpg, .png)?

Cuando la app **valida que el filename termine con una extensión esperada**. En ese caso se usa un null byte para truncar la extensión:

```
filename=../../../etc/passwd%00.jpg
```

El `%00` termina la cadena — la app ve `.jpg` al final y pasa la validación, pero el SO lee solo `../../../etc/passwd`. Ojo: esto funciona en stacks antiguos (PHP, C). Servidores modernos lo filtran.

### ¿Cuándo URL encodear?

Cuando la app bloquea `../` como string literal pero no valida los caracteres codificados:

```
%2e%2e%2f        ← ../ en URL encoding
%252e%252e%252f  ← ../ en doble URL encoding
..%c0%af         ← encoding no estándar
```

### Orden recomendado de prueba en blackbox

1. Payload limpio primero: `../../../etc/passwd`
2. Si lo bloquea, probar URL encoding: `%2e%2e%2f`
3. Si requiere extensión, agregar null byte: `../../../etc/passwd%00.jpg`
4. Si hay prefijo requerido, incluirlo: `/var/www/images/../../../etc/passwd`
5. Probar encodings no estándar y variantes anidadas: `....//`

---

## How to prevent a path traversal attack

La forma más efectiva de prevenir vulnerabilidades de path traversal es evitar pasar data brindada por el usuario a APIs del sistema de archivos. Muchas funciones de aplicaciones que hacen esto pueden ser reescritas para entregar el mismo comportamiento de forma más segura.

Si no se puede evitar pasar data de inputs del usuario a la API del sistema de archivos, se recomienda usar dos capas de defensa:

- **Validar las entradas del usuario** procesándolas antes. Idealmente, comparar la entrada con una lista blanca de caracteres permitidos. Si esto no es posible, verificar que la entrada contiene solo contenido permitido, como caracteres alfanuméricos.
- Luego de validar la entrada, **añadirla al directorio base y usar una API del sistema de archivos para canonizar la ruta**. Verificar que la ruta canonizada comienza con el directorio base esperado.

Ejemplo en Java:

```java
File file = new File(BASE_DIRECTORY, userInput);
if (file.getCanonicalPath().startsWith(BASE_DIRECTORY)) {
    // process file
}
```
