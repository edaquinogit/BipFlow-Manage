import { CONFIG } from './config.js';

export class Utils {
  static formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: CONFIG.MOEDA });
  }
}
