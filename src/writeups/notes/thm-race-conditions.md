---
title: "TryHackMe: Race Conditions"
date: 2025-07-08
category: "TryHackMe"
order: 4
tags: ["tryhackme", "race-conditions"]
layout: layouts/writeup.njk
permalink: /writeups/thm-race-conditions.html
---

## Introduction

Si nos asignan probar la seguridad de una app web, podríamos intentar pagar con una gift card de $10 un monto de $100, o aplicar el mismo descuento múltiples veces. Si una app web es susceptible a race conditions, se puede lograr todo esto.

**Race condition** es una vulnerabilidad en donde el tiempo influencia el comportamiento del programa. Pasa cuando una variable es accedida y modificada por múltiples hilos. Debido a la falta de mecanismos de bloqueo y sincronización entre diferentes hilos, un atacante podría abusar del sistema y aplicar un descuento múltiples veces.

---

## Multi-Threading

### Programs

Un programa es un conjunto de instrucciones para alcanzar una tarea específica. Si no se ejecuta, no hace nada — solo actúa si lo corremos. Pensemos en una receta de café: si nadie sigue los pasos, nunca hay café. De la misma forma, un código en Flask que muestra "Hola mundo" en HTML no hace nada si nadie lo ejecuta.

### Processes

Un **process** es un **program** en ejecución. Un programa es estático; un proceso es dinámico. Algunos valores clave:

- **Program:** el código ejecutable relacionado al proceso.
- **Memory:** almacenamiento temporal de información.
- **State:** un proceso pasa por diferentes estados (ej. "Waiting" cuando espera un evento de I/O).

Si corremos el código de Flask, se inicia un proceso que escucha conexiones en el puerto 8080 — pasará mucho tiempo en estado "Waiting". Desde la perspectiva del servidor, la app sirve clientes secuencialmente: las peticiones se procesan una a la vez.

```bash
$ flask run --without-threads --host=0.0.0.0
 * Debug mode: off
WARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
 * Running on http://192.168.0.104:5000
Press CTRL+C to quit
127.0.0.1 - - [16/Apr/2024 23:34:46] "GET / HTTP/1.1" 200 -
127.0.0.1 - - [16/Apr/2024 23:34:48] "GET / HTTP/1.1" 200 -
```

### Threads

Pensemos en una máquina de espresso comercial con dos portafiltros: si un cliente pide un espresso, se usa el primer portafiltro; si otro cliente pide otro, se usa el segundo. En esta analogía:

- La máquina es el **proceso** — está encendida y lista para trabajar.
- Cada portafiltro representa un **hilo** — tareas que pueden ejecutarse en paralelo dentro del mismo proceso.
- Cada orden de espresso es como una tarea o instrucción que debe ejecutarse.

Un hilo es una unidad ligera de ejecución. Comparte partes de memoria e instrucciones con el proceso. Para replicar el mismo proceso repetidamente (por ejemplo, un servidor web sirviendo miles de usuarios), se pueden adoptar los siguientes enfoques:

- **Serial:** un proceso corre y sirve un usuario tras otro secuencialmente. Nuevos usuarios son encolados.
- **Parallel:** un proceso corre y crea un hilo para cada nuevo usuario. Los nuevos usuarios solo se encolan después de alcanzar el número máximo de hilos.

La app de Flask anterior puede correr con 4 hilos usando **Gunicorn** — un Python WSGI HTTP Server (WSGI = Web Server Gateway Interface, el puente entre Python y servidores web). Gunicorn puede generar múltiples procesos trabajadores para manejar peticiones entrantes simultáneamente. Con `--workers=4` se especifican cuatro trabajadores listos para recibir peticiones, y `--threads` indica cuántos hilos puede generar cada proceso trabajador.

```bash
gunicorn --workers=4 --threads=2 -b 0.0.0.0:8080 app:app
[2024-04-16 23:35:59 +0300] [507149] [INFO] Starting gunicorn 21.2.0
[2024-04-16 23:35:59 +0300] [507149] [INFO] Listening at: http://0.0.0.0:8080 (507149)
[2024-04-16 23:35:59 +0300] [507149] [INFO] Using worker: gthread
[2024-04-16 23:35:59 +0300] [507150] [INFO] Booting worker with pid: 507150
```

Vale la pena notar:

- Es imposible ejecutar más de una copia de este proceso, ya que se vincula al puerto TCP 8080. Un puerto TCP o UDP solo puede estar vinculado a un proceso.
- El proceso puede configurarse con cualquier número de hilos, y las peticiones HTTP que lleguen al puerto 8080 serán enviadas a los diferentes hilos.

---

## Preguntas del room

**You downloaded an instruction booklet on how to make an origami crane. What would this instruction booklet resemble in computer terms?**
→ Program

**What is the name of the state where a process is waiting for an I/O event?**
→ Waiting
