import { useState, useEffect, useCallback } from "react";
import { ejecutarCruce } from "./agenda-cruce";

const LS_CRUCE_KEY = "portal-proveedores:cruce:resultado";
const CRUCE_EVENT = "cruce-actualizado";

export type CruceResultado = ReturnType<typeof ejecutarCruce>;

export function useCruceStorage() {
  const [resultado, setResultado] = useState<CruceResultado | null>(null);

  const cargarDesdeLocalStorage = useCallback(() => {
    try {
      const prev = localStorage.getItem(LS_CRUCE_KEY);
      if (!prev) {
        setResultado(null);
        return;
      }
      const parsed = JSON.parse(prev);
      setResultado(parsed);
    } catch {
      setResultado(null);
    }
  }, []);

  const guardarResultado = useCallback(
    (res: CruceResultado) => {
      try {
        localStorage.setItem(LS_CRUCE_KEY, JSON.stringify(res));
        window.dispatchEvent(new Event(CRUCE_EVENT));
        setResultado(res);
      } catch {
        // Ignorar errores de escritura
      }
    },
    []
  );

  const limpiarResultado = useCallback(() => {
    localStorage.removeItem(LS_CRUCE_KEY);
    window.dispatchEvent(new Event(CRUCE_EVENT));
    setResultado(null);
  }, []);

  // Cargar al montar y escuchar eventos de actualización
  useEffect(() => {
    cargarDesdeLocalStorage();

    const handler = () => cargarDesdeLocalStorage();
    window.addEventListener(CRUCE_EVENT, handler);

    return () => window.removeEventListener(CRUCE_EVENT, handler);
  }, [cargarDesdeLocalStorage]);

  return {
    resultado,
    setResultado: guardarResultado,
    limpiar: limpiarResultado,
    cargar: cargarDesdeLocalStorage,
  };
}