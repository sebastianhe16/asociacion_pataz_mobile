import { PlaceholderLine, PlaceholderScreen } from './PlaceholderScreen';

export default function FieldScreen() {
  return (
    <PlaceholderScreen
      title="Trabajo de campo"
      subtitle="Proyectos comunitarios y registro preparado para operar sin conexión."
    >
      <PlaceholderLine>5 proyectos de muestra · cartera institucional de 27</PlaceholderLine>
      <PlaceholderLine>Ejes iniciales: Salud, Agricultura y Educación.</PlaceholderLine>
      <PlaceholderLine>
        Los formularios, coordenadas y observaciones se incorporarán en la siguiente etapa.
      </PlaceholderLine>
    </PlaceholderScreen>
  );
}
