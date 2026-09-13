import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateTenantPermissionsUseCase } from '../application/use-cases/admin/UpdateTenantPermissionsUseCase.js'
import { Tenant } from '../domain/entities/Tenant.js'

describe('UpdateTenantPermissionsUseCase', () => {
  const mockRepo = {
    findBySellerId: vi.fn(),
    save: vi.fn(),
    findById: vi.fn(),
    getAll: vi.fn(),
  }

  beforeEach(() => vi.clearAllMocks())

  it('updates permissions and saves', async () => {
    const tenant = Tenant.createDefault({ id: '1', sellerId: '123', accessToken: 't', refreshToken: 'r', expiresInSec: 3600 })
    mockRepo.findBySellerId.mockResolvedValue(tenant)
    mockRepo.save.mockResolvedValue(undefined)

    const useCase = new UpdateTenantPermissionsUseCase(mockRepo as any)
    const result = await useCase.execute({ sellerId: '123', permissions: { whatsappEnabled: false } })

    expect(result.permissions.whatsappEnabled).toBe(false)
    expect(result.permissions.telegramEnabled).toBe(true)
    expect(mockRepo.save).toHaveBeenCalledOnce()
  })

  it('throws if tenant not found', async () => {
    mockRepo.findBySellerId.mockResolvedValue(null)
    const useCase = new UpdateTenantPermissionsUseCase(mockRepo as any)
    await expect(useCase.execute({ sellerId: 'nope', permissions: {} })).rejects.toThrow('Tenant not found')
  })
})
