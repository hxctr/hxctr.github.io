---
title: "TryHackMe: Active Directory Basics"
date: 2025-08-25
category: "TryHackMe"
order: 6
tags: ["tryhackme", "active-directory", "gpo", "kerberos"]
layout: layouts/writeup.njk
permalink: /writeups/thm-active-directory-basics.html
---

## Windows Domains

Con pocas computadoras, cualquier configuración o problema se puede gestionar fácilmente accediendo directamente a cada una. Pero cuando el negocio crece, ese proceso deja de ser viable. Para resolverlo se usa un **Windows domain**: un grupo de usuarios y computadoras bajo la administración de una organización. La idea es centralizar la administración de una red Windows en un solo repositorio llamado **Active Directory (AD)**. El servidor que corre el Active Directory se conoce como **Domain Controller (DC)**.

Principales ventajas de un Windows domain:

- **Gestión centralizada de identidad:** todos los usuarios de la red pueden configurarse desde el Active Directory sin esfuerzo mínimo.
- **Gestión de políticas de seguridad:** se pueden configurar políticas directamente desde AD y aplicarlas a usuarios y computadoras según sea necesario.

### Ejemplo del mundo real

Las credenciales de un usuario funcionan en cualquier computadora del dominio porque el proceso de autenticación se envía al Active Directory, donde se revisan. Gracias a esto, las credenciales no necesitan existir en cada máquina — están disponibles a través de la red. AD también es el componente que restringe el acceso, por ejemplo, al panel de control: las políticas se despliegan a través de la red para que un usuario no tenga privilegios administrativos en esa computadora.

---

## Active Directory

El core de cada Windows Domain es el **Active Directory Domain Service (AD DS)**. Este servicio actúa como un catálogo que sostiene la información de todos los "objects" que existen en la red: usuarios, grupos, máquinas, impresoras, shares, entre otros.

### Users

Los usuarios son de los tipos de objetos más comunes en AD. Son un **security principal** — un objeto que puede ser autenticado por el dominio y puede tener privilegios asignados sobre recursos como archivos o impresoras. Los usuarios representan dos tipos de entidades:

- **People:** empleados u otras personas de la organización que necesitan acceder a la red.
- **Services:** cuentas usadas por servicios como IIS o MSSQL. Cada servicio requiere un usuario para funcionar, pero estas cuentas de servicio solo tienen el privilegio necesario para correr ese servicio específico.

### Machines

Cada computadora que se une al dominio genera un objeto máquina. Las máquinas también son security principals y se les asigna una cuenta, igual que a un usuario regular, con derechos limitados dentro del dominio. La cuenta de máquina es administrador local de su propia computadora, y su contraseña se rota automáticamente y se compone de 120 caracteres aleatorios.

Las cuentas de máquina siguen un esquema de nombramiento específico: el nombre de la computadora seguido de `$`. Por ejemplo, una máquina llamada `DC01` tiene la cuenta `DC01$`.

### Security Groups

Permiten asignar derechos de acceso a archivos u otros recursos a grupos enteros en lugar de a un solo usuario — se agregan usuarios a un grupo existente y heredan automáticamente sus privilegios. Los security groups también son security principals. Un grupo puede tener usuarios, máquinas, e incluso otros grupos como miembros.

<table>
<tr><td>Security Group</td><td>Descripción</td></tr>
<tr><td>Domain Admins</td><td>Privilegios de administrador, controlan cualquier computadora del dominio, incluyendo los DCs.</td></tr>
<tr><td>Server Operators</td><td>Pueden administrar Domain Controllers. No pueden cambiar ningún grupo.</td></tr>
<tr><td>Backup Operators</td><td>Pueden acceder a cualquier archivo, ignorando permisos. Usado para hacer backups.</td></tr>
<tr><td>Account Operators</td><td>Pueden crear o modificar otras cuentas en el dominio.</td></tr>
<tr><td>Domain Users</td><td>Incluye todas las cuentas de usuario del dominio.</td></tr>
<tr><td>Domain Computers</td><td>Incluye todas las computadoras del dominio.</td></tr>
<tr><td>Domain Controllers</td><td>Incluye todos los DCs del dominio.</td></tr>
</table>

### Active Directory Users and Computers

Se accede desde el Domain Controller. Los objetos están organizados en **Organizational Units (OUs)** — contenedores que permiten clasificar usuarios y máquinas, típicamente reflejando la estructura del negocio (ventas, IT, marketing, etc.). Un usuario solo puede pertenecer a un OU a la vez.

También existen containers por defecto creados por Windows:

- **Builtin:** grupos por defecto disponibles en cualquier host Windows.
- **Computers:** cualquier máquina unida a la red se pone acá por defecto (se puede mover).
- **Domain Controllers:** OU por defecto que contiene los DCs de la red.
- **Users:** usuarios y grupos por defecto que aplican a todo el dominio.
- **Managed Service Accounts:** cuentas usadas por servicios del dominio.

```powershell
# Consultar grupos de un usuario vía crackmapexec
crackmapexec smb 10.201.44.110 -u 'Claire' -p 'msInspect' -d thm.local --groups
```

### Security Groups vs OUs

- **OUs:** aplican políticas a usuarios y computadoras según su rol en la empresa. Un usuario solo puede ser miembro de un OU a la vez.
- **Security Groups:** dan permisos sobre recursos (ej. acceso a una carpeta compartida o impresora de red). Un usuario puede pertenecer a muchos grupos simultáneamente.

**Preguntas del room:**
- ¿Qué grupo administra normalmente todas las computadoras y recursos de un dominio? → **Domain Admins**
- ¿Nombre de la cuenta de máquina asociada a una máquina llamada TOM-PC? → **TOM-PC$**
- Para agrupar usuarios de un nuevo departamento de QA y aplicarles políticas consistentes, ¿qué tipo de contenedor se usa? → **Organizational Units**

---

## Managing Users in AD

### Eliminar OUs y usuarios sobrantes

Por defecto, los OUs están protegidos contra eliminación accidental. Para eliminar uno, hay que habilitar **Advanced Features** en el menú View, entrar a las propiedades del OU y desmarcar la protección contra eliminación accidental.

### Delegation

Permite dar controles específicos a usuarios sobre ciertos OUs — realizar tareas avanzadas sin necesitar ser Domain Administrator. Un caso común: darle a IT support el privilegio de resetear contraseñas de usuarios de bajo nivel.

Desde consola (con las credenciales delegadas, ya que la consola gráfica de AD puede no estar disponible para ese usuario):

```powershell
# Resetear la contraseña de un usuario
Set-ADAccountPassword sophie -Reset -NewPassword (Read-Host -AsSecureString -Prompt 'New Password') -Verbose

# Forzar que la cambie en el próximo login
Set-ADUser -ChangePasswordAtLogon $true -Identity sophie -Verbose
```

**Preguntas del room:**
- Flag encontrada en el escritorio de Sophie → `THM{thanks_for_contacting_support}`
- El proceso de otorgar privilegios sobre un OU u otro objeto de AD se llama... → **delegation**

---

## Managing Computers in AD

Por defecto, todas las máquinas que se unen al dominio (excepto los DCs) van al contenedor "Computers". No es recomendable dejarlas todas ahí, ya que se quieren políticas distintas para servidores vs. máquinas de usuario. Divisiones comunes:

- **Workstations:** el dispositivo más común — donde cada usuario se loguea a diario.
- **Servers:** brindan servicios a usuarios u otros servicios.
- **Domain Controllers:** gestionan el dominio; son los dispositivos más sensibles porque contienen los hashes de contraseñas de todas las cuentas.

**Pregunta del room:** después de organizar las computadoras disponibles, ¿cuántas terminaron en el OU de Workstations? → **7**. ¿Es recomendable crear OUs separados para Servers y Workstations? → **sí**

---

## Group Policies

Se implementan mediante **Group Policy Objects (GPO)** — colecciones de configuraciones aplicadas a OUs, dirigidas a usuarios o computadoras, que permiten establecer una baseline en máquinas específicas.

Se crea una GPO bajo "Group Policy Objects" y luego se **linkea** al OU donde se quiere aplicar. Una GPO aplica al OU enlazado y a cualquier sub-OU. La tab "Scope" muestra dónde está linkeada, y permite aplicar **Security Filtering** para restringirla a usuarios/computadoras específicos (por defecto aplica a "Authenticated Users"). La tab "Settings" muestra las configuraciones activas — separadas entre configuraciones de computadora y de usuario.

Ruta para cambiar la longitud mínima de contraseña:

```
Computer Configuration → Policies → Windows Settings → Security Settings → Account Policies → Password Policy
```

### GPO distribution

Las GPOs se distribuyen por la red a través de un share llamado **SYSVOL**, almacenado en el DC (por defecto en `C:\Windows\SYSVOL\sysvol\`). Un cambio puede tardar hasta 2 horas en propagarse. Para forzar la sincronización inmediata en una máquina:

```powershell
gpupdate /force
```

### Creando GPOs para THM Inc.

**Restringir acceso al Panel de Control:** se crea una GPO, se habilita la política *"Prohibit Access to Control Panel and PC settings"* bajo User Configuration, y se linkea a los OUs de Marketing, Management y Sales.

**Auto Lock Screen:** en vez de aplicar la GPO individualmente a Workstations, Servers y Domain Controllers, se puede aplicar directamente al dominio raíz — como esos OUs son hijos del root, heredan la política automáticamente. (Los OUs que solo contienen usuarios, como Sales, ignorarán las configuraciones de computadora de esa GPO). Se configura el bloqueo de pantalla tras 5 minutos de inactividad y se linkea al dominio.

**Preguntas del room:**
- Nombre del network share usado para distribuir GPOs a las máquinas del dominio → **SYSVOL**
- ¿Una GPO puede aplicar configuraciones tanto a usuarios como a computadoras? → **sí**

---

## Authentication Methods

Las credenciales de Windows se almacenan en los Domain Controllers. Cuando un usuario intenta conectarse a un servicio, este debe preguntarle al DC si las credenciales son correctas. Existen dos protocolos:

- **Kerberos:** protocolo por defecto en cualquier dominio reciente.
- **NetNTLM:** protocolo legacy, mantenido por compatibilidad — debería estar deprecado, pero muchas redes lo siguen teniendo habilitado.

### Kerberos Authentication

Los usuarios reciben **tickets** como prueba de autenticación previa, y los presentan al servicio para demostrar que ya se autenticaron.

1. El usuario envía su username y un timestamp encriptado (con una llave derivada de su contraseña) al **Key Distribution Center (KDC)**, instalado en el DC. El KDC responde con un **Ticket Granting Ticket (TGT)**, que permite solicitar tickets adicionales sin volver a enviar credenciales cada vez, más una **Session Key**. El TGT está encriptado con el hash de la cuenta `krbtgt`, así que el usuario no puede leer su contenido.
2. Para conectarse a un servicio (share, sitio web, base de datos), el usuario usa su TGT para pedirle al KDC un **Ticket Granting Service (TGS)** — enviando su username y timestamp encriptado con la Session Key, junto al TGT y un **Service Principal Name (SPN)** que identifica el servicio objetivo. El KDC responde con un TGS y una Service Session Key. El TGS está encriptado con una llave derivada del hash del Service Owner (la cuenta bajo la que corre el servicio).
3. El TGS se envía al servicio deseado, que lo desencripta con su propio hash de contraseña para validar la Service Session Key y establecer la conexión.

### NetNTLM Authentication

Funciona con un mecanismo challenge-response:

1. El cliente envía una petición de autenticación al servidor.
2. El servidor genera un número aleatorio (challenge) y lo envía al cliente.
3. El cliente combina su hash NTLM con el challenge (y otra data) para generar una respuesta, y la envía de vuelta.
4. El servidor reenvía el challenge y la respuesta al Domain Controller para verificación.
5. El DC recalcula la respuesta con el challenge y la compara. Si coinciden, el usuario es autenticado; el resultado se envía de vuelta al servidor.
6. El servidor reenvía el resultado al cliente.

La contraseña del usuario (o su hash) **nunca se transmite por la red**. Nota: si se usa una cuenta local en vez de una de dominio, el servidor puede verificar la respuesta por sí mismo, sin el DC, porque tiene el hash almacenado localmente en su SAM.

**Preguntas del room:**
- ¿Una versión reciente de Windows usa NetNTLM como protocolo preferido por defecto? → **no**
- En Kerberos, ¿qué tipo de ticket permite solicitar más tickets (TGS)? → **Ticket Granting Ticket**
- Usando NetNTLM, ¿se transmite la contraseña del usuario por la red en algún punto? → **no**

---

## Trees, Forests and Trusts

Conforme una compañía crece, también crecen sus redes. Tener un solo dominio es suficiente al principio, pero eventualmente se necesita más de uno.

### Trees

Si dos dominios comparten el mismo namespace (ej. `thm.local`), pueden unirse en un **Tree**. Por ejemplo, si `thm.local` se separa en ramas de UK y US, se puede construir un tree con dominio raíz `thm.local` y subdominios `uk.thm.local` y `us.thm.local`, cada uno con su propio AD, computadoras y usuarios — dando control independiente a cada equipo de IT regional.

Un nuevo grupo de seguridad entra en juego acá: **Enterprise Admins**, con privilegios administrativos sobre *todos* los dominios de la empresa (a diferencia de Domain Admins, que solo controla su propio dominio).

### Forests

Cuando los dominios usan namespaces distintos (por ejemplo, tras adquirir otra compañía con su propio tree), la unión de múltiples trees con diferentes namespaces en la misma red se llama **forest**.

### Trust Relationships

Permiten que un usuario de un dominio acceda recursos de otro dominio distinto, dentro de una estructura de trees/forests.

- **One-way trust:** si `Domain AAA` confía en `Domain BBB`, un usuario de BBB puede ser autorizado a acceder recursos en AAA (la dirección de la relación de confianza es contraria a la dirección del acceso).
- **Two-way trust:** ambos dominios se autorizan mutuamente. Por defecto, unir dominios bajo un mismo tree o forest crea automáticamente una two-way trust.

Tener una trust relationship **no** otorga acceso automático a todos los recursos del otro dominio — solo habilita la posibilidad de autorizar usuarios entre dominios; qué se autoriza sigue siendo una decisión explícita.

**Preguntas del room:**
- ¿Cómo se llama a un grupo de dominios Windows que comparten el mismo namespace? → **tree**
- ¿Qué debe configurarse entre dos dominios para que un usuario del Dominio A acceda a un recurso del Dominio B? → **A Trust Relationship**
