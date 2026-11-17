# CONTEXTO MAESTRO DEL PROYECTO: PETI ASOCIACIÓN PATAZ – PROYECTO P1

## 1. Contexto Organizacional y Académico
- **Organización:** Asociación Pataz (ONG de desarrollo sostenible vinculada a Compañía Minera Poderosa S.A., ubicada en la sierra de La Libertad, Perú). Opera en más de 100 caseríos y anexos rurales altoandinos de difícil acceso y baja conectividad.
- **Contexto Académico:** Plan Estratégico de Tecnologías de Información (PETI) – Curso de Gobierno y Gestión de Tecnologías de Información (USAT).
- **Problemática Central:** La institución gestiona 27 proyectos comunitarios (salud, agricultura, educación, agua/saneamiento) y 3 almacenes base (**Lavasen, Marañón y Pataz**) utilizando hojas de cálculo manuales en Excel y registros en papel. Esto provoca descuadres de stock, extravío de guías, retrabajo administrativo en oficina y falta de trazabilidad en tiempo real.

## 2. Alineamiento Estratégico (PETI y COBIT 2019)
La cartera de TI se sustenta en 4 procesos clave de COBIT 2019 (**EDM04, MEA01, EDM05 y APO04**). Este prototipo corresponde al **Proyecto P1**:
- **Nombre del Proyecto:** P1. Sistema Móvil de Recolección de Datos de Campo y Control Logístico de Almacenes (App Offline/Online).
- **Objetivo Estratégico Alineado (OE4 – Digitalización Operativa):** Implementar un sistema digital de inventarios y recolección de datos en el 100% de almacenes base y proyectos activos, reduciendo en un 50% los descuadres de stock.
- **Proceso COBIT 2019 Asociado:** **EDM04 (Asegurar la optimización de recursos)**, complementado con soporte operativo a **MEA01 (Monitorización del rendimiento y conformidad)** mediante datos auditables de campo.
- **Sistema Central de Destino:** Integración simulada vía API RESTful hacia el ERP administrativo-contable institucional **SISGEAP**.

## 3. Requerimientos Funcionales del Prototipo Móvil (P1)
1. **Arquitectura Offline-First:** La app debe funcionar al 100% sin conexión a internet o datos móviles. Toda operación se guarda primero en una base de datos local persistente (SQLite) con estampas de tiempo (`timestamps`) y estado de sincronización (`PENDIENTE`, `SINCRONIZADO`, `ERROR`), sincronizándose automáticamente en segundo plano o bajo demanda al detectar red.
2. **Módulo de Control Logístico de Almacenes (Lavasen, Marañón, Pataz):**
   - Visualización de stock por almacén base.
   - Registro de movimientos de **Entrada** y **Salida** de insumos (agrícolas: semillas, plantones, fertilizantes; salud: suplementos contra anemia; educación/construcción).
   - Escaneo de códigos QR / códigos de barras mediante cámara (y modo de simulación rápida para pruebas sin cámara física) para identificar insumos y generar guías digitales.
3. **Módulo de Recolección de Datos de Campo (27 Proyectos):**
   - Formularios dinámicos parametrizados por eje/proyecto (Salud, Agricultura, Educación).
   - Registro de beneficiarios, entregas en caseríos, captura de coordenadas GPS simuladas/reales y observaciones de campo con interfaz simplificada (botones grandes tipo checklist para técnicos en zonas altoandinas).
4. **Módulo de Sincronización y Auditoría (Integración SISGEAP):**
   - Cola de paquetes pendientes de envío, resolución básica de conflictos por `timestamp`, historial de auditoría (`log trails`) y simulación de envío hacia la API del ERP SISGEAP.

## 4. Stack Tecnológico Definido
- **Framework:** React Native con Expo (SDK reciente) y TypeScript.
- **Persistencia Local (Offline):** `expo-sqlite` + `@react-native-async-storage/async-storage`.
- **Conectividad y Hardware:** `@react-native-community/netinfo`, `expo-camera` (escáner QR/barras), `expo-location`.
- **Navegación y UI:** `@react-navigation/native` (Bottom Tabs + Native Stack), `lucide-react-native` o `@expo/vector-icons`, diseño de alto contraste adaptado a campo.