---
title: "Cross-Site Scripting (XSS)"
date: 2026-04-13
category: "XSS"
order: 1
tags: ["web-security-academy", "xss", "theory"]
layout: layouts/writeup.njk
permalink: /writeups/xss-cross-site-scripting.html
---

## What is XSS

Se le conoce también como XSS, es una vulnerabilidad que le permite a un atacante comprometer la interacción que un usuario tiene con una aplicación vulnerable. Le permite a un atacante eludir la política **same origin** (regla del navegador que impide que un sitio web acceda a datos de otro sitio diferente), la cual está diseñada para segregar distintos sitios entre sí.

Vulnerabilidades XSS suelen permitir a un atacante suplantar la identidad de un usuario víctima, realizar cualquier acción que dicho usuario pueda llevar a cabo y acceder a cualquiera de sus datos. Si el usuario víctima tiene acceso con privilegios dentro de la aplicación, el atacante podría llegar a obtener el control total sobre todas las funciones y los datos de la aplicación.

---

## How does XSS work?

Esto funciona al manipular un sitio web vulnerable de forma que retorne JavaScript malicioso a usuarios. Cuando el código malicioso se ejecuta dentro del navegador de la víctima, el atacante puede comprometer totalmente sus interacciones con la aplicación.

---

## Impact of XSS vulnerabilities

Depende de la naturaleza de la aplicación, su funcionalidad e información, y el estado del usuario comprometido. Por ejemplo:

- En una landing page, donde los usuarios son anónimos y toda la información es pública, el impacto es a menudo mínimo.
- En una app con información sensible, tal como transacciones bancarias, emails o info de salud, el impacto usualmente será serio.
- Si el usuario comprometido tiene privilegios elevados, el impacto será crítico, permitiéndole al atacante tomar control total de la app y comprometer toda la data del usuario.

---

## XSS proof of concept

Se puede testear al ingresar un payload que haga que el navegador ejecute algún JavaScript arbitrario. Comúnmente se usa `alert()`, porque no hace daño y es silencioso en general.

Sin embargo, en las versiones nuevas de Chrome ya no se permite el uso de `alert()` en ciertos contextos; en su lugar se recomienda `print()`.

---

## What are the types of XSS attacks?

Existen tres tipos:

- **Reflected XSS**, donde el script malicioso proviene de la petición HTTP actual.
- **Stored XSS**, donde el script malicioso viene de la base de datos.
- **DOM-based XSS**, donde la vulnerabilidad existe en código client-side en lugar de código server-side.

---

## How to find and test for XSS vulnerabilities

Se trata de testear todos los inputs posibles que encontremos en un sitio web.

DOM-based XSS que surge de parámetros URL involucra un proceso similar: colocar algunos inputs simples en el parámetro, usando las herramientas de desarrollador del navegador para buscar el DOM para este input y testear cada ubicación para determinar si es explotable. Otros tipos de DOM XSS son más difíciles de detectar. Para encontrar vulnerabilidades basadas en DOM en inputs no URL (como `document.cookie`) o en sinks no basados en HTML (como `setTimeout`), no hay sustituto para revisar el código JavaScript.

---

## Content Security Policy

Es el mecanismo del navegador que ayuda a eliminar el impacto de XSS y algunas otras vulnerabilidades. Si una aplicación que utiliza CSP presenta un comportamiento similar al de un ataque XSS, la CSP podría dificultar o impedir el aprovechamiento de la vulnerabilidad. A menudo es posible eludir la CSP para permitir el aprovechamiento de la vulnerabilidad subyacente.

---

## Reflected XSS

### What is reflected cross-site scripting?

Surge cuando una aplicación recibe data en una petición HTTP e incluye esa data en la respuesta inmediata sin sanitizarla de forma segura.

Supongamos que un sitio web tiene una función de búsqueda que recibe un término de búsqueda del usuario en el parámetro de la URL:

```
https://insecure-website.com/search?term=gift
```

Si asumimos que la aplicación no realiza ningún otro proceso a la data, un atacante puede construir un ataque como el siguiente:

```
https://insecure-website.com/search?term=<script>/*+Bad+stuff+here...+*/</script>
```

La URL resulta en la siguiente respuesta:

```html
<p>You searched for: <script>/* Bad stuff here... */</script></p>
```

### Impact of reflected XSS attacks

Si un atacante puede crear un script que controla el navegador de la víctima, puede:

- Realizar cualquier acción dentro de la aplicación que el usuario podría hacer también.
- Ver información que el usuario es capaz de ver.
- Modificar cualquier información que el usuario es capaz de modificar.
- Iniciar interacciones con otras aplicaciones de usuario, incluyendo ataques maliciosos que parecerán originarse desde el usuario inicial.

Hay muchas formas de engañar al usuario: poner links en un sitio web controlado por el atacante, en otro sitio que permita contenido generado, o enviar un link por correo o mensaje. Puede ser un ataque dirigido o no.

### Reflected XSS in different contexts

La ubicación de la data reflejada dentro de la respuesta de la aplicación determina el tipo de payload requerido para explotarla, y además podría afectar el impacto de la vulnerabilidad.

También, si la app realiza alguna validación en la data enviada antes de que sea reflejada, esto generalmente afectará el tipo de payload que será necesario.

### How to find and test for reflected XSS vulnerabilities

Manualmente, encontrar este tipo de XSS involucra:

- **Testear cada punto.** Revisar parámetros u otra data dentro del string de la consulta URL y el cuerpo del mensaje, y la ruta de la URL. Incluye encabezados HTTP, aunque el comportamiento generado a través de encabezados HTTP podría no ser explotable en la práctica.
- **Enviar valores alfanuméricos aleatorios.** Enviar un valor y ver si es reflejado en la respuesta. Un valor random alfanumérico de alrededor de 8 caracteres es normalmente ideal.
- **Determinar el contexto de la reflexión.** Para cada ubicación donde el valor random es reflejado, determinar su contexto (texto entre etiquetas HTML, dentro de un atributo, dentro de un string JavaScript, etc.).
- **Probar un payload candidato.** Con base en la reflexión, un test inicial desencadenará una ejecución JavaScript si es reflejado sin modificar dentro de la respuesta.
- **Probar payloads alternativos.** Si el payload candidato fue modificado o bloqueado por la aplicación, usar técnicas alternativas según el contexto y el tipo de validación de entrada.
- **Testear el ataque en el navegador.** Si se encuentra un payload que funcione con el Repeater de Burp Suite, transferir el ataque a un navegador real.

---

## Stored XSS

### What is stored cross-site scripting?

Se le conoce como XSS de segundo orden o persistente. Surge cuando una aplicación recibe información de fuentes no confiables e incluye esa data dentro de su próxima respuesta HTTP de forma insegura.

Supongamos que un sitio web permite a los usuarios enviar comentarios en posts de un blog, los cuales son mostrados a otros usuarios:

```
POST /post/comment HTTP/1.1
Host: vulnerable-website.com
Content-Length: 100

postId=3&comment=This+post+was+extremely+helpful.&name=Carlos+Montoya&email=carlos%40normal-user.net
```

Luego de que este comentario ha sido subido, cualquier usuario que visite el blog recibirá la siguiente respuesta en la aplicación:

```html
<p>This post was extremely helpful.</p>
```

Si asumimos que la página no realiza ninguna validación, un atacante puede enviar un comentario malicioso como el siguiente:

```html
<script>/* Bad stuff here... */</script>
```

Entonces cualquier usuario que visite el blog recibirá el script del atacante en la respuesta, y este se ejecutará en su navegador.

### Impact of stored XSS attacks

Si un atacante puede controlar un script que se ejecuta en el navegador de la víctima, puede comprometer totalmente al usuario. La diferencia principal con reflected XSS es que **no se necesita ingeniería social** para explotar stored XSS — el atacante solo deja su payload en el sitio web y espera a que los usuarios caigan solos.

### How to find and test for stored XSS vulnerabilities

Manualmente, se deben revisar todos los puntos de entrada, ubicando los enlaces entre entrada y salida: dónde sea que la data enviada a un punto de entrada es emitida desde un punto de salida.

---

## DOM-Based XSS

### What is DOM-based cross-site scripting?

Surge cuando JavaScript toma data de una fuente controlable por el atacante, tal como una URL, y la pasa a un sink que soporta ejecución de código dinámico, como `eval()` o `innerHTML`. Esto le permite a los atacantes ejecutar JS malicioso, típicamente permitiéndoles secuestrar cuentas de otros usuarios.

Para entregar ataques basados en DOM XSS, necesitas poner data en una fuente de manera que se propague hacia un sink y cause la ejecución de JavaScript arbitrario.

La fuente más común de DOM XSS es la URL, típicamente accedida con el objeto `window.location`. Un atacante puede construir un link para enviar a una víctima a una página vulnerable con un payload en el string de la consulta o en fragmentos de la URL.

### How to test for DOM-based cross-site scripting

Generalmente se necesita usar un navegador con developer tools, como Chrome.

**Testing HTML sinks:** colocar un string alfanumérico random en un source (como `location.search`), luego usar las developer tools para inspeccionar el HTML y encontrar dónde aparece tu string. La opción "View source" del navegador no funciona para pruebas DOM XSS porque no toma en cuenta cambios realizados por JS en el HTML.

Para cada ubicación donde tu string aparece dentro del DOM, identificás el contexto y afinás tu entrada según cómo es procesada. Nota: los navegadores manejan URL-encoding de forma distinta (Chrome, Safari y Firefox codifican `location.search`, mientras que Internet Explorer y Edge no).

**Testing JavaScript execution sinks:** es más difícil porque tu input no necesariamente aparece en el DOM. Necesitás usar el JS debugger para determinar si tu entrada llega a un sink y cómo. Se pone un breakpoint donde el source es leído y se sigue el flujo hasta encontrar si termina en un sink peligroso.
