---
title: "File upload teoria"
date: 2026-06-06
category: "File Upload"
order: 1
tags: ["web-security-academy", "file-upload", "theory"]
layout: layouts/writeup.njk
permalink: /writeups/file-upload-teoria.html
---

## ¿Qué son las vulnerabilidades de File Upload?

Las vulnerabilidades de file upload ocurren cuando un servidor web permite a los usuarios subir archivos a su sistema de archivos sin validar correctamente cosas como el nombre, tipo, contenido o tamaño del archivo. No aplicar restricciones adecuadas puede significar que incluso una función simple de subida de imágenes pueda ser usada para subir archivos arbitrarios y potencialmente peligrosos — incluyendo scripts del lado del servidor que permiten Remote Code Execution (RCE).

En algunos casos, el simple acto de subir el archivo ya es suficiente para causar daño. Otros ataques requieren un HTTP request adicional hacia el archivo, típicamente para disparar su ejecución en el servidor.

---

## Impacto

El impacto depende de dos factores clave:

- Qué aspecto del archivo no se valida correctamente (tamaño, tipo, contenido).
- Qué restricciones se aplican al archivo una vez subido exitosamente.

**Peor escenario:** el tipo de archivo no se valida y el servidor está configurado para ejecutar archivos como `.php` o `.jsp` como código. Un atacante puede subir una **web shell** y obtener control total del servidor.

Otros impactos posibles:

- Si el `filename` no se valida, un atacante puede **sobreescribir archivos críticos** subiendo un archivo con el mismo nombre.
- Si el servidor también es vulnerable a Path Traversal, el atacante puede subir archivos en ubicaciones no esperadas.
- Si no se valida el tamaño, puede habilitarse un ataque de **Denial of Service (DoS)** llenando el disco del servidor.

---

## ¿Cómo surgen estas vulnerabilidades?

Es raro encontrar sitios sin ninguna restricción. Lo más común es que los desarrolladores implementen validaciones que parecen robustas pero que son defectuosas o fácilmente bypasseables:

- Intentan hacer blacklist de extensiones peligrosas pero no cubren todas las variantes.
- Verifican el tipo de archivo con propiedades que un atacante puede manipular fácilmente con Burp.
- Aplican validaciones de forma inconsistente en diferentes directorios del servidor.

---

## ¿Cómo maneja el servidor los archivos estáticos?

El servidor parsea la extensión del archivo en el request para determinar su tipo, comparándola contra una lista de mappings entre extensiones y MIME types. Lo que ocurre después depende del tipo:

- **Archivo no ejecutable** (imagen, HTML estático) → el servidor envía el contenido al cliente directamente.
- **Archivo ejecutable** (`.php`) **y** el servidor está configurado para ejecutarlo → el servidor lo ejecuta y envía el output.
- **Archivo ejecutable** pero el servidor **no** está configurado para ejecutarlo → generalmente retorna un error, aunque a veces sirve el contenido como texto plano (lo que puede filtrar código fuente).

> El header `Content-Type` en la respuesta puede dar pistas sobre cómo el servidor interpreta el archivo.

---

## Web Shell — Concepto clave

Una **web shell** es un script malicioso que permite a un atacante ejecutar comandos arbitrarios en un servidor web remoto simplemente enviando HTTP requests al endpoint donde fue subida.

Si se logra subir una web shell, se tiene control total del servidor: leer y escribir archivos, exfiltrar datos, usar el servidor como pivot para atacar infraestructura interna u otros servidores.

**Web shell básica en PHP — solo lectura de archivos:**

```php
<?php echo file_get_contents('/path/to/target/file'); ?>
```

**Web shell versátil — ejecución de comandos:**

```php
<?php echo system($_GET['command']); ?>
```

Uso:

```
GET /uploads/exploit.php?command=id HTTP/1.1
```

---

## Explotando validaciones defectuosas

### 1. Validación defectuosa del tipo de archivo (Content-Type)

Cuando se sube un archivo con un formulario HTML, el browser envía un request `multipart/form-data` que incluye un header `Content-Type` por cada archivo:

```
Content-Disposition: form-data; name="image"; filename="exploit.php"
Content-Type: image/jpeg
```

Algunos servidores solo verifican que el `Content-Type` sea `image/jpeg` o `image/png`, sin verificar que el contenido real del archivo sea efectivamente una imagen. Con Burp Repeater se puede cambiar el `Content-Type` a `image/jpeg` mientras se sube un `.php` — el servidor acepta el archivo pensando que es una imagen.

### 2. Ejecución de scripts en directorios accesibles

El campo `filename` en requests `multipart/form-data` determina dónde se guarda el archivo. Si se combina esto con Path Traversal se puede intentar subir el archivo a otra ubicación.

### 3. Blacklist insuficiente de extensiones peligrosas

Hacer blacklist de `.php` es insuficiente porque hay extensiones alternativas que también son ejecutables:

```
.php5, .php7, .phtml, .shtml, .phar
```

**Overriding server configuration:** en servidores Apache, se puede subir un archivo `.htaccess` para sobrescribir la configuración del directorio y mapear una extensión custom como ejecutable:

```
AddType application/x-httpd-php .jpg
```

Con esto, cualquier `.jpg` en ese directorio se ejecutaría como PHP. En IIS se puede usar `web.config` de forma similar.

**Obfuscación de extensiones:**

<table>
<tr><td>Técnica</td><td>Ejemplo</td></tr>
<tr><td>Case sensitivity</td><td><code>exploit.pHp</code></td></tr>
<tr><td>Múltiples extensiones</td><td><code>exploit.php.jpg</code></td></tr>
<tr><td>Trailing characters</td><td><code>exploit.php.</code></td></tr>
<tr><td>URL encoding del punto</td><td><code>exploit%2Ephp</code></td></tr>
<tr><td>Null byte</td><td><code>exploit.asp%00.jpg</code></td></tr>
<tr><td>Caracteres unicode multibyte</td><td><code>exploit.pHp</code> con bytes especiales</td></tr>
<tr><td>Extensión anidada</td><td><code>exploit.p.phphp</code> → al eliminar <code>.php</code> queda <code>exploit.p.php</code></td></tr>
</table>

### 4. Validación defectuosa del contenido del archivo

Servidores más seguros verifican propiedades intrínsecas del archivo — como las dimensiones de una imagen o los **magic bytes** del header.

Los **magic bytes** son una secuencia de bytes al inicio del archivo que identifican su tipo. Por ejemplo, los archivos JPEG siempre empiezan con `FF D8 FF`.

Sin embargo, con herramientas como **ExifTool** es posible crear un archivo **polyglot** — un archivo que es simultáneamente una imagen JPEG válida y contiene código PHP malicioso en sus metadatos.

### 5. Race Conditions en file upload

Algunos frameworks modernos suben el archivo primero a un directorio temporal, lo validan, y solo entonces lo mueven a su destino final.

Sin embargo, algunos desarrolladores implementan su propio procesamiento. En ese caso pueden existir race conditions: el archivo se sube directamente al filesystem, se elimina si no pasa validación (antivirus, etc.), y **durante esos milisegundos el archivo existe y puede ser ejecutado**.

**Race conditions en uploads basados en URL:** si el servidor descarga un archivo desde una URL para procesarlo, también puede ser vulnerable. Si el nombre del directorio temporal se genera con funciones pseudo-aleatorias como `uniqid()` de PHP, puede ser brute-forceado. Para extender la ventana de tiempo, se puede subir un archivo más grande o con padding al final para que el procesamiento tome más tiempo.

---

## Explotando file upload sin RCE

### Subir scripts maliciosos del lado del cliente

Si no se puede ejecutar scripts en el servidor, aún se puede usar para **XSS almacenado**. Si se pueden subir archivos HTML o SVG con tags `<script>`, cualquier usuario que visite la página donde aparece el archivo ejecutará el script.

> Esto solo funciona si el archivo se sirve desde el mismo origen donde fue subido — por restricciones de Same-Origin Policy.

### Explotar vulnerabilidades en el parsing de archivos

Si el servidor parsea archivos XML (como `.doc` o `.xls` de Microsoft Office), puede ser un vector para ataques de **XXE injection**.

---

## Subir archivos usando PUT

Algunos servidores soportan el método HTTP `PUT`, lo que puede permitir subir archivos maliciosos aunque no haya una función de upload visible en la interfaz:

```
PUT /images/exploit.php HTTP/1.1
Host: vulnerable-website.com
Content-Type: application/x-httpd-php

<?php echo file_get_contents('/etc/passwd'); ?>
```

> Se puede enviar un request `OPTIONS` a diferentes endpoints para ver cuáles anuncian soporte para el método `PUT`.

---

## Cómo prevenir vulnerabilidades de File Upload

- Usar **whitelist** de extensiones permitidas en lugar de blacklist de extensiones prohibidas — es más fácil definir lo que sí se permite que adivinar todo lo que un atacante podría intentar.
- Verificar que el `filename` no contenga substrings que puedan interpretarse como secuencias de traversal (`../`).
- **Renombrar** los archivos subidos para evitar colisiones y sobreescritura de archivos existentes.
- No mover el archivo a su destino permanente hasta que haya sido completamente validado.
- Usar frameworks establecidos para el procesamiento de file uploads en lugar de escribir validaciones propias.

---

## File Upload en diferentes servidores web

La vulnerabilidad de file upload no es exclusiva de Apache — todos los servidores web son potencialmente vulnerables. Lo que varía es el vector de ataque y el lenguaje ejecutado.

**El problema universal es el mismo:** si el servidor acepta archivos sin validación y los sirve desde una ruta pública accesible, hay riesgo de RCE.

<table>
<tr><td>Servidor</td><td>Lenguaje ejecutado</td><td>Vector típico</td></tr>
<tr><td>Apache + mod_php</td><td>PHP</td><td><code>.php</code>, <code>.htaccess</code> para reconfigurar el directorio</td></tr>
<tr><td>IIS (Windows)</td><td>ASP, ASPX</td><td><code>.asp</code>, <code>.aspx</code>, <code>web.config</code> para reconfigurar</td></tr>
<tr><td>Nginx + PHP-FPM</td><td>PHP</td><td><code>.php</code> directo — sin <code>.htaccess</code>, pero si acepta <code>.php</code> ya hay RCE</td></tr>
<tr><td>Tomcat</td><td>JSP</td><td><code>.jsp</code>, <code>.jspx</code></td></tr>
<tr><td>Node.js</td><td>JS del servidor</td><td>Depende de la implementación</td></tr>
<tr><td>LiteSpeed</td><td>PHP (compatible Apache)</td><td><code>.htaccess</code> igual que Apache</td></tr>
</table>

### ¿Por qué Apache es especialmente peligroso en este contexto?

Apache tiene el vector adicional de `.htaccess` — un archivo de configuración por directorio que el servidor lee automáticamente. Esto permite reconfigurar el comportamiento del servidor desde adentro, aunque haya restricciones en el directorio. Si el servidor bloquea `.php` pero acepta `.htaccess`, el atacante puede hacer que `.jpg` se ejecute como PHP.

**Nginx es el más seguro** en este aspecto porque no tiene equivalente a `.htaccess` — su configuración solo puede modificarse en archivos del servidor, no por directorio. Un atacante no puede reconfigurar Nginx subiendo archivos.

### Equivalente de `.htaccess` en otros servidores

- **Apache / LiteSpeed:** `.htaccess`
- **IIS:** `web.config` — archivo XML por directorio. Si se puede subir, permite ejecutar código ASP/ASPX de forma similar.
- **Nginx:** no tiene equivalente — configuración centralizada únicamente.

---

## Referencia

[PortSwigger — File upload vulnerabilities](https://portswigger.net/web-security/file-upload)
