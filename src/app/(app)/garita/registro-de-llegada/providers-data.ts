export type ProviderMaster = {
  ruc: string;
  nombre: string;
  estado: string;
};

// Datos de EJEMPLO. En produccion, este listado se genera desde el maestro
// de proveedores (GARITA/PROVEEDORES.xlsx), que no se sube al repositorio.
export const PROVIDERS: ProviderMaster[] = [
  { ruc: "20000000011", nombre: "LABORATORIO EJEMPLO UNO S.A.C.", estado: "Activo" },
  { ruc: "20000000022", nombre: "DISTRIBUIDORA EJEMPLO DOS S.A.", estado: "Activo" },
  { ruc: "20000000033", nombre: "FARMA EJEMPLO TRES S.R.L.", estado: "Activo" },
  { ruc: "20000000044", nombre: "INDUSTRIAS EJEMPLO CUATRO S.A.C.", estado: "Activo" },
  { ruc: "20000000055", nombre: "COMERCIAL EJEMPLO CINCO S.A.C.", estado: "Activo" },
  { ruc: "20000000066", nombre: "IMPORTADORA EJEMPLO SEIS S.A.", estado: "Inactivo" },
];