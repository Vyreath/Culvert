# Culvert

Sistema de gestión e inspección de alcantarillas basado en PostgreSQL + PostGIS para inventario, monitoreo y análisis de infraestructura vial.

---

## Descripción

Este proyecto permite registrar, visualizar y administrar información técnica de alcantarillas y estructuras hidráulicas mediante una interfaz moderna orientada a sistemas GIS.

El sistema integra:

- Inventario de alcantarillas
- Gestión de tuberías y muros
- Registro de inspecciones técnicas
- Georreferenciación espacial con PostGIS
- Gestión de fotografías y archivos adjuntos
- Visualización cartográfica
- Dashboard operativo con métricas

---

## Características principales

### Gestión de infraestructura
- Registro completo de alcantarillas
- Información vial y ubicación geográfica
- Control de estado estructural
- Historial de inspecciones

### Componentes estructurales
- Tuberías
- Muros
- Pozos de recolección

### GIS / Geoespacial
- Integración con PostGIS
- Geometrías `POINT`
- Índices espaciales `GIST`
- Consultas geográficas
- Preparado para integración con Leaflet/OpenLayers

### Multimedia
- Fotografías por alcantarilla
- Archivos técnicos adjuntos

### Interfaz moderna
- Dark UI inspirada en dashboards enterprise
- Diseño responsive
- Tablas dinámicas
- Modales y notificaciones
- Componentes reutilizables

---
### Backend / Base de Datos
- PostgreSQL
- PostGIS

### Frontend
- HTML5
- CSS3
- JavaScript

### GIS
- PostGIS

---

## Modelo de Base de Datos

### Tablas principales

| Tabla | Descripción |
|---|---|
| `alcantarillas` | Registro principal de infraestructura |
| `tuberias` | Información técnica de tuberías |
| `muros` | Información estructural de muros |
| `pozos_recoleccion` | Pozos asociados |
| `fotografias` | Evidencia fotográfica |
| `inspecciones` | Historial técnico |
| `archivos_adjuntos` | Documentación adicional |
| `materiales` | Catálogo de materiales |
| `estados` | Catálogo de estados |

---

## Características GIS

El sistema utiliza PostGIS para almacenar geometrías espaciales.

### Geometría utilizada

```sql
geometry(Point, 32717)
```

### Índice espacial

```sql
CREATE INDEX idx_alcantarillas_geom
ON alcantarillas
USING GIST (geom);
```

### Trigger automático de geometría

Las coordenadas UTM generan automáticamente la geometría espacial mediante trigger PL/pgSQL.

