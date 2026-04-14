# Guest lock con TTL + heartbeat

## Decisiones de diseño

| Parámetro | Valor | Motivo |
| --- | --- | --- |
| Intervalo heartbeat | 25 segundos | Balancea latencia de recuperación y coste de escrituras. |
| TTL de lock | 90 segundos | Deja margen a reconexiones breves sin generar locks zombies largos. |
| Reintentos antes de degradar UI local | 3 fallos consecutivos | Evita falsos positivos por microcortes y da señal clara de lock inestable. |
| Liberación explícita | Sí, en `changeProfile` y `beforeunload` (best effort) | Minimiza tiempo de bloqueo cuando el flujo termina normalmente. |

## Supuestos de reloj

- El cálculo de `lockExpiresAt` se hace en cliente, y las reglas comparan contra `request.time` para impedir robar locks activos.
- `updatedAt` sigue usando `serverTimestamp()` para mantener trazabilidad consistente entre clientes.

## Riesgos restantes y mitigaciones

- **Deriva de reloj del cliente:** puede acortar/estirar ligeramente la ventana real de expiración.
  - **Mitigación:** regla bloquea takeover de lock activo según `request.time`.
- **Pérdida de red prolongada:** el lock puede expirar mientras el usuario sigue en pantalla.
  - **Mitigación:** degradación local tras 3 heartbeats fallidos y aviso suave al usuario.
- **Carga de escritura en eventos masivos:** heartbeat periódico aumenta writes por usuario activo.
  - **Mitigación:** intervalo de 25s y payload mínimo sobre el mismo documento de invitado.
