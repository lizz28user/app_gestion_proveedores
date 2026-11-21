# Fórmulas Power Apps — Portal de Proveedores FP

Fórmulas Power Fx para armar la app tomando como modelo el diseño `diseno/portal-fp-glass.html`.
Cópialas en la propiedad indicada de cada control. Los nombres de los controles (por ejemplo `cmbProveedor`) son sugerencias: si usas otros nombres, cámbialos también en las fórmulas.

> **Sobre la columna Título.** En SharePoint toda lista tiene una columna `Title`. En estas fórmulas la uso como:
> Proveedores → nombre · CitasIKF → número de cita · AgendaCD40 → proveedor · Llegadas → proveedor · IncidenciasRecepcion → tipo · IncidenciasProveedor → proveedor · RolesPortal → correo.
> Si Power Apps te la muestra con otro nombre (por ejemplo `Nombre` o `NumeroCita`), usa ese nombre donde aquí dice `Title`.

> **Columnas de opción (Choice).** `EstadoLlegada`, `EstadoOperativo`, `Homologacion`, `Resultado`, `Motivo`, `Estado` y `Rol` son de tipo *Opción*. Para leerlas se usa `.Value` y para guardarlas `{Value: "texto"}`.

> **Fechas de los reportes.** `CitasIKF.FechaCita` y `AgendaCD40.Fecha` son texto con formato `dd-mm-yyyy`, tal como vienen en los archivos. La app las compara con `Text(varHoy, "dd-mm-yyyy")`.

---

## 0. Configuración de la app

**Configuración → General → Límite de filas de datos:** `2000`
(Proveedores tiene 1,861 filas; con 2,000 el buscador de proveedores funciona sin avisos de delegación).

**Orígenes de datos** (Datos → Agregar datos → SharePoint → tu sitio): `Proveedores`, `CitasIKF`, `AgendaCD40`, `Llegadas`, `IncidenciasRecepcion`, `IncidenciasProveedor`, `RolesPortal`.

### App.Formulas (colores y constantes de marca)

```powerfx
ColRojo = ColorValue("#F02615");
ColRojoOscuro = ColorValue("#8B0000");
ColAmbar = ColorValue("#FAB701");
ColGrisLogo = ColorValue("#76797B");
ColFondo = ColorValue("#07070A");
ColTexto = ColorValue("#F4F2F0");
ColTextoTenue = ColorValue("#A3A4A8");
ColTextoApagado = ColorValue("#6B6C70");
ColVidrio = RGBA(255, 255, 255, 0.07);
ColVidrioInterno = RGBA(255, 255, 255, 0.045);
ColBordeVidrio = RGBA(255, 255, 255, 0.14);
ColOk = ColorValue("#2FBF71");
ColMuelle = ColorValue("#7FB2FF");
ColPatio = ColorValue("#FAB701");
ColTarde = ColorValue("#F02615");
ColPendiente = ColorValue("#76797B");
Puertas = ForAll(Sequence(30), {Puerta: "PTA" & Text(Value, "00")});
Operarios = ["Operario 1", "Operario 2", "Operario 3", "Operario 4", "Operario 5", "Operario 6", "Operario 7", "Operario 8", "Operario 9", "Operario 10"];
TiposIncidencia = ["Daño de empaque", "Producto vencido", "Falta de unidades", "Producto incorrecto", "Etiquetado erróneo", "Otro"];
```

### App.OnStart

```powerfx
Set(varHoy, Today());
Set(varHoyTexto, Text(varHoy, "dd-mm-yyyy"));
Set(varRol, LookUp(RolesPortal, Lower(Title) = Lower(User().Email)).Rol.Value);

// Reporte IKF del día: una fila por orden de compra
ClearCollect(colOCsHoy, Filter(CitasIKF, FechaCita = varHoyTexto));

// Citas del día: se agrupan las OC por número de cita
ClearCollect(colCitasHoy,
    AddColumns(
        RenameColumns(
            GroupBy(colOCsHoy, Title, RUC, NombreProveedor, Anden, HoraInicio, HoraTermino, EstadoCita, OCs),
            Title, NumeroCita),
        UnidadesEstimadas, Sum(OCs, UnidadesEstimadas),
        Bultos, Sum(OCs, BultosConfirmados),
        NumOCs, CountRows(OCs)));

// Agenda CD40 del día, con el RUC tomado del maestro por nombre
ClearCollect(colAgendaHoy,
    AddColumns(Filter(AgendaCD40, Fecha = varHoyTexto) As a,
        RUC, LookUp(Proveedores, Title = Trim(a.Title)).RUC));

ClearCollect(colLlegadasHoy, Filter(Llegadas, Fecha = varHoy));
```

> Si tu versión de Power Apps marca error en `GroupBy`, `RenameColumns` o `AddColumns`, escribe los nombres de columna nuevos entre comillas: `GroupBy(colOCsHoy, "Title", "RUC", …, "OCs")`, `RenameColumns(…, "Title", "NumeroCita")`, `AddColumns(…, "UnidadesEstimadas", Sum(OCs, UnidadesEstimadas), …)`.

### Refresco automático (control **Temporizador** `tmrRefresco` en cada pantalla)

- `Duration`: `30000` (30 segundos) · `Repeat`: `true` · `AutoStart`: `true` · `Visible`: `false`
- `OnTimerEnd`:

```powerfx
ClearCollect(colLlegadasHoy, Filter(Llegadas, Fecha = varHoy))
```

### Estilo glassy (se repite en todas las pantallas)

| Control | Propiedad | Valor |
|---|---|---|
| Pantalla | `Fill` | `ColFondo` |
| Imagen de fondo `imgFondo` (ocupa toda la pantalla, al fondo) | `Image` | `fondo-glass` (sube `recursos/fondo-glass.svg` en Multimedia) · `ImagePosition`: `ImagePosition.Fill` |
| Rectángulo de panel | `Fill` | `ColVidrio` |
| | `BorderColor` / `BorderThickness` | `ColBordeVidrio` / `1` |
| | `RadiusTopLeft`… (los 4) | `18` |
| Etiquetas de título | `Font` / `Color` | `Font.'Segoe UI'` (o la fuente corporativa) / `ColTexto` |
| Etiquetas secundarias | `Color` | `ColTextoTenue` |
| Botón principal | `Fill` / `Color` / `RadiusTopLeft`… | `ColRojo` / `White` / `8` |
| Logo | `Image` | `logo_fape_color` (sube `recursos/logo_fape_color.svg`) |

Power Apps no tiene desenfoque real detrás de los paneles. El efecto vidrio se logra con la imagen de fondo y los rectángulos semitransparentes.

### Menú lateral (componente o grupo repetido en cada pantalla)

Botones del menú, propiedad `Visible`:

```powerfx
// Garita (Registro de llegada, Gestión de recepción)
varRol in ["Administrador", "Garita"]
// Agendamientos (Dashboard de citas, Incidencias)
varRol in ["Administrador", "Agendamiento"]
```

Botón activo, propiedad `Fill`:

```powerfx
If(App.ActiveScreen = scrLlegadas, RGBA(240, 38, 21, 0.25), Transparent)
```

### Color por estado (para chips y marcadores)

```powerfx
// Fill de un chip de estado dentro de una galería de llegadas
Switch(ThisItem.EstadoOperativo.Value,
    "Recibido", ColOk,
    "En muelle", ColMuelle,
    "En patio", ColPatio,
    ColPendiente)
```

---

## 1. Pantalla Panel general (`scrPanel`)

**Indicadores** (etiquetas grandes, propiedad `Text`):

```powerfx
// Citas del día
CountRows(colCitasHoy)

// Llegadas / citas
CountRows(colLlegadasHoy) & "/" & CountRows(colCitasHoy)

// En planta (en patio + en muelle)
CountRows(Filter(colLlegadasHoy, EstadoOperativo.Value in ["En patio", "En muelle"]))

// Unidades estimadas del día (reporte IKF)
Text(Sum(colCitasHoy, UnidadesEstimadas), "#,##0")

// Alertas de homologación
CountRows(Filter(colLlegadasHoy, Homologacion.Value <> "Vigente"))
```

**Anillo de avance** (control Imagen `imgAnillo`, propiedad `Image`). Dibuja el anillo rojo con el porcentaje de citas que ya llegaron:

```powerfx
With(
    {pct: If(CountRows(colCitasHoy) = 0, 0, CountRows(colLlegadasHoy) / CountRows(colCitasHoy))},
    "data:image/svg+xml;utf8," & EncodeUrl(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'>" &
        "<circle cx='90' cy='90' r='76' fill='none' stroke='#2A2A2E' stroke-width='10'/>" &
        "<circle cx='90' cy='90' r='76' fill='none' stroke='#F02615' stroke-width='10' stroke-linecap='round' " &
        "stroke-dasharray='" & Text(Round(477 * pct, 0), "0", "en-US") & " 477' transform='rotate(-90 90 90)'/>" &
        "</svg>"
    )
)
```

Encima del anillo, una etiqueta con `Text(Round(pct * 100, 0)) & "%"` (usa el mismo `With`).

**Actividad reciente** (galería `galActividad`, `Items`):

```powerfx
FirstN(Sort(colLlegadasHoy, Modified, SortOrder.Descending), 5)
```

Texto de cada fila: `ThisItem.HoraLlegada & "  " & ThisItem.Title & " · " & ThisItem.EstadoOperativo.Value`

---

## 2. Pantalla Registro de llegada (`scrLlegadas`)

Cada fila es **una cita** del reporte IKF (un proveedor puede aparecer varias veces si tiene varias citas).

**Galería de la agenda** `galAgenda`, `Items`:

```powerfx
Sort(
    Filter(
        AddColumns(colCitasHoy As c, Llegada, LookUp(colLlegadasHoy, NumeroCita = c.NumeroCita)),
        (IsBlank(txtBuscar.Text)
            || txtBuscar.Text in NombreProveedor
            || txtBuscar.Text in RUC
            || txtBuscar.Text in NumeroCita)
        && (IsBlank(locFiltro) || Coalesce(Llegada.EstadoOperativo.Value, "Pendiente") = locFiltro)
    ),
    HoraInicio,
    SortOrder.Ascending
)
```

Dentro de la galería:

| Control | Propiedad | Valor |
|---|---|---|
| Etiqueta proveedor | `Text` | `ThisItem.NombreProveedor` |
| Etiqueta detalle | `Text` | `"Cita " & ThisItem.NumeroCita & " · RUC " & ThisItem.RUC & " · " & ThisItem.NumOCs & " OC"` |
| Etiqueta cita | `Text` | `ThisItem.HoraInicio & "–" & ThisItem.HoraTermino & " · " & ThisItem.Anden` |
| Etiqueta unidades | `Text` | `Text(ThisItem.UnidadesEstimadas, "#,##0") & " uds"` |
| Etiqueta llegada | `Text` | `Coalesce(ThisItem.Llegada.HoraLlegada, "—")` |
| Chip estado | `Text` | `Coalesce(ThisItem.Llegada.EstadoOperativo.Value, "Pendiente")` |
| Botón "Registrar" | `Visible` | `IsBlank(ThisItem.Llegada)` |
| Botón "Registrar" | `OnSelect` | `Set(varCitaSel, ThisItem); Navigate(scrNuevaLlegada)` |

**Chips de filtro** (botones Todos / Pendiente / En patio / En muelle / Recibido), `OnSelect`: `UpdateContext({locFiltro: "En patio"})` (para "Todos": `UpdateContext({locFiltro: Blank()})`).

**Llegada sin cita** (botón **Registrar llegada** arriba de la galería), `OnSelect`: `Set(varCitaSel, Blank()); Navigate(scrNuevaLlegada)`

---

## 3. Pantalla Nueva llegada (`scrNuevaLlegada`)

Controles: `cmbProveedor` (cuadro combinado), `txtConductor`, `txtLicencia`, `txtPlaca`, `drpHomologacion`, `btnGuardar`, y una etiqueta con los datos de la cita.

| Control | Propiedad | Valor |
|---|---|---|
| Etiqueta de la cita | `Text` | `If(IsBlank(varCitaSel), "Llegada sin cita", "Cita " & varCitaSel.NumeroCita & " · " & varCitaSel.HoraInicio & " · " & varCitaSel.Anden & " · " & varCitaSel.NumOCs & " OC")` |
| `cmbProveedor` | `Items` | `Filter(Proveedores, Estado.Value = "Activo")` *(si Estado quedó como texto: `Estado = "Activo"`)* |
| | `SearchFields` | `["Title", "RUC"]` |
| | `DisplayFields` | `["Title"]` |
| | `DefaultSelectedItems` | `LookUp(Proveedores, RUC = varCitaSel.RUC)` |
| | `DisplayMode` | `If(IsBlank(varCitaSel), DisplayMode.Edit, DisplayMode.View)` |
| `drpHomologacion` | `Items` | `Choices(Llegadas.Homologacion)` |
| `btnGuardar` | `DisplayMode` | `If(IsBlank(cmbProveedor.Selected) Or IsBlank(txtPlaca.Text) Or IsBlank(txtConductor.Text), DisplayMode.Disabled, DisplayMode.Edit)` |

**`btnGuardar.OnSelect`**: calcula la diferencia con la hora de la cita, impide registrar dos veces la misma cita y guarda.

```powerfx
With(
    {
        prov: cmbProveedor.Selected,
        cita: varCitaSel,
        horaLlegada: Text(Now(), "hh:mm")
    },
    With(
        {
            dif: If(IsBlank(cita), 0,
                DateDiff(TimeValue(cita.HoraInicio), TimeValue(horaLlegada), TimeUnit.Minutes))
        },
        If(
            !IsBlank(cita) && !IsBlank(LookUp(Llegadas, NumeroCita = cita.NumeroCita)),
            Notify("La cita " & cita.NumeroCita & " ya tiene una llegada registrada.", NotificationType.Error),

            IsBlank(cita) && !IsBlank(LookUp(Llegadas, RUC = prov.RUC && Fecha = varHoy && IsBlank(NumeroCita))),
            Notify("Este proveedor ya tiene una llegada sin cita registrada hoy.", NotificationType.Error),

            !IsMatch(Upper(txtPlaca.Text), "[A-Z0-9]{3}-?[A-Z0-9]{3}"),
            Notify("Revisa la placa: debe tener el formato ABC-123.", NotificationType.Warning),

            Patch(Llegadas, Defaults(Llegadas), {
                Title: prov.Title,
                NumeroCita: Coalesce(cita.NumeroCita, ""),
                RUC: prov.RUC,
                Fecha: varHoy,
                Anden: Coalesce(cita.Anden, ""),
                HoraCita: Coalesce(cita.HoraInicio, ""),
                HoraLlegada: horaLlegada,
                MinutosDiferencia: dif,
                EstadoLlegada: {Value: If(dif < 0, "Anticipado", dif <= 15, "Puntual", "Tardanza")},
                EstadoOperativo: {Value: "En patio"},
                UnidadesEstimadas: Coalesce(cita.UnidadesEstimadas, 0),
                Conductor: Trim(txtConductor.Text),
                Licencia: Upper(Trim(txtLicencia.Text)),
                Placa: Upper(Trim(txtPlaca.Text)),
                Homologacion: {Value: drpHomologacion.Selected.Value}
            });
            ClearCollect(colLlegadasHoy, Filter(Llegadas, Fecha = varHoy));
            Notify("Llegada registrada: " & prov.Title, NotificationType.Success);
            Reset(txtConductor); Reset(txtLicencia); Reset(txtPlaca);
            Navigate(scrLlegadas)
        )
    )
)
```

La regla de puntualidad es la misma que la app actual (`src/lib/utils.ts`): antes de la cita = Anticipado; hasta 15 minutos tarde = Puntual; más de 15 = Tardanza.

---

## 4. Pantalla Gestión de recepción (`scrRecepcion`)

**Mapa de puertas** (galería en cuadrícula `galPuertas`, `WrapCount`: `4`, `Items`):

```powerfx
AddColumns(Puertas As p,
    Ocupada, LookUp(colLlegadasHoy, Puerta = p.Puerta && EstadoOperativo.Value = "En muelle"),
    CitasProgramadas, CountRows(Filter(colCitasHoy, Anden = p.Puerta)))
```

| Control | Propiedad | Valor |
|---|---|---|
| Etiqueta puerta | `Text` | `ThisItem.Puerta` |
| Etiqueta proveedor | `Text` | `If(IsBlank(ThisItem.Ocupada), "Libre", ThisItem.Ocupada.Title)` |
| Etiqueta detalle | `Text` | `If(IsBlank(ThisItem.Ocupada), ThisItem.CitasProgramadas & " citas hoy en este andén", ThisItem.Ocupada.Operario & " · desde " & ThisItem.Ocupada.HoraInicioDescarga)` |
| Borde de la tarjeta | `BorderColor` | `If(IsBlank(ThisItem.Ocupada), ColBordeVidrio, ColMuelle)` |

Para mostrar solo los andenes que se usan (en el IKF del 16/11 fueron PTA01 a PTA07), filtra: `Filter(…, CitasProgramadas > 0 || !IsBlank(Ocupada))`.

**Cola de patio** (`galCola`, `Items`):

```powerfx
Sort(Filter(colLlegadasHoy, EstadoOperativo.Value = "En patio"), HoraLlegada, SortOrder.Ascending)
```

**Asignar puerta**. Controles `drpPuerta` y `drpOperario` en la tarjeta de la cola:

- `drpPuerta.Items`: `Filter(Puertas As p, IsBlank(LookUp(colLlegadasHoy, Puerta = p.Puerta && EstadoOperativo.Value = "En muelle")))`
- `drpPuerta.Default`: `ThisItem.Anden` *(propone el andén que tenía la cita en el IKF)*
- `drpOperario.Items`: `Operarios`
- Botón **Asignar**, `OnSelect`:

```powerfx
Patch(Llegadas, LookUp(Llegadas, ID = ThisItem.ID), {
    Puerta: drpPuerta.Selected.Puerta,
    Operario: drpOperario.Selected.Value,
    EstadoOperativo: {Value: "En muelle"},
    HoraInicioDescarga: Text(Now(), "hh:mm")
});
ClearCollect(colLlegadasHoy, Filter(Llegadas, Fecha = varHoy));
Notify(ThisItem.Title & " asignado a " & drpPuerta.Selected.Puerta, NotificationType.Success)
```

**Finalizar recepción** (al tocar una puerta ocupada se abre un panel con `txtAceptadas`, `txtRechazadas`). Botón **Finalizar**, `OnSelect`:

```powerfx
With(
    {acep: Value(txtAceptadas.Text), rech: Value(txtRechazadas.Text)},
    Patch(Llegadas, LookUp(Llegadas, ID = galPuertas.Selected.Ocupada.ID), {
        Aceptadas: acep,
        Rechazadas: rech,
        Resultado: {Value: If(rech = 0, "Sin rechazo", acep = 0, "Rechazo total", "Rechazo parcial")},
        EstadoOperativo: {Value: "Recibido"},
        HoraFin: Text(Now(), "hh:mm")
    })
);
ClearCollect(colLlegadasHoy, Filter(Llegadas, Fecha = varHoy));
Notify("Recepción finalizada", NotificationType.Success)
```

**Registrar incidencia de recepción** (`drpTipo`, `drpOC`, `txtOcSku`, `txtCantidad`, `txtDescripcion`):

- `drpTipo.Items`: `TiposIncidencia`
- `drpOC.Items` (las OC de esa cita según el IKF): `Filter(colOCsHoy, Title = galPuertas.Selected.Ocupada.NumeroCita).OrdenCompra`
- Botón, `OnSelect`:

```powerfx
Patch(IncidenciasRecepcion, Defaults(IncidenciasRecepcion), {
    Title: drpTipo.Selected.Value,
    LlegadaID: galPuertas.Selected.Ocupada.ID,
    Proveedor: galPuertas.Selected.Ocupada.Title,
    OrdenCompra: drpOC.Selected.OrdenCompra,
    OcSku: txtOcSku.Text,
    CantidadAfectada: Value(txtCantidad.Text),
    Descripcion: txtDescripcion.Text
});
Notify("Incidencia registrada", NotificationType.Success)
```

Para adjuntar fotos de evidencia, usa un **Formulario de edición** conectado a `IncidenciasRecepcion` con su tarjeta de Datos adjuntos.

---

## 5. Pantalla Dashboard de citas (`scrCitas`)

**Indicadores**:

```powerfx
// Citas agendadas (reporte IKF)
CountRows(colCitasHoy) & " citas · " & CountRows(colOCsHoy) & " OC"

// Unidades estimadas (IKF) frente a solicitadas (Agenda CD40)
Text(Sum(colCitasHoy, UnidadesEstimadas), "#,##0") & " / " & Text(Sum(colAgendaHoy, UnidSolicitadas), "#,##0")

// Puntualidad (llegados con 15 min o menos de retraso)
If(CountRows(colLlegadasHoy) = 0, "—",
    Text(CountIf(colLlegadasHoy, MinutosDiferencia <= 15) / CountRows(colLlegadasHoy), "0%"))

// Proveedores de la Agenda sin cita en el IKF
CountRows(Filter(colAgendaHoy As a, IsBlank(LookUp(colCitasHoy, RUC = a.RUC))))

// Franja pico
First(Sort(colFranjas, Total, SortOrder.Descending)).HoraInicio
```

**Carga por franja**. En `scrCitas.OnVisible`:

```powerfx
ClearCollect(colFranjas,
    AddColumns(GroupBy(colCitasHoy, HoraInicio, Grupo),
        Total, Sum(Grupo, UnidadesEstimadas),
        NumCitas, CountRows(Grupo)));
Set(varMaxFranja, Max(colFranjas, Total))
```

Galería `galFranjas` con `Items`: `Sort(colFranjas, HoraInicio, SortOrder.Ascending)`. Dentro, un rectángulo que hace de barra:

| Control | Propiedad | Valor |
|---|---|---|
| Barra (rectángulo) | `Width` | `(Parent.TemplateWidth - 260) * ThisItem.Total / varMaxFranja` |
| | `Fill` | `If(ThisItem.Total = varMaxFranja, ColRojo, ColGrisLogo)` |
| Etiqueta hora | `Text` | `ThisItem.HoraInicio & "  ·  " & ThisItem.NumCitas & " citas"` |
| Etiqueta valor | `Text` | `Text(ThisItem.Total, "#,##0")` |

**Top proveedores por volumen** (agrupa todas las citas de cada proveedor), `galTop.Items`:

```powerfx
FirstN(
    Sort(
        AddColumns(GroupBy(colCitasHoy, RUC, NombreProveedor, Citas),
            Total, Sum(Citas, UnidadesEstimadas),
            NumCitas, CountRows(Citas)),
        Total, SortOrder.Descending),
    6)
```

Barra: `Width` = `(Parent.TemplateWidth - 260) * ThisItem.Total / First(galTop.AllItems).Total`

**Agenda CD40 frente a citas** (galería `galCobertura`, `Items`). Cruza lo que se espera recibir con lo que el proveedor agendó:

```powerfx
Sort(
    AddColumns(colAgendaHoy As a,
        UdsCitadas, Sum(Filter(colCitasHoy, RUC = a.RUC), UnidadesEstimadas),
        Cobertura, If(a.UnidSolicitadas = 0, 0,
            Sum(Filter(colCitasHoy, RUC = a.RUC), UnidadesEstimadas) / a.UnidSolicitadas)),
    Cobertura, SortOrder.Ascending
)
```

| Control | Propiedad | Valor |
|---|---|---|
| Etiqueta proveedor | `Text` | `ThisItem.Title & If(IsBlank(ThisItem.RUC), "  (sin RUC en maestro)", "")` |
| Etiqueta detalle | `Text` | `ThisItem.Buyer & " · FR " & ThisItem.FR & " · " & ThisItem.CantPaletas & " paletas"` |
| Etiqueta cobertura | `Text` | `Text(ThisItem.UdsCitadas, "#,##0") & " / " & Text(ThisItem.UnidSolicitadas, "#,##0") & " (" & Text(ThisItem.Cobertura, "0%") & ")"` |
| Etiqueta cobertura | `Color` | `If(ThisItem.Cobertura = 0, ColRojo, ThisItem.Cobertura < 0.7, ColAmbar, ColOk)` |

Así agendamiento ve de un vistazo qué proveedores de la agenda **no generaron cita** (en rojo) o citaron menos del 70% de lo solicitado (en ámbar).

> La Agenda y el IKF tienen que ser **del mismo día** para que el cruce tenga sentido.

---

## 6. Pantalla Incidencias de proveedores (`scrIncidencias`)

Usa un **Formulario de edición** conectado a `IncidenciasProveedor` (más simple que hacerlo a mano) y una galería con:

```powerfx
Sort(IncidenciasProveedor, Fecha, SortOrder.Descending)
```

Días transcurridos (etiqueta en la galería):

```powerfx
With(
    {dias: DateDiff(ThisItem.Fecha, If(ThisItem.Estado.Value = "Resuelta" && !IsBlank(ThisItem.FechaResolucion), ThisItem.FechaResolucion, Today()), TimeUnit.Days)},
    If(dias = 0, "Mismo día", dias & If(dias = 1, " día", " días"))
)
```

**Atajo desde el dashboard:** en `galCobertura`, un botón "Registrar incidencia" visible cuando `ThisItem.Cobertura = 0`, con `OnSelect`:

```powerfx
Patch(IncidenciasProveedor, Defaults(IncidenciasProveedor), {
    Title: ThisItem.Title,
    Fecha: varHoy,
    Motivo: {Value: "No generó su cita"},
    Observaciones: "En Agenda CD40 con " & Text(ThisItem.UnidSolicitadas, "#,##0") & " uds solicitadas y sin cita en el IKF.",
    Estado: {Value: "Pendiente"}
});
Notify("Incidencia registrada para " & ThisItem.Title, NotificationType.Success)
```

En el formulario, propiedad `OnSuccess`: si el estado es *Resuelta* y no hay fecha de resolución, complétala:

```powerfx
If(Self.LastSubmit.Estado.Value = "Resuelta" && IsBlank(Self.LastSubmit.FechaResolucion),
    Patch(IncidenciasProveedor, Self.LastSubmit, {FechaResolucion: Today()}));
Notify("Incidencia guardada", NotificationType.Success)
```
