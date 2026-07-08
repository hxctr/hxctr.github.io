---
title: "Lab: Information disclosure on debug page"
date: 2026-06-18
category: "Information Disclosure"
order: 3
tags: ["web-security-academy", "information-disclosure", "lab"]
layout: layouts/writeup.njk
permalink: /writeups/information-disclosure-lab-debug-page.html
---

## Descripción

Lab de PortSwigger donde un comentario de desarrollador, deliberadamente dejado en el HTML de producción, revela la ruta de un script de debug (`phpinfo.php`). Acceder a esta página expone la salida completa de la función `phpinfo()` de PHP, que incluye, entre mucha otra información, una variable de entorno con una **clave secreta (`SECRET_KEY`)**. El objetivo del lab es encontrar esa clave y enviarla como solución.

---

## Reconocimiento

Petición normal a la página de un producto:

```
GET /product?productId=1 HTTP/2
```

Respuesta `200 OK` con el HTML renderizado del producto. Al inspeccionar el código fuente completo (no lo que se ve renderizado en el navegador, sino el HTML crudo vía Burp o "ver código fuente"), aparece al final del body un comentario que el navegador no muestra visualmente:

```html
<!-- <a href=/cgi-bin/phpinfo.php>Debug</a> -->
```

Esto es exactamente lo que la teoría describe como **developer comments**: código dejado en producción que el desarrollador probablemente usó durante el desarrollo y olvidó eliminar antes de desplegar.

---

## Intentos fallidos

### Intento 1: Forzar un error en `productId` (vector del lab anterior)

```
GET /product?productId=holamundo HTTP/2
```

Respuesta:

```
HTTP/2 400 Bad Request
Content-Type: application/json; charset=utf-8
Content-Length: 20

"Invalid product ID"
```

**¿Por qué no funcionó?** Porque este lab específico ya maneja correctamente las excepciones de conversión de tipos — devuelve un `400` genérico en JSON, sin stack trace ni detalles internos. Confirma que el vector de explotación de este lab es distinto al del lab "Information disclosure in error messages"; acá el vector correcto es el comentario de desarrollador encontrado en el reconocimiento.

---

## Bypass exitoso

### Acceder a la ruta de debug encontrada en el comentario

```
GET /cgi-bin/phpinfo.php HTTP/2
```

Respuesta: `200 OK` con la salida completa de `phpinfo()` — más de 70 KB de información de configuración del servidor PHP. Dentro de la sección **"Environment"**, aparece:

```
SECRET_KEY = vkmk0l9lqt0jgsuxu89vk75thghfdarp
```

**Solución enviada:** `vkmk0l9lqt0jgsuxu89vk75thghfdarp`

---

## Por qué funcionó

El comentario HTML (`<!-- <a href=/cgi-bin/phpinfo.php>Debug</a> -->`) no es visible al renderizar la página en un navegador normal, pero **sí viaja en el HTML crudo de la respuesta HTTP**. Cualquier herramienta que inspeccione el código fuente —Burp, "View Page Source", DevTools— lo expone sin problema. El comentario apuntaba directamente a un script de diagnóstico (`phpinfo.php`) que, en teoría, debía usarse solo durante desarrollo, pero quedó accesible públicamente en producción.

Al solicitar esa ruta, PHP ejecutó la función nativa `phpinfo()`, diseñada para mostrar exhaustivamente la configuración del entorno PHP. Esta función expone, entre otras cosas, **todas las variables de entorno del proceso**, incluyendo variables que la aplicación pudo haber definido para uso interno — en este caso, `SECRET_KEY`, una variable que nunca debió ser visible para un cliente externo.

---

## Error del desarrollador

Hubo dos errores combinados, uno de proceso y uno de configuración:

1. **No se eliminó el comentario de referencia a la herramienta de debug** antes de desplegar a producción. Esto es justo lo que la teoría señala como "fallo en remover contenido interno del contenido público".
2. **El script `phpinfo.php` se dejó accesible en el entorno de producción**, sin ningún control de acceso ni restricción de IP/entorno. `phpinfo()` es una herramienta legítima de diagnóstico, pero nunca debería estar expuesta públicamente en un sitio en vivo — su propósito es exclusivamente para desarrollo local o entornos controlados.

Como agravante adicional: la aplicación almacenó un secreto sensible (`SECRET_KEY`) como variable de entorno del sistema, sin considerar que cualquier mecanismo que exponga el entorno del proceso (como `phpinfo()`, pero también logs de errores, paneles de debug, etc.) filtraría ese secreto automáticamente.

---

## Mitigación

- Eliminar todo comentario de desarrollador, referencias a herramientas de debug, y cualquier contenido interno del HTML antes de desplegar a producción. Esto se puede automatizar como parte del pipeline de build/CI.
- Nunca dejar `phpinfo.php` (o cualquier script de diagnóstico equivalente) accesible en un entorno de producción. Si se necesita temporalmente, protegerlo con autenticación fuerte y eliminarlo inmediatamente después de su uso.
- No almacenar secretos sensibles (API keys, claves de cifrado, credenciales) como variables de entorno accesibles por cualquier proceso o función de diagnóstico del lenguaje. Usar en su lugar un gestor de secretos dedicado (Vault, AWS Secrets Manager, variables inyectadas solo en tiempo de ejecución con scope restringido).
- Auditar periódicamente el código fuente y la configuración del servidor en busca de archivos de debug, paneles administrativos, o endpoints de diagnóstico olvidados.

---

## Impacto

El impacto real depende de para qué se usa `SECRET_KEY` dentro de la aplicación, pero en términos generales, una clave secreta filtrada de esta forma puede tener consecuencias muy graves:

- Si se usa para firmar tokens de sesión, JWTs, o cookies, un atacante podría **forjar tokens válidos** y suplantar a cualquier usuario, incluyendo administradores.
- Si se usa para cifrar datos sensibles, el atacante podría **descifrar información protegida**.
- Si se usa como clave de API hacia servicios internos o de terceros, el atacante obtiene **acceso no autorizado a esos servicios**.

Más allá del secreto en sí, `phpinfo()` por sí sola ya es una mina de información para un atacante real, independientemente de si encuentra o no una variable como `SECRET_KEY`.

---

## Blackbox — ¿Para qué usaría esto un atacante real?

Desde una perspectiva de caja negra, encontrar una página `phpinfo()` expuesta es uno de los hallazgos más valiosos que se pueden tener en una fase de reconocimiento, porque concentra en un solo lugar información que normalmente tendrías que recolectar pieza por pieza. Algunos usos reales:

**Huella tecnológica exacta (fingerprinting).** La página revela la versión exacta de PHP (`7.4.3-4ubuntu2.29`), el sistema operativo y kernel (`Linux ... 4.14.355-281.714.amzn2.x86_64`), la versión de OpenSSL, la versión de libxml2, y decenas de otras librerías con sus versiones exactas. Cada una de estas es un punto de partida para buscar CVEs conocidos — el mismo patrón que en el lab anterior con Struts, pero aquí con todo un stack completo en lugar de un solo framework.

**Rutas absolutas del sistema de archivos.** Variables como `SCRIPT_FILENAME` (`/home/carlos/cgi-bin/phpinfo.php`), `HOME` (`/home/carlos`), y `PWD` revelan la estructura de directorios del servidor y el nombre del usuario del sistema (`carlos`). Esto es oro puro si más adelante se encuentra una vulnerabilidad de path traversal o LFI — ya se sabe exactamente qué rutas probar en vez de adivinar a ciegas.

**Variables de entorno con secretos.** Cualquier variable de entorno definida por la aplicación (claves de API, credenciales de base de datos, tokens internos) queda expuesta. Este es el riesgo más directo y de mayor impacto.

**Configuración de seguridad del propio PHP.** Directivas como `disable_functions`, `open_basedir`, `allow_url_include`, etc., le dicen a un atacante exactamente qué funciones peligrosas están bloqueadas y cuáles no — información clave si más adelante logra subir o inyectar código PHP (por ejemplo, combinado con una vulnerabilidad de file upload).

**Información de sesión y cookies.** Las directivas `session.*` revelan cómo se gestionan las sesiones (nombre de cookie `PHPSESSID`, si `cookie_secure` está activado — acá aparece en `0`, desactivado —, si usa `httponly`, etc.), información útil para evaluar si un ataque de session hijacking o fijación de sesión sería viable.

En resumen: en un pentest real, encontrar un `phpinfo.php` expuesto rara vez es "el hallazgo final" — es más bien el punto de partida que alimenta y dirige el resto de la fase de explotación.
