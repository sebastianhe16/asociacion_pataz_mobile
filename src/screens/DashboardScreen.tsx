import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { PlaceholderLine, PlaceholderScreen } from './PlaceholderScreen';
import { getDatabase } from '../database/db';
import { colors } from '../core/theme';

interface SummaryCounts {
  warehouses: number;
  supplies: number;
  projects: number;
}

export default function DashboardScreen() {
  const [counts, setCounts] = useState<SummaryCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getDatabase()
      .then(async (database) => {
        const result = await database.getFirstAsync<SummaryCounts>(
          `SELECT
            (SELECT COUNT(*) FROM almacenes) AS warehouses,
            (SELECT COUNT(*) FROM insumos) AS supplies,
            (SELECT COUNT(*) FROM proyectos) AS projects`,
        );
        if (active && result) {
          setCounts(result);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudo leer el resumen local.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <PlaceholderScreen
      title="Resumen operativo"
      subtitle="P1 · Recolección de datos de campo y control logístico."
    >
      {!counts && !error && <ActivityIndicator color={colors.primary} />}
      {counts && (
        <>
          <PlaceholderLine>Almacenes base: {counts.warehouses}</PlaceholderLine>
          <PlaceholderLine>Insumos de prueba: {counts.supplies}</PlaceholderLine>
          <PlaceholderLine>Proyectos de muestra: {counts.projects} de 27 activos</PlaceholderLine>
          <PlaceholderLine>Los datos se guardan primero en este dispositivo.</PlaceholderLine>
        </>
      )}
      {error && <PlaceholderLine>Error al consultar la base local: {error}</PlaceholderLine>}
    </PlaceholderScreen>
  );
}
