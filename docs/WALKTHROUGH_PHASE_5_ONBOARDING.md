# Walkthrough: Fase 5 — Onboarding de Tenant & Flujo OAuth Self-Service

En esta fase se implementó el flujo autónomo de registro y vinculación OAuth 2.0 con Mercado Libre, permitiendo que cualquier vendedor cree su cuenta, autorice el acceso a su tienda y comience a operar sin intervención manual del Super Administrador.

---

## 🎯 Objetivos Cumplidos

1. **Casos de Uso de Onboarding**:
   - `ConnectMeliAccountUseCase`: Intercambio de código OAuth por tokens de acceso/refresco, consulta del perfil oficial de Mercado Libre (`nickname`, `email`), alta/actualización de la entidad `Tenant`, vinculación al `User` y emisión de un nuevo token JWT actualizado.
   - `GetOnboardingStatusUseCase`: Diagnóstico del estado de conexión del tenant, salud de sus credenciales y URL de autorización personalizada.
2. **Infraestructura & Adaptador MELI**:
   - `MeliApiClient.getSellerProfile`: Consulta directa a `GET https://api.mercadolibre.com/users/:id` para capturar el apodo real de la tienda.
3. **Endpoints de Onboarding & Autenticación**:
   - `GET /api/auth/onboarding-status`: Estado de conexión para el frontend.
   - `GET /api/auth/meli-auth-url`: Generación de URL OAuth con `state` asociado al `userId`.
   - `GET /oauth/login`: Inicio de autorización compatible con navegadores y query params `?token=...`.
   - `GET /oauth/callback`: Callback receptor de MELI que redirige a `/onboarding.html?status=connected`.
4. **Página de Onboarding (`public/onboarding.html`)**:
   - Wizard paso a paso (Registro/Login ➔ Conectar Mercado Libre ➔ Confirmación con Nickname y Seller ID ➔ Ingreso al panel).
   - Estética Glassmorphic Dark Mode consistente con el resto de la plataforma.
5. **Tests Automatizados**:
   - Suite completa en `tests/auth/ConnectMeliAccountUseCase.test.ts` y `tests/auth/GetOnboardingStatusUseCase.test.ts` (100% pasados).
