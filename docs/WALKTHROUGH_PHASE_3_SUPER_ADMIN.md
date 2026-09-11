# Walkthrough: Fase 3 — Panel de Super Administrador (Centro de Control)

En esta fase se construyeron los servicios de monitoreo global, cálculo de KPIs del negocio y control remoto de clientes.

---

## 🎯 Objetivos Cumplidos

1. **DTOs de Administración**:
   - `GlobalMetricsDTO`: Total preguntas, auto-respuestas, aprobadas, tasa en %, latencia media en ms y desglose de intenciones de compra.
   - `TenantOverviewDTO`: Directorio de tiendas con semáforo de estado de conexión (`healthy`, `expiring_soon`, `expired`) y volumen.
   - `TenantDetailDTO`: Vista profunda de configuración, preguntas recientes y logs de auditoría por tienda.
2. **Casos de Uso de Administración**:
   - `GetGlobalMetricsUseCase`: Agregación de métricas de toda la plataforma.
   - `ListTenantsOverviewUseCase`: Listado de clientes y salud de tokens OAuth.
   - `GetTenantDetailUseCase`: Ficha técnica de un cliente.
   - `ToggleTenantAutoAnswerUseCase`: Pausar o activar remotamente el auto-responder de una tienda.
   - `ForceTokenRefreshUseCase`: Forzar la renovación del token OAuth de Mercado Libre desde el panel.
3. **Persistencia Agregada**:
   - Métodos SQL en `SqliteQuestionRepository` para promedios de latencia, agrupación por estado, agrupación por intención y estadísticas por vendedor.
4. **Endpoints con Guard `super_admin`**:
   - `GET /api/admin/metrics`
   - `GET /api/admin/tenants`
   - `GET /api/admin/tenants/:sellerId`
   - `POST /api/admin/tenants/:sellerId/toggle`
   - `POST /api/admin/tenants/:sellerId/refresh-token`
