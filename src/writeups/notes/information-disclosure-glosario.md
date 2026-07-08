---
title: "Glosario Information Disclosure"
date: 2026-06-18
category: "Information Disclosure"
order: 4
tags: ["web-security-academy", "information-disclosure", "glosario"]
layout: layouts/writeup.njk
permalink: /writeups/information-disclosure-glosario.html
---

## NumberFormatException

Excepción nativa de **Java** que se lanza cuando se intenta convertir un `String` a un tipo numérico (como `int` o `double`) usando métodos como `Integer.parseInt()`, pero el string no representa un número válido. Si no se captura con `try/catch`, el error se propaga y puede revelar un stack trace completo en la respuesta HTTP, exponiendo lenguaje, librerías y versión del framework (information disclosure).

## Stack trace

Reporte detallado que muestra la secuencia de llamadas a métodos/funciones que estaban activas en el momento en que ocurrió un error o excepción. Es muy útil para depuración en desarrollo, pero si se expone en producción es una fuente común de **information disclosure**, ya que revela rutas de clases internas, lenguaje de programación, librerías usadas y, en ocasiones, versiones exactas de frameworks.

## Apache Struts

Framework de desarrollo web de código abierto para aplicaciones Java EE. Ha tenido múltiples CVEs críticos de **ejecución remota de código (RCE)**, principalmente por vulnerabilidades de **OGNL injection** en versiones antiguas. La versión `2.3.31` corresponde a una rama vulnerable; identificarla en un mensaje de error suele ser el primer paso para localizar exploits públicos documentados.
