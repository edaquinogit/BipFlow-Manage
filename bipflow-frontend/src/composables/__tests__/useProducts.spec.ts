import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProducts } from '../useProducts';
import ProductService from '../../services/product.service';

/**
 * 🛰️ BIPFLOW TELEMETRY: useProducts Unit Suite
 * Protocolo de testes para garantir a integridade dos ativos e mídias.
 */
describe('useProducts Composable', () => {
  
  // Reset de Mocks antes de cada teste para evitar poluição de estado
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * 🛡️ TEST CASE: MULTIPART DATA INTEGRITY
   * Verifica se o payload é convertido corretamente para FormData quando há imagem.
   */
  it('should transform product data into a valid FormData for media upload', async () => {
    // 1. SETUP: Criamos um Mock de Arquivo (Blob)
    const { createProduct } = useProducts();
    const mockFile = new File(['image-content'], 'test-product.png', { type: 'image/png' });
    
    const productInput = {
      name: 'Industrial Fabric NYC',
      price: 150,
      stock: 10,
      image: mockFile // O ponto crítico do bug
    };

    // 2. SPY: Monitoramos a chamada do Service para interceptar o que ele recebe
    const serviceSpy = vi.spyOn(ProductService, 'create').mockResolvedValue({
      id: 101,
      ...productInput,
      image: 'http://localhost:8000/media/products/test-product.png'
    } as any);

    // 3. EXECUTION
    await createProduct(productInput as any);

    // 4. ASSERTIONS: A "Prova Real"
    expect(serviceSpy).toHaveBeenCalled();
    
    // Pegamos o argumento enviado para o ProductService.create
    const sentPayload = serviceSpy.mock.calls[0][0];

    // Validação de Nível Sênior: O payload DEVE ser uma instância de FormData
    expect(sentPayload).toBeInstanceOf(FormData);
    
    // Verificamos se o arquivo binário está presente dentro do FormData
    const imageInPayload = (sentPayload as FormData).get('image');
    expect(imageInPayload).toBeInstanceOf(File);
    expect((imageInPayload as File).name).toBe('test-product.png');
  });

  /**
   * 📉 TEST CASE: REVENUE CALCULATION
   * Garante que a telemetria financeira ignore inconsistências de preço.
   */
  it('should format total revenue correctly even with string prices', () => {
    const { products, totalRevenue } = useProducts();
    
    products.value = [
      { id: 1, price: '100.00', stock: 2 } as any,
      { id: 2, price: 50, stock: 5 } as any
    ];

    // (100 * 2) + (50 * 5) = 450
    expect(totalRevenue.value).toBe('$450');
  });

  /**
   * 🛡️ TEST CASE: ERROR HANDLING
   * Verifica se o estado de erro é populado em caso de falha na NYC Station (API).
   */
  it('should populate error state when deployment fails', async () => {
    const { createProduct, error } = useProducts();
    
    vi.spyOn(ProductService, 'create').mockRejectedValue(new Error('Network Failure'));

    try {
      await createProduct({ name: 'Fail Test' } as any);
    } catch (e) {
      // Catch esperado
    }

    expect(error.value).toContain('Deployment failed');
  });
});