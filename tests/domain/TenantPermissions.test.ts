import { describe, it, expect } from 'vitest'
import { Tenant } from '../domain/entities/Tenant.js'

describe('TenantPermissions', () => {
  function makeTenant(overrides: Partial<any> = {}) {
    return Tenant.createDefault({
      id: 'test-id',
      sellerId: '123',
      accessToken: 'tok',
      refreshToken: 'ref',
      expiresInSec: 3600,
      ...overrides,
    })
  }

  it('createDefault includes all permissions enabled except emailEnabled', () => {
    const t = makeTenant()
    expect(t.effectivePermissions.whatsappEnabled).toBe(true)
    expect(t.effectivePermissions.telegramEnabled).toBe(true)
    expect(t.effectivePermissions.emailEnabled).toBe(false)
    expect(t.effectivePermissions.preSaleEnabled).toBe(true)
    expect(t.effectivePermissions.postSaleEnabled).toBe(true)
  })

  it('updatePermissions merges partial update', () => {
    const t = makeTenant()
    t.updatePermissions({ whatsappEnabled: false, preSaleEnabled: false })
    expect(t.effectivePermissions.whatsappEnabled).toBe(false)
    expect(t.effectivePermissions.preSaleEnabled).toBe(false)
    expect(t.effectivePermissions.telegramEnabled).toBe(true) // unchanged
  })

  it('canSendWhatsAppAlert returns false when whatsappEnabled is false', () => {
    const t = makeTenant()
    t.updatePermissions({ whatsappEnabled: false })
    expect(t.canSendWhatsAppAlert()).toBe(false)
  })

  it('canSendTelegramAlert returns false when telegramEnabled is false', () => {
    const t = makeTenant()
    t.updatePermissions({ telegramEnabled: false })
    expect(t.canSendTelegramAlert()).toBe(false)
  })
})
