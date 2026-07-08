---
title: "Lab: Stored XSS into anchor href attribute with double quotes HTML-encoded"
date: 2026-04-25
category: "XSS"
order: 3
tags: ["web-security-academy", "xss", "lab"]
layout: layouts/writeup.njk
permalink: /writeups/xss-lab-stored-anchor-href-encoded.html
---

This lab contains a stored cross-site scripting vulnerability in the comment functionality. To solve this lab, submit a comment that calls the `alert` function when the comment author name is clicked.

## El contexto del lab

El sitio tiene una sección de comentarios con tres campos: **nombre**, **email** y **website**. El objetivo es ejecutar un `alert(1)` explotando un XSS almacenado.

---

## Lo que intenté y por qué no funcionó

### Intento 1 — Inyectar tags en el campo "nombre"

Payload probado:

```html
<button onclick="alert(1)">Testing</button>
<p onclick="alert('hola')">Presióname</p>
<a href="#" onclick="alert(1);">Google Chrome</a>
```

Cómo quedó en el código fuente:

```html
<a id="author" href="testing.com">
  &lt;button onclick=&quot;alert(1)&quot;&gt;Testing&lt;/button&gt;
</a>
```

**Por qué falló:** el input del campo nombre cae en el **contenido de texto** entre tags, no en un atributo. Los `< >` y `"` están codificados, por lo que todo se renderiza como texto plano. El navegador nunca lo interpreta como HTML ejecutable.

### Intento 2 — Intentar escapar el atributo href con comillas

Payload probado:

```
"test
```

Cómo quedó en el código fuente:

```html
<a id="author" href="sfasd.com">&quot;test</a>
```

**Por qué falló:** las comillas `"` también están codificadas (`&quot;`), así que no es posible escapar del atributo `href` para inyectar eventos como `onmouseover`.

---

## Análisis del contexto

Mirando el código fuente con un input normal:

```html
<a id="author" href="website.com">nombre</a>
```

Esto confirma dos cosas:

<table>
<tr><td>Campo</td><td>Contexto</td><td>Restricciones</td></tr>
<tr><td>Nombre</td><td>Texto entre tags</td><td><code>&lt; &gt;</code> codificados → solo texto plano</td></tr>
<tr><td>Website</td><td>Valor del atributo <code>href</code></td><td><code>"</code> codificadas → no se puede escapar el atributo</td></tr>
</table>

---

## Lo que funcionó y por qué

### Payload correcto

```
javascript:alert(1)
```

### Cómo quedó en el código fuente

```html
<a id="author" href="javascript:alert(1)">nombre</a>
```

### Por qué funcionó

No necesita `< >` ni `"`. Es tratado como una **URL válida** por el navegador, y al hacer click se ejecuta el código JS.

---

## ¿Cómo funciona `javascript:`?

Es un protocolo especial que los navegadores soportan en los `href`, igual que otros protocolos:

<table>
<tr><td>Protocolo</td><td>Acción</td></tr>
<tr><td><code>https://</code></td><td>Carga una página web</td></tr>
<tr><td><code>mailto:</code></td><td>Abre el cliente de correo</td></tr>
<tr><td><code>ftp://</code></td><td>Accede a un servidor FTP</td></tr>
<tr><td><code>javascript:</code></td><td>Ejecuta código JavaScript directamente</td></tr>
</table>

Al hacer click en el link, en lugar de navegar a una URL, el navegador ejecuta el código que viene después de los dos puntos.

---

## Por qué `onmouseover` no era una opción en el href

`onmouseover` necesita estar dentro de un tag HTML:

```html
<tag onmouseover="alert(1)">
```

En el `href` solo controlás el **valor de la URL**, no podés crear ni modificar tags. Por eso `javascript:` es la única opción en ese contexto.

---

## ¿Por qué el sitio codifica `< > " '`?

Es la defensa principal contra XSS y se llama **output encoding**. Consiste en convertir caracteres peligrosos en su versión inofensiva antes de mostrarlos en pantalla:

<table>
<tr><td>Carácter</td><td>Codificado</td></tr>
<tr><td><code>&lt;</code></td><td><code>&amp;lt;</code></td></tr>
<tr><td><code>&gt;</code></td><td><code>&amp;gt;</code></td></tr>
<tr><td><code>"</code></td><td><code>&amp;quot;</code></td></tr>
<tr><td><code>'</code></td><td><code>&amp;apos;</code></td></tr>
</table>

Un sitio bien desarrollado **siempre** debería aplicar esto a cualquier input del usuario. El problema ocurre cuando esa codificación no se aplica en **todos los contextos**. En este lab, el campo `website` codificaba correctamente los caracteres, pero no validaba que el valor fuera una URL legítima, permitiendo que `javascript:` pasara sin problemas.

---

## ¿Cómo se aplica el encoding? ¿Cómo se corrige?

No se hace con `if` manuales uno por uno. Los frameworks y lenguajes ya tienen funciones que lo resuelven solas.

**En Python:**

```python
from html import escape
escape('<script>alert(1)</script>')
# Devuelve: '&lt;script&gt;alert(1)&lt;/script&gt;'
```

Los frameworks modernos como React, Django o Laravel lo aplican **automáticamente** al renderizar. El problema ocurre cuando el desarrollador bypasea esa protección sin darse cuenta.

### Si usan React

```javascript
// ❌ Vulnerable - bypasea el encoding automático
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ Seguro - React codifica automáticamente
<div>{ userInput }</div>
```

**Por qué:** `dangerouslySetInnerHTML` inserta el HTML tal cual, sin codificar nada. En cambio, al usar `{ userInput }` directamente, React convierte cualquier `<` o `>` en su versión codificada antes de mostrarlo.

### Si usan JavaScript puro

```javascript
// ❌ Vulnerable
document.getElementById('nombre').innerHTML = userInput

// ✅ Seguro - solo inserta texto, nunca HTML
document.getElementById('nombre').textContent = userInput
```

**Por qué:** `innerHTML` interpreta el contenido como HTML real, permitiendo que un `<script>` se ejecute. `textContent` lo trata como texto plano, así que `<script>` aparece como texto en pantalla, no se ejecuta.

### Para el caso del href

```javascript
// ❌ Vulnerable - acepta javascript:alert(1)
<a href={ userInput }>click</a>

// ✅ Seguro - valida que sea una URL real
if (userInput.startsWith('https://') || userInput.startsWith('http://')) {
  <a href={ userInput }>click</a>
}
```

**Por qué:** el problema aquí no era que faltara encoding, sino que no se validaba el **tipo de valor**. `javascript:` no contiene caracteres peligrosos como `< > "`, por eso el encoding no lo detiene. La solución es validar que el valor sea una URL real antes de usarlo.

---

## Regla general aprendida

> Siempre identificá en qué contexto cae tu input antes de elegir el payload.

<table>
<tr><td>Contexto</td><td>Estrategia</td></tr>
<tr><td>Texto entre tags con <code>&lt; &gt;</code> codificados</td><td>Sin opción directa, buscar otro campo</td></tr>
<tr><td>Atributo con <code>"</code> codificadas pero es <code>href</code></td><td>Usar <code>javascript:alert(1)</code></td></tr>
<tr><td>Atributo con <code>"</code> no codificadas</td><td>Escapar con <code>"</code> y usar eventos (<code>onmouseover</code>, <code>onclick</code>)</td></tr>
<tr><td>Atributo <code>href</code> sin restricciones</td><td>Usar <code>javascript:alert(1)</code> o escapar con <code>"</code></td></tr>
</table>
