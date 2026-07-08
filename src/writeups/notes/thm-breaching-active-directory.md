---
title: "TryHackMe: Breaching Active Directory"
date: 2025-11-17
category: "TryHackMe"
order: 3
tags: ["tryhackme", "active-directory", "ntlm"]
layout: layouts/writeup.njk
permalink: /writeups/thm-breaching-active-directory.html
---

## Introduction to AD Breaches

## NTLM Authenticated Services

### NTLM and NetNTLM

New Technology LAN Manager (NTLM) es una suite de protocolos de seguridad usada para autenticar usuarios identificados en el AD. NTLM puede usarse para autenticación mediante un esquema de challenge-response llamado **NetNTLM**. Este mecanismo es usado ampliamente por servicios en una red. Sin embargo, los servicios que usan NetNTLM también pueden estar expuestos a internet. Algunos ejemplos populares:

- Servicios internos de intercambio de correo/host que exponen un Outlook Web App (OWA).
- Remote Desktop Protocol (RDP) de un servidor expuesto a internet.
- Endpoints VPN expuestos que fueron integrados con AD.
- Aplicaciones web frente a internet que hacen uso de NetNTLM.

NetNTLM, también conocido como autenticación de Windows o autenticación NTLM, permite que la aplicación haga de intermediario entre el cliente y el AD. Todo el material de autenticación es reenviado a un Domain Controller en forma de challenge, y si se completa exitosamente, la aplicación autentica al usuario.

Esto significa que la aplicación está autenticando al usuario de forma indirecta, no directamente en la aplicación. Esto evita que la aplicación tenga que almacenar credenciales de AD, las cuales deberían almacenarse únicamente en un Domain Controller.

### Brute-force Login Attacks

Estos servicios brindan una excelente ubicación para probar credenciales descubiertas por otras vías. Sin embargo, también pueden ser usados directamente para intentar recuperar un conjunto inicial de credenciales válidas de AD — se podría intentar un ataque de fuerza bruta si se recuperó información válida, como emails, durante la fase de reconocimiento.

Dado que los entornos AD tienen bloqueo de cuentas configurado, no se debe correr un ataque de fuerza bruta completo. En su lugar, se necesita realizar un **password spraying attack**. En lugar de intentar múltiples contraseñas contra un usuario (lo cual dispararía el bloqueo de cuenta), se escoge una sola contraseña y se prueba contra todos los usuarios adquiridos. Es importante destacar que estos intentos fallidos también serán detectados.
