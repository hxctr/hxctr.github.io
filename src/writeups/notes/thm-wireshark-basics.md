---
title: "TryHackMe: Wireshark: The Basics"
date: 2025-01-02
category: "TryHackMe"
order: 11
tags: ["tryhackme", "wireshark", "pcap"]
layout: layouts/writeup.njk
permalink: /writeups/thm-wireshark-basics.html
---

## Introduction

Wireshark es un analizador de paquetes de red, capaz de hacer sniffing, investigar el tráfico de la red e inspeccionar packet captures (PCAP).

---

## Tool Overview

### Casos de uso

- Detectar y hacer troubleshooting, como puntos de falla de red y congestión.
- Detectar anomalías de seguridad, como rogue hosts, uso anormal de puertos y tráfico malicioso.
- Investigar y aprender detalles de protocolos, como códigos de respuesta y datos de payloads.

Wireshark **no es un IDS**. Solo permite a los analistas descubrir e investigar paquetes en profundidad — no modifica paquetes, solo los lee. Detectar una anomalía en la red depende del conocimiento del analista y sus habilidades de investigación.

### GUI y datos

<table>
<tr><td>Toolbar</td><td>El toolbar principal contiene múltiples menús y atajos para captura y procesamiento de paquetes, incluyendo filtrado, orden, resumen, exportación y merge.</td></tr>
<tr><td>Display Filter Bar</td><td>La sección principal de consulta y filtrado.</td></tr>
<tr><td>Recent Files</td><td>Lista de archivos investigados recientemente. Se recuperan con doble click.</td></tr>
<tr><td>Capture Filter and Interfaces</td><td>Filtros de captura e interfaces de red disponibles para sniffing. La interfaz de red es el punto de conexión entre una computadora y una red (ej. <code>lo</code>, <code>eth0</code>, <code>ens33</code>).</td></tr>
<tr><td>Status Bar</td><td>Estado de la herramienta, perfil e información numérica de paquetes.</td></tr>
</table>

### Cargar archivos PCAP

Se puede cargar un archivo `.pcap` desde el menú File, arrastrándolo y soltándolo, o con doble click sobre el archivo.
