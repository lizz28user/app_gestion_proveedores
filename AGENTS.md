# AGENTS.md — App_gestion_proveedores

## 1. Contexto del proyecto
Estamos construyendo una **PWA profesional para gestión de proveedores** (CRUD, búsqueda, filtros, estado offline básico).
- **Frontend/PWA**: Next.js 16 (App Router), React, TypeScript, Tailwind CSS.
- **Base de Datos**: **Firebase** (Firestore o Realtime Database según convenga; preferir Firestore para consultas complejas).
- **Backend/Workers**: **Cloudflare Workers** (para lógica de servidor ligera, webhooks o integraciones externas).
- **Público objetivo**: Pymes. La UI debe ser responsive, accesible y en español.

## 2. Reglas de código
- **TypeScript estricto**: No usar `any` a menos que sea estrictamente necesario.
- **Componentes**: Usar Server Components por defecto; Client Components solo cuando haya interactividad (`'use client'`).
- **Estilos**: Usar Tailwind CSS. No crear archivos CSS globales innecesarios.
- **Validación**: Todos los formularios deben validarse con Zod antes de enviar a Firebase.
- **Nombres**: Archivos en `kebab-case`, componentes en `PascalCase`.

## 3. Reglas de negocio (Proveedores)
Un proveedor tiene los campos: `id`, `nombre`, `ruc`, `email`, `telefono`, `direccion`, `categoria`, `estado` (activo/inactivo), `fecha_alta`.
- No se puede eliminar un proveedor si tiene `estado = 'activo'`; primero debe marcarse como inactivo.
- El `ruc` debe ser único.
- La lógica de negocio sensible (cálculos, validaciones de unicidad) debe residir en **Cloudflare Workers** si se requiere seguridad adicional.

## 4. Flujo de trabajo con MCPs
- **Antes de escribir código de UI**, consulta la documentación de Next.js/React usando **Context7**.
- **Para cambios en Firebase**, usa el **Firebase MCP** para inspeccionar el esquema actual de Firestore (colecciones, campos) antes de generar código de acceso a datos.
- **Para lógica de backend o despliegues en Cloudflare**, consulta primero la documentación con **cloudflare-docs** y luego usa **cloudflare-api** para verificar logs o desplegar Workers.
- **Después de implementar una funcionalidad**, usa **Playwright MCP** para probarla en el navegador: registra el Service Worker, crea un proveedor de prueba y verifica que aparece en el listado.

## 5. PWA — Requisitos no negociables
- El `manifest.json` debe incluir `name`, `short_name`, `start_url`, `display: "standalone"`, e iconos de 192x192 y 512x512.
- El Service Worker debe cachear el “app shell” (layout, estilos base) y tener una estrategia `network-first` para los datos de proveedores obtenidos de Firebase.
- El agente debe verificar con Playwright que la app es instalable (Auditoría de PWA en Chrome DevTools).

## 6. Qué NO hacer
- No instalar librerías de UI pesadas (Material UI, Ant Design) sin consultar primero.
- No modificar la estructura de Firestore sin usar el Firebase MCP para revisar el estado actual.
- No crear commits directamente en `main`; usar ramas `feat/`, `fix/` o `chore/`.