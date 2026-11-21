import { useEffect, useState } from "react";

type UsuarioSesion = {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  rol: string;
  estado: string;
  debeCambiarPassword: boolean;
} | null;

export function useSession() {
  const [usuario, setUsuario] = useState<UsuarioSesion>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let montado = true;

    async function cargarSesion() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (!montado) return;

        if (response.ok) {
          const data = await response.json();
          if (data.autenticado) {
            setUsuario(data.usuario);
          } else {
            setUsuario(null);
          }
        } else {
          setUsuario(null);
        }
      } catch {
        setUsuario(null);
      } finally {
        if (montado) setLoading(false);
      }
    }

    cargarSesion();

    return () => {
      montado = false;
    };
  }, []);

  return { usuario, loading };
}
