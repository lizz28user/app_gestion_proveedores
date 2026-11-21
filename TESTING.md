# 🔐 Guía de prueba — Autenticación y Roles

Este documento explica cómo probar el flujo completo de autenticación, roles y permisos del sistema.

---

## 1. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto (usa `.env.example` como base):

```bash
cp .env.example .env
```

Edita `.env` y genera la clave secreta para el primer administrador:

```bash
# Generar clave secreta segura
openssl rand -hex 32
```

Pega el resultado en `ADMIN_SEED_KEY`. Configura también las variables de Firebase con los valores de tu proyecto.

---

## 2. Crear el primer Administrador (seed)

Como no existe ningún usuario, el sistema no permite crear administradores desde el menú normal. Debes crear el primero manualmente:

```bash
curl -X POST http://localhost:3001/api/seed/admin \
  -H "Content-Type: application/json" \
  -H "x-admin-seed-key: TU_CLAVE_SECRETA_AQUI" \
  -d '{
    "dni": "12345678",
    "nombres": "Admin",
    "apellidos": "Sistema",
    "password": "Admin12345"
  }'
```

Respuesta esperada:

```json
{
  "success": true,
  "mensaje": "Primer administrador creado. Debe cambiar la contraseña en su primer ingreso.",
  "usuario": {
    "id": "...",
    "dni": "12345678",
    "nombres": "Admin",
    "apellidos": "Sistema",
    "rol": "Administrador",
    "debeCambiarPassword": true
  }
}
```

> ⚠️ Si ya existe un administrador, el endpoint devolverá error 409. No es posible crear otro administrador desde el login ni desde la interfaz de usuarios (solo el Admin actual puede crear usuarios, y no puede asignar el rol de Administrador a nadie más si ya existe uno — esa restricción está en la lógica de negocio).

---

## 3. Probar el login

1. Inicia la aplicación: `npm.cmd run dev`
2. Ve a `http://localhost:3001/login`
3. Inicia sesión con:
   - **DNI:** `12345678`
   - **Contraseña:** `Admin12345` (la que definiste en el seed)

**Esperado:**
- Redirección a `/usuarios/cambiar-password` porque `debeCambiarPassword` es `true`.
- Ingresa una nueva contraseña (mínimo 8 caracteres) en ambos campos y haz clic en "Cambiar contraseña".
- Debería redirigir a `/dashboard`.

---

## 4. Crear usuarios adicionales (Supervisor y Auxiliar)

Ya autenticado como Administrador:

1. Ve a `http://localhost:3001/usuarios`
2. Haz clic en **"Nuevo usuario"**
3. Llena el formulario:
   - DNI: `87654321`
   - Nombres: `María`
   - Apellidos: `Gómez`
   - Rol: `Supervisor`
   - Contraseña: déjalo vacío para generar una temporal (o pon una manual)
4. Haz clic en **"Crear usuario"**

**Esperado:**
- Si dejaste la contraseña vacía, aparecerá un mensaje con la **contraseña temporal generada**. Anótala y entrégasela al usuario.
- El usuario aparece en la tabla con rol "Supervisor" y estado "Activo".

Repite para crear un usuario con rol **Auxiliar** (DNI distinto, ej. `11223344`).

---

## 5. Probar permisos por rol

### A) Como Administrador
- Puede acceder a `/usuarios` (listado completo)
- Puede crear, editar, desactivar y restablecer contraseñas
- Puede acceder a todos los módulos (garita, agendamientos, datos-maestros)

### B) Como Supervisor
1. Cierra sesión y inicia sesión con el DNI y contraseña del Supervisor creado.
2. Intenta entrar a `http://localhost:3001/usuarios`
   - **Esperado:** Redirección automática a `/dashboard` (bloqueado por middleware y servidor).
3. Puede acceder a `/garita/registro-de-llegada` y `/garita/historico-llegadas` (ver, crear, editar).
4. **No** puede eliminar registros ni acceder a datos maestros de usuarios.

### C) Como Auxiliar
1. Inicia sesión con el DNI y contraseña del Auxiliar.
2. Intenta entrar a `/usuarios`
   - **Esperado:** Redirección a `/dashboard`.
3. Puede ver llegadas en `/garita/registro-de-llegada` pero **no** puede editar ni eliminar.

---

## 6. Probar restablecimiento de contraseña

Como Administrador:

1. Ve a `/usuarios`
2. Busca al usuario Supervisor o Auxiliar
3. Haz clic en el botón **"Clave"** (ícono de llave/ámbar)
4. **Esperado:** Se genera una nueva contraseña temporal y se muestra un mensaje de éxito. El usuario deberá cambiarla en su próximo ingreso.

---

## 7. Probar desactivar cuenta

Como Administrador:

1. Ve a `/usuarios`
2. Haz clic en **"Desactivar"** sobre un usuario de prueba
3. **Esperado:** El estado cambia a "Inactivo" y el usuario ya no puede iniciar sesión (recibirá error 403 si lo intenta).

---

## 8. Seguridad verificada

| Requisito | Estado |
|-----------|--------|
| Contraseñas hasheadas (PBKDF2-SHA256, nunca texto plano) | ✅ |
| DNI único validado en Firestore | ✅ |
| DNI de exactamente 8 dígitos | ✅ |
| Contraseña mínima 8 caracteres | ✅ |
| Contraseña temporal en primer ingreso | ✅ |
| Sin registro público (solo Admin crea usuarios) | ✅ |
| Primer admin solo vía clave secreta (`ADMIN_SEED_KEY`) | ✅ |
| Supervisor/Auxiliar bloqueados en `/usuarios` | ✅ |
| Permisos validados en servidor (API + Middleware) | ✅ |

---

## Comandos útiles

```bash
# Construir para producción
npm.cmd run build

# Ejecutar en modo desarrollo
npm.cmd run dev

# Ejecutar en producción (puerto 3001)
npm.cmd run start -p 3001
```

---

## Solución de problemas

| Problema | Solución |
|----------|----------|
| "Ya existe un administrador" en `/api/seed/admin` | Ya hay un admin. No es necesario volver a crear. |
| "Clave de semilla inválida" | Revisa que `ADMIN_SEED_KEY` coincida en `.env` y en el header de la petición. |
| "Credenciales inválidas" en login | Verifica que el usuario exista en Firestore y que la contraseña sea correcta. Si es primer ingreso, cambia la contraseña temporal primero. |
| No puede acceder a `/usuarios` siendo Admin | Verifica que la cookie de sesión esté presente y que el rol sea exactamente `"Administrador"`. |
