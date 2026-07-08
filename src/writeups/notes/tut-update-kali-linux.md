---
title: "Update Kali Linux"
category: "Tutoriales"
order: 34
tags: ["tutorial", "kali-linux", "maintenance"]
layout: layouts/writeup.njk
permalink: /writeups/tut-update-kali-linux.html
---

## Checklist rápida

Confirmar la versión actual del sistema:

```bash
cat /etc/os-release
```

Actualizar el sistema completo:

```bash
sudo apt-get update && sudo apt-get upgrade && sudo apt-get dist-upgrade
```
