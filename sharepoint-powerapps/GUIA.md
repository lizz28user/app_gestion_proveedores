# Guía: Portal de Proveedores en SharePoint + Power Apps

Esta guía monta el portal **dentro de Microsoft 365**: los datos quedan en Listas de SharePoint de la empresa, la gente entra con su cuenta corporativa y no hace falta pedirle a TI un registro de aplicación.

**Necesitas:** permiso para crear listas en un sitio de SharePoint (propietario o miembro con edición) y acceso a Power Apps con tu cuenta de la empresa (make.powerapps.com).

**Los dos archivos diarios se cargan tal como vienen:**

- **Reporte IKF de Citas B2B** (`.xls`, hoja `REPORTE_CITAS`): se pega completo en la lista `CitasIKF`. Trae **una fila por orden de compra**; una cita puede tener varias OC, y la app las agrupa por número de cita.
- **Agenda CD40** (`.xlsx`, hoja `Ingreso por Proveedores CD40`): se pega en la lista `AgendaCD40`. Es lo que se **espera recibir** de cada proveedor (unidades solicitadas, MPs, paletas, buyer, FR). No trae RUC: la app lo obtiene del maestro de proveedores por el nombre.

**Contenido de esta carpeta:**

| Archivo | Para qué sirve |
|---|---|
| `plantillas/01-Proveedores.csv` | Los 1,861 proveedores de `PROVEEDORES.xlsx` |
| `plantillas/02-CitasIKF.csv` | El reporte IKF real del 16/11/2026 (83 OC, 65 citas, 37 proveedores) |
| `plantillas/03-AgendaCD40.csv` | La Agenda CD40 real del 14/11/2026 (32 proveedores) |
| `plantillas/04-Llegadas.csv` | Estructura de la lista Llegadas (1 fila de ejemplo) |
| `plantillas/05-IncidenciasRecepcion.csv` | Estructura de incidencias de recepción |
| `plantillas/06-IncidenciasProveedor.csv` | Estructura de incidencias de agendamiento |
| `plantillas/07-RolesPortal.csv` | Quién es Administrador, Garita o Agendamiento |
| `formato-columnas/*.json` | Colores FP para las columnas de estado en las listas |
| `recursos/` | Logo FP y fondo glassy para Power Apps |
| `FORMULAS-POWERAPPS.md` | Todas las fórmulas de la app, pantalla por pantalla |

---

## Parte 1 · Crear las listas (45–60 min)

### 1.1 Crear un sitio (si no tienes uno)

SharePoint → **+ Crear sitio** → **Sitio de grupo** → nombre: `Portal Proveedores`. Agrega como miembros a los usuarios de garita y agendamiento.

> Si TI prefiere que uses un sitio existente, sirve igual. Lo importante es que todos los usuarios de la app tengan permiso de **edición** en el sitio.

### 1.2 Importar cada lista desde CSV

Para cada archivo de `plantillas/`, en el orden 01 → 07:

1. En el sitio: **+ Nuevo → Lista → Desde CSV** (o **Desde Excel**, si tu menú no muestra CSV: abre el CSV en Excel, guárdalo como `.xlsx` y conviértelo en tabla con *Insertar → Tabla*).
2. Sube el archivo.
3. En la vista previa, **revisa el tipo de cada columna** según las tablas de abajo. Lists los adivina y a veces se equivoca.
4. Ponle a la lista el nombre exacto indicado (sin tildes ni espacios: así las fórmulas funcionan tal cual).

La primera columna de cada CSV es la que debe quedar como **Título** de la lista. Si Lists no te deja elegir, normalmente usa la primera columna. Revisa en **Configuración de lista** cuál quedó como Título, porque las fórmulas la llaman `Title`.

> **Importante:** RUC, número de cita, orden de compra y fechas de los reportes van como **Una línea de texto**, nunca como número ni fecha. Así se pegan exactamente como vienen del reporte, sin perder ceros ni confundir día y mes.

#### Lista `Proveedores` (desde `01-Proveedores.csv`)

| Columna | Tipo |
|---|---|
| Nombre | Título |
| RUC | Una línea de texto |
| Estado | Opción: Activo, Inactivo |

Después de importar: **Configuración de lista → columna RUC → Exigir valores únicos: Sí** (SharePoint te pedirá indexarla; acepta). Así el RUC no se puede repetir.

#### Lista `CitasIKF` (desde `02-CitasIKF.csv`)

Las columnas siguen **el mismo orden que el reporte IKF**, para poder pegarlo tal cual.

| Columna (en este orden) | Columna del reporte IKF | Tipo |
|---|---|---|
| NumeroCita | Número de Cita | Título |
| FechaCita | Fecha Cita | Una línea de texto (`16-11-2026`) |
| Anden | Andén | Una línea de texto (`PTA06`) |
| HoraInicio | Hora Inicio | Una línea de texto |
| HoraTermino | Hora Término | Una línea de texto |
| EstadoCita | Estado | Una línea de texto (`Cita Asignada`, `Cita Agendada`…) |
| RUC | RUC Proveedor | Una línea de texto |
| NombreProveedor | Nombre Proveedor | Una línea de texto |
| OrdenCompra | Orden de Compra | Una línea de texto |
| UnidadesEstimadas | Unidades Estimadas | Número (2 decimales) |
| UnidadesConfirmadas | Unidades Confirmadas | Número (2 decimales) |
| BultosConfirmados | Bultos Confirmados | Número |
| UnidadesRecepcionadas | Unidades Recepcionadas | Número (2 decimales) |

#### Lista `AgendaCD40` (desde `03-AgendaCD40.csv`)

Columnas en el mismo orden que la hoja `Ingreso por Proveedores CD40` desde la columna **B**, más la fecha al final.

| Columna (en este orden) | Columna de la Agenda | Tipo |
|---|---|---|
| Proveedor | DESPROVEEDOR (B) | Título |
| UnidSolicitadas | Unid Solicitadas (C) | Número |
| CantMPs | Cant de Mps CDs (D) | Número |
| CantPaletas | Cant de Paletas CDs (E) | Número |
| NumProv | N° Prov. (F) | Número |
| Dia | Día (G) | Una línea de texto |
| Buyer | BUYERS (H) | Una línea de texto |
| FR | FR (I) | Una línea de texto (`70%`) |
| LPNFR | LPN FR (J) | Número |
| Fecha | *(la agregas tú, columna K)* | Una línea de texto (`14-11-2026`) |

La Agenda no trae fecha completa (solo el día) ni RUC. La fecha la pones tú al pegar; el RUC lo busca la app en `Proveedores` por el nombre. Los 32 proveedores de la agenda del 14/11 coinciden con el maestro.

#### Lista `Llegadas` (desde `04-Llegadas.csv`)

Una llegada corresponde a **una cita** (un proveedor puede tener varias citas el mismo día: en el reporte del 16/11, 11 de 37 proveedores tienen más de una).

| Columna | Tipo | Notas |
|---|---|---|
| Proveedor | Título | |
| NumeroCita | Una línea de texto | enlaza con `CitasIKF` |
| RUC | Una línea de texto | |
| Fecha | Fecha (solo fecha) | |
| Anden | Una línea de texto | andén asignado en la cita |
| HoraCita | Una línea de texto | Hora Inicio de la cita |
| HoraLlegada | Una línea de texto | |
| MinutosDiferencia | Número | negativo = llegó antes |
| EstadoLlegada | Opción | Puntual, Tardanza, Anticipado |
| EstadoOperativo | Opción | Pendiente, En patio, En muelle, Recibido |
| UnidadesEstimadas | Número | suma de las OC de la cita |
| Conductor | Una línea de texto | |
| Licencia | Una línea de texto | |
| Placa | Una línea de texto | |
| Homologacion | Opción | Vigente, Vencida, No homologado |
| Puerta | Una línea de texto | puerta real de descarga |
| Operario | Una línea de texto | |
| HoraInicioDescarga | Una línea de texto | |
| HoraFin | Una línea de texto | |
| Resultado | Opción | Sin rechazo, Rechazo parcial, Rechazo total |
| Aceptadas | Número | |
| Rechazadas | Número | |

Al importar, las columnas de **Opción** solo traen el valor de la fila de ejemplo. Entra a cada una (**Configuración de lista → columna**) y agrega todas las opciones de la tabla. Luego **borra la fila "EJEMPLO - BORRAR"**.

#### Lista `IncidenciasRecepcion` (desde `05-IncidenciasRecepcion.csv`)

| Columna | Tipo |
|---|---|
| Tipo | Título |
| LlegadaID | Número (ID de la fila en Llegadas) |
| Proveedor | Una línea de texto |
| OrdenCompra | Una línea de texto |
| OcSku | Una línea de texto |
| CantidadAfectada | Número |
| Descripcion | Varias líneas de texto |

Activa **Datos adjuntos** (Configuración de lista → Configuración avanzada) para las fotos de evidencia. Borra la fila de ejemplo.

#### Lista `IncidenciasProveedor` (desde `06-IncidenciasProveedor.csv`)

| Columna | Tipo |
|---|---|
| Proveedor | Título |
| Fecha | Fecha (solo fecha) |
| Motivo | Opción: No generó su cita, Cita tardía, Por límite cubierto |
| Observaciones | Varias líneas de texto |
| Estado | Opción: Pendiente, En Proceso, Resuelta |
| FechaResolucion | Fecha (solo fecha) |

Borra la fila de ejemplo.

#### Lista `RolesPortal` (desde `07-RolesPortal.csv`)

| Columna | Tipo |
|---|---|
| Correo | Título |
| Rol | Opción: Administrador, Garita, Agendamiento |

Reemplaza el correo de ejemplo por el tuyo y agrega una fila por cada usuario de la app.

### 1.3 Índices (para que funcione bien con años de datos)

SharePoint limita a 5,000 elementos lo que una consulta puede recorrer sin índice. Con unas 80 OC por día, `CitasIKF` pasa ese límite en unos dos meses, así que los índices son obligatorios. En **Configuración de lista → Columnas indexadas → Crear un índice**:

- `CitasIKF`: **FechaCita** y **NumeroCita**
- `AgendaCD40`: **Fecha**
- `Llegadas`: **Fecha**, **NumeroCita** y **RUC**
- `IncidenciasProveedor`: **Fecha**

### 1.4 Vista de pegado (para la carga diaria)

Para que el pegado coincida columna por columna, el orden de la vista tiene que ser igual al del reporte:

- `CitasIKF` → vista **Todos los elementos** → *Editar vista actual* → deja visibles solo las 13 columnas, en el orden de la tabla de arriba.
- `AgendaCD40` → igual, con las 10 columnas en el orden de la tabla.

### 1.5 Colores FP en las columnas de estado (opcional, 5 min)

En la vista de la lista, abre el menú de la columna → **Configuración de columnas → Formato de esta columna → Modo avanzado**, pega el JSON y guarda:

| Lista | Columna | Archivo |
|---|---|---|
| Llegadas | EstadoOperativo | `formato-columnas/EstadoOperativo.json` |
| Llegadas | EstadoLlegada | `formato-columnas/EstadoLlegada.json` |
| Llegadas | Homologacion | `formato-columnas/Homologacion.json` |
| IncidenciasProveedor | Estado | `formato-columnas/EstadoIncidencia.json` |

---

## Parte 2 · Crear la app en Power Apps (1–2 días)

1. Entra a **make.powerapps.com** con tu cuenta corporativa → **+ Crear → Aplicación de lienzo en blanco** → formato **Tableta**. Nombre: `Portal Proveedores FP`.
2. **Datos → Agregar datos → SharePoint →** elige tu sitio y marca las 7 listas.
3. **Configuración → General → Límite de filas de datos: 2000.**
4. **Multimedia → Cargar:** `recursos/fondo-glass.svg`, `recursos/logo_fape_color.svg` y `recursos/logo_fape_blanco.svg`.
5. Pega `App.Formulas` y `App.OnStart` de `FORMULAS-POWERAPPS.md`. Luego, en el árbol, haz clic en **…** junto a App → **Ejecutar OnStart**.
6. Crea las pantallas, usando el diseño `diseno/portal-fp-glass.html` como referencia visual:
   - `scrPanel` — Panel general
   - `scrLlegadas` — Registro de llegada
   - `scrNuevaLlegada` — formulario de llegada
   - `scrRecepcion` — Gestión de recepción
   - `scrCitas` — Dashboard de citas
   - `scrIncidencias` — Incidencias de proveedores
7. En cada pantalla: la imagen de fondo, el menú lateral, el temporizador de refresco y los controles de la sección correspondiente de `FORMULAS-POWERAPPS.md`.

**Consejo:** arma primero `scrPanel` completa con el menú lateral, cópiala (**Duplicar pantalla**) y sobre las copias arma las demás. Así el menú y el fondo quedan iguales en todas.

### Probar

1. Las plantillas traen el IKF del **16/11/2026** y la Agenda del **14/11/2026**. Para probar con ellas, cambia temporalmente en `App.OnStart` `Set(varHoy, Today())` por `Set(varHoy, Date(2026, 11, 16))` (o `14` para ver la Agenda).
2. Presiona **F5** (vista previa) y registra una llegada de prueba.
3. Abre la lista `Llegadas` en SharePoint y comprueba que la fila aparece con su número de cita.
4. Asígnale una puerta en Gestión de recepción y finaliza la recepción.
5. Vuelve a dejar `Set(varHoy, Today())` y borra las filas de prueba.

---

## Parte 3 · Publicar

1. **Archivo → Guardar → Publicar.**
2. **Compartir** la app con el grupo del sitio (los mismos usuarios que tienen permiso en las listas).
3. Para que esté a mano:
   - **En SharePoint:** edita una página del sitio → agrega el elemento web **Power Apps** → pega el enlace de la app.
   - **En Teams:** en Power Apps, **Agregar a Teams**.
   - **En celular:** la app **Power Apps** de la tienda, con la cuenta corporativa.

---

## Operación diaria (5 minutos)

### Cargar el reporte IKF de Citas B2B

1. Abre el `.xls` del día (hoja `REPORTE_CITAS`).
2. Selecciona desde **A2** hasta la última fila de la columna **M** (todo menos el encabezado) y copia.
3. En SharePoint, abre `CitasIKF` → **Editar en vista de cuadrícula** → haz clic en la primera celda de la fila vacía (columna NumeroCita) → pega → **Salir de la vista de cuadrícula**.

No hay que borrar ni reordenar nada: se pega tal cual.

### Cargar la Agenda CD40

1. Abre el `.xlsx` de la agenda (hoja `Ingreso por Proveedores CD40`).
2. En la columna **K**, a partir de la fila 6, escribe la fecha de la agenda con formato `14-11-2026` y arrástrala hasta la última fila.
3. Selecciona desde **B6** hasta **K** de la última fila y copia (no incluyas las filas 1–5 de totales y encabezados).
4. En SharePoint, abre `AgendaCD40` → **Editar en vista de cuadrícula** → pega en la primera celda vacía de la columna Proveedor → sal de la cuadrícula.

> Las hojas `Cross dock`, `Cartonizado` y `Refrigerados` no se cargan por ahora. Si las necesitas en la app, se agregan como listas aparte con el mismo método.

**Más adelante:** ambas cargas se pueden automatizar con **Power Automate**, leyendo los archivos desde una carpeta de SharePoint o OneDrive cada mañana. Ojo: Power Automate lee bien `.xlsx` con tablas, pero no el `.xls` antiguo del IKF; para automatizar ese, el reporte tendría que guardarse como `.xlsx`.

---

## Limitaciones a tener en cuenta

- **Refresco cada 30 segundos**, no instantáneo como Firestore. Para ver al momento lo que registró otra persona, se puede agregar un botón "Actualizar".
- **Sin conexión:** Power Apps necesita internet para guardar. Si se cae la red en garita, hay que registrar al volver la conexión.
- **Nombres en la Agenda:** el cruce Agenda → RUC es por nombre exacto. Si el nombre de un proveedor en la Agenda cambia y deja de coincidir con `Proveedores`, ese proveedor aparecerá "sin RUC" en el dashboard; se corrige ajustando el nombre en el maestro.
- **Licencias:** las Listas de SharePoint usan el conector estándar incluido en Microsoft 365. Si Power Apps te pide una licencia premium, es porque se agregó algún conector premium: con lo de esta guía no debería pasar.
- **El diseño glassy es aproximado:** Power Apps no desenfoca lo que hay detrás de un panel. El efecto se logra con el fondo de luces y paneles semitransparentes.
