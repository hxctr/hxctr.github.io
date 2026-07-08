---
title: "Análisis Estático — InsecureBankv2"
date: 2026-07-06
category: "Mobile Pentesting"
order: 8
tags: ["mobile-pentesting", "android", "static-analysis", "owasp"]
layout: layouts/writeup.njk
permalink: /writeups/analisis-estatico-insecurebankv2.html
---

## ¿Qué es el análisis estático?

Analizar el código y recursos de una app **sin ejecutarla**. Se descompila el APK y se revisa el código fuente, el manifest, los archivos de configuración y los recursos en busca de vulnerabilidades.

Complementa el análisis dinámico (Frida, Burp) — juntos dan una visión completa de la seguridad de la app.

---

## Herramientas utilizadas

- **jadx** — descompila el APK a código Java legible
- **apktool** — descompila a smali + extrae recursos
- **VS Code + SSH Remote** — navegar el código descompilado

### Comando para descompilar

```bash
jadx $PWD/InsecureBankv2.apk -d $PWD/jadx_insecurebank
```

Genera dos carpetas:

- `resources/` — AndroidManifest.xml, layouts, strings
- `sources/` — código Java descompilado

---

## AndroidManifest.xml — Código completo

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    android:versionCode="1"
    android:versionName="1.0"
    package="com.android.insecurebankv2"
    platformBuildVersionCode="22"
    platformBuildVersionName="5.1.1-1819727">
    <uses-sdk
        android:minSdkVersion="15"
        android:targetSdkVersion="22"/>
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
    <uses-permission android:name="android.permission.SEND_SMS"/>
    <uses-permission android:name="android.permission.USE_CREDENTIALS"/>
    <uses-permission android:name="android.permission.GET_ACCOUNTS"/>
    <uses-permission android:name="android.permission.READ_PROFILE"/>
    <uses-permission android:name="android.permission.READ_CONTACTS"/>
    <uses-permission android:name="android.permission.READ_PHONE_STATE"/>
    <uses-permission
        android:name="android.permission.READ_EXTERNAL_STORAGE"
        android:maxSdkVersion="18"/>
    <uses-permission android:name="android.permission.READ_CALL_LOG"/>
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
    <uses-feature
        android:glEsVersion="0x20000"
        android:required="true"/>
    <application
        android:theme="@android:style/Theme.Holo.Light.DarkActionBar"
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:debuggable="true"
        android:allowBackup="true">
        <activity
            android:label="@string/app_name"
            android:name="com.android.insecurebankv2.LoginActivity">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
        <activity
            android:label="@string/title_activity_file_pref"
            android:name="com.android.insecurebankv2.FilePrefActivity"
            android:windowSoftInputMode="adjustNothing|stateVisible"/>
        <activity
            android:label="@string/title_activity_do_login"
            android:name="com.android.insecurebankv2.DoLogin"/>
        <activity
            android:label="@string/title_activity_post_login"
            android:name="com.android.insecurebankv2.PostLogin"
            android:exported="true"/>
        <activity
            android:label="@string/title_activity_wrong_login"
            android:name="com.android.insecurebankv2.WrongLogin"/>
        <activity
            android:label="@string/title_activity_do_transfer"
            android:name="com.android.insecurebankv2.DoTransfer"
            android:exported="true"/>
        <activity
            android:label="@string/title_activity_view_statement"
            android:name="com.android.insecurebankv2.ViewStatement"
            android:exported="true"/>
        <provider
            android:name="com.android.insecurebankv2.TrackUserContentProvider"
            android:exported="true"
            android:authorities="com.android.insecurebankv2.TrackUserContentProvider"/>
        <receiver
            android:name="com.android.insecurebankv2.MyBroadCastReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="theBroadcast"/>
            </intent-filter>
        </receiver>
        <activity
            android:label="@string/title_activity_change_password"
            android:name="com.android.insecurebankv2.ChangePassword"
            android:exported="true"/>
    </application>
</manifest>
```

---

## Findings del Manifest

### 🔴 CRÍTICO — android:debuggable="true"

```xml
<application android:debuggable="true">
```

Esta flag indica que la app fue compilada en modo debug y **nunca debió llegar a producción así**.

**Qué permite un atacante hacer:**

- Conectar un debugger a la app en runtime via ADB
- Ejecutar código arbitrario en el contexto de la app
- Extraer datos internos de la app sin necesitar root
- Inspeccionar memoria, variables, y flujo de ejecución en tiempo real

**Cómo se explota:**

```bash
adb shell
run-as com.android.insecurebankv2
# Ahora tienes acceso a todos los archivos internos de la app
ls /data/data/com.android.insecurebankv2/
```

**Fix en build.gradle:**

```
buildTypes {
    release {
        debuggable false   // debe estar explícito
        minifyEnabled true
    }
    debug {
        debuggable true    // solo para development
    }
}
```

---

### 🔴 CRÍTICO — android:allowBackup="true"

```xml
<application android:allowBackup="true">
```

Permite hacer un backup completo de todos los datos de la app **sin necesitar root**.

**Qué expone:**

- Bases de datos SQLite (credenciales, historial)
- Shared Preferences (tokens, configuración)
- Archivos internos de la app

**Cómo se explota:**

```bash
# Hacer backup completo de la app
adb backup -f insecurebank.ab com.android.insecurebankv2

# Convertir el backup a formato legible
dd if=insecurebank.ab bs=24 skip=1 | python3 -c "import zlib,sys; sys.stdout.buffer.write(zlib.decompress(sys.stdin.buffer.read()))" > insecurebank.tar
tar xf insecurebank.tar
```

**Fix:**

```xml
android:allowBackup="false"
```

---

### 🟡 MEDIO — Activities exportadas sin protección

Estas activities tienen `android:exported="true"` — cualquier app en el dispositivo puede abrirlas directamente sin pasar por el flujo normal de autenticación:

```xml
com.android.insecurebankv2.PostLogin       android:exported="true"
com.android.insecurebankv2.DoTransfer      android:exported="true"
com.android.insecurebankv2.ViewStatement   android:exported="true"
com.android.insecurebankv2.ChangePassword  android:exported="true"
```

**Qué significa:** Un atacante puede lanzar directamente `DoTransfer` o `ViewStatement` sin haber hecho login.

**Cómo se explota:**

```bash
adb shell am start -n com.android.insecurebankv2/.DoTransfer
```

---

### 🟡 MEDIO — Content Provider exportado

```xml
<provider
    android:name="com.android.insecurebankv2.TrackUserContentProvider"
    android:exported="true"/>
```

Cualquier app puede consultar este Content Provider y leer los datos que expone.

---

### 🟡 MEDIO — BroadcastReceiver exportado

```xml
<receiver
    android:name="com.android.insecurebankv2.MyBroadCastReceiver"
    android:exported="true">
    <intent-filter>
        <action android:name="theBroadcast"/>
    </intent-filter>
</receiver>
```

Cualquier app puede enviar el broadcast `theBroadcast` y triggear este receiver.

---

### 🟡 MEDIO — Permisos excesivos

La app pide permisos que una app bancaria no necesita:

```
android.permission.SEND_SMS         <!-- ¿Por qué necesita enviar SMS? -->
android.permission.READ_CONTACTS    <!-- No necesario para banking -->
android.permission.READ_CALL_LOG    <!-- No necesario para banking -->
android.permission.ACCESS_COARSE_LOCATION  <!-- No necesario para banking -->
android.permission.READ_PROFILE     <!-- Deprecated y no necesario -->
```

Permisos excesivos aumentan la superficie de ataque — si la app es comprometida, el atacante hereda todos esos permisos.

---

### 🟠 INFO — SDK version muy antigua

```xml
<uses-sdk
    android:minSdkVersion="15"
    android:targetSdkVersion="22"/>
```

targetSdkVersion 22 = Android 5.1 (2015). Las protecciones de seguridad modernas de Android (scoped storage, permission model mejorado, network security config) no aplican a esta app.
